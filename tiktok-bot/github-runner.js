/**
 * github-runner.js
 * Script one-shot pour GitHub Actions.
 * Recupere le dernier favori TikTok et le traite.
 */
require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const PROCESSED_FILE = path.join(__dirname, 'processed-videos.json');

function loadProcessed() {
    try {
        if (fs.existsSync(PROCESSED_FILE)) return JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'));
    } catch (e) { }
    return { videoIds: [] };
}

function isAlreadyProcessed(videoId) {
    return loadProcessed().videoIds.includes(String(videoId));
}

function markAsProcessed(videoId) {
    const data = loadProcessed();
    if (!data.videoIds.includes(String(videoId))) {
        data.videoIds.push(String(videoId));
        if (data.videoIds.length > 1000) data.videoIds = data.videoIds.slice(-1000);
        fs.writeFileSync(PROCESSED_FILE, JSON.stringify(data, null, 2));
    }
}

async function fetchLatestFavorites() {
    const sessionId = process.env.TIKTOK_SESSION_ID;
    const webId = process.env.TIKTOK_WEBID;
    const msToken = process.env.TIKTOK_MS_TOKEN || '';

    if (!sessionId || !webId) {
        console.log('Cookies TikTok non configures dans les Secrets GitHub.');
        return [];
    }

    const cookieStr = [`sessionid=${sessionId}`, `ttwid=${webId}`, msToken ? `msToken=${msToken}` : ''].filter(Boolean).join('; ');

    try {
        const url = `https://www.tiktok.com/api/favorite/item_list/?count=5&cursor=0&aid=1988&app_language=fr-FR&device_platform=web_pc&msToken=${msToken}`;
        const res = await fetch(url, {
            headers: {
                'Cookie': cookieStr,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://www.tiktok.com/foryou',
                'Accept': 'application/json',
            }
        });
        if (!res.ok) { console.log(`TikTok API: ${res.status}`); return []; }
        const data = await res.json();
        return data.itemList || data.item_list || [];
    } catch (err) {
        console.error('Erreur fetch favoris TikTok:', err.message);
        return [];
    }
}

async function run() {
    console.log('GitHub Runner - Demarrage...');
    const { processRecipe } = require('./recipe-processor');

    const manualUrl = process.env.VIDEO_URL;
    const country = process.env.COUNTRY;

    // 1. PRIORITÉ : TRAITEMENT DE LA FILE D'ATTENTE (QUEUE.JSON)
    const queuePath = path.join(__dirname, 'queue.json');
    if (fs.existsSync(queuePath)) {
        let data = { queue: [] };
        try { data = JSON.parse(fs.readFileSync(queuePath, 'utf8')); } catch(e){}
        
        if (data.queue && data.queue.length > 0) {
            console.log(`\n📬 ${data.queue.length} recette(s) trouvée(s) dans la file d'attente GitHub...`);
            const item = data.queue[0];
            const videoUrl = item.url || item.videoUrl;
            
            console.log(`🪄 Traitement de la file en cours : ${videoUrl}`);
            const recipeName = await processRecipe({ 
                videoUrl, 
                description: 'Recette iPhone (Cloud)', 
                author: 'cloud-shortcut', 
                country: item.country 
            });
            
            if (typeof recipeName === 'string') {
                data.queue.shift(); // Supprimer de la file seulement si succès
                fs.writeFileSync(queuePath, JSON.stringify(data, null, 2));
                fs.writeFileSync(path.join(__dirname, 'latest-recipe.txt'), recipeName);
                console.log(`   ✅ File mise à jour. Recette : "${recipeName}"`);
            }
            return; // On s'arrête là pour ce tour (pour éviter de saturer GitHub Actions)
        }
    }

    // 2. TRAITEMENT MANUEL (Si déclenché via workflow_dispatch avec URL)
    if (manualUrl && manualUrl.includes('tiktok.com')) {
        console.log(`URL manuelle recue : ${manualUrl} (${country || 'sans pays'})`);
        const recipeName = await processRecipe({ 
            videoUrl: manualUrl, 
            description: '', 
            author: 'manual', 
            title: 'Recette TikTok', 
            country: country
        });
        if (typeof recipeName === 'string') {
            fs.writeFileSync(path.join(__dirname, 'latest-recipe.txt'), recipeName);
            console.log(`   💡 Nom de la recette sauvegardée : "${recipeName}"`);
        }
        return;
    }

    // 3. VÉRIFICATION DES FAVORIS TIKTOK (Poll automatique)
    const items = await fetchLatestFavorites();
    if (items.length === 0) { console.log('Aucun favori trouve. Fin.'); return; }

    for (const item of items) {
        const videoId = String(item.id || item.video?.id || '');
        if (!videoId || isAlreadyProcessed(videoId)) { console.log(`Deja traite : ${videoId}`); continue; }

        const author = item.author?.uniqueId || 'inconnu';
        const description = item.desc || '';
        const videoUrl = `https://www.tiktok.com/@${author}/video/${videoId}`;
        const title = description.split('\n')[0].substring(0, 100) || 'Recette TikTok';
        const coverUrl = item.video?.cover || null;

        console.log(`Nouveau favori : "${title.substring(0, 60)}"`);
        markAsProcessed(videoId);
        const recipeName = await processRecipe({ videoUrl, description, author, title, coverUrl });
        if (typeof recipeName === 'string') {
            fs.writeFileSync(path.join(__dirname, 'latest-recipe.txt'), recipeName);
            console.log(`   💡 Nom de la recette sauvegardé : "${recipeName}"`);
        }
        break; // Une seule recette par run
    }
}

run().catch(err => { console.error('Erreur fatale :', err); process.exit(1); });
