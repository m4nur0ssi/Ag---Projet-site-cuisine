import { NextRequest, NextResponse } from 'next/server';

/**
 * Vignette OFFICIELLE d'une vidéo TikTok, sans en garder de copie.
 *
 * Pourquoi cette route existe : les photos de recettes du site sont des images
 * trouvées puis réhébergées, ce qui n'est pas tenable. TikTok, lui, publie une
 * interface prévue pour ça (oEmbed) : on lui demande l'adresse de la vignette
 * de la vidéo, et on RENVOIE LE VISITEUR dessus. L'image reste chez TikTok, on
 * n'en stocke rien — c'est l'usage prévu par leurs conditions.
 *
 * Deux contraintes ont dicté la forme :
 *
 *   • l'adresse rendue par oEmbed est signée et EXPIRE (48 h environ). La figer
 *     dans les données condamnerait l'image à mourir au bout de deux jours ;
 *     elle doit donc être résolue à la demande ;
 *   • oEmbed n'aime pas être martelé. On garde la réponse en mémoire quelques
 *     heures, bien en deçà de la durée de vie de la signature.
 */

/** Résolutions déjà obtenues : videoId → { url, auteur, jusqu'à quand }. */
const memoire = new Map<string, { url: string; auteur: string; expire: number }>();

/** Six heures : loin de l'expiration de la signature, et oEmbed respire. */
const DUREE_MEMOIRE = 6 * 3600 * 1000;

export async function GET(req: NextRequest) {
    const id = (req.nextUrl.searchParams.get('v') || '').trim();
    // Un identifiant TikTok est une suite de chiffres, rien d'autre : on refuse
    // le reste sans discuter plutôt que d'aller interroger n'importe quelle URL.
    if (!/^\d{5,32}$/.test(id)) {
        return NextResponse.json({ error: 'identifiant invalide' }, { status: 400 });
    }

    const connu = memoire.get(id);
    if (connu && connu.expire > Date.now()) {
        return NextResponse.redirect(connu.url, 302);
    }

    try {
        const oembed = await fetch(
            `https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com/@x/video/${id}`)}`,
            { signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'Mozilla/5.0' } },
        );
        if (!oembed.ok) throw new Error('oembed ' + oembed.status);

        const data = await oembed.json();
        const url: string | undefined = data?.thumbnail_url;
        // On n'accepte que les serveurs de TikTok : cette route ne doit pas
        // pouvoir devenir un renvoi vers n'importe où.
        if (!url || !/^https:\/\/[a-z0-9.-]*tiktokcdn[a-z0-9.-]*\//i.test(url)) {
            throw new Error('vignette absente ou hors TikTok');
        }

        memoire.set(id, { url, auteur: data?.author_name || '', expire: Date.now() + DUREE_MEMOIRE });
        return NextResponse.redirect(url, 302);
    } catch {
        // Vidéo retirée, compte privé, TikTok injoignable : on rend la silhouette
        // du site plutôt qu'une image cassée.
        return NextResponse.redirect(new URL('/images/recipe-placeholder.svg', req.nextUrl.origin), 302);
    }
}
