/**
 * Ouvrir le clavier AVANT que le champ existe.
 * ============================================
 *
 * iOS ne lève le clavier que si un champ prend le focus PENDANT le geste du
 * doigt. Or nos panneaux de recherche se montent après le clic : un `focus()`
 * posé dans un `setTimeout` arrive trop tard et ne fait rien — la recherche
 * s'ouvre, le curseur n'y est pas, il faut retaper dans le champ.
 *
 * On focalise donc un champ invisible dans le geste lui-même. Le clavier monte
 * tout de suite, et le vrai champ le récupère quand il apparaît (iOS garde le
 * clavier ouvert quand le focus passe d'un champ à un autre).
 *
 * Le même porte-clavier sert à tout le site : BottomNav, menu, planificateur.
 */

let keeper: HTMLInputElement | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

export function ouvrirClavier() {
    if (typeof document === 'undefined') return;
    if (!keeper || !keeper.isConnected) {
        const el = document.createElement('input');
        el.type = 'text';
        el.setAttribute('aria-hidden', 'true');
        el.tabIndex = -1;
        el.autocomplete = 'off';
        // 16 px : en dessous, iOS zoome sur la page en donnant le focus.
        el.style.cssText =
            'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;' +
            'opacity:0;font-size:16px;z-index:-1;pointer-events:none;';
        document.body.appendChild(el);
        keeper = el;
    }
    keeper.focus({ preventScroll: true });
    /*
     * Filet : si le vrai champ n'a pas pris le relais, on rend le clavier plutôt
     * que de laisser la frappe tomber dans le vide. Il est LARGE (5 s) exprès :
     * plus tôt, le porte-clavier lâchait avant l'arrivée du panneau, le clavier
     * redescendait, et le `focus()` du vrai champ — hors du geste — ne pouvait
     * plus le faire remonter. On voyait alors le curseur… sans clavier.
     */
    if (releaseTimer) clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
        if (keeper && document.activeElement === keeper) keeper.blur();
        releaseTimer = null;
    }, 5000);
}

/** Le vrai champ a pris le focus : plus besoin du filet. */
export function clavierRepris() {
    if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null; }
}
