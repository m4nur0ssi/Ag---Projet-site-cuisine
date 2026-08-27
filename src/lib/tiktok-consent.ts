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

// v2 : la v1 comptait n'importe quel message du lecteur comme une lecture
// réussie, y compris le bandeau de cookies — des navigateurs qui ne liront
// jamais rien étaient marqués « ça joue ici ». On repart de zéro.
const OK_KEY = 'tiktok-plays-v2';    // '1' = une vidéo a déjà joué ici
const FAIL_KEY = 'tiktok-fails-v2';  // nombre d'essais restés muets
const DATE_KEY = 'tiktok-fails-date-v2'; // quand le compte a commencé
const MAX_FAILS = 2;
/*
 * La garde s'oublie au bout d'une semaine.
 *
 * Deux échecs suffisaient à couper les vidéos DÉFINITIVEMENT sur cet appareil.
 * Or la cause est presque toujours un réglage — les cookies tiers bloqués par
 * défaut dans Safari — et un réglage, ça change. Sans péremption, quelqu'un qui
 * autorise TikTok le lendemain garde des photos pour toujours et n'a aucun
 * moyen de le savoir.
 */
const PEREMPTION = 7 * 24 * 3600 * 1000;

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
    const depuis = Number(read(DATE_KEY) || 0);
    if (depuis && Date.now() - depuis > PEREMPTION) {
        write(FAIL_KEY, '0');
        write(DATE_KEY, '');
        return true;
    }
    return Number(read(FAIL_KEY) || 0) < MAX_FAILS;
}

/**
 * L'utilisateur a demandé une vidéo LUI-MÊME.
 *
 * Son geste passe avant notre heuristique : on tente, quoi qu'ait décidé la
 * garde. Si ça marche, elle saute pour de bon ; sinon la photo revient et rien
 * n'est perdu. Sans cette porte, personne ne pouvait revenir en arrière — on
 * refusait même d'essayer quand on nous le demandait explicitement.
 */
export function tiktokDemandeExplicite(): void {
    write(FAIL_KEY, '0');
    write(DATE_KEY, String(Date.now()));
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
    if (!read(DATE_KEY)) write(DATE_KEY, String(Date.now()));
    write(FAIL_KEY, String(Number(read(FAIL_KEY) || 0) + 1));
}

/**
 * Le lecteur TikTok parle-t-il pour dire qu'il JOUE ?
 *
 * Il envoie aussi des messages quand il n'affiche que son bandeau de cookies
 * (`onPlayerReady`, `onError`). Les prendre pour un succès, c'était laisser le
 * pavé bleu « Player error » en travers du visuel ET lever la garde à vie
 * (`tiktok-plays-v1`) sur un navigateur qui ne lira jamais rien. On n'accepte
 * donc que la preuve d'une image qui avance.
 */
export function tiktokSignal(e: MessageEvent): 'play' | 'error' | null {
    const d = e.data as Record<string, unknown> | null;
    if (!d || typeof d !== 'object' || !d['x-tiktok-player']) return null;
    const type = String(d.type || '');
    if (type === 'onError') return 'error';
    if (type === 'onStateChange') return Number(d.value) === 1 ? 'play' : null;
    if (type === 'onCurrentTime') {
        const v = d.value as { currentTime?: number } | number | undefined;
        const t = typeof v === 'object' && v ? Number(v.currentTime) : Number(v);
        return t > 0 ? 'play' : null;
    }
    return null;
}
