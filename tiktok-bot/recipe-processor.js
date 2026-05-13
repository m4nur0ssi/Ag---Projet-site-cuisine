require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const { postToWordPress } = require('./wordpress-poster.js');
const { sendNotificationEmail } = require('./email-notifier');
const { searchPhoto } = require('./photo-search');

const { callGemini } = require('./gemini-config');
const { callClaude } = require('./claude-config');

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
    
    Si c'est une recette, extrais les détails au format JSON.
    Titre détecté : "${title || ''}"
    Description : "${description}"
    
    Format JSON attendu: { 
        "isRecipe": true, 
        "recipeName": "Nom de la recette", 
        "summary": "Petit résumé", 
        "ingredients": ["ing1", "ing2"], 
        "steps": ["étape 1", "étape 2"], 
        "category": "aperitifs|entrees|plats|desserts|patisserie|vegetarien|glaces|rafraichissements|voila-lete|cest-lhiver", 
        "tags": ["tag1"], 
        "photoSearchKeyword": "mot clé pour photo" 
    }
    
    RÈGLES POUR LA CATÉGORIE :
    - Si glace, sorbet, gelato, granita -> catégorie "glaces"
    - Si cocktail, smoothie, jus, limonade, citronnade, boisson fraîche, mocktail, milkshake -> catégorie "rafraichissements"
    - Si gâteau, tarte, viennoiserie, croissant, brioche -> catégorie "patisserie"
    - Si recette estivale, fruits d'été, barbecue, salade fraîche, plage -> catégorie "voila-lete"
    - Si soupe d'hiver, raclette, fondue, gratins d'hiver, plat mijoté de saison froide -> catégorie "cest-lhiver"
    
    RÈGLES POUR LES TAGS :
    1. RÉGIME/TENDANCE : Si sain/équilibré -> "Healthy". Si végétarien -> "Végé". Si grillade/barbecue -> "Barbecue". Si ingrédients basiques/économiques -> "Pas cher".
    2. PAYS : Choisis UN pays dans cette liste : France, Italie, Espagne, Grèce, Liban, USA, Mexique, Orient, Asie, Afrique.
    Si le pays d'origine est évident mais n'est pas dans la liste, utilise le plus proche ou "Afrique".
    Si ce n'est pas clair, laisse le champ tags vide.
    3. SAISONS/ÉVÉNEMENTS : Si la recette contient de l'agneau ou lamb -> ajoute le tag "Pâques". Si recette typique de Noël -> ajoute "Noël". Si estival -> ajoute "Voilà l'été". Si hivernal -> ajoute "C'est l'hiver".
    4. NE PAS utiliser le tag "Famille" (supprimé).
    5. TYPE DE PLAT (ajoute UN de ces tags si la recette correspond, peu importe la catégorie) :
       - Si c'est une salade (composée, verte, de pâtes, de fruits, de quinoa, bowl froid) -> ajoute "Salades".
       - Si c'est une soupe, velouté, bouillon, gaspacho, potage, minestrone, ramen -> ajoute "Soupes".
       - Si c'est un gratin (dauphinois, parmentier, tian, lasagnes au four, plat au four nappé de fromage/béchamel) -> ajoute "Gratins".
       - Si la recette est piquante/relevée (piment, harissa, sambal, curry fort, chili, sriracha, paprika fumé en quantité, jalapeño, habanero) -> ajoute "Épicé".`;

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

    console.log(`   🧠 Analyse de la recette par l'IA...`);
    let analysis = await isRecipeWithGemini(description, title);

    let isStub = false;
    if (!analysis || !analysis.isRecipe) {
        console.log('   🚫 Ce n\'est pas une recette selon l\'IA (ou erreur Quota).');
        return false;
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
    }

    // Supprimer le tag Famille s'il a été ajouté par l'IA (supprimé de la logique)
    analysis.tags = analysis.tags.filter(t => !t.toLowerCase().includes('famille'));

    console.log(`   🖼️ Recherche d'une photo pour: ${analysis.photoSearchKeyword}...`);
    let photoUrl = '';
    const { findPhoto } = require('./photo-search');
    try { photoUrl = await findPhoto(analysis.photoSearchKeyword || analysis.recipeName); } catch (e) { }

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

        // Sync local et deploiement Vercel
        console.log(`   📦 Synchro local et déploiement Vercel...`);
        const { execSync } = require('child_process');
        try { execSync(`node sync-recipes.js --recent`, { cwd: path.join(__dirname, '..') }); } catch (e) { }

        if (!process.env.GITHUB_ACTIONS) {
            const deployCmd = 'git add . && git commit -m "🍳 Nouvelle recette: ' + analysis.recipeName + '" && git push origin main';
            require('child_process').exec(deployCmd, { cwd: path.join(__dirname, '..') });
        }

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
