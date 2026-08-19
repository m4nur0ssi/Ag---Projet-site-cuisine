/**
 * Faut-il encore tenter de charger un lecteur TikTok dans ce navigateur ?
 *
 * Le lecteur embarqué a besoin des cookies tiers. Quand ils sont bloqués — c'est
 * le réglage PAR DÉFAUT de Safari — il ne joue pas : il affiche à la place un
 * pavé bleu de texte juridique (« Allow cookies from TikTok on this browser? »)
 * en travers du cadre. Sur une affiche de héros ou une carte de recette, ce pavé
 * remplace purement et simplement la photo du plat.
 *
 * On ne peut pas interroger le navigateur là-dessus : la seule preuve qu'une
 * lecture est possible, c'est qu'une lecture ait eu lieu. On la mémorise donc.
 * Tant qu'aucune vidéo n'a jamais joué et qu'on a essuyé deux échecs, on cesse
 * d'insérer des lecteurs et les photos restent. Un seul succès lève la garde
 * pour de bon (l'utilisateur a accepté les cookies quelque part).
 */

const OK_KEY = 'tiktok-plays-v1';    // '1' = une vidéo a déjà joué ici
const FAIL_KEY = 'tiktok-fails-v1';  // nombre d'essais restés muets
const MAX_FAILS = 2;

const read = (k: string) => {
    try { return localStorage.getItem(k); } catch { return null; }
};
const write = (k: string, v: string) => {
    try { localStorage.setItem(k, v); } catch { /* stockage plein ou refusé */ }
};

/** Peut-on tenter une lecture ? Faux = on garde la photo, sans même essayer. */
export function tiktokAllowed(): boolean {
    if (typeof window === 'undefined') return false;
    if (read(OK_KEY) === '1') return true;
    return Number(read(FAIL_KEY) || 0) < MAX_FAILS;
}

/** Une vidéo a joué pour de bon : la garde saute définitivement. */
export function tiktokPlayed(): void {
    if (read(OK_KEY) === '1') return;
    write(OK_KEY, '1');
    write(FAIL_KEY, '0');
}

/** Le lecteur est resté muet (bandeau de cookies, lecture refusée). */
export function tiktokFailed(): void {
    if (read(OK_KEY) === '1') return;
    write(FAIL_KEY, String(Number(read(FAIL_KEY) || 0) + 1));
}
