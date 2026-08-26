/**
 * Ce que l'accueil n'a pas besoin de connaître.
 * ============================================
 *
 * Deux paquets de données ne servent QUE dans une fiche ouverte :
 *
 *   • les étapes et les ingrédients — les trois quarts du poids du catalogue,
 *     que l'accueil ne fouillait que pour ranger les recettes par thème (c'est
 *     désormais décidé au build) ;
 *   • le HTML d'embed TikTok, près de 300 ko dont l'accueil n'extrayait qu'un
 *     numéro de vidéo.
 *
 * On les sort du chargement initial et on va les chercher une fois les rangées
 * peintes, pendant que l'utilisateur regarde son écran. Les deux lectures
 * restent SYNCHRONES : au moment où une fiche s'ouvre — plusieurs secondes plus
 * tard dans la vie réelle — les modules sont là.
 */
type Detail = { steps: string[]; ingredients: { quantity?: string; name: string }[] };

let details: Record<string, Detail> | null = null;
let videos: Record<string, string> | null = null;
let enRoute: Promise<void> | null = null;

/** Va chercher les deux modules. Sans effet s'ils sont déjà là ou déjà en route. */
export function chargerVideos(): Promise<void> {
    if (details && videos) return Promise.resolve();
    if (!enRoute) {
        enRoute = Promise.all([
            import('@/mobile/data/home-details').then((m) => { details = m.detailById; }),
            import('@/mobile/data/home-videos').then((m) => { videos = m.videoHtmlById; }),
        ]).then(() => undefined).catch(() => { enRoute = null; });
    }
    return enRoute;
}

/** L'embed d'une recette, ou undefined tant que le module n'est pas chargé. */
export function videoHtmlDe(id: string | number): string | undefined {
    return videos ? videos[String(id)] : undefined;
}

/**
 * Rend à une recette de l'accueil ses étapes, ses ingrédients et sa vidéo, pour
 * la passer à une fiche. Si les modules ne sont pas encore arrivés, la recette
 * repart telle quelle : la fiche s'affiche, et le rappel ci-dessous la complète
 * dès la seconde suivante.
 */
export function completer<T extends { id: string | number }>(recette: T): T {
    const d = details ? details[String(recette.id)] : undefined;
    const html = videos ? videos[String(recette.id)] : undefined;
    if (!d && !html) return recette;
    return {
        ...recette,
        ...(d ? { steps: d.steps, ingredients: d.ingredients } : {}),
        ...(html ? { videoHtml: html } : {}),
    };
}

/** Vrai quand les deux modules sont disponibles. */
export const detailsPrets = () => !!details && !!videos;
