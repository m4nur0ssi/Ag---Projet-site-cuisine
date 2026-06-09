// Recherche multi-ingrédient avec scoring.
// Tape "oeuf farine chocolat" → recettes 3/3 en haut, puis 2/3, etc.
import { normalizeIng, cleanIngredientText } from './ingredients';
import type { Recipe } from '@/types';

// Mots à ignorer dans la requête (liaisons, articles).
const STOP = new Set([
    'et', 'de', 'des', 'du', 'la', 'le', 'les', 'un', 'une', 'au', 'aux',
    'avec', 'ou', 'a', 'à', 'd', 'l', 'en', 'sans',
]);

// Découpe la requête en tokens d'ingrédients normalisés (sans accents, sans stopwords).
export const queryTokens = (query: string): string[] => {
    const seen = new Set<string>();
    return normalizeIng(query)
        .split(/[\s,;+]+/)
        .map(t => t.replace(/[^a-z0-9'-]/g, '').trim())
        .filter(t => t.length >= 2 && !STOP.has(t))
        .filter(t => (seen.has(t) ? false : (seen.add(t), true)));
};

export interface RankedRecipe {
    recipe: Recipe;
    matched: number;          // nb d'ingrédients tapés trouvés
    total: number;            // nb d'ingrédients tapés
    matchedTokens: string[];  // ingrédients tapés présents dans la recette
    missingTokens: string[];  // ingrédients tapés absents
}

// Construit le "foin" normalisé d'une recette : noms d'ingrédients nettoyés + titre + tags.
const haystackOf = (r: Recipe): string => {
    const ings = (r.ingredients || [])
        .map(i => cleanIngredientText(i?.name || ''))
        .join(' ');
    const tags = (r.tags || []).join(' ');
    return normalizeIng(`${ings} ${r.title || ''} ${tags}`);
};

// Recherche STRICTE par ingrédients (#7).
// Règle : seules les recettes contenant TOUS les ingrédients tapés sont des
// résultats (matched === total). En complément, on renvoie les recettes auxquelles
// il manque exactement 1 ingrédient (matched === total-1) comme SUGGESTIONS, placées
// après les résultats stricts. Le caller affiche/masque ces suggestions et indique
// l'ingrédient manquant via `missingTokens`.
// Renvoie null si 0 token (le caller bascule sur la recherche texte classique).
export const rankByIngredients = (recipes: Recipe[], query: string): RankedRecipe[] | null => {
    const tokens = queryTokens(query);
    if (tokens.length < 1) return null;

    const ranked = recipes.map<RankedRecipe>(recipe => {
        const hay = haystackOf(recipe);
        const matchedTokens: string[] = [];
        const missingTokens: string[] = [];
        tokens.forEach(t => (hay.includes(t) ? matchedTokens : missingTokens).push(t));
        return { recipe, matched: matchedTokens.length, total: tokens.length, matchedTokens, missingTokens };
    });

    const byScore = (a: RankedRecipe, b: RankedRecipe) =>
        (b.recipe.votes || 0) - (a.recipe.votes || 0) ||
        a.recipe.title.localeCompare(b.recipe.title);

    // Résultats stricts : tous les ingrédients présents.
    const full = ranked.filter(r => r.matched === r.total).sort(byScore);
    // Suggestions : il manque exactement 1 ingrédient (seulement si ≥2 tapés).
    const partial = tokens.length >= 2
        ? ranked.filter(r => r.matched === r.total - 1).sort(byScore)
        : [];

    return [...full, ...partial];
};
