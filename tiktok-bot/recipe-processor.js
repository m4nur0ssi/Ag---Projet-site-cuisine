require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const { postToWordPress } = require('./wordpress-poster.js');
const { sendNotificationEmail } = require('./email-notifier');

const { callGemini } = require('./gemini-config');
const { callClaude } = require('./claude-config');

// Extrait le NOM du restaurant depuis la légende TikTok (pour le titre de la fiche).
// Priorité au texte après un pin 📍 (les créateurs y mettent le nom du lieu).
function extractRestaurantName(desc) {
    if (!desc) return '';
    const s = String(desc).replace(/https?:\/\/\S+/g, ' ');
    const clean = (n) => {
        n = (n || '').split(/[|·\n]/)[0];
        n = n.replace(/#[^\s#]+/g, ' ');                                  // hashtags
        n = n.replace(/^[\s\p{Extended_Pictographic}•\-–—:.,]+/u, '');    // emojis/puces/pins en tête
        n = n.replace(/\s+[-–—]\s+.*$/, '');                              // " - Ville", " – 2e"
        n = n.replace(/\s+(?:à\s+)?(?:paris|lyon|marseille|bordeaux|lille|toulouse|nantes|nice)\b.*$/i, ''); // ville
        n = n.replace(/^(le |la |les |un |une |restaurant |resto |brunch |bar |chez )/i, '');
        n = n.replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim();
        return (n.length >= 2 && n.length <= 60) ? n : '';
    };
    // 1) Après un pin de localisation (📍 prioritaire, sinon 🍴/🍽️), avant le 1er hashtag
    const pin = s.match(/📍\s*([^#\n]{2,60})/) || s.match(/(?:🍴|🍽️)\s*([^#\n]{2,60})/);
    if (pin) { const n = clean(pin[1]); if (n) return n; }
    // 2) Motif "chez/au NOM"
    const chez = s.replace(/#[^\s#]+/g, ' ').match(/\b(?:chez|au|à la|resto)\s+([A-ZÉÈÀ][\w'’&\- ]{2,50})/);
    if (chez) { const n = clean(chez[1]); if (n) return n; }
    return '';
}

async function isRecipeWithGemini(description, title) {
    const desc = (description || '').toLowerCase();
    const isManual = desc.includes('iphone') || desc.includes('remote') || (title && title.toLowerCase().includes('iphone'));

    // On a réduit la sévérité : si c'est manuel ou un "Stub" WordPress, on tente l'analyse même avec peu de texte
    const isStub = title && title.includes('attente');
    if (!description || description.trim().length < 5) {
        if (!isManual && !isStub) return null;
        console.log(`   ⚠️ Description très faible (${description}), mais mode manuel/stub détecté. On tente l'analyse Gemini...`);
    }

    const prompt = `Analyse ce contenu TikTok.
    IMPORTANT: Si le contenu ne parle absolument pas de NOURRITURE, de RECETTE ou de CUISINE (ex: c'est juste de la tech, de la danse, de la mode), réponds exactement : {"isRecipe": false}.

    LANGUE — RÈGLE ABSOLUE : la sortie doit être ENTIÈREMENT EN FRANÇAIS, y compris
    si la source est en anglais ou dans une autre langue. Traduis TOUT en français
    naturel : le titre (recipeName), le résumé (summary), CHAQUE ingrédient et CHAQUE
    étape. Aucun mot anglais ne doit rester dans le résultat (ex: "Black Forest
    Cupcakes" -> "Cupcakes Forêt-Noire" ; "BBQ Cheddar Glazed Chicken Breasts" ->
    "Blancs de poulet laqués au cheddar et sauce barbecue"). Garde les noms propres
    de lieux/marques tels quels, mais traduis tout le reste.

    Si c'est une recette, extrais les détails au format JSON.
    Titre détecté : "${title || ''}"
    Description : "${description}"

    Format JSON attendu: {
        "isRecipe": true,
        "recipeName": "Nom de la recette EN FRANÇAIS",
        "summary": "Petit résumé EN FRANÇAIS",
        "ingredients": ["ingrédient en français", "..."],
        "steps": ["étape en français", "..."],
        "category": "aperitifs|entrees|plats|desserts|patisserie|vegetarien|glaces|rafraichissements|voila-lete|cest-lhiver",
        "tags": ["tag1"],
    }
    
    RÈGLES POUR LA CATÉGORIE (la catégorie = le TYPE de plat, PAS la saison ni le régime) :
    - RÈGLE PRIORITAIRE : si c'est un plat SALÉ dont l'ingrédient principal est de la viande, de la volaille,
      du poisson ou des fruits de mer -> catégorie "plats" OBLIGATOIRE. La saison (été/hiver), le régime
      (healthy, végé…) et le pays vont dans les TAGS, JAMAIS dans la catégorie.
    - Si glace, sorbet, gelato, granita -> catégorie "glaces"
    - Si cocktail, smoothie, jus, limonade, citronnade, boisson fraîche, mocktail, milkshake -> catégorie "rafraichissements"
    - Si gâteau, tarte sucrée, viennoiserie, croissant, brioche -> catégorie "patisserie"
    - "voila-lete" / "cest-lhiver" ne sont utilisables comme CATÉGORIE que pour une boisson ou un dessert
      de saison. Pour un plat salé, la saison est UNIQUEMENT un tag ("Voilà l'été" / "C'est l'hiver").
    
    RÈGLES POUR LES TAGS :
    IMPORTANT : les tags sont CUMULATIFS. Une recette doit recevoir TOUS les tags qui s'appliquent
    (pays + régime + saison + type de plat). Exemple : une salade grecque estivale ->
    ["Grèce", "Voilà l'été", "Salades"]. Une pâtisserie italienne -> ["Italie"].
    1. RÉGIME/TENDANCE : Si sain/équilibré -> "Healthy". Si végétarien -> "Végé". Si grillade/barbecue -> "Barbecue". Si ingrédients basiques/économiques -> "Pas cher".
       Si clairement sans gluten -> "Sans gluten". Si sans lactose -> "Sans lactose". Si sans sucre -> "Sans sucre". Si léger/minceur -> "Minceur".
    2. PAYS : Ajoute TOUJOURS un tag pays si l'origine de la recette est identifiable (nom du plat,
    ingrédients typiques, technique). Choisis UN pays dans cette liste : France, Italie, Espagne, Grèce, Liban, USA, Mexique, Orient, Asie, Afrique.
    Si le pays d'origine est évident mais n'est pas dans la liste, utilise le plus proche ou "Afrique".
    N'omets le pays QUE si l'origine est vraiment indéterminable.
    3. SAISONS/ÉVÉNEMENTS : Si la recette contient de l'agneau ou lamb -> ajoute le tag "Pâques". Si recette typique de Noël -> ajoute "Noël". Si estival -> ajoute "Voilà l'été". Si hivernal -> ajoute "C'est l'hiver".
    4. NE PAS utiliser le tag "Famille" (supprimé).
    5. TYPE DE PLAT (ajoute UN de ces tags si la recette correspond, peu importe la catégorie) :
       - Si c'est une salade (composée, verte, de pâtes, de fruits, de quinoa, bowl froid) -> ajoute "Salades".
       - Si c'est une soupe, velouté, bouillon, gaspacho, potage, minestrone, ramen -> ajoute "Soupes".
       - Si c'est un gratin (dauphinois, parmentier, tian, lasagnes au four, plat au four nappé de fromage/béchamel) -> ajoute "Gratins".
       - Si la recette est piquante/relevée (piment, harissa, sambal, curry fort, chili, sriracha, paprika fumé en quantité, jalapeño, habanero) -> ajoute "Épicé".
       - Si c'est une tarte (sucrée ou salée, quiche, tourte) -> ajoute "Tarte".
       - Si c'est un plat de pâtes -> ajoute "Pâtes". Si c'est une sauce -> ajoute "Sauces".
       - Si l'ingrédient principal est un poisson ou un fruit de mer (saumon, thon, cabillaud, dorade, crevettes, gambas, moules, Saint-Jacques, crabe, homard, calamar, poulpe) -> ajoute "Poissons et crustacés".
       - Si c'est un sandwich (burger, wrap, panini, croque-monsieur, bagel, hot-dog, kebab, pita, club) -> ajoute "Sandwichs".`;

    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.5-pro', 'gemini-pro-latest'];

    for (const model of models) {
        try {
            console.log(`   🧠 Analyse Gemini (${model})...`);
            const parsed = await callGemini(prompt, model, true);

            if (parsed) {
                if (parsed.isRecipe) {
                    console.log(`   ✅ Succès avec ${model} !`);
                    parsed.recipeName = parsed.recipeName || parsed.title || parsed.name || "Nouvelle Recette";
                    return parsed;
                } else {
                    console.log(`   🚫 ${model} dit : Ce n'est pas une recette.`);
                    return parsed;
                }
            }
        } catch (e) {
            if (e.message === 'QUOTA_EXCEEDED') {
                console.error(`   🚨 Quota Gemini épuisé — Tentative avec Claude (Anthropic)...`);
                break; // Sortir de la boucle Gemini et tenter Claude
            }
            console.error(`   ❌ Exception ${model}:`, e.message);
        }
    }

    // 🔄 FALLBACK : Claude (Anthropic) si Gemini est en quota ou indisponible
    if (process.env.ANTHROPIC_API_KEY) {
        try {
            console.log(`   🤖 Fallback Claude (claude-sonnet-4-6)...`);
            const parsed = await callClaude(prompt, 'claude-sonnet-4-6');
            if (parsed) {
                if (parsed.isRecipe) {
                    console.log(`   ✅ Succès avec Claude !`);
                    parsed.recipeName = parsed.recipeName || parsed.title || parsed.name || "Nouvelle Recette";
                    return parsed;
                } else {
                    console.log(`   🚫 Claude dit : Ce n'est pas une recette.`);
                    return parsed;
                }
            }
        } catch (e) {
            console.error(`   ❌ Exception Claude:`, e.message);
        }
    } else {
        console.error(`   ⚠️ ANTHROPIC_API_KEY manquante — impossible d'utiliser Claude comme fallback.`);
    }

    return null;
}

/**
 * Résout une URL courte TikTok (vm.tiktok.com, vt.tiktok.com) vers l'URL longue.
 * Retourne l'URL finale et l'ID vidéo si trouvé.
 */
async function resolveShortUrl(videoUrl) {
    const isShort = /vm\.tiktok\.com|vt\.tiktok\.com/.test(videoUrl);
    if (!isShort) return { resolvedUrl: videoUrl };

    console.log(`    🔗 URL courte détectée (${videoUrl}), résolution...`);
    try {
        // Utiliser un HEAD pour suivre les redirects sans télécharger le body
        const res = await fetch(videoUrl, {
            method: 'GET',
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            }
        });
        const finalUrl = res.url || videoUrl;
        const idMatch = finalUrl.match(/\/video\/(\d+)/);
        const videoId = idMatch ? idMatch[1] : null;
        console.log(`    ✅ URL résolue : ${finalUrl} (ID: ${videoId || 'inconnu'})`);
        return { resolvedUrl: finalUrl, videoId };
    } catch (e) {
        console.log(`    ⚠️ Résolution URL courte échouée : ${e.message}`);
        return { resolvedUrl: videoUrl };
    }
}

async function fetchTikTokMetadata(videoUrl) {
    if (!videoUrl) return null;
    try {
        const sessionId = process.env.TIKTOK_SESSION_ID;
        const webId = process.env.TIKTOK_WEBID;
        const cookieStr = [
            sessionId ? `sessionid=${sessionId}` : '',
            webId ? `ttwid=${webId}` : ''
        ].filter(Boolean).join('; ');

        // ── Étape 0 : Résoudre les URLs courtes AVANT tout le reste ──────────────
        const { resolvedUrl, videoId: resolvedId } = await resolveShortUrl(videoUrl);
        const effectiveUrl = resolvedUrl;

        const res = await fetch(effectiveUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Cookie': cookieStr
            },
            redirect: 'follow'
        });
        const html = await res.text();
        const finalUrl = res.url || effectiveUrl;

        // Tentative 1 : JSON Rehydration (Le plus fiable)
        const jsonMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/);
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[1]);
                const scope = data.__DEFAULT_SCOPE__ || {};
                const itemStruct = scope['webapp.video-detail']?.itemInfo?.itemStruct ||
                    scope['webapp.reflow.video.detail']?.itemInfo?.itemStruct;

                if (itemStruct) {
                    return {
                        title: itemStruct.desc,
                        description: itemStruct.desc,
                        finalUrl: finalUrl,
                        author: itemStruct.author?.uniqueId
                    };
                }
            } catch (e) {
                console.log(`    ⚠️ Parse JSON rehydration échoué: ${e.message}`);
            }
        }

        // Tentative 2 : OEmbed API (Très robuste pour la description)
        console.log(`    🔍 Récupération via OEmbed...`);
        try {
            // Priorité : ID extrait depuis l'URL résolue ou la finalUrl
            const idFromFinal = finalUrl.match(/\/video\/(\d+)/)?.[1];
            const videoId = idFromFinal || resolvedId || videoUrl.match(/\/video\/(\d+)/)?.[1];

            if (videoId) {
                const oEmbedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@a/video/${videoId}`;
                const oRes = await fetch(oEmbedUrl);
                const oData = await oRes.json();
                if (oData && oData.title) {
                    console.log(`    ✅ Infos récupérées via OEmbed (ID: ${videoId}).`);
                    return {
                        title: oData.title.split('\n')[0],
                        description: oData.title,
                        finalUrl: finalUrl,
                        author: oData.author_name
                    };
                }
            } else {
                // Fallback si toujours pas d'ID : OEmbed direct sur l'URL courte originale
                const oEmbedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
                console.log(`    🔍 OEmbed direct sur URL courte : ${oEmbedUrl}`);
                const oRes = await fetch(oEmbedUrl);
                const oData = await oRes.json();
                if (oData && oData.title) {
                    console.log(`    ✅ Infos récupérées via OEmbed (URL courte).`);
                    // Extraire l'ID vidéo depuis l'URL OEmbed retournée
                    const embedUrl = oData.embed_product_id || '';
                    const idFromOEmbed = embedUrl || oData.video_id || null;
                    const longUrl = idFromOEmbed
                        ? `https://www.tiktok.com/@${oData.author_unique_id || 'a'}/video/${idFromOEmbed}`
                        : finalUrl;
                    return {
                        title: oData.title.split('\n')[0],
                        description: oData.title,
                        finalUrl: longUrl,
                        author: oData.author_name
                    };
                }
            }
        } catch (e) {
            console.log(`    ⚠️ OEmbed échoué : ${e.message}`);
        }

        // Tentative 3 : Meta Tags classiques (Fallback)
        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        const metaDescMatch = html.match(/<meta name="description" content="(.*?)">/)
        const ogDescMatch = html.match(/<meta property="og:description" content="(.*?)">/);

        const bestDesc = (metaDescMatch ? metaDescMatch[1] : (ogDescMatch ? ogDescMatch[1] : (titleMatch ? titleMatch[1] : '')));

        if (bestDesc && !bestDesc.includes('TikTok - Make Your Day')) {
            return {
                title: bestDesc,
                description: bestDesc,
                finalUrl: finalUrl
            };
        }
    } catch (e) {
        console.error('    ❌ Erreur fetchTikTokMetadata:', e.message);
    }
    return null;
}

