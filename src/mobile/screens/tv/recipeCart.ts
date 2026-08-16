// « Mes recettes » : ingrédients choisis À LA MAIN dans une recette ouverte.
//
// La fiche recette (RecipeDetails) écrit DÉJÀ ces choix dans `magic-shopping-list`
// (clé par recette : { title, image, ingredients: [{ name, checked }] }) via
// `toggleIngredient`, et émet `shoppingListUpdated`. On lit cette même source ici
// pour l'afficher dans un onglet dédié (liste de courses mobile + planner desktop).

export const CART_KEY = 'magic-shopping-list';
export const CART_EVENT = 'shoppingListUpdated';

export interface CartRecipe {
    id: string;
    title: string;
    image?: string;
    ingredients: string[]; // libellés (« - 200 g farine »)
}

/** Recettes du panier (celles avec au moins un ingrédient choisi). */
export function readCart(): CartRecipe[] {
    if (typeof window === 'undefined') return [];
    let raw: Record<string, { title?: string; image?: string; ingredients?: { name: string }[]; source?: string }>;
    try { raw = JSON.parse(localStorage.getItem(CART_KEY) || '{}'); } catch { return []; }
    if (!raw || typeof raw !== 'object') return [];
    return Object.entries(raw)
        // « Par recette » = UNIQUEMENT les recettes choisies à la main dans une fiche.
        // On exclut le menu du planificateur (source 'planner') et les ajouts manuels
        // (source 'manuel') — ceux-là n'appartiennent qu'à « La semaine ».
        .filter(([, r]) => r?.source !== 'planner' && r?.source !== 'manuel')
        .map(([id, r]) => ({
            id,
            title: r?.title || 'Recette',
            image: r?.image,
            ingredients: (r?.ingredients || []).map((i) => i?.name).filter(Boolean) as string[],
        }))
        .filter((r) => r.ingredients.length > 0);
}

/** Retire une recette entière du panier. */
export function removeCartRecipe(id: string) {
    if (typeof window === 'undefined') return;
    let raw: Record<string, unknown>;
    try { raw = JSON.parse(localStorage.getItem(CART_KEY) || '{}'); } catch { return; }
    if (raw && raw[id]) {
        delete raw[id];
        localStorage.setItem(CART_KEY, JSON.stringify(raw));
        window.dispatchEvent(new Event(CART_EVENT));
    }
}
