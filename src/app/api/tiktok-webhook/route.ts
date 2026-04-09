import { NextResponse } from 'next/server';
import { mockRecipes } from '@/data/mockData';

export async function POST(request: Request) {
    return handleRequest(request);
}

export async function GET(request: Request) {
    return handleRequest(request);
}

async function addToQueue(videoUrl: string, country: string) {
    const githubToken = process.env.GITHUB_PAT;
    const githubRepo = process.env.GITHUB_REPO || 'm4nur0ssi/Ag---Projet-site-cuisine';
    const queuePath = 'tiktok-bot/queue.json';

    try {
        // 1. Lire le fichier actuel
        const getRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${queuePath}`, {
            headers: { 'Authorization': `Bearer ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        let currentData: any = { queue: [] };
        let fileSha = undefined;

        if (getRes.ok) {
            const getFile = await getRes.json();
            fileSha = getFile.sha;
            try {
                currentData = JSON.parse(Buffer.from(getFile.content, 'base64').toString());
            } catch (e) {
                // If the file is empty or invalid JSON, we just start fresh
                currentData = { queue: [] };
            }
        } else if (getRes.status === 401 || getRes.status === 403) {
            return { ok: false, error: 'Token GitHub invalide ou manquant (env GITHUB_PAT).' };
        } else if (getRes.status !== 404) {
            return { ok: false, error: 'Erreur inattendue Github API: ' + getRes.statusText };
        }

        // 2. Vérifier les doublons
        if (!currentData.queue) currentData.queue = [];

        // 2.a - Doublon dans la file d'attente ?
        const isDuplicateInQueue = currentData.queue.some((item: any) => item.videoUrl === videoUrl);
        if (isDuplicateInQueue) {
            return { ok: false, error: 'already_queued', message: '⚠️ Cette recette est déjà en file d\'attente !' };
        }

        // 2.b - Doublon déjà publié ?
        const match = videoUrl.match(/video\/(\d+)/);
        const videoId = match ? match[1] : null;
        if (videoId) {
            const isAlreadyPublished = mockRecipes.some(r => r.videoHtml && r.videoHtml.includes(videoId));
            if (isAlreadyPublished) {
                return { ok: false, error: 'already_published', message: '✅ Cette recette est déjà publiée sur le site !' };
            }
        }

        currentData.queue.push({ videoUrl, country, timestamp: new Date().toISOString() });

        // 3. Sauvegarder sur GitHub
        const payload: any = {
            message: '➕ Nouvelle recette distante en attente',
            content: Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64')
        };

        if (fileSha) {
            payload.sha = fileSha; // Requis pour mettre à jour un fichier existant
        }

        const putRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${queuePath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!putRes.ok) {
            const errorDetails = await putRes.text();
            return { ok: false, error: 'Erreur lors de la sauvegarde sur Github: ' + errorDetails };
        }

        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e.message };
    }
}

