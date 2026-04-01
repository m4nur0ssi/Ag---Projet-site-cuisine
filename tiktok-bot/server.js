require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const { processRecipe, checkWordPressDuplicate, fetchTikTokMetadata } = require('./recipe-processor');
const { startPolling } = require('./tiktok-poller');
const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();

// =============================================
// CORS - Accepter les requêtes de l'extension Chrome
// =============================================
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// =============================================
// MIDDLEWARE : Capturer tout ce qui arrive (brut)
// =============================================
app.use('/tiktok-recipe', express.raw({ type: '*/*', limit: '5mb' }));

// =============================================
// ENDPOINT : Reçoit les données TikTok depuis l'iPhone ou Chrome
// =============================================
app.post('/tiktok-recipe', async (req, res) => {
    let rawText = '';
    let payload = {};

    // On convertit les données brutes
    if (req.body instanceof Buffer) {
        rawText = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
        rawText = req.body;
    }

    try {
        payload = JSON.parse(rawText);
    } catch (e) {
        const urlMatch = rawText.match(/https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/[^\s"'<>|]*/);
        if (urlMatch) payload.videoUrl = urlMatch[0].replace(/\\/g, '');
    }

    // Sécurité
    const secret = payload.secret || req.query?.secret;
    const envSecret = process.env.WEBHOOK_SECRET || '2TlsVemp';

    if (secret !== envSecret) {
        console.log(`   🚫 Accès refusé : Secret invalide (${secret})`);
        return res.status(401).json({ status: 'error', message: 'Non autorisé' });
    }

    // RÉPONSE ULTRA-RAPIDE POUR LE RACCOURCI (Liste des pays)
    if (payload.checkOnly) {
        console.log("   ✅ CheckOnly reçu : Envoi de la liste des pays.");
        const countriesList = ["🇫🇷 France", "🇮🇹 Italie", "🇪🇸 Espagne", "🇬🇷 Grèce", "🇱🇧 Liban", "🇺🇸 USA", "🇲🇽 Mexique", "🕌 Orient", "🥢 Asie", "🌍 Afrique"];
        return res.json({ 
            status: 'ok', 
            message: 'Quelle est l\'origine de cette recette ?',
            countries: countriesList,
            pays: countriesList
        });
    }

    if (!payload.videoUrl) {
        return res.status(400).json({ status: 'error', message: 'Lien TikTok absent' });
    }

    console.log(`\n🎵 Signal reçu pour : ${payload.videoUrl}`);

    // VÉRIFICATION DOUBLON MÉCANISME DE SURVIE
    const videoIdMatch = payload.videoUrl.match(/video\/(\d+)/);
    let videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
        const metadata = await fetchTikTokMetadata(payload.videoUrl);
        if (metadata && metadata.finalUrl) {
            const finalIdMatch = metadata.finalUrl.match(/video\/(\d+)/);
            if (finalIdMatch) videoId = finalIdMatch[1];
        }
    }

    if (videoId) {
        // 1. Local check
        const pollerDataPath = path.join(__dirname, 'processed-videos.json');
        if (fs.existsSync(pollerDataPath)) {
            try {
                const pollerData = JSON.parse(fs.readFileSync(pollerDataPath, 'utf8'));
                if (pollerData.videoIds && pollerData.videoIds.includes(String(videoId))) {
                    console.log(`   🚫 Doublon local détecté (ID: ${videoId})`);
                    return res.json({ status: 'duplicate', message: 'Déjà enregistré ! 🍳' });
                }
            } catch (e) {}
        }
        // 2. WordPress check (Recherche sur le site lui-même)
        if (await checkWordPressDuplicate(videoId)) {
            return res.json({ status: 'duplicate', message: 'Déjà sur WordPress ! 🍳' });
        }
    }

    // TRAITEMENT RÉEL des données
    res.json({ status: 'received', message: 'Cuisine en cours... 🪄' });

    try {
        if (videoId) {
            const pollerDataPath = path.join(__dirname, 'processed-videos.json');
            let pollerData = { videoIds: [] };
            if (fs.existsSync(pollerDataPath)) {
                try { pollerData = JSON.parse(fs.readFileSync(pollerDataPath, 'utf8')); } catch(e){}
            }
            if (!pollerData.videoIds.includes(String(videoId))) {
                pollerData.videoIds.push(String(videoId));
                fs.writeFileSync(pollerDataPath, JSON.stringify(pollerData, null, 2));
            }
        }

        await processRecipe({ 
            videoUrl: payload.videoUrl, 
            description: payload.description || 'Recette iPhone', 
            author: payload.author || 'mobile',
            country: payload.country 
        });
    } catch (err) {
        console.error('❌ Erreur :', err.message);
    }
});

app.post('/webhook-publish', (req, res) => {
    console.log('\n🚀 Webhook WordPress : Déploiement...');
    res.json({ status: 'started' });
    const repoPath = path.resolve(__dirname, '..');
    // Supprimer index.lock si présent (évite les blocages)
    const lockFile = path.join(repoPath, '.git', 'index.lock');
    if (fs.existsSync(lockFile)) {
        try { fs.unlinkSync(lockFile); console.log('   🔓 index.lock supprimé.'); } catch(e) {}
    }
    exec('node sync-recipes.js && git add . && git commit -m "🍳 Auto-Sync" --no-verify && git push origin main', 
        { cwd: repoPath },
        (err) => {
            if (err && !err.message.includes('nothing to commit')) {
                console.error('⚠️ Erreur webhook-publish:', err.message);
            } else {
                console.log('   ✅ Sync et push terminés.');
            }
        }
    );
});

// =============================================
// GESTION DE LA FILE D'ATTENTE (QUEUE GITHUB)
// =============================================
let isQueueProcessing = false;
async function checkRemoteQueue() {
    if (isQueueProcessing) return;
    isQueueProcessing = true;
    const queuePath = path.join(__dirname, 'queue.json');
    const repoPath = path.resolve(__dirname, '..');
    
    try {
        // 1. On récupère les nouveaux ordres sur GitHub
        execSync('git pull origin main', { cwd: repoPath });

        if (!fs.existsSync(queuePath)) return;
        let data = JSON.parse(fs.readFileSync(queuePath, 'utf8'));

        if (data.queue && data.queue.length > 0) {
            console.log(`\n📬 ${data.queue.length} recette(s) trouvée(s) dans la file GitHub...`);
            
            const item = data.queue[0]; // On regarde le premier
            console.log(`🪄 Traitement en cours : ${item.url || item.videoUrl}`);
            
            const success = await processRecipe({ 
                videoUrl: item.url || item.videoUrl, 
                description: 'Recette iPhone (Remote)', 
                author: 'remote', 
                country: item.country 
            });
            
            if (success) {
                // On ne retire de la file que si le traitement est un succès
                data.queue.shift();
                fs.writeFileSync(queuePath, JSON.stringify(data, null, 2));

                // 2. Supprimer index.lock si présent avant de commit
                const lockFile = path.join(repoPath, '.git', 'index.lock');
                if (fs.existsSync(lockFile)) {
                    try { fs.unlinkSync(lockFile); console.log('   🔓 index.lock supprimé.'); } catch(e) {}
                }

                // 3. On valide sur GitHub que l'ordre est traité
                execSync('git add tiktok-bot/queue.json src/data/mockData.ts src/data/sync-stats.json', { cwd: repoPath });
                execSync('git commit -m "✅ Remote task completed" --no-verify', { cwd: repoPath });
                execSync('git push origin main', { cwd: repoPath });

                console.log('   🏁 Ordre traité et validé sur GitHub.');
            } else {
                console.log('   ⚠️ Échec du traitement (IA/WP), la recette reste dans la file pour le prochain passage.');
            }
            
            if (data.queue.length > 0 && success) setTimeout(checkRemoteQueue, 2000);
        }
    } catch (e) {
        if (!e.message.includes('nothing to commit')) {
            console.error('⚠️ Erreur file d\'attente :', e.message);
        }
    } finally {
        isQueueProcessing = false;
    }
}

// Initialisation au démarrage

app.listen(process.env.PORT || 3456, () => {
    console.log(`\n🚀 Serveur prêt (Port 3456)`);
    startPolling();
    // Vérification de la file toutes les minutes
    setInterval(checkRemoteQueue, 60000); 
    checkRemoteQueue();
});
