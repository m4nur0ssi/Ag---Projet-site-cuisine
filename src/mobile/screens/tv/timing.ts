// Temps réels des recettes — accueil « Apple TV+ » (route /tv).
//
// Les valeurs WordPress sont inutilisables : les 617 recettes portent TOUTES
// prepTime 15 + cookTime 30 = 45 min (valeurs par défaut du sync, jamais
// renseignées). On les recalcule donc depuis les ÉTAPES, via l'estimateur déjà
// utilisé par le site (src/lib/recipe-timing.ts) :
//   • cuisson     = somme des durées écrites dans les étapes (« 10 min », « 1 h »)
//   • préparation = somme par étape sans durée (mot-clé reconnu, sinon 3 min)
//     → le temps de préparation croît donc avec LE NOMBRE D'ÉTAPES
//   • difficulté  = nombre d'étapes (≥ 9 difficile, ≥ 5 moyen)

import { Recipe } from '@/mobile/types';
import { estimateRecipeTiming, sumStepMinutes, type RecipeTiming } from '@/lib/recipe-timing';

const cache = new WeakMap<Recipe, RecipeTiming>();

/** Arrondi à 5 min : afficher « 23 min » donnerait une fausse précision. */
const round5 = (n: number) => (n <= 0 ? 0 : Math.max(5, Math.round(n / 5) * 5));

export function timingOf(recipe: Recipe): RecipeTiming {
    let t = cache.get(recipe);
    if (!t) {
        const est = estimateRecipeTiming(recipe.steps);
        t = est.prepTime + est.cookTime > 0
            ? { ...est, prepTime: round5(est.prepTime), cookTime: round5(est.cookTime) }
            // Recette sans étapes exploitables : on retombe sur les valeurs WP.
            : {
                prepTime: recipe.prepTime || 0,
                cookTime: recipe.cookTime || 0,
                difficulty: recipe.difficulty || 'facile',
                steps: (recipe.steps || []).length,
            };
        cache.set(recipe, t);
    }
    return t;
}

/**
 * Minutes écrites NOIR SUR BLANC dans les étapes — cuisson, repos, frigo, levée.
 * Zéro = la recette ne dit rien de son temps, et aucune estimation ne peut le
 * remplacer : les champs WordPress valent 15 + 30 partout.
 *
 * Sert aux thèmes qui promettent une durée (« Express ») : sans durée écrite,
 * on ne peut pas promettre, donc on n'inscrit pas la recette.
 */
export const timedMinutes = (r: Recipe) =>
    (r.steps || []).reduce((n, step) => n + sumStepMinutes(step), 0);

export const totalMinutes = (r: Recipe) => {
    const t = timingOf(r);
    return t.prepTime + t.cookTime;
};

/** « 45 min » ou « 1 h 15 ». */
export const formatMinutes = (m: number) => {
    if (!m) return '';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h} h ${rest}` : `${h} h`;
};
