/**
 * Charger le panneau de recherche AVANT qu'on le demande.
 * ======================================================
 *
 * `TVSpotlight` arrive en `dynamic()` : à la toute première ouverture, son
 * morceau de code met près d'une seconde à descendre. Pendant ce temps le champ
 * n'existe pas — donc pas de curseur, et un clavier qui redescend en attendant.
 *
 * On va donc chercher le morceau dès que le fil est libre, et de nouveau au
 * moment où le doigt se pose sur la loupe : quand le clic arrive, le panneau se
 * monte tout de suite et le champ prend le relais du porte-clavier.
 */

let lance = false;

export function prechargerRecherche() {
    if (lance || typeof window === 'undefined') return;
    lance = true;
    import('@/mobile/screens/tv/TVSpotlight').catch(() => { lance = false; });
}

/** À poser dans un effet de montage : précharge quand le fil est libre. */
export function prechargerRechercheAuRepos() {
    if (typeof window === 'undefined') return () => {};
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (ric) { const id = ric(() => prechargerRecherche()); return () => { (window as unknown as { cancelIdleCallback?: (i: number) => void }).cancelIdleCallback?.(id); }; }
    const t = setTimeout(prechargerRecherche, 1200);
    return () => clearTimeout(t);
}
