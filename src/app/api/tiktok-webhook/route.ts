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
    if (request.method === 'POST') {
      try { body = await request.json(); } catch(e) {}
    }

    const finalSecret = secret || body.secret || '';
    const envSecret = process.env.WEBHOOK_SECRET || '2TlsVemp';

    if (finalSecret !== envSecret) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // --- MODE TIKTOK ---
    let videoUrl = searchParams.get('url') || body.url || body.videoUrl || '';
    if (!videoUrl && request.method === 'POST') {
       try { const t = await request.clone().text(); if (t.includes('tiktok.com')) videoUrl = t.trim(); } catch(e) {}
    }

    if (!videoUrl) {
        return NextResponse.json({ 
            error: 'URL manquante', 
            v: "SYNC-FIX-ERROR",
            debug_body: body,
            debug_params: Object.fromEntries(searchParams.entries())
        }, { status: 400 });
    }

    // --- DETECTION DU PAYS ET DOUBLON ---
    let selectedCountry = searchParams.get('country') || body.country || searchParams.get('pays') || body.pays || body.selection || '';
    
    // Si c'est un POST avec du texte brut (souvent le cas des raccourcis iOS)
    if (!selectedCountry && request.method === 'POST') {
        try {
            const rawBody = await request.clone().text();
            // Si le corps contient juste le nom du pays ou "pays=France"
            if (rawBody.length < 50) {
               if (rawBody.includes('=')) {
                   selectedCountry = rawBody.split('=')[1];
               } else {
                   selectedCountry = rawBody.trim();
               }
            }
        } catch(e) {}
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
        } catch (e) {}

        // Check Published Recipes
        const match = videoUrl.match(/video\/(\d+)/);
        const videoId = match ? match[1] : null;
        if (!isDup && videoId && mockRecipes.some(r => r.videoHtml && r.videoHtml.includes(videoId))) {
            isDup = true; dupMessage = '✅ Cette recette est déjà publiée sur le site !';
        }

        if (isDup) {
             return NextResponse.json({ 
                success: false, 
                status: 'Duplicate',
                message: dupMessage,
                url: videoUrl
            });
        }
    }

    if (!selectedCountry && body && typeof body === 'object') {
        const countriesList = ["France", "Italie", "Espagne", "Grèce", "Liban", "USA", "Mexique", "Orient", "Asie", "Autre"];
        for (const val of Object.values(body)) {
            if (typeof val === 'string') {
                for (const pc of countriesList) {
                    if (val.includes(pc)) {
                        selectedCountry = val;
                        break;
                    }
                }
            }
            if (selectedCountry) break;
        }
    }

    // Étape 1 : Si on n'a pas de pays, on envoie le dictionnaire attendu par le Raccourci iOS.
    // AUCUN EMOJI NULLE PART : iOS Shortcuts crashe complètement qaund on lui passe des emojis dans ce dictionnaire.
    if (!selectedCountry && !checkOnly && body.checkOnly !== 'true' && body.checkOnly !== true) {
        const countriesList = [
            "France", "Italie", "Espagne", "Grece", "Liban",
            "USA", "Mexique", "Orient", "Asie", "Afrique",
            "Rapide", "Facile", "Paques", "Dolce Vita", "Astuce",
            "Glaces", "Boissons", "Gouter", "Healthy", "Vege"
        ];
        
        const countryMenu: any = {};
        countriesList.forEach(c => countryMenu[c] = c);

        const response = NextResponse.json({ status: countryMenu });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return response;
    }

    // Étape 2 : Si on a un pays (ou que c'est un POST forcé), on ENVOIE EN CUISINE !
    console.log(`✅ Webhook : Envoi en cuisine ! (Pays : ${selectedCountry || 'Autre'})`);
    
    const queueResult = await addToQueue(videoUrl, selectedCountry || 'Autre');

    // Message personnalisé si c'est un doublon
    if (queueResult.ok === false && queueResult.message) {
        return NextResponse.json({ 
            success: false, 
            status: 'duplicate',
            message: queueResult.message,
            url: videoUrl,
            debug_queue_result: queueResult
        });
    }

    // Message d'erreur s'il y a eu un autre souci (ex: Token manquant)
    if (queueResult.ok === false) {
        return NextResponse.json({ 
            success: false, 
            status: 'error',
            message: `Erreur: ${queueResult.error}. Verifiez la clé GITHUB_PAT sur Vercel !`,
            url: videoUrl,
            debug_pat_active: !!githubToken,
            debug_queue_result: queueResult
        }, { status: 500 });
    }

    return NextResponse.json({ 
        success: true, 
        status: 'ok',
        v: "SYNC-FIX-SUCCESS",
        debug_pat_active: !!process.env.GITHUB_PAT,
        message: `C'est en cuisine ! (Pays: ${selectedCountry || 'Autre'})`,
        url: videoUrl,
        debug_received_country: selectedCountry,
        debug_queue_result: queueResult
    });
} catch (err: any) {
    console.error('❌ Critical Error:', err.message);
    return NextResponse.json({ error: err.message, status: 'error' }, { status: 500 });
}
}
