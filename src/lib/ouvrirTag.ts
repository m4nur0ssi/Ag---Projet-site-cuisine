import { FERMER_FICHE } from './ficheEvents';

/**
 * Un hashtag (sous la photo d'une fiche, sur l'affiche de l'accueil) devient un
 * lien : il ouvre la grille de TOUTES les recettes de ce tag, dans le même
 * affichage que les rangées de l'accueil.
 *
 * L'accueil écoute `OUVRIR_TAG` et répond `detail.pris = true`. Hors accueil
 * (fiche ouverte depuis le planificateur, par exemple), personne ne répond :
 * on retombe sur le lien `/?tag=…` que l'accueil sait déjà ouvrir à l'arrivée.
 */
export const OUVRIR_TAG = 'magic-open-tag';

export interface OuvrirTagDetail { tag: string; pris: boolean }

export function ouvrirTag(tag: string): void {
    if (typeof window === 'undefined' || !tag) return;
    // La fiche s'écarte d'abord (flottante ou intégrée à l'accueil).
    window.dispatchEvent(new Event(FERMER_FICHE));
    window.dispatchEvent(new Event('magic-close-sheet'));
    const detail: OuvrirTagDetail = { tag, pris: false };
    window.dispatchEvent(new CustomEvent<OuvrirTagDetail>(OUVRIR_TAG, { detail }));
    if (!detail.pris) window.location.assign(`/?tag=${encodeURIComponent(tag)}`);
}
