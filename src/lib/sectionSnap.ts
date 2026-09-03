'use client';

/**
 * Défilement PAR SECTION de l'accueil desktop.
 *
 * L'accueil « Apple TV+ » n'est pas une page qu'on parcourt au pixel : c'est une
 * pile d'écrans. Un cran de molette ne descend donc pas de trois centimètres, il
 * amène LA SECTION SUIVANTE AU CENTRE du cadre — exactement le résultat qu'on
 * obtiendrait en cliquant son onglet dans le menu.
 *
 * Pourquoi au CENTRE et non en haut : deux rangées tiennent dans un écran. Calée
 * en haut, la rangée qui arrive laissait la suivante à moitié dans le cadre, et
 * c'est celle-là qu'on lisait — amputée de ses temps de cuisson, parfois de ses
 * titres, d'autant plus que ses images étaient hautes. Centrée, la rangée est
 * entière quelle que soit la taille de ses cartes, et le décalage disparaît.
 *
 * Quatre pièges, quatre réponses :
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
 * 3. UNE SECTION PLUS HAUTE QUE LE CADRE ne peut pas être centrée (le héros fait
 *    un écran à lui seul) : celle-là se cale en haut, sinon son titre passerait
 *    au-dessus du bord.
 *
 * 4. LE GESTE HORIZONTAL APPARTIENT À LA RANGÉE. Un balayage latéral sur un
 *    carrousel de cartes n'est pas intercepté : la rangée défile normalement.
 *
 * `prefers-reduced-motion` conserve le saut par section mais le fait sec, sans
 * glissement.
 */

/** Durée du glissement d'une section à l'autre. */
const DUREE = 380;
/** Silence exigé (ms) après la fin d'un geste avant d'en accepter un nouveau. */
const REARME = 90;
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

/** Pilotage du défilement par section, pour l'ascenseur qui l'accompagne. */
export interface SnapController {
    /** Débranche tout (molette, clavier, abonnements). */
    detach(): void;
    /** Amène la section `i` au centre. `sec` = sans glissement (glissé du doigt sur l'ascenseur). */
    goTo(i: number, sec?: boolean): void;
    /** Section suivante (`dir` > 0) ou précédente. */
    step(dir: number): void;
    /** Première (`dir` < 0) ou dernière section. */
    bout(dir: number): void;
    /** S'abonne à la section courante et à la liste des titres. Renvoie le désabonnement. */
    subscribe(cb: (index: number, titres: string[]) => void): () => void;
}

const VIDE: SnapController = {
    detach() {}, goTo() {}, step() {}, bout() {},
    subscribe() { return () => {}; },
};

/**
 * Branche le défilement par section sur un conteneur. Les sections sont ses
 * descendants portant `data-snap`, relus à chaque geste (les rangées vont et
 * viennent : « Pour toi », « Reprendre la cuisine »…). Leur titre vient de
 * `data-snap-label`, sinon du `h1`/`h2` qu'elles contiennent.
 *
 * @param marge Air laissée au-dessus d'une section trop haute pour être centrée.
 */
