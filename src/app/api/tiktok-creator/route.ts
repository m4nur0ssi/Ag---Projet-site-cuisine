import { NextResponse } from 'next/server';

/**
 * Résout l'auteur réel d'une vidéo TikTok à partir du SEUL id vidéo.
 *
 * Les recettes stockées gardent un embed générique (tiktok.com/v/{id}) qui
 * renvoie une 404 et ne contient pas le pseudo. Mais l'API oEmbed publique de
 * TikTok, interrogée avec un pseudo bidon (@a/video/{id}), renvoie quand même
 * le vrai author_name + author_url. On l'utilise ici côté serveur (pas de CORS)
 * pour reconstruire :
 *   - le nom affiché du créateur
 *   - le lien vers sa chaîne TikTok
 *   - l'URL canonique de la vidéo (qui, elle, ne 404 pas)
 *
 * Réponse mise en cache (les métadonnées d'une vidéo ne changent pas).
 */
/**
 * Récupère le lien bio (site web externe) d'un profil TikTok par scraping léger
 * de la page publique @handle. TikTok n'autorise qu'un seul lien externe → c'est
 * le "site web" du créateur. Best-effort, ne jette jamais.
 */
async function fetchBioLink(handle: string): Promise<string> {
    try {
        const res = await fetch(`https://www.tiktok.com/@${handle}`, {
            headers: {
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
                'accept-language': 'fr-FR,fr;q=0.9',
            },
            next: { revalidate: 60 * 60 * 24 * 7 },
        });
        if (!res.ok) return '';
        const html = await res.text();
        const m = html.match(/"bioLink":\{"link":"([^"]+)"/);
        let link = m ? m[1] : '';
        if (!link) return '';
        link = link.replace(/\\u002F/g, '/').trim();
        if (!/^https?:\/\//i.test(link)) link = 'https://' + link;
        // garde-fou : URL valide uniquement
        try { new URL(link); } catch { return ''; }
        return link;
    } catch {
        return '';
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = (searchParams.get('id') || '').trim();

    if (!/^\d{5,25}$/.test(id)) {
        return NextResponse.json({ error: 'id vidéo invalide' }, { status: 400 });
    }

    try {
        const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@a/video/${id}`;
        const res = await fetch(oembedUrl, {
            headers: { 'user-agent': 'Mozilla/5.0 (compatible; RecettesMagiques/1.0)' },
            // met en cache la réponse TikTok côté Next (métadonnées stables)
            next: { revalidate: 60 * 60 * 24 * 30 },
        });

        if (!res.ok) {
            return NextResponse.json({ error: 'oEmbed indisponible', status: res.status }, { status: 502 });
        }

        const data: any = await res.json();
        const authorUrl: string = typeof data?.author_url === 'string' ? data.author_url : '';
        const authorName: string = typeof data?.author_name === 'string' ? data.author_name : '';
        const handleMatch = authorUrl.match(/@([A-Za-z0-9._]+)/);
        const handle = handleMatch ? handleMatch[1] : '';
        const thumbnail: string = typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : '';
        // URL canonique = page auteur + /video/{id} → ne renvoie PAS de 404
        const videoUrl = authorUrl ? `${authorUrl}/video/${id}` : `https://www.tiktok.com/embed/v2/${id}`;

        if (!authorUrl && !authorName) {
            return NextResponse.json({ error: 'auteur introuvable' }, { status: 404 });
        }

        // Site web = lien bio du profil TikTok (le seul lien externe autorisé par TikTok).
        // Best-effort : si le scraping échoue, on renvoie simplement pas de website.
        const website = handle ? await fetchBioLink(handle) : '';

        return NextResponse.json(
            { id, authorName, authorUrl, handle, thumbnail, videoUrl, website },
            { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400' } },
        );
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Erreur oEmbed' }, { status: 500 });
    }
}
