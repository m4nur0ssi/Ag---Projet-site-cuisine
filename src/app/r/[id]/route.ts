import { mockRecipes } from '@/data/mockData';
import { decodeHtml } from '@/lib/utils';

/**
 * Lien de partage d'une recette : `/r/<id>`.
 *
 * Deux publics, deux besoins :
 * - l'aperçu de Messages / WhatsApp lit les balises og: de CETTE page → la
 *   photo de la recette et son titre (pas de description : elle s'affichait
 *   en doublon dans les SMS) ;
 * - la personne qui touche l'aperçu est renvoyée aussitôt sur `/?fiche=<id>`,
 *   la fiche ACTUELLE de l'app (DeepLinkOpener), et non sur l'ancienne route
 *   `/recipe/[id]` au rendu très différent.
 *
 * Une page HTML brute plutôt qu'une page Next : le shell de l'app ne rend rien
 * côté serveur sur mobile, un script de redirection n'y figurerait pas. Et pas
 * de redirection HTTP : les robots d'aperçu la suivraient jusqu'à l'accueil,
 * dont les balises og: n'ont pas la photo de la recette.
 */

const BASE = 'https://lesrecettesmagiques.fr';

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function GET(_req: Request, { params }: { params: { id: string } }) {
    const recipe = mockRecipes.find((r) => String(r.id) === String(params.id));
    const cible = recipe ? `/?fiche=${encodeURIComponent(String(recipe.id))}` : '/';
    const titre = recipe ? decodeHtml(recipe.title || '') : 'Les Recettes Magiques';
    const src = recipe?.image || '';
    const image = !src ? '' : /^https?:\/\//i.test(src) ? src : `${BASE}${src.startsWith('/') ? '' : '/'}${src}`;

    const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${BASE}${recipe ? `/recipe/${esc(String(recipe.id))}` : '/'}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Les Recettes Magiques">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:url" content="${BASE}/r/${esc(String(params.id))}">
${image ? `<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(image)}">` : ''}
<meta name="twitter:title" content="${esc(titre)}">
<script>location.replace(${JSON.stringify(cible)});</script>
</head>
<body style="background:#0d0b10;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:40px 16px">
<a href="${esc(cible)}" style="color:#fff">Ouvrir la recette</a>
</body>
</html>`;

    return new Response(html, {
        headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'public, max-age=0, s-maxage=86400',
        },
    });
}
