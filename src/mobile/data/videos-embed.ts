/**
 * Le HTML d'embed TikTok, chargé à part.
 * =====================================
 *
 * Il pèse près de 300 ko et ne sert QUE dans une fiche ouverte — l'accueil s'en
 * servait uniquement pour extraire l'identifiant de la vidéo, désormais fourni
 * par les données elles-mêmes. On le sort donc du chargement initial et on va
 * le chercher une fois l'accueil affiché, pendant que l'utilisateur regarde ses
 * rangées.
 *
 * `videoHtmlDe` reste SYNCHRONE : au moment où une fiche s'ouvre, le module est
 * déjà là dans l'immense majorité des cas. S'il ne l'est pas (ouverture très
 * rapide, réseau lent), la fiche s'affiche sans son onglet vidéo, exactement
 * comme pour les neuf recettes du catalogue qui n'ont pas d'embed, et
 * l'onglet apparaît dès que le module arrive.
 */
let table: Record<string, string> | null = null;
let enCours: Promise<Record<string, string>> | null = null;

/** Va chercher le module. Sans effet s'il est déjà là ou déjà en route. */
export function chargerVideos(): Promise<Record<string, string>> {
    if (table) return Promise.resolve(table);
    if (!enCours) {
        enCours = import('@/mobile/data/home-videos')
            .then((m) => (table = m.videoHtmlById))
            .catch(() => (enCours = null) || {});
    }
    return enCours;
}

/** L'embed d'une recette, ou undefined tant que le module n'est pas chargé. */
export function videoHtmlDe(id: string | number): string | undefined {
    return table ? table[String(id)] : undefined;
}
