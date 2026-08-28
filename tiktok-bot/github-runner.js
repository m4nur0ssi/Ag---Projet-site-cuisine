/**
 * github-runner.js
 * Script one-shot pour GitHub Actions.
 * Recupere le dernier favori TikTok et le traite.
 */
require('dotenv').config({ path: __dirname + '/.env' });
// Node 18+ : fetch natif intégré, pas besoin de node-fetch
const fs = require('fs');
const path = require('path');

const PROCESSED_FILE = path.join(__dirname, 'processed-videos.json');
/** Combien de fois on retente une recette avant de renoncer (panne passagère). */
const MAX_ESSAIS = 6;

function loadProcessed() {
    try {
        if (fs.existsSync(PROCESSED_FILE)) return JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'));
    } catch (e) { }
    return { videoIds: [] };
}

function isAlreadyProcessed(videoId) {
    return loadProcessed().videoIds.includes(String(videoId));
}

/**
 * Retire une vidéo de la liste des traitées.
 *
 * On la marque AVANT publication pour qu'un double passage du workflow ne crée
 * pas deux fois la même recette. Quand la tentative échoue pour une raison
 * temporaire, cette marque devient un piège : la vidéo ne serait plus jamais
 * retentée. On la lève.
 */
function demarquer(videoId) {
    const data = loadProcessed();
    const i = data.videoIds.indexOf(String(videoId));
    if (i === -1) return;
    data.videoIds.splice(i, 1);
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify(data, null, 2));
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

/**
 * Garde la trace d'une demande qui n'a pas abouti.
 *
 * L'item est retiré de la file quoi qu'il arrive — c'est voulu, un lien
 * impossible ne doit pas bloquer les suivants. Mais il disparaissait alors sans
 * laisser un mot : côté téléphone, la recette envoyée ne revenait jamais et rien
 * n'expliquait pourquoi. On la range donc dans `echecs`, avec sa raison et sa
 * date. Le fichier est commité par le workflow : la trace est lisible dans
 * l'historique, et le lien reste sous la main pour réessayer.
 */
function noterEchec(data, item, raison) {
    data.echecs = Array.isArray(data.echecs) ? data.echecs : [];
    data.echecs.push({ ...item, raison, quand: new Date().toISOString() });
    // On garde les vingt derniers : de quoi comprendre, sans faire enfler le dépôt.
    if (data.echecs.length > 20) data.echecs = data.echecs.slice(-20);
}

async function run() {
    console.log('GitHub Runner - Demarrage...');
    const { processRecipe, raisonDuDernierEchec, RAISON_QUOTA } = require('./recipe-processor');

    const manualUrl = process.env.VIDEO_URL;
    const country = process.env.COUNTRY;

    // 1. PRIORITÉ : TRAITEMENT DE LA FILE D'ATTENTE (QUEUE.JSON)
    const queuePath = path.join(__dirname, 'queue.json');
    if (fs.existsSync(queuePath)) {
        let data = { queue: [] };
        try { data = JSON.parse(fs.readFileSync(queuePath, 'utf8')); } catch(e){}
        
        if (data.queue && data.queue.length > 0) {
            console.log(`\n📬 ${data.queue.length} recette(s) trouvée(s) dans la file d'attente GitHub...`);
            
            while (data.queue.length > 0) {
                const item = data.queue[0];
                const videoUrl = item.url || item.videoUrl;

                // Extraction ID pour vérifier les doublons (TikTok ou YouTube)
                const { extractTikTokId, extractYouTubeId } = require('./wordpress-poster');
                const isYouTube = /youtube\.com|youtu\.be/i.test(videoUrl || '');
                const videoId = isYouTube ? extractYouTubeId(videoUrl) : extractTikTokId(videoUrl);

                if (videoId && isAlreadyProcessed(videoId)) {
                    console.log(`   ⏭️ Déjà traitée (${videoId}), on la retire de la file.`);
                    data.queue.shift();
                    fs.writeFileSync(queuePath, JSON.stringify(data, null, 2));
                    continue;
                }

                console.log(`🪄 Traitement de la file en cours : ${videoUrl}`);
                // ⚠️ Marquer comme traité AVANT publication pour éviter les doublons si le workflow tourne deux fois
                if (videoId) markAsProcessed(videoId);
                let recipeName;
                let raison = '';
                try {
                if (isYouTube) {
                    // Recette YouTube : même logique que le CLI (extraction + IA + publication).
                    const { importYouTubeRecipe } = require('./youtube-import');
                    recipeName = await importYouTubeRecipe({ url: videoUrl, country: item.country, status: 'publish' });
                } else {
                    recipeName = await processRecipe({
                        videoUrl,
                        description: 'Recette iPhone (Cloud)',
                        author: 'cloud-shortcut',
                        country: item.country
                    });
                }
                } catch (e) {
                    // Une exception ne doit pas emporter le job : les recettes
                    // suivantes de la file ont le droit d'être traitées, et la
                    // raison de l'échec a le droit d'être écrite quelque part.
                    raison = (e && e.message) ? String(e.message).slice(0, 200) : String(e);
                    console.log(`   ❌ Exception : ${raison}`);
                    recipeName = false;
                }

                if (typeof recipeName === 'string') {
                    fs.writeFileSync(path.join(__dirname, 'latest-recipe.txt'), recipeName);
                    console.log(`   ✅ Success : "${recipeName}"`);
                } else {
                    const cause = raison || raisonDuDernierEchec() || 'traitement sans résultat';
                    console.log(`   ⚠️ Echec ou Ignoré : ${videoUrl} — ${cause}`);

                    /*
                     * On lève la marque « déjà traitée ».
                     *
                     * Elle est posée AVANT publication pour qu'un double passage du
                     * workflow ne crée pas deux fois la même recette. Après un
                     * échec, elle condamnait la vidéo : toute nouvelle tentative
                     * était écartée d'office, et la recette devenait impossible à
                     * rattraper. Le contrôle de doublon côté WordPress reste là pour
                     * ce qu'elle protégeait.
                     */
                    if (videoId) demarquer(videoId);

                    /*
                     * Certaines pannes ne parlent pas de la recette.
                     *
                     * Le quota d'IA se recharge ; le WordPress du NAS s'arrête et
                     * repart. Perdre une recette parce que la base de données
                     * dormait à cette minute-là n'a aucun sens : on la laisse en
                     * tête de file et le passage horaire du workflow la reprendra
                     * tout seul, jusqu'à ce que ça marche.
                     *
                     * Avec un compteur, tout de même : une recette qu'on ne saura
                     * jamais publier ne doit pas bloquer les suivantes pour
                     * toujours. Au sixième échec, elle rejoint la trace.
                     */
                    const temporaire = cause === RAISON_QUOTA || /WordPress/i.test(cause);
                    item.essais = (item.essais || 0) + 1;
                    if (temporaire && item.essais < MAX_ESSAIS) {
                        fs.writeFileSync(queuePath, JSON.stringify(data, null, 2));
                        console.log(`   ⏳ Panne passagère (${cause}) — tentative ${item.essais}/${MAX_ESSAIS}, on garde la recette en file.`);
                        return;   // les suivantes échoueraient de la même façon
                    }
                    noterEchec(data, item, temporaire ? `${cause} — abandon après ${item.essais} tentatives` : cause);
                }

                // On retire TOUJOURS l'item de la file après tentative pour ne pas bloquer
                data.queue.shift();
                fs.writeFileSync(queuePath, JSON.stringify(data, null, 2));
            }
            console.log("✅ File d'attente épuisée.");
            return;
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
