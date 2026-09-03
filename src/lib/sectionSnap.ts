'use client';

/**
 * Défilement PAR SECTION de l'accueil desktop.
 *
 * L'accueil « Apple TV+ » n'est pas une page qu'on parcourt au pixel : c'est une
 * pile d'écrans. Un cran de molette ne descend donc pas de trois centimètres, il
 * amène LA SECTION SUIVANTE en haut du cadre — exactement le résultat qu'on
 * obtiendrait en cliquant son onglet dans le menu. Le héros laisse la place au
 * Top 10, le Top 10 aux Nouveautés, et ainsi de suite.
 *
 * Trois pièges, trois réponses :
 *
 * 1. UN GESTE = UNE SECTION. Un trackpad envoie des dizaines d'événements pour
 *    une seule poussée (l'inertie). On verrouille pendant le glissement, puis on
 *    exige un silence (`REARME`) avant d'accepter le geste suivant : sans ça une
 *    chiquenaude traverserait six rangées.
 *
 * 2. LES RANGÉES SONT DÉCALÉES quand elles arrivent. L'animation de révélation
 *    les translate de 34 px vers le bas ; `getBoundingClientRect()` inclut cette
 *    translation et viserait donc 34 px trop bas. On la retranche.
 *
 * 3. LE GESTE HORIZONTAL APPARTIENT À LA RANGÉE. Un balayage latéral sur un
 *    carrousel de cartes n'est pas intercepté : la rangée défile normalement.
 *
 * `prefers-reduced-motion` conserve le saut par section mais le fait sec, sans
 * glissement.
 */

/** Durée du glissement d'une section à l'autre. */
const DUREE = 620;
/** Silence exigé (ms) après la fin d'un geste avant d'en accepter un nouveau. */
const REARME = 140;
/** En dessous, c'est du bruit de trackpad, pas une intention. */
const SEUIL = 6;

/** Translation verticale appliquée par une transformation CSS (0 si aucune). */
function translationY(el: HTMLElement): number {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    const m = t.match(/matrix3d\(([^)]+)\)/);
    if (m) return parseFloat(m[1].split(',')[13]) || 0;
    const m2 = t.match(/matrix\(([^)]+)\)/);
    if (m2) return parseFloat(m2[1].split(',')[5]) || 0;
    return 0;
}

/**
 * Branche le défilement par section sur un conteneur. Les sections sont ses
 * descendants portant `data-snap`, relus à chaque geste (les rangées vont et
 * viennent : « Pour toi », « Reprendre la cuisine »…).
 *
 * @param marge Air laissée au-dessus de la section une fois calée en haut.
 * @returns fonction de débranchement.
 */
export function startSectionSnap(container: HTMLElement, marge = 0): () => void {
    if (typeof window === 'undefined') return () => {};
    const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /** Position de défilement qui cale `el` en haut du conteneur. */
    const hautDe = (el: HTMLElement): number => {
        const y = el.getBoundingClientRect().top - container.getBoundingClientRect().top
            + container.scrollTop - translationY(el);
        return Math.max(0, Math.round(y) - marge);
    };

    const hauts = (): number[] =>
        Array.from(container.querySelectorAll<HTMLElement>('[data-snap]')).map(hautDe);

    let anim = 0;
    let verrou = false;      // un glissement est en cours
    let arme = true;         // prêt à accepter un nouveau geste
    let rearme: ReturnType<typeof setTimeout> | null = null;
    let filet: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
        if (anim) cancelAnimationFrame(anim);
        if (filet) clearTimeout(filet);
        anim = 0; filet = null; verrou = false;
    };

    const glisser = (vers: number) => {
        stop();
        const max = Math.max(0, container.scrollHeight - container.clientHeight);
        const cible = Math.max(0, Math.min(max, vers));
        const depart = container.scrollTop;
        const delta = cible - depart;
        if (calme || Math.abs(delta) < 2) { container.scrollTop = cible; return; }
        const t0 = performance.now();
        verrou = true;
        const pas = (t: number) => {
            const p = Math.min(1, (t - t0) / DUREE);
            // Même courbe que la révélation des rangées : départ franc, arrivée posée.
            const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
            container.scrollTop = depart + delta * e;
            if (p < 1) anim = requestAnimationFrame(pas);
            else { anim = 0; verrou = false; }
        };
        anim = requestAnimationFrame(pas);
        /*
         * Filet de sécurité. Un onglet passé à l'arrière-plan GÈLE
         * `requestAnimationFrame` : sans ce garde-fou, le verrou posé juste
         * au-dessus ne serait jamais relâché et la molette resterait morte au
         * retour sur l'onglet. Passé la durée du glissement, on tranche : on pose
         * la section à sa place et on rend la main.
         */
        filet = setTimeout(() => {
            if (!verrou) return;
            stop();
            container.scrollTop = cible;
        }, DUREE + 220);
    };

    /**
     * Va à la section suivante (`dir` > 0) ou précédente. On ne raisonne pas en
     * « index courant » mais en « première section strictement au-dessous / la
     * dernière strictement au-dessus » : le calage reste juste même si la page a
     * bougé entre-temps (redimensionnement, rangée apparue, lien profond).
     */
    const aller = (dir: number) => {
        const tops = hauts();
        if (!tops.length) return;
        const y = container.scrollTop;
        const eps = 4;
        let j: number;
        if (dir > 0) {
            j = tops.findIndex((t) => t > y + eps);
            if (j < 0) j = tops.length - 1;
        } else {
            j = 0;
            for (let k = 0; k < tops.length; k++) if (tops[k] < y - eps) j = k;
        }
        glisser(tops[j]);
    };

    const onWheel = (e: WheelEvent) => {
        // Geste franchement latéral : il appartient au carrousel de la rangée.
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault();
        if (rearme) clearTimeout(rearme);
        rearme = setTimeout(() => { arme = true; }, REARME);
        if (verrou || !arme || Math.abs(e.deltaY) < SEUIL) return;
        arme = false;
        aller(e.deltaY > 0 ? 1 : -1);
    };

    const onKey = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        const bas = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ';
        const haut = e.key === 'ArrowUp' || e.key === 'PageUp';
        if (!bas && !haut) return;
        e.preventDefault();
        aller(bas ? 1 : -1);
    };

    // Un clic dans la page (carte, flèche de rangée) ne doit pas laisser un
    // glissement en cours reprendre la main sur un scroll déclenché ailleurs.
    container.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);

    return () => {
        container.removeEventListener('wheel', onWheel);
        window.removeEventListener('keydown', onKey);
        if (rearme) clearTimeout(rearme);
        stop();
    };
}
