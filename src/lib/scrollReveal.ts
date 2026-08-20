'use client';

/**
 * Révélation au défilement, façon apple.com.
 *
 * Deux mécaniques, séparées à dessein :
 *
 * 1. LES RANGÉES se révèlent à l'approche du bord bas de la fenêtre. C'est un
 *    IntersectionObserver, pas un écouteur de défilement : le navigateur nous
 *    prévient, on ne recalcule rien à chaque pixel. La transition qui suit ne
 *    touche que `opacity` et `transform`, les deux propriétés que le compositeur
 *    anime sans repasser par la mise en page.
 *
 * 2. LE HÉROS s'efface et recule à mesure qu'on le quitte. Là il faut une valeur
 *    continue : on la calcule dans un `requestAnimationFrame` (au plus une fois
 *    par image) et on la pose en variable CSS. Le style fait le reste.
 *
 * `prefers-reduced-motion` coupe tout : les éléments s'affichent, sans mouvement.
 */

const REVEALED = 'data-revealed';

export function startScrollReveal(): () => void {
    if (typeof window === 'undefined') return () => {};

    // Le CSS ne masque les rangées QUE si ce drapeau est posé. Sans lui — script
    // en échec, JavaScript coupé — la page reste entièrement lisible au lieu de
    // rester blanche sous le héros.
    document.documentElement.setAttribute('data-reveal-ready', '1');

    const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calme) {
        document.querySelectorAll('[data-reveal]').forEach((el) => el.setAttribute(REVEALED, '1'));
        return () => {};
    }

    // Marge basse négative : la rangée s'anime quand elle est franchement entrée,
    // pas au premier pixel — sinon tout est déjà révélé avant d'être regardé.
    const io = new IntersectionObserver(
        (entries) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                e.target.setAttribute(REVEALED, '1');
                io.unobserve(e.target);   // une seule fois : rien ne clignote au retour
            });
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );

    const observe = () => {
        document.querySelectorAll('[data-reveal]:not([' + REVEALED + '])').forEach((el) => io.observe(el));
    };
    observe();

    // Les rangées arrivent après coup (chargement, filtres, onglets) : on surveille
    // l'arbre pour les prendre au vol.
    const mo = new MutationObserver(observe);
    mo.observe(document.body, { childList: true, subtree: true });

    // ── Sortie du héros ───────────────────────────────────────────────────
    /**
     * Le défilement n'a pas toujours lieu dans la fenêtre : le shell desktop tient
     * en 100 vh et fait défiler un conteneur interne. `window.scrollY` y reste à
     * zéro — il faut trouver l'ancêtre qui défile vraiment.
     */
    const scrollerDe = (el: HTMLElement | null): HTMLElement | Window => {
        let n: HTMLElement | null = el?.parentElement || null;
        while (n && n !== document.body) {
            const o = getComputedStyle(n).overflowY;
            if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 4) return n;
            n = n.parentElement;
        }
        return window;
    };

    let raf = 0;
    let scroller: HTMLElement | Window = window;
    const majHero = () => {
        raf = 0;
        const hero = document.querySelector('[data-hero]') as HTMLElement | null;
        if (!hero) return;
        const h = hero.offsetHeight || 1;
        const y = scroller === window ? window.scrollY : (scroller as HTMLElement).scrollTop;
        // 0 en haut, 1 quand le héros a défilé de sa moitié : la sortie est finie
        // avant qu'il ne quitte l'écran, sinon on voit un fantôme sur la rangée.
        const p = Math.min(1, Math.max(0, y / (h * 0.55)));
        hero.style.setProperty('--hero-out', p.toFixed(3));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(majHero); };

    // Le héros peut n'être monté qu'au rendu suivant : on branche à ce moment-là.
    const brancher = () => {
        const hero = document.querySelector('[data-hero]') as HTMLElement | null;
        const cible = scrollerDe(hero);
        if (cible === scroller) return;
        (scroller as any).removeEventListener?.('scroll', onScroll);
        scroller = cible;
        (scroller as any).addEventListener('scroll', onScroll, { passive: true });
        majHero();
    };
    brancher();
    const reBrancher = setInterval(brancher, 1000);
    setTimeout(() => clearInterval(reBrancher), 6000);

    return () => {
        document.documentElement.removeAttribute('data-reveal-ready');
        io.disconnect();
        mo.disconnect();
        clearInterval(reBrancher);
        (scroller as any).removeEventListener?.('scroll', onScroll);
        if (raf) cancelAnimationFrame(raf);
    };
}
