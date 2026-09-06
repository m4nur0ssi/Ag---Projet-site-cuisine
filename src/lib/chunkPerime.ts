'use client';

/**
 * « Loading chunk … failed » : la page est plus vieille que le site.
 * ================================================================
 *
 * Une partie du code n'est demandée qu'au moment où l'on s'en sert — le volet
 * de planification, le choix d'une recette, la recherche. Si un déploiement a
 * eu lieu entre l'ouverture de l'écran et ce clic, le fichier réclamé porte le
 * nom de l'ancienne version : il n'existe plus, et Next.js remonte une erreur
 * qui fait tomber tout l'écran sur « Quelque chose a cassé ».
 *
 * Ce n'est pas un plantage, c'est une page périmée. La bonne réponse est de la
 * recharger : le nouveau document connaît les nouveaux fichiers.
 *
 * Une seule fois, cependant. Si le rechargement ne résout rien — fichier
 * vraiment absent, réseau coupé —, on laisse l'écran d'erreur s'afficher
 * plutôt que de tourner en boucle.
 */

const CLE = 'magic-chunk-recharge';

/**
 * Délai avant d'autoriser un nouveau rattrapage.
 *
 * Ni permanent — la session dure des jours sur un téléphone, et le déploiement
 * suivant mérite le même rattrapage —, ni absent : deux rechargements
 * rapprochés signifient que recharger n'y change rien, et il faut alors laisser
 * l'écran d'erreur parler.
 */
const REPOS_MS = 60 * 1000;

/** L'erreur dit-elle qu'un morceau de code n'a pas pu être chargé ? */
export function estChunkPerime(error: unknown): boolean {
    const e = error as { name?: string; message?: string } | null;
    const msg = `${e?.name || ''} ${e?.message || ''}`;
    return /ChunkLoadError|Loading chunk .* failed|Importing a module script failed|error loading dynamically imported module/i.test(msg);
}

/**
 * Recharge la page si l'erreur est celle d'une version périmée.
 * Renvoie `true` quand le rechargement est lancé — l'appelant n'a alors plus
 * rien à afficher.
 */
export function rechargerSiChunkPerime(error: unknown): boolean {
    if (typeof window === 'undefined' || !estChunkPerime(error)) return false;
    try {
        // Tout juste tenté : le rechargement n'y peut rien, on laisse l'écran
        // d'erreur s'afficher plutôt que de tourner en boucle.
        const dernier = Number(sessionStorage.getItem(CLE) || 0);
        if (dernier && Date.now() - dernier < REPOS_MS) return false;
        sessionStorage.setItem(CLE, String(Date.now()));
    } catch { /* stockage indisponible : on tente quand même, une fois */ }
    window.location.reload();
    return true;
}

