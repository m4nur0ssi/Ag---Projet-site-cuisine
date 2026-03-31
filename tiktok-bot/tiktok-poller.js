require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { processRecipe } = require('./recipe-processor');

// =============================================
// Mémorisation des vidéos déjà traitées
// =============================================
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
        if (data.videoIds.length > 500) data.videoIds = data.videoIds.slice(-500);
        fs.writeFileSync(PROCESSED_FILE, JSON.stringify(data, null, 2));
    }
}

// =============================================
// Appel API TikTok avec les cookies de session
// =============================================
async function fetchTikTokFavorites() {
    const sessionId = process.env.TIKTOK_SESSION_ID;
    const webId = process.env.TIKTOK_WEBID;

    if (!sessionId || !webId) {
        // Pas encore configuré => on ne pollue pas les logs
        return [];
    }

    const msToken = process.env.TIKTOK_MS_TOKEN || '';
    const cookieStr = [
        `sessionid=${sessionId}`,
        `ttwid=${webId}`,        // TikTok utilise ttwid (équivalent de tt_webid_v2)
        msToken ? `msToken=${msToken}` : ''
    ].filter(Boolean).join('; ');

    try {
        const url = `https://www.tiktok.com/api/favorite/item_list/?count=20&cursor=0&aid=1988&app_language=fr-FR&device_platform=web_pc&msToken=${msToken}`;

        const res = await fetch(url, {
            headers: {
                'Cookie': cookieStr,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://www.tiktok.com/foryou',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'fr-FR,fr;q=0.9',
                'Origin': 'https://www.tiktok.com',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!res.ok) {
            const errorBody = await res.text().catch(() => 'no-body');
            console.error(`⚠️  TikTok API: ${res.status} (${res.statusText})`);
            console.error(`   Détails : ${errorBody.substring(0, 100)}`);
            return [];
        }

        const data = await res.json();
        if (data.statusCode !== 0 && data.status_code !== 0) {
            console.error(`⚠️  TikTok status: ${data.statusCode || data.status_code}`);
            return [];
        }
        return data.itemList || data.item_list || [];
    } catch (err) {
        console.error('❌ Erreur fetch favoris TikTok:', err.message);
        return [];
    }
}

// =============================================
// Traitement d'un item favori
// =============================================
async function processFavoriteItem(item) {
    const videoId = String(item.id || item.video?.id || '');
    if (!videoId || isAlreadyProcessed(videoId)) return;

    const author = item.author?.uniqueId || 'inconnu';
    const description = item.desc || '';
    const videoUrl = `https://www.tiktok.com/@${author}/video/${videoId}`;
    const title = description.split('\n')[0].substring(0, 100) || 'Recette TikTok';

    // Récupérer la MEILLEURE image (soit la couverture animée, soit la fixe)
    const coverUrl = item.video?.cover || item.video?.origin_cover || item.video?.dynamic_cover || null;

    console.log(`\n🆕 [iPhone] Nouveau favori : @${author} - "${title.substring(0, 60)}"`);

    // Marquer avant de traiter (évite les doublons)
    markAsProcessed(videoId);

    await processRecipe({ videoUrl, description, author, title, coverUrl });
}

// =============================================
// Boucle de polling
// =============================================
async function startPolling() {
    const minutes = parseInt(process.env.POLL_INTERVAL_MINUTES || '5');
    const interval = minutes * 60 * 1000;

    // Au démarrage, on initialise les favoris existants SANS les traiter
    // (pour ne pas republier des anciens favoris)
    await initializeExistingFavorites();

    console.log(`📱 Surveillance iPhone activée (vérification toutes les ${minutes} min)`);
    setInterval(checkNewFavorites, interval);
}

async function initializeExistingFavorites() {
    console.log('🔍 Initialisation des favoris existants (ils ne seront pas retraités)...');
    const items = await fetchTikTokFavorites();
    for (const item of items) {
        const videoId = String(item.id || item.video?.id || '');
        if (videoId) markAsProcessed(videoId);
    }
    console.log(`   ✅ ${items.length} favoris existants mémorisés.`);
}

let isPollerRunning = false;
async function checkNewFavorites() {
    if (isPollerRunning) return;
    isPollerRunning = true;
    const now = new Date().toLocaleTimeString('fr-FR');
    console.log(`\n🔄 [${now}] Vérification favoris iPhone...`);

    try {
        const items = await fetchTikTokFavorites();
        if (!items.length) { console.log('   Aucun résultat'); return; }

        let newCount = 0;
        for (const item of items) {
            const videoId = String(item.id || item.video?.id || '');
            if (videoId && !isAlreadyProcessed(videoId)) {
                newCount++;
                await processFavoriteItem(item);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        if (newCount === 0) console.log('   ✅ Pas de nouveau favori');
        else console.log(`   🎉 ${newCount} nouveau(x) favori(s) traité(s) !`);
    } catch (e) {
        console.error('❌ Erreur Poller:', e.message);
    } finally {
        isPollerRunning = false;
    }
}

module.exports = { startPolling };
