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
                currentData = { queue: [] };
            }
        }
        
        if (!currentData.queue) currentData.queue = [];
        
        // Doublon dans la file ?
        if (currentData.queue.some((item: any) => item.videoUrl === videoUrl)) {
            return { ok: false, error: 'already_queued', message: '⚠️ Cette recette est déjà en file d\'attente !' };
        }

        currentData.queue.push({ videoUrl, country, timestamp: new Date().toISOString() });

        const payload: any = {
            message: '➕ Nouvelle recette distante en attente',
            content: Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64'),
            sha: fileSha
        };

        const putRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${queuePath}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${githubToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        return { ok: putRes.ok, error: putRes.ok ? null : await putRes.text() };
    } catch (e: any) {
        return { ok: false, error: e.message };
    }
}

async function handleRequest(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const contentType = request.headers.get('content-type') || '';
    let body: any = {};

    // Parsing intelligent du corps de la requête
    if (request.method === 'POST') {
      if (contentType.includes('application/json')) {
        body = await request.json().catch(() => ({}));
      } else if (contentType.includes('form') || contentType.includes('multipart')) {
        const formData = await request.formData();
        formData.forEach((value, key) => body[key] = value);
      } else {
        const text = await request.text();
        try { body = JSON.parse(text); } catch(e) { 
           if (text.includes('tiktok.com')) body.url = text.trim();
        }
      }
    }

    const secret = searchParams.get('secret') || body.secret || '';
    const envSecret = process.env.WEBHOOK_SECRET || '2TlsVemp';
    const checkOnly = searchParams.get('checkOnly') === 'true' || body.checkOnly === 'true' || body.checkOnly === true;
    const videoUrl = searchParams.get('url') || body.url || body.videoUrl || '';

    if (secret !== envSecret) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (!videoUrl) {
      return NextResponse.json({ error: 'URL manquante' }, { status: 400 });
    }

    // --- 1. VERIFICATION DOUBLON ---
    const match = videoUrl.match(/video\/(\d+)/);
    const videoId = match ? match[1] : null;
    const isPublished = videoId && mockRecipes.some(r => r.videoHtml && r.videoHtml.includes(videoId));

    if (isPublished) {
      return new Response('✅ Déjà publiée ! 🍳', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // --- 2. GESTION DU MENU ---
    let selectedCountry = searchParams.get('country') || body.country || searchParams.get('pays') || body.pays || '';
    
    if (!selectedCountry) {
        const pays = [
            "🇫🇷 France", "🇮🇹 Italie", "🇪🇸 Espagne", "🇬🇷 Grèce", "🇱🇧 Liban", 
            "🇺🇸 USA", "🇲🇽 Mexique", "🕌 Orient", "🥢 Asie", "🍦 Glaces", "🍰 Patisserie", 
            "🍹 Boissons", "🥐 Petit-Dej", "🥨 Aperitif", "🥧 Cakes & Tartes", "🥗 Healthy", "🥦 Vegan", "🥬 Vegetarien"
        ];
        
        // Réponse claire et sans collision : status est une STRING, pays/countries sont des LISTES
        const response = NextResponse.json({
            status: 'ok',
            ok: true,
            message: 'Choisissez un pays ou une thématique',
            pays,
            countries: pays
        });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return response;
    }

    // --- 3. ENVOI EN CUISINE ---
    const result = await addToQueue(videoUrl, selectedCountry);
    if (!result.ok) {
        return new Response(`Erreur: ${result.error || result.message}`, { status: 500 });
    }

    return new Response(`C'est en cuisine ! (Pays: ${selectedCountry})`, { 
        status: 200, 
        headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
