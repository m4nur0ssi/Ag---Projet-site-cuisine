/**
 * Relevé des animations, à déclencher depuis l'appareil.
 * =====================================================
 *
 * Certains à-coups ne se reproduisent que sur un vrai téléphone, avec un vrai
 * doigt : les navigateurs pilotés à distance ne peignent pas, `requestAnimation
 * Frame` y est gelé, et l'animation qu'on cherche ne s'y exécute jamais. Plutôt
 * que de deviner, on demande à l'appareil ce qui bouge chez lui.
 *
 * Ajouter `?diag=anim` à l'adresse : pendant quinze secondes, le cartouche liste
 * ce qui démarre une animation ET ce qui DÉCALE la mise en page. Cette seconde
 * mesure compte autant : un élément qui saute parce qu'un voisin change de
 * taille ne joue aucune animation, et n'apparaissait donc nulle part.
 * Sans le paramètre, ce fichier ne fait rien.
 */
const PARAMETRE = 'diag=anim';

export function demarrerDiagnosticAnimations(): void {
    if (typeof window === 'undefined') return;
    if (!window.location.search.includes(PARAMETRE)) return;
    if ((window as unknown as Record<string, unknown>).__diagAnim) return;
    (window as unknown as Record<string, unknown>).__diagAnim = true;

    const cartouche = document.createElement('div');
    cartouche.setAttribute('role', 'status');
    /*
     * Le cartouche ne doit RIEN intercepter : la première version se plaçait en
     * bas, sous le pouce, et se fermait au clic — le balayage tombait dessus et
     * arrêtait la mesure au moment précis qu'on voulait observer. Il est donc
     * transparent aux gestes, et posé en haut.
     */
    cartouche.style.cssText = [
        'position:fixed', 'left:6px', 'right:6px', 'top:6px', 'z-index:2147483647',
        'max-height:40vh', 'overflow:hidden', 'background:rgba(0,0,0,.88)', 'color:#fff',
        'font:10px/1.3 ui-monospace,monospace', 'padding:6px 8px', 'border-radius:8px',
        'white-space:pre-wrap', 'pointer-events:none', 'touch-action:none',
    ].join(';');
    cartouche.textContent = 'relevé en cours — ouvre une recette et balaye…\n';
    document.body.appendChild(cartouche);

    const connues = new WeakSet<Animation>();
    document.getAnimations().forEach((a) => connues.add(a));

    const lignes: string[] = [];
    const decrire = (a: Animation) => {
        const effet = a.effect as KeyframeEffect | null;
        const cible = effet && effet.target;
        const nom = String((cible && (cible as HTMLElement).className) || (cible && cible.tagName) || '?')
            .split(' ')[0].slice(0, 26);
        const props = effet && effet.getKeyframes
            ? [...new Set(effet.getKeyframes().flatMap((k) => Object.keys(k))
                .filter((k) => !['offset', 'computedOffset', 'easing', 'composite'].includes(k)))]
            : [];
        const duree = effet ? Math.round(Number(effet.getTiming().duration) || 0) : 0;
        return `${nom} ${duree}ms [${props.join(',')}]`;
    };

    /*
     * Décalages de mise en page. `sources` nomme les éléments qui ont bougé —
     * c'est exactement ce qu'on cherche quand « ça rebondit » sans qu'aucune
     * animation ne tourne.
     */
    const secousses: string[] = [];
    try {
        const observateur = new PerformanceObserver((liste) => {
            for (const entree of liste.getEntries()) {
                const e = entree as PerformanceEntry & {
                    value: number;
                    hadRecentInput: boolean;
                    sources?: { node?: Node; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[];
                };
                // On NE saute PAS `hadRecentInput` : le décalage cherché suit
                // justement un balayage, il porte donc toujours ce drapeau.
                (e.sources || []).forEach((src) => {
                    const n = src.node as HTMLElement | undefined;
                    const nom = String((n && n.className) || (n && n.tagName) || '?').split(' ')[0].slice(0, 26);
                    const dy = Math.round(src.currentRect.top - src.previousRect.top);
                    const dh = Math.round(src.currentRect.height - src.previousRect.height);
                    secousses.push(`${nom} Δy=${dy} Δh=${dh}`);
                });
            }
        });
        observateur.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
    } catch { /* navigateur sans layout-shift : on garde les animations */ }

    /*
     * Position de la piste, image par image.
     *
     * Un rebond « dans le sens du geste » ne se voit dans aucune liste
     * d'animations : il faut regarder la valeur elle-même. On note donc, à
     * chaque frame, le décalage horizontal de la piste, et on résume chaque
     * geste par ses extrêmes — si la valeur dépasse sa cible puis revient, ou
     * repasse du signe opposé avant de se poser, le rebond est là, chiffré.
     */
    const gestes: string[] = [];
    let serie: number[] = [];
    let apres: number[] = [];
    let finGeste = 0;

    const decalageDe = (el: Element | null) => {
        if (!el) return 0;
        const t = getComputedStyle(el as HTMLElement).transform;
        if (!t || t === 'none') return 0;
        const m = t.match(/matrix.*\((.+)\)/);
        if (!m) return 0;
        const v = m[1].split(', ').map(Number);
        return Math.round(v.length > 6 ? v[12] : v[4]);
    };

    /*
     * On suit la piste ET la carte affichée, pendant le geste et UNE DEMI-SECONDE
     * APRÈS. La première version arrêtait de mesurer au moment précis où la piste
     * revient à zéro — c'est-à-dire à l'instant du basculement, donc juste avant
     * ce qu'on cherche.
     */
    const suivrePiste = () => {
        const piste = document.querySelector('[class*="swipeTrack"]');
        const x = decalageDe(piste);
        const maintenant = Date.now();

        if (Math.abs(x) > 2) {
            serie.push(x);
            finGeste = 0;
            apres = [];
        } else if (serie.length > 3) {
            const min = Math.min(...serie);
            const max = Math.max(...serie);
            gestes.push(`${Math.abs(min) > Math.abs(max) ? 'gauche' : 'droite'} : ${min} → ${max}`);
            serie = [];
            finGeste = maintenant;
        } else if (finGeste && maintenant - finGeste < 600) {
            // Après le basculement : la carte du milieu bouge-t-elle encore ?
            const carte = piste && piste.children[Math.floor(piste.children.length / 2)];
            const dx = decalageDe(carte || null);
            if (Math.abs(x) > 0 || Math.abs(dx) > 0) apres.push(x || dx);
        } else if (finGeste && apres.length) {
            const m = apres.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
            if (Math.abs(m) > 1) gestes.push(`   ↳ APRÈS le basculement : ${m}px`);
            apres = [];
            finGeste = 0;
        } else {
            serie = [];
        }
        if (Date.now() - debut < 15000) requestAnimationFrame(suivrePiste);
    };

    const debut = Date.now();
    requestAnimationFrame(suivrePiste);
    const minuteur = window.setInterval(() => {
        document.getAnimations().forEach((a) => {
            if (connues.has(a)) return;
            connues.add(a);
            lignes.push(decrire(a));
        });
        const compte: Record<string, number> = {};
        lignes.forEach((l) => { compte[l] = (compte[l] || 0) + 1; });
        const compteSecousses: Record<string, number> = {};
        secousses.forEach((l) => { compteSecousses[l] = (compteSecousses[l] || 0) + 1; });
        /*
         * L'ordre compte : le cartouche est plafonné en hauteur, et la première
         * version noyait la mesure de la piste sous cinquante lignes d'animations
         * de l'accueil. Les sections utiles passent donc en tête, et la liste des
         * animations est réduite à ce qui se joue DANS la fiche — le reste est
         * compté d'une ligne.
         */
        const liste = (o: Record<string, number>, max = 99) => Object.entries(o)
            .sort((a, b) => b[1] - a[1])
            .slice(0, max)
            .map(([l, n]) => `${String(n).padStart(3)} × ${l}`)
            .join('\n');
        const fiche: Record<string, number> = {};
        let accueil = 0;
        Object.entries(compte).forEach(([l, n]) => {
            if (/^tv_|^SplashScreen/.test(l)) accueil += n; else fiche[l] = n;
        });
        cartouche.textContent = `relevé ${Math.round((Date.now() - debut) / 1000)}s / 15s\n`
            + `— PISTE —\n${gestes.slice(-5).join('\n') || '(aucun geste)'}\n`
            + `— DÉCALAGES —\n${liste(compteSecousses, 4) || '(aucun)'}\n`
            + `— DANS LA FICHE —\n${liste(fiche, 6) || '(aucune)'}\n`
            + `— accueil, derrière : ${accueil} animations`;
        if (Date.now() - debut > 15000) window.clearInterval(minuteur);
    }, 100);
}
