/**
 * Proxy d'images pour contourner le problème de Mixed Content.
 * Vercel récupère l'image depuis l'IP du NAS (HTTP) et la sert en HTTPS.
 * Usage: /api/image-proxy?url=http://109.221.250.122/wordpress/...&v=timestamp
 * Le paramètre &v= permet de forcer le rafraîchissement quand une image WordPress change.
 */
import { NextRequest, NextResponse } from 'next/server';

// Domaines autorisés (pour éviter que ce proxy soit utilisé pour autre chose)
const ALLOWED_HOSTS = [
    '109.221.250.122',
    '192.168.1.200',
    'lesrec3ttesm4giques.fr',
];

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

        const response = await fetch(fetchUrl, {
            // Pas de vérification SSL nécessaire ici car Vercel → IP en HTTP
            headers: {
                'User-Agent': 'Vercel-Image-Proxy/1.0',
            },
        });

        if (!response.ok) {
            return new NextResponse(`Upstream error: ${response.status}`, {
                status: response.status
            });
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const buffer = await response.arrayBuffer();

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                // Cache LONG-TERME : 30 jours (2592000s) dans le CDN Vercel
                // On utilise stale-while-revalidate pour que l'image soit servie instantanément même si le cache expire
                'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error('Image proxy error:', error);
        return new NextResponse('Failed to fetch image', { status: 500 });
    }
}
