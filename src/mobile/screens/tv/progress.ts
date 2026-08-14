// « Reprendre la cuisine » : rangée AUTOMATIQUE des recettes réellement EN COURS.
//
// Une recette est en cours quand certaines de ses étapes sont cochées, mais pas
// toutes — la fiche mémorise l'état dans `recipe-steps-<id>` (tableau de booléens,
// écrit par RecipeDetails). Ni « pas commencée » (0 coché), ni « terminée » (tout
// coché) : seulement ce qui est entamé. C'est ce qui distingue cette rangée de
// la liste MANUELLE « À faire plus tard » (clic droit), avec laquelle elle ne
// fait plus doublon.

import { Recipe } from '@/mobile/types';

/** Émis quand une étape est cochée/décochée : la home recalcule sa rangée. */
export const PROGRESS_EVENT = 'tv-progress-change';

const STEPS_KEY = (id: string | number) => `recipe-steps-${id}`;

/** Progression d'une recette en % (0 si aucune étape connue). */
export function recipeProgress(id: string | number): number {
    if (typeof window === 'undefined') return 0;
    let raw: string | null;
    try { raw = localStorage.getItem(STEPS_KEY(id)); } catch { return 0; }
    if (!raw) return 0;
    let arr: unknown;
    try { arr = JSON.parse(raw); } catch { return 0; }
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    const done = arr.filter(Boolean).length;
    return Math.round((done / arr.length) * 100);
}

/** Retire une recette de « Reprendre la cuisine » : on efface son avancement. */
export function clearProgress(id: string | number): void {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(STEPS_KEY(id)); } catch { /* noop */ }
    window.dispatchEvent(new Event(PROGRESS_EVENT));
}

/**
 * Recettes en cours (0 % < progression < 100 %), les plus avancées d'abord.
 * `all` = catalogue complet ; on ne garde que celles qui ont un état d'étapes.
 */
export function inProgressRecipes(all: Recipe[]): { recipe: Recipe; pct: number }[] {
    if (typeof window === 'undefined') return [];
    const out: { recipe: Recipe; pct: number }[] = [];
    for (const r of all) {
        const pct = recipeProgress(r.id);
        if (pct > 0 && pct < 100) out.push({ recipe: r, pct });
    }
    return out.sort((a, b) => b.pct - a.pct);
}
