/**
 * Ouvrir une recette DIRECTEMENT sur une étape (depuis un chrono, par exemple).
 *
 * La fiche s'ouvre par l'hôte global (`openRecipeFromPlanner`) ; l'étape visée
 * est posée ici, et la fiche qui porte cette recette la lit en se montant — ou
 * à réception de `ALLER_ETAPE` si elle était déjà ouverte : onglet « Étapes »,
 * défilement jusqu'à l'étape, qui s'allume un instant.
 */
export const ALLER_ETAPE = 'magic-aller-etape';

export interface EtapeVisee { recipeId: string; etape: number; quand: number }

type Fenetre = Window & { __etapeVisee?: EtapeVisee };

export function etapeVisee(recipeId: string): number | null {
    if (typeof window === 'undefined') return null;
    const v = (window as Fenetre).__etapeVisee;
    // Une demande vieille de plus de 5 s ne concerne plus personne.
    if (!v || String(v.recipeId) !== String(recipeId) || Date.now() - v.quand > 5000) return null;
    return v.etape;
}

export function allerAEtape(fiche: { id: string | number; title?: string; image?: string }, etape: number): void {
    if (typeof window === 'undefined') return;
    (window as Fenetre).__etapeVisee = { recipeId: String(fiche.id), etape, quand: Date.now() };
    window.dispatchEvent(new CustomEvent('openRecipeFromPlanner', { detail: fiche }));
    window.dispatchEvent(new Event(ALLER_ETAPE));
}