async function handleRequest(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret') || '';
        const action = searchParams.get('action') || '';
        const checkOnly = searchParams.get('checkOnly') === 'true';

        let body: any = {};
        let rawBodyText = '';
        if (request.method === 'POST') {
            // Lire le body UNE SEULE FOIS en texte brut, puis tenter le parse JSON
            try { rawBodyText = await request.text(); } catch (e) { }
            if (rawBodyText) {
                try { body = JSON.parse(rawBodyText); } catch (e) { }
            }
        }

        const finalSecret = secret || body.secret || '';
        const envSecret = process.env.WEBHOOK_SECRET || '2TlsVemp';

        if (finalSecret !== envSecret) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        // --- MODE TIKTOK ---
        // Cherche l'URL dans les params GET, le body JSON, ou le texte brut du body
        let videoUrl = searchParams.get('url') || body.url || body.videoUrl || '';
        if (!videoUrl && rawBodyText && rawBodyText.includes('tiktok.com')) {
            videoUrl = rawBodyText.trim();
        }

        // --- MODE MENU PAYS (sans URL = afficher le menu des pays) ---
        // Le raccourci iOS appelle sans URL pour obtenir la liste des pays
        // Que ce soit avec checkOnly=true ou non
        if (!videoUrl) {
            const paysDict: any = {
                "France": "🇫🇷 France",
                "Italie": "🇮🇹 Italie",
                "Espagne": "🇪🇸 Espagne",
                "Grece": "🇬🇷 Grèce",
                "Liban": "🇱🇧 Liban",
                "USA": "🇺🇸 USA",
                "Mexique": "🇲🇽 Mexique",
                "Orient": "🕌 Orient",
                "Asie": "🥢 Asie",
                "Afrique": "🌍 Afrique",
                "Aperitifs": "🥨 Apéritifs",
                "Entrees": "🥗 Entrées",
                "Plats": "🍲 Plats",
                "Vegetarien": "🥬 Végétarien",
                "Desserts": "🍰 Desserts",
                "Patisserie": "🥐 Pâtisserie",
                "Restaurant": "🍽️ Restaurant",
                "Glaces": "🧊 Les Glaces",
                "Rafraichissements": "🥤 Rafraîchissements",
                "Paques": "🥚 Pâques",
                "Noel": "🎄 Noël",
                "Astuces": "💡 Astuces",
                "Simplissime": "⏱️ Simplissime"
            };
            const response = NextResponse.json({ status: paysDict });
            response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            return response;
        }

        // --- DETECTION DU PAYS ET DOUBLON ---
        let selectedCountry = searchParams.get('country') || body.country || searchParams.get('pays') || body.pays || body.selection || '';

        // Si c'est un POST avec du texte brut (souvent le cas des raccourcis iOS)
        if (!selectedCountry && request.method === 'POST' && rawBodyText) {
            // Si le corps contient juste le nom du pays ou "pays=France"
            if (rawBodyText.length < 50) {
                if (rawBodyText.includes('=')) {
                    selectedCountry = rawBodyText.split('=')[1];
                } else {
                    selectedCountry = rawBodyText.trim();
                }
            }
        }

        const githubToken = process.env.GITHUB_PAT;

        // On vérifie d'abord si la recette est DÉJÀ en base AVANT de demander le pays !
        if (!checkOnly) {
            let isDup = false;
            let dupMessage = '';

            // Check Github Queue via API (rapide)
            try {
                if (githubToken) {
                    const getRes = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO || 'm4nur0ssi/Ag---Projet-site-cuisine'}/contents/tiktok-bot/queue.json`, {
                        headers: { 'Authorization': `Bearer ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' }
                    });
                    if (getRes.ok) {
                        const data = JSON.parse(Buffer.from((await getRes.json()).content, 'base64').toString());
                        if (data.queue && data.queue.some((item: any) => item.videoUrl === videoUrl)) {
                            isDup = true; dupMessage = '⚠️ Cette recette est déjà en file d\'attente !';
                        }
                    }
                }
            } catch (e) { }

            // Check Published Recipes
            const match = videoUrl.match(/video\/(\d+)/);
            const videoId = match ? match[1] : null;
            if (!isDup && videoId && mockRecipes.some(r => r.videoHtml && r.videoHtml.includes(videoId))) {
                isDup = true; dupMessage = '✅ Cette recette est déjà publiée sur le site !';
            }

            if (isDup) {
                return new Response(dupMessage, {
                    status: 200,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            }
        }

        // Étape 1 : Si on n'a pas de pays, on cherche partout dans les params et le body
        if (!selectedCountry) {
            const knownCountries = ["France", "Italie", "Espagne", "Grece", "Grèce", "Liban",
                "USA", "Mexique", "Orient", "Asie", "Afrique", "Aperitifs", "Aperitif", "Entrees", "Entrée", "Entree",
                "Plats", "Plat", "Vegetarien", "Desserts", "Dessert", "Patisserie", "Restaurant",
                "Glaces", "Glace", "Rafraichissements", "Rafraîchissements", "Paques", "Pâques", "Noel", "Noël", "Astuces", "Simplissime"];

            // Scan TOUS les paramètres de l'URL
            searchParams.forEach((val) => {
                if (!selectedCountry && val) {
                    for (const c of knownCountries) {
                        if (val.includes(c)) { selectedCountry = val; break; }
                    }
                }
            });

            // Scan TOUTES les clés du body (y compris Choixpays, selection, paysChoice...)
            if (!selectedCountry && body && typeof body === 'object') {
                for (const [key, val] of Object.entries(body)) {
                    if (!selectedCountry && typeof val === 'string') {
                        // Clé connue OU valeur qui ressemble à un pays
                        if (['Choixpays', 'choixpays', 'selection', 'paysChoice', 'pays', 'country'].includes(key)) {
                            selectedCountry = val;
                            break;
                        }
                        for (const c of knownCountries) {
                            if (val.includes(c)) { selectedCountry = val; break; }
                        }
                    }
                }
            }
        }

        // Si toujours pas de pays → on renvoie le menu + debug pour comprendre ce que le raccourci envoie
        if (!selectedCountry) {
            const paysDict: any = {
                // Pays & Régions
                "France": "🇫🇷 France",
                "Italie": "🇮🇹 Italie",
                "Espagne": "🇪🇸 Espagne",
                "Grece": "🇬🇷 Grèce",
                "Liban": "🇱🇧 Liban",
                "USA": "🇺🇸 USA",
                "Mexique": "🇲🇽 Mexique",
                "Orient": "🕌 Orient",
                "Asie": "🥢 Asie",
                "Afrique": "🌍 Afrique",

                // Catégories de plats
                "Aperitifs": "🥨 Apéritifs",
                "Entrees": "🥗 Entrées",
                "Plats": "🍲 Plats",
                "Vegetarien": "🥬 Végétarien",
                "Desserts": "🍰 Desserts",
                "Patisserie": "🥐 Pâtisserie",
                "Restaurant": "🍽️ Restaurant",

                // Spécialités glacées & boissons
                "Glaces": "🧊 Les Glaces",
                "Rafraichissements": "🥤 Rafraîchissements",

                // Thématiques et Tendances (sans Famille)
                "Paques": "🥚 Pâques",
                "Noel": "🎄 Noël",
                "Astuces": "💡 Astuces",
                "Simplissime": "⏱️ Simplissime"
            };
            console.log('🔍 Pays non trouvé — on affiche le menu de sélection');
            const response = NextResponse.json({ status: paysDict });
            response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            return response;
        }

        // Étape 2 : Si on a un pays (ou que c'est un POST forcé), on ENVOIE EN CUISINE !
        console.log(`✅ Webhook : Envoi en cuisine ! (Pays : ${selectedCountry || 'Autre'})`);

        const queueResult = await addToQueue(videoUrl, selectedCountry || 'Autre');

        // Message personnalisé si c'est un doublon
        if (queueResult.ok === false && queueResult.message) {
            return new Response(queueResult.message, {
                status: 200,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        // Message d'erreur s'il y a eu un autre souci (ex: Token manquant)
        if (queueResult.ok === false) {
            return new Response(`Erreur: ${queueResult.error}. Verifiez la clé GITHUB_PAT sur Vercel !`, {
                status: 500,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        return new Response(`C'est en cuisine ! (Pays: ${selectedCountry || 'Autre'})`, {
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    } catch (err: any) {
        console.error('❌ Critical Error:', err.message);
        return NextResponse.json({ error: err.message, status: 'error' }, { status: 500 });
    }
}
