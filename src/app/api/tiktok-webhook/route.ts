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

        // 2. Ajouter la recette
        if (!currentData.queue) currentData.queue = [];
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

    if (!videoUrl) return NextResponse.json({ error: 'URL manquante' }, { status: 400 });

    // --- DETECTION DU PAYS (ULTRA ROBUSTE) ---
    let selectedCountry = searchParams.get('country') || body.country || searchParams.get('pays') || body.pays || '';
    
    // Si on n'a toujours pas trouvé le pays, on fouille TOUT le body (au cas où l'iPhone l'envoie bizarrement)
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

    // --- LOGIQUE DE RÉPONSE ---
    
    // Étape 1 : Si on n'a pas de pays et qu'on ne demande pas juste un check, on envoie la liste
    if (!selectedCountry && !checkOnly && body.checkOnly !== 'true' && body.checkOnly !== true) {
        const countriesArr = [
            // Pays
            "🇫🇷 France", "🇮🇹 Italie", "🇪🇸 Espagne", "🇬🇷 Grèce", "🇱🇧 Liban",
            "🇺🇸 USA", "🇲🇽 Mexique", "🕌 Orient", "🥢 Asie", "🗺️ Autre",
            // Thématiques du moment
            "🐣 Pâques", "🎄 Noël", "😊 Facile", "🍝 Dolce Vita", "💡 Astuce"
        ];
        const countryDict: any = {};
        countriesArr.forEach(c => countryDict[c] = c);

        const response = NextResponse.json({ 
            status: countryDict,
            countries: countryDict, 
            pays: countryDict,
            v: "00:13-NETLIFY-FORCE",
            message: 'Quel pays ?'
        });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return response;
    }

    // Étape 2 : Si on a un pays (ou que c'est un POST forcé), on ENVOIE EN CUISINE !
    console.log(`✅ Webhook : Envoi en cuisine ! (Pays : ${selectedCountry || 'Autre'})`);
    
    const queueResult = await addToQueue(videoUrl, selectedCountry || '🗺️ Autre');

    return NextResponse.json({ 
        success: true, 
        status: 'ok',
        v: "RELAX-VRAIMENT",
        message: `C'est en cuisine ! (Pays: ${selectedCountry || '🗺️ Autre'})`,
        url: videoUrl,
        debug_received_country: selectedCountry,
        debug_queue_result: queueResult
    });
} catch (err: any) {
    console.error('❌ Critical Error:', err.message);
    return NextResponse.json({ error: err.message, status: 'error' }, { status: 500 });
}
}
