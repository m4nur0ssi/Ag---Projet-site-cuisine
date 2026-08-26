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
    cartouche.style.cssText = [
        'position:fixed', 'left:8px', 'right:8px', 'bottom:8px', 'z-index:2147483647',
        'max-height:42vh', 'overflow:auto', 'background:rgba(0,0,0,.86)', 'color:#fff',
        'font:11px/1.35 ui-monospace,monospace', 'padding:8px 10px', 'border-radius:10px',
        'white-space:pre-wrap', 'pointer-events:auto',
    ].join(';');
    cartouche.textContent = 'relevé en cours — fais ton geste…\n';
    document.body.appendChild(cartouche);
    cartouche.addEventListener('click', () => cartouche.remove());

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

    const debut = Date.now();
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
        const liste = (o: Record<string, number>) => Object.entries(o)
            .sort((a, b) => b[1] - a[1])
            .map(([l, n]) => `${String(n).padStart(3)} × ${l}`)
            .join('\n');
        cartouche.textContent = `relevé (${Math.round((Date.now() - debut) / 1000)}s) — touche pour fermer\n`
            + `— ANIMATIONS —\n${liste(compte) || '(aucune)'}\n`
            + `— DÉCALAGES —\n${liste(compteSecousses) || '(aucun)'}`;
        if (Date.now() - debut > 15000) window.clearInterval(minuteur);
    }, 100);
}