async function checkWordPressDuplicate(videoUrl) {
    if (!videoUrl) return false;
    try {
        const { extractTikTokId } = require('./wordpress-poster');
        const videoId = extractTikTokId(videoUrl);

        const wpBase = (process.env.WP_URL || '').replace(/\/$/, '');

        // On cherche par l'ID de la vidéo s'il existe, sinon par l'URL
        const query = videoId ? videoId : videoUrl;
        const res = await fetch(`${wpBase}/wp-json/wp/v2/posts?search=${encodeURIComponent(query)}&_fields=id,link,content,title&per_page=5`);

        if (res.ok) {
            const posts = await res.json();
            // Filtrage strict : on vérifie que l'un des posts correspond vraiment à la vidéo
            const found = posts.some(p => {
                const content = (p.content?.rendered || '').toLowerCase();
                const title = (p.title?.rendered || '').toLowerCase();
                const link = (p.link || '').toLowerCase();

                if (videoId && (content.includes(videoId) || link.includes(videoId))) return true;
                if (videoUrl && (content.includes(videoUrl) || link.includes(videoUrl))) return true;
                return false;
            });
            if (found) {
                console.log(`   ⛔ Doublon détecté via WordPress.`);
                return true;
            }
        }
    } catch (e) {
        console.warn(`   ⚠️ Erreur lors de la vérification de doublon: ${e.message}`);
    }
    return false;
}

