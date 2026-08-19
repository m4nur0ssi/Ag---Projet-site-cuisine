/**
 * Proxy d'images pour contourner le problème de Mixed Content.
 * Vercel récupère l'image depuis l'IP du NAS (HTTP) et la sert en HTTPS.
 * Usage: /api/image-proxy?url=http://109.221.250.122/wordpress/...&v=timestamp
 * Le paramètre &v= permet de forcer le rafraîchissement quand une image WordPress change.
 */
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

// sharp = binaire natif → runtime Node (pas Edge).
export const runtime = 'nodejs';

// Domaines autorisés (pour éviter que ce proxy soit utilisé pour autre chose)
const ALLOWED_HOSTS = [
    '109.221.250.122',
    '192.168.1.200',
    'lesrec3ttesm4giques.fr',
];

// On sert du WebP redimensionné : la source (full-res du NAS) fait 2000-4000 px
// alors que le site affiche 150-800 px. On envoie donc « juste ce qui s'affiche »
// (× Retina), ce qui divise le Fast Origin Transfer Vercel par 5-10 sans perte
// visible. Largeur pilotée par &w= ; jamais d'agrandissement.
const MAX_W = 1280;   // plafond (héros/fiche en Retina)
const DEFAULT_W = 900;

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
        return new NextResponse('Missing url parameter', { status: 400 });
    }

    // Vérification que le domaine est autorisé
    try {
        const urlObj = new URL(imageUrl);
        const isAllowed = ALLOWED_HOSTS.some(host => urlObj.hostname === host);
        if (!isAllowed) {
            return new NextResponse('Host not allowed', { status: 403 });
        }
    } catch {
        return new NextResponse('Invalid URL', { status: 400 });
    }

    try {
        // Forcer HTTP pour éviter les erreurs SSL côté serveur Vercel → NAS
        const fetchUrl = imageUrl.replace(/^https:\/\//i, 'http://');

        // Plafond de temps : sans lui, un NAS injoignable laisse la fonction
        // pendue jusqu'au timeout de la plateforme. En local (NAS hors réseau)
        // on descend très bas via IMAGE_PROXY_TIMEOUT_MS, sinon les 6 connexions
        // du navigateur restent bloquées et les chunks Next ne se chargent plus.
        // 30 s : les originaux du NAS pèsent plusieurs mégaoctets et remontent
        // par la fibre montante d'une maison. Un plafond trop court ferait
        // échouer des photos qui finissaient par arriver.
        const timeoutMs = Number(process.env.IMAGE_PROXY_TIMEOUT_MS) || 30000;

        const response = await fetch(fetchUrl, {
            // Pas de vérification SSL nécessaire ici car Vercel → IP en HTTP
            headers: {
                'User-Agent': 'Vercel-Image-Proxy/1.0',
            },
            signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
            return new NextResponse(`Upstream error: ${response.status}`, {
                status: response.status
            });
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const original = Buffer.from(await response.arrayBuffer());

        // Largeur demandée (bornée). Les GIF/SVG/animés ne passent pas par sharp.
        const reqW = parseInt(searchParams.get('w') || '', 10);
        const width = Math.min(MAX_W, Math.max(80, isNaN(reqW) ? DEFAULT_W : reqW));
        const skip = /gif|svg|apng/i.test(contentType);

        if (skip) {
            return new NextResponse(new Uint8Array(original), {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        let out: Buffer; let outType = 'image/webp';
        try {
            out = await sharp(original)
                .rotate() // respecte l'orientation EXIF
                .resize({ width, withoutEnlargement: true }) // jamais d'upscale
                .webp({ quality: 82 })
                .toBuffer();
        } catch {
            // Si sharp échoue (format exotique) : on renvoie l'original tel quel.
            out = original; outType = contentType;
        }

        return new NextResponse(new Uint8Array(out), {
            headers: {
                'Content-Type': outType,
                // Cache LONG-TERME : 30 jours dans le CDN Vercel (stale-while-revalidate).
                'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400',
                'Access-Control-Allow-Origin': '*',
                'Vary': 'Accept',
            },
        });
    } catch (error) {
        console.error('Image proxy error:', error);
        return new NextResponse('Failed to fetch image', { status: 500 });
    }
}
