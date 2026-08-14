import { NextRequest, NextResponse } from 'next/server';

/**
 * Domaine canonique unique : le site ne vit QUE sur lesrecettesmagiques.fr.
 * Toute visite via une autre adresse Vercel (aperçus *.vercel.app, ancien
 * domaine…) est renvoyée en 308 vers lesrecettesmagiques.fr, en conservant le
 * chemin et les paramètres. Comme tous les liens internes sont relatifs, une
 * fois arrivé sur le domaine canonique on n'en sort plus, quel que soit le clic.
 *
 * Le développement local (localhost / 127.0.0.1) est laissé intact.
 */

const CANONICAL_HOST = 'lesrecettesmagiques.fr';

export function middleware(req: NextRequest) {
    const host = req.headers.get('host') || '';
    const bare = host.split(':')[0];

    // Local : on ne touche à rien.
    if (bare === 'localhost' || bare === '127.0.0.1' || bare.endsWith('.local')) {
        return NextResponse.next();
    }

    // Déjà sur le bon domaine (avec ou sans www déjà géré par www→apex ailleurs).
    if (bare === CANONICAL_HOST) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.port = '';
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
}

export const config = {
    // On évite les assets statiques et les routes API (webhooks, sync WordPress).
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest).*)'],
};
