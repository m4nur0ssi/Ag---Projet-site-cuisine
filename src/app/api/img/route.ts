import { NextResponse } from 'next/server';

/**
 * Proxy d'image même-origine : /api/img?url=<url encodée>.
 * Sert une image externe (photos WordPress) depuis NOTRE domaine → le canvas de
 * « Partager en image » peut l'exporter sans être « sali » par le CORS.
 *
 * Garde-fous anti-SSRF : uniquement http(s), pas d'IP privée/localhost, et on
 * n'accepte que des réponses de type image (taille plafonnée).
 */
export const runtime = 'nodejs';
const MAX_BYTES = 8 * 1024 * 1024;
// Sans plafond de temps, un hôte qui ne répond pas immobilise la fonction
// jusqu'à son propre délai d'expiration.
const TIMEOUT_MS = 10_000;

function isPrivateHost(host: string): boolean {
    const h = host.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1') return true;
    // Plages IP privées courantes.
    if (/^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    if (h.endsWith('.internal') || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80:')) return true;
    return false;
}

/** Adresse acceptable : http(s) et hôte public. Sert aussi après redirection. */
function urlAcceptable(u: string): boolean {
    try {
        const t = new URL(u);
        return (t.protocol === 'http:' || t.protocol === 'https:') && !isPrivateHost(t.hostname);
    } catch {
        return false;
    }
}

export async function GET(request: Request) {
    const raw = new URL(request.url).searchParams.get('url');
    if (!raw) return NextResponse.json({ error: 'url manquante' }, { status: 400 });

    let target: URL;
    try { target = new URL(raw); } catch { return NextResponse.json({ error: 'url invalide' }, { status: 400 }); }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        return NextResponse.json({ error: 'protocole non autorisé' }, { status: 400 });
    }
    if (isPrivateHost(target.hostname)) {
        return NextResponse.json({ error: 'hôte non autorisé' }, { status: 400 });
    }

    const stop = new AbortController();
    const minuteur = setTimeout(() => stop.abort(), TIMEOUT_MS);
    let res: Response;
    try {
        res = await fetch(target.toString(), {
            signal: stop.signal,
            redirect: 'follow',
            headers: {
                // Un agent « robot » se fait refuser par plusieurs marchands
                // (403) alors que la même image passe depuis un navigateur.
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Safari/605.1.15',
                accept: 'image/*,*/*;q=0.8',
            },
        });
    } catch {
        return NextResponse.json({ error: 'fetch échoué' }, { status: 502 });
    } finally {
        clearTimeout(minuteur);
    }
    if (!res.ok) return NextResponse.json({ error: 'image introuvable' }, { status: res.status });
    // Une redirection a pu mener ailleurs : on revérifie l'arrivée.
    if (res.url && !urlAcceptable(res.url)) return NextResponse.json({ error: 'redirection refusée' }, { status: 400 });

    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return NextResponse.json({ error: 'pas une image' }, { status: 415 });

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return NextResponse.json({ error: 'image trop lourde' }, { status: 413 });

    return new NextResponse(buf, {
        status: 200,
        headers: {
            'content-type': type,
            'cache-control': 'public, max-age=86400, immutable',
            'access-control-allow-origin': '*',
        },
    });
}
