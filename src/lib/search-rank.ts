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
    matched: number; // nb d'ingrédients tapés trouvés
    total: number;   // nb d'ingrédients tapés
}

// Construit le "foin" normalisé d'une recette : noms d'ingrédients nettoyés + titre + tags.
const haystackOf = (r: Recipe): string => {
    const ings = (r.ingredients || [])
        .map(i => cleanIngredientText(i?.name || ''))
        .join(' ');
    const tags = (r.tags || []).join(' ');
    return normalizeIng(`${ings} ${r.title || ''} ${tags}`);
};

// Classe les recettes par nombre d'ingrédients tapés présents (desc).
// Renvoie null si < 2 tokens (le caller bascule sur la recherche texte classique).
export const rankByIngredients = (recipes: Recipe[], query: string): RankedRecipe[] | null => {
    const tokens = queryTokens(query);
    if (tokens.length < 2) return null;

    // 3 ingrédients+ : on exige au moins 2 correspondances pour couper le bruit.
    // 2 ingrédients : on garde aussi les 1/2 (sous les 2/2).
    const minMatch = tokens.length >= 3 ? 2 : 1;

    const ranked = recipes
        .map<RankedRecipe>(recipe => {
            const hay = haystackOf(recipe);
            const matched = tokens.reduce((n, t) => (hay.includes(t) ? n + 1 : n), 0);
            return { recipe, matched, total: tokens.length };
        })
        .filter(r => r.matched >= minMatch)
        .sort((a, b) =>
            b.matched - a.matched ||
            (b.recipe.votes || 0) - (a.recipe.votes || 0) ||
            a.recipe.title.localeCompare(b.recipe.title)
        );

    return ranked;
};
