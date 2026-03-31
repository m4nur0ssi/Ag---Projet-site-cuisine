require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const { postToWordPress } = require('./wordpress-poster.js');
const { sendNotificationEmail } = require('./email-notifier');
const { searchPhoto } = require('./photo-search');

const { callGemini } = require('./gemini-config');

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
        "category": "aperitifs|entrees|plats|desserts|patisserie|vegetarien", 
        "tags": ["tag1"], 
        "photoSearchKeyword": "mot clé pour photo" 
    }
    
    IMPORTANCE POUR LES TAGS : 
    1. RÉGIME/TENDANCE : Si sain/équilibré -> "Healthy". Si végétarien -> "Végé". Si convivial/enfants -> "Famille". Si grillade -> "Barbecue". Si ingrédients basiques/économiques -> "Pas cher".
    2. PAYS : Choisis UN pays dans cette liste : France, Italie, Espagne, Grèce, Liban, USA, Mexique, Orient, Asie, Afrique.
    Si le pays d'origine est évident mais n'est pas dans la liste, utilise le plus proche ou "Afrique". 
    Si ce n'est pas clair, laisse le champ tags vide.`;

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
                console.error(`   🚨 Toutes les clés API ont épuisé leur quota.`);
                return { isRecipe: true, isQuotaExceeded: true };
            }
            console.error(`   ❌ Exception ${model}:`, e.message);
        }
    }
    return null;
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

        const res = await fetch(videoUrl, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Cookie': cookieStr
            },
            redirect: 'follow'
        });
        const html = await res.text();
        
        // Tentative 1 : JSON Rehydration (Le plus fiable)
        const jsonMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[1]);
            const scope = data.__DEFAULT_SCOPE__ || {};
            // On cherche dans plusieurs chemins possibles (desktop vs mobile/reflow)
            const itemStruct = scope['webapp.video-detail']?.itemInfo?.itemStruct || 
                               scope['webapp.reflow.video.detail']?.itemInfo?.itemStruct;
            
            if (itemStruct) {
                return { 
                    title: itemStruct.desc, 
                    description: itemStruct.desc, 
                    finalUrl: res.url,
                    author: itemStruct.author?.uniqueId
                };
            }
        }

        // Fallback: OEmbed API (Très robuste pour la description)
        console.log(`    🔍 Récupération via OEmbed...`);
        try {
            const videoIdMatch = videoUrl.match(/\/(?:video|v)\/(\d+)/);
            let videoId = videoIdMatch ? videoIdMatch[1] : null;
            if (videoId) {
                // Essayer l'URL OEmbed avec un auteur générique @a (très robuste, évite les 400 sur URLs mobiles/short)
                const oEmbedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@a/video/${videoId}`;
                const oRes = await fetch(oEmbedUrl);
                const oData = await oRes.json();
                if (oData && oData.title) {
                    console.log(`    ✅ Infos récupérées via OEmbed.`);
                    return {
                        title: oData.title.split('\n')[0],
                        description: oData.title,
                        finalUrl: res.url, // Use the final URL from the initial fetch
                        author: oData.author_name
                    };
                }
            }
        } catch (e) {
            console.log(`    ⚠️ OEmbed échoué : ${e.message}`);
        }

        // Tentative 2 : Meta Tags classiques (Fallback)
        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        const metaDescMatch = html.match(/<meta name="description" content="(.*?)">/);
        const ogDescMatch = html.match(/<meta property="og:description" content="(.*?)">/);
        
        const bestDesc = (metaDescMatch ? metaDescMatch[1] : (ogDescMatch ? ogDescMatch[1] : (titleMatch ? titleMatch[1] : '')));
        
        if (bestDesc && !bestDesc.includes('TikTok - Make Your Day')) {
            return { 
                title: bestDesc, 
                description: bestDesc,
                finalUrl: res.url 
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
        const res = await fetch(`${wpBase}/wp-json/wp/v2/posts?search=${encodeURIComponent(query)}&_fields=id,link`);
        
        if (res.ok) {
            const posts = await res.json();
            // Filtrage strict : on vérifie que l'un des posts correspond vraiment à la vidéo
            const found = posts.some(p => {
                if (!p.link) return false;
                if (videoId && p.link.includes(videoId)) return true;
                if (videoUrl && p.link.includes(videoUrl)) return true;
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
    
    // Recovery
    console.log(`   🔍 Récupération des infos TikTok...`);
    const metadata = await fetchTikTokMetadata(videoUrl);
    const isGeneric = !description || description.toLowerCase().includes('recette iphone') || description.toLowerCase().includes('remote');
    
    if (metadata) {
        description = isGeneric ? metadata.description : description;
        videoUrl = metadata.finalUrl || videoUrl;
        console.log(`   ✅ Infos ok : "${metadata.title?.substring(0, 30)}..."`);
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
        console.log('   ⚠️ Quota IA dépassé. Création d\'une recette temporaire (Stub)...');
        isStub = true;
        analysis = {
            recipeName: title || "Recette TikTok en attente",
            summary: "Cette recette est en cours d'analyse par notre IA. Elle sera complétée automatiquement très bientôt ! ✨",
            ingredients: [],
            steps: [],
            category: 'Plats',
            tags: ['À ENRICHIR', 'Stub'],
            photoSearchKeyword: title,
            isDraft: true
        };
    }

    if (['dessert', 'patisserie', 'sucré'].some(c => analysis.category.toLowerCase().includes(c))) analysis.category = 'desserts';

    console.log(`   🖼️ Recherche d'une photo pour: ${analysis.photoSearchKeyword}...`);
    let photoUrl = '';
    const { findPhoto } = require('./photo-search');
    try { photoUrl = await findPhoto(analysis.photoSearchKeyword || analysis.recipeName); } catch(e){}

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
        
        // Notification Email (TOTALEMENT DÉSACTIVÉ)
        /*
        console.log(`   📧 Envoi du mail de notification...`);
        const { sendNotificationEmail } = require('./email-notifier');
        await sendNotificationEmail({
            recipeName: analysis.recipeName,
            postId: postResult.postId,
            adminUrl: `${process.env.WP_URL}/wp-admin/post.php?post=${postResult.postId}&action=edit`,
            publicUrl: `https://lesrecettesmagiques.vercel.app/recette/${analysis.recipeName.toLowerCase().replace(/\s+/g, '-')}`,
            ingredients: analysis.ingredients,
            steps: analysis.steps,
            tiktokUrl: videoUrl,
            photoUrl: photoUrl
        });
        */

        // Sync local et deploiement Vercel
        console.log(`   📦 Synchro local et déploiement Vercel...`);
        const { execSync } = require('child_process');
        try { execSync(`node sync-recipes.js --recent`, { cwd: path.join(__dirname, '..') }); } catch(e){}
        
        if (!process.env.GITHUB_ACTIONS) {
            const deployCmd = 'git add . && git commit -m "🍳 Nouvelle recette: ' + analysis.recipeName + '" && git push origin main';
            require('child_process').exec(deployCmd, { cwd: path.join(__dirname, '..') });
        }
        return analysis.recipeName;
    } else {
        console.log(`   ❌ Échec de la publication WordPress.`);
        return false;
    }
}

module.exports = { processRecipe, fetchTikTokMetadata, checkWordPressDuplicate, isRecipeWithGemini };
