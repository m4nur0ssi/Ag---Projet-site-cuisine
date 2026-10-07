import type { Ingredient } from '@/types';
import { canonicalIng, parseIngredient } from './ingredients';
import { getIngredientProductVisual } from './ingredient-utils';
import { scaleQuantity } from './utils';

type RecipeIngredient = Ingredient & { shoppingParts?: Ingredient[] };

/** Une carte par produit ; conserve toutes les mesures sans inventer de conversion. */
export function recipeIngredients(ingredients: Ingredient[]): RecipeIngredient[] {
    const groups = new Map<string, RecipeIngredient>();
    for (const ing of ingredients) {
        const embedded = parseIngredient(ing.name);
        const parsed = embedded.qty != null || embedded.range ? embedded : parseIngredient(`${ing.quantity || ''} ${ing.name}`.trim());
        const cleanName = parsed.name
            .replace(/\b(?:finement|grossièrement|préalablement|délicatement|soigneusement)\b/gi, '')
            .replace(/(?:^|\s)(?:éminc[ée]e?s?|hach[ée]e?s?|cisel[ée]e?s?|coup[ée]e?s?)(?=\s|$)/gi, '')
            .replace(/\s+/g, ' ').trim();
        const key = canonicalIng(cleanName).name;
        const measure = parsed.range ? `${parsed.range[0]} à ${parsed.range[1]}${parsed.unit ? ' ' + parsed.unit : ''}` : parsed.qty == null ? '' : `${parsed.qty}${parsed.unit ? ' ' + parsed.unit : ''}`;
        const part: Ingredient = { ...ing, name: cleanName, quantity: embedded.qty != null || embedded.range ? measure : ing.quantity || measure };
        const existing = groups.get(key);
        if (existing) {
            existing.shoppingParts!.push(part);
            existing.quantity = existing.shoppingParts!.map(p => p.quantity).filter(Boolean).join(' + ');
        } else {
            groups.set(key, { ...part, image: getIngredientProductVisual(cleanName) || ing.image, shoppingParts: [part] });
        }
    }
    return [...groups.values()];
}

/** Une seule sélection conserve chaque quantité dans le panier et la liste fusionnée. */
export function shoppingNames(ing: RecipeIngredient, ratio: number): string[] {
    return (ing.shoppingParts || [ing]).map(part => `${scaleQuantity(part.quantity || '', ratio)} ${part.name}`.trim());
}