async function processRecipe({ videoUrl, description, author, title, country }) {
    if (!videoUrl || videoUrl === '...') {
        return false;
    }
    console.log(`\n📋 Analyse : ${videoUrl}`);

    // ── Étape 0 : Résoudre l'URL courte en URL longue AVANT tout ────────────────
    // Ex: vm.tiktok.com/ZNRVdYEyx/ → tiktok.com/@user/video/1234567890
    const isShort = /vm\.tiktok\.com|vt\.tiktok\.com/.test(videoUrl);
    if (isShort) {
        console.log(`   🔗 URL courte détectée, résolution préalable...`);
        const { resolvedUrl } = await resolveShortUrl(videoUrl);
        if (resolvedUrl && resolvedUrl !== videoUrl) {
            console.log(`   ✅ URL résolue : ${resolvedUrl}`);
            videoUrl = resolvedUrl;
        } else {
            console.log(`   ⚠️ Résolution échouée, on continue avec l'URL courte.`);
        }
    }

    // Recovery
    console.log(`   🔍 Récupération des infos TikTok...`);
    const metadata = await fetchTikTokMetadata(videoUrl);
    const isGeneric = !description || description.toLowerCase().includes('recette iphone') || description.toLowerCase().includes('remote');

    if (metadata) {
        description = isGeneric ? metadata.description : description;
        // Si on a obtenu une URL longue avec l'ID, on l'utilise
        if (metadata.finalUrl && metadata.finalUrl !== videoUrl) {
            videoUrl = metadata.finalUrl;
        }
        console.log(`   ✅ Infos ok : "${metadata.title?.substring(0, 50)}..."`);
    } else {
        console.log(`   ⚠️ Impossible de lire les infos TikTok, utilisation de la description brute.`);
    }

    // Duplicate Check
    console.log(`   🔎 Vérification doublon sur WordPress...`);
    if (await checkWordPressDuplicate(videoUrl)) {
        console.log('   🚫 Déjà sur WordPress.');
        return true; // Consider success for queue management
    }

    // Fiche restaurant ("Comme au resto") : ce n'est PAS une recette → il ne faut
    // pas l'abandonner au test isRecipe ci-dessous. On la publie quand même.
    const isRestaurant = !!(country && country.toLowerCase().includes('restaurant'));

    console.log(`   🧠 Analyse de la recette par l'IA...`);
    let analysis = await isRecipeWithGemini(description, title);

    let isStub = false;
    if (!analysis || !analysis.isRecipe) {
        if (isRestaurant) {
            // Restaurant reconnu comme "non-recette" par l'IA → on force une fiche minimale
            // (le titre + la description deviennent le contenu ; catégorie forcée plus bas).
            analysis = analysis && typeof analysis === 'object' ? analysis : {};
            analysis.isRecipe = true;
            analysis.recipeName = analysis.recipeName || metadata?.title || title || 'Restaurant';
            analysis.category = 'restaurant';
            analysis.tags = Array.isArray(analysis.tags) ? analysis.tags : [];
            analysis.ingredients = Array.isArray(analysis.ingredients) ? analysis.ingredients : [];
            analysis.steps = Array.isArray(analysis.steps) && analysis.steps.length ? analysis.steps : (description ? [description] : []);
            analysis.description = analysis.description || description || '';
            console.log('   🍽️ Restaurant : pas une recette pour l\'IA, mais fiche resto forcée.');
        } else {
            console.log('   🚫 Ce n\'est pas une recette selon l\'IA (ou erreur Quota).');
            return false;
        }
    }

    if (analysis.isQuotaExceeded) {
        console.log('   ⏳ Quota Gemini dépassé — recette laissée en file d\'attente pour retry demain (reset minuit UTC).');
        return false; // La recette reste dans la queue GitHub, sera retraitée automatiquement
    }

    if (['dessert', 'patisserie', 'sucré'].some(c => analysis.category.toLowerCase().includes(c))) analysis.category = 'desserts';

    // ================================================================
    // POST-TRAITEMENT INTELLIGENT : smart tagging & catégorisation
    // ================================================================
    const allTextLower = (
        (analysis.recipeName || '') + ' ' +
        (analysis.summary || '') + ' ' +
        ((analysis.ingredients || []).join(' '))
    ).toLowerCase();

    if (!analysis.tags) analysis.tags = [];

    // Agneau ou lamb → Pâques automatiquement
    if (allTextLower.includes('agneau') || allTextLower.includes('lamb')) {
        if (!analysis.tags.some(t => t.toLowerCase().includes('paques') || t.toLowerCase().includes('pâques'))) {
            analysis.tags.push('Pâques');
        }
    }

    // Glace/sorbet/gelato → catégorie glaces
    if (allTextLower.includes('glace') || allTextLower.includes('sorbet') || allTextLower.includes('gelato') || allTextLower.includes('granita')) {
        if (['gâteau', 'cake', 'bûche', 'tarte'].some(k => allTextLower.includes(k))) {
            // Pâtisserie glacée → reste desserts/patisserie + tag Glaces
            if (!analysis.tags.includes('Glaces')) analysis.tags.push('Glaces');
        } else {
            analysis.category = 'glaces';
        }
    }

    // Cocktail/smoothie/boisson fraîche → rafraichissements
    if (['cocktail', 'smoothie', 'jus de', 'limonade', 'citronnade', 'mocktail', 'frappé', 'milkshake'].some(k => allTextLower.includes(k))) {
        analysis.category = 'rafraichissements';
    }

    // Override si l'utilisateur a choisi une thématique depuis le raccourci iPhone
    if (country) {
        const cl = country.toLowerCase();
        if (cl.includes('glace')) analysis.category = 'glaces';
        if (cl.includes('rafra')) analysis.category = 'rafraichissements';
        if (cl.includes('été') || cl.includes('ete')) {
            analysis.category = 'voila-lete';
            if (!analysis.tags.includes("Voilà l'été")) analysis.tags.push("Voilà l'été");
        }
        if (cl.includes('hiver')) {
            analysis.category = 'cest-lhiver';
            if (!analysis.tags.includes("C'est l'hiver")) analysis.tags.push("C'est l'hiver");
        }
        if (cl.includes('paques') || cl.includes('pâques')) {
            if (!analysis.tags.some(t => t.toLowerCase().includes('paques') || t.toLowerCase().includes('pâques'))) {
                analysis.tags.push('Pâques');
            }
        }
        // Restaurant : fiche "Comme au resto" → catégorie restaurant + sous-type classé
        // automatiquement (Brasserie / Italien / Asiatique / Gastro / Salon de thé).
        if (cl.includes('restaurant')) {
            analysis.category = 'restaurant';
            const blob = `${title || ''} ${description || ''} ${(analysis.tags || []).join(' ')}`.toLowerCase();
            let sub = 'resto-brasserie';
            if (/ital|pizz|pasta|pâtes|trattoria|osteria/.test(blob)) sub = 'resto-italien';
            else if (/asiat|japon|sushi|tha[iï]|chin|vietnam|cor[ée]|ramen|wok|nem|dim sum|bao/.test(blob)) sub = 'resto-asiatique';
            else if (/gastro|[ée]toil|michelin|gastronomique|fine dining|d[ée]gustation/.test(blob)) sub = 'resto-gastro';
            else if (/salon de th|th[ée]|p[âa]tiss|brunch|go[ûu]ter|caf[ée]|cocooning/.test(blob)) sub = 'resto-salon-de-the';
            if (!analysis.tags.includes(sub)) analysis.tags.push(sub);
        }
        // NB : Tarte + régimes (sans gluten/lactose/sucre/sel, minceur) sont ajoutés comme
        // tag automatiquement par wordpress-poster.js (push générique de manualCountry).
    }

    // ================================================================
    // FILET DE SÉCURITÉ : un plat SALÉ viande/poisson est TOUJOURS "plats".
    // La saison (été/hiver) devient un tag, jamais la catégorie. Ainsi le
    // Menu IA (qui filtre category === 'plats') retrouve bien ces recettes,
    // au lieu de les rater et de laisser fuiter des desserts.
    // ================================================================
    const MEAT_FISH_RX = /\b(poulet|volaille|dinde|canard|b(?:oeuf|œuf|ouf)|bourguignon|steak|bavette|paleron|entrec[ôo]te|rumsteck|veau|agneau|mouton|gigot|porc|lardon|jambon|bacon|saucisse|chorizo|merguez|c[ôo]telette|escalope|magret|viande|kefta|k[ée]fta|poisson|saumon|thon|cabillaud|colin|merlu|lieu|dorade|bar|truite|sardine|maquereau|crevette|gambas|moule|saint-jacques|st-jacques|crabe|homard|calamar|calmar|poulpe|seiche|encornet|fruits de mer)\b/i;
    const SWEET_RX = /\b(dessert|g[âa]teau|tarte sucr|p[âa]tisserie|glace|sorbet|gelato|cr[êe]pe sucr|g[âa]ufre sucr|cookie|muffin|cupcake|brownie|cheesecake|tiramisu|mousse au chocolat|cr[èe]me dessert|panna cotta|clafoutis|flan|pancake)\b/i;

    const isSweetCat = ['desserts', 'patisserie', 'glaces', 'rafraichissements'].includes((analysis.category || '').toLowerCase());
    const looksSweet = isSweetCat || SWEET_RX.test(allTextLower);
    const hasMeatFish = MEAT_FISH_RX.test(allTextLower);

    if (hasMeatFish && !looksSweet) {
        const seasonalTag = { 'voila-lete': "Voilà l'été", 'cest-lhiver': "C'est l'hiver" };
        const curCat = (analysis.category || '').toLowerCase();
        if (seasonalTag[curCat] && !analysis.tags.includes(seasonalTag[curCat])) {
            analysis.tags.push(seasonalTag[curCat]);
        }
        if (curCat !== 'plats' && curCat !== 'restaurant') {
            console.log(`   🍽️ Filet de sécurité : plat salé viande/poisson -> catégorie "plats" (était "${analysis.category}").`);
            analysis.category = 'plats';
        }
    }

    // Supprimer le tag Famille s'il a été ajouté par l'IA (supprimé de la logique)
    analysis.tags = analysis.tags.filter(t => !t.toLowerCase().includes('famille'));

    // Restaurant : le TITRE doit être UNIQUEMENT le nom du resto (pas la légende TikTok).
    // Heuristique : texte après le 📍 (ou après "à/chez"), avant le 1er hashtag.
    if (isRestaurant) {
        const extracted = extractRestaurantName(description || metadata?.title || '');
        if (extracted) analysis.recipeName = extracted;
        else if (!analysis.recipeName || analysis.recipeName.length > 60) analysis.recipeName = (metadata?.title || title || 'Restaurant').split(/[#\n]/)[0].trim().slice(0, 60);
        console.log(`   🍽️ Titre resto : "${analysis.recipeName}"`);
    }

    let photoUrl = '';

    console.log(`   📝 Publication sur WordPress...`);
    const { postToWordPress } = require('./wordpress-poster');
    author = 'manu'; // Default author
    const postResult = await postToWordPress({
        ...analysis,
        title: analysis.recipeName,
        tiktokUrl: videoUrl,
        tiktokAuthor: author,
        photoUrl,
        manualCountry: country,
        status: isStub ? 'draft' : 'publish'
    });

    if (postResult?.success) {
        console.log(`   🚀 SUCCESS : "${analysis.recipeName}" est en ligne !`);
        console.log(`   📝 Brouillon à review : ${process.env.WP_URL}/wp-admin/post.php?post=${postResult.postId}&action=edit`);

        // 📱 Sync automatique de l'app iPhone après chaque publication
        const ghPat = process.env.GH_PAT_SYNC;
        if (ghPat) {
            try {
                console.log(`   📱 Envoi du signal de sync à l'app iPhone...`);
                const nodeFetch = require('node-fetch');
                const ghRes = await nodeFetch('https://api.github.com/repos/m4nur0ssi/AG-App-Iphone-cuisine/dispatches', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/vnd.github+json',
                        'Authorization': 'Bearer ' + ghPat,
                        'X-GitHub-Api-Version': '2022-11-28',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        event_type: 'wp_full_sync',
                        client_payload: { trigger: 'recipe-published', source: 'site-cuisine', recipe: analysis.recipeName }
                    })
                });
                if (ghRes.status === 204) {
                    console.log(`   ✅ Signal iPhone envoyé !`);
                } else {
                    const errText = await ghRes.text();
                    console.warn(`   ⚠️ Signal iPhone HTTP ${ghRes.status}: ${errText.substring(0, 100)}`);
                }
            } catch (e) {
                console.warn(`   ⚠️ Impossible d'envoyer le signal iPhone: ${e.message}`);
            }
        } else {
            console.log(`   ℹ️ GH_PAT_SYNC absent — sync iPhone ignorée (OK en GitHub Actions, le wp-sync.yml s'en charge).`);
        }

        return analysis.recipeName;
    } else {
        console.log(`   ❌ Échec de la publication WordPress.`);
        return false;
    }
}

module.exports = { processRecipe, fetchTikTokMetadata, checkWordPressDuplicate, isRecipeWithGemini };