export function startSectionSnap(container: HTMLElement, marge = 18): SnapController {
    if (typeof window === 'undefined') return VIDE;
    const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Les titres ne changent pas : on les lit une fois par section, pas à chaque
    // image de l'animation.
    const titres = new WeakMap<HTMLElement, string>();
    const titreDe = (el: HTMLElement): string => {
        const vu = titres.get(el);
        if (vu) return vu;
        const t = el.getAttribute('data-snap-label')
            || el.querySelector('h1, h2')?.textContent?.trim()
            || 'Section';
        titres.set(el, t);
        return t;
    };

    const sections = () => Array.from(container.querySelectorAll<HTMLElement>('[data-snap]'));

    /** Position de défilement qui amène `el` au centre du cadre (voir l'en-tête). */
    const hautDe = (el: HTMLElement): number => {
        const r = el.getBoundingClientRect();
        const base = r.top - container.getBoundingClientRect().top
            + container.scrollTop - translationY(el);
        const vue = container.clientHeight;
        const max = Math.max(0, container.scrollHeight - vue);
        const y = r.height >= vue - 8 ? base - marge : base - (vue - r.height) / 2;
        return Math.max(0, Math.min(max, Math.round(y)));
    };

    const hauts = (list = sections()) => list.map(hautDe);

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

    const glisser = (vers: number, sec = false) => {
        stop();
        const max = Math.max(0, container.scrollHeight - container.clientHeight);
        const cible = Math.max(0, Math.min(max, vers));
        const depart = container.scrollTop;
        const delta = cible - depart;
        if (sec || calme || Math.abs(delta) < 2) { container.scrollTop = cible; return; }
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
        if (!tops.length || !dir) return;
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

    // ── Section courante, publiée à l'ascenseur ───────────────────────────
    const abonnes = new Set<(i: number, titres: string[]) => void>();
    let rafPub = 0;
    /*
     * On ne prévient les abonnés QUE si quelque chose a changé pour de bon —
     * d'où cette signature (section courante + liste des titres). Sans elle, le
     * `MutationObserver` ci-dessous relançait une publication, la publication
     * mettait à jour l'ascenseur, le rendu de l'ascenseur modifiait le DOM, et
     * l'observateur repartait : une boucle de rendu à chaque image, pour une
     * valeur identique.
     */
    let signature = '';

    const publier = () => {
        rafPub = 0;
        const list = sections();
        if (!list.length) return;
        const tops = hauts(list);
        const y = container.scrollTop;
        let i = 0;
        let d = Infinity;
        tops.forEach((t, k) => { const dd = Math.abs(t - y); if (dd < d) { d = dd; i = k; } });
        const noms = list.map(titreDe);
        const sig = `${i}|${noms.join('\u00a7')}`;
        if (sig === signature) return;
        signature = sig;
        abonnes.forEach((cb) => cb(i, noms));
    };
    const onScroll = () => { if (!rafPub) rafPub = requestAnimationFrame(publier); };

    /*
     * La liste des rangées BOUGE après le premier rendu : « Pour toi » et
     * « Reprendre la cuisine » n'arrivent qu'une fois le stockage relu, et les
     * hauteurs se figent quand les images se posent. L'ascenseur doit suivre —
     * sinon il resterait sur les rangées connues à la milliseconde du montage.
     * Le sursis évite de recalculer trente-neuf rectangles à chaque battement du
     * DOM (vidéos du héros, révélations, cartes qui se posent).
     */
    let sursis: ReturnType<typeof setTimeout> | null = null;
    const republier = () => {
        if (sursis) return;
        sursis = setTimeout(() => { sursis = null; onScroll(); }, 90);
    };
    const mo = new MutationObserver(republier);
    mo.observe(container, { childList: true, subtree: true });
    const ro = new ResizeObserver(republier);
    ro.observe(container);

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
        const debut = e.key === 'Home';
        const fin = e.key === 'End';
        if (!bas && !haut && !debut && !fin) return;
        e.preventDefault();
        if (debut || fin) { const tops = hauts(); if (tops.length) glisser(tops[fin ? tops.length - 1 : 0]); return; }
        aller(bas ? 1 : -1);
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);

    return {
        detach() {
            container.removeEventListener('wheel', onWheel);
            container.removeEventListener('scroll', onScroll);
            window.removeEventListener('keydown', onKey);
            mo.disconnect();
            ro.disconnect();
            if (sursis) clearTimeout(sursis);
            if (rearme) clearTimeout(rearme);
            if (rafPub) cancelAnimationFrame(rafPub);
            abonnes.clear();
            stop();
        },
        goTo(i, sec) {
            const tops = hauts();
            if (!tops.length) return;
            glisser(tops[Math.max(0, Math.min(tops.length - 1, i))], sec);
        },
        step(dir) { aller(dir); },
        bout(dir) {
            const tops = hauts();
            if (tops.length) glisser(tops[dir > 0 ? tops.length - 1 : 0]);
        },
        subscribe(cb) {
            abonnes.add(cb);
            signature = '';            // force une première publication
            publier();
            return () => { abonnes.delete(cb); };
        },
    };
}
