// Estimation calorique approximative basée sur les noms d'ingrédients
// Valeurs en kcal pour une portion "standard" (~100g ou unité commune)

const CALORIE_MAP: { keywords: string[]; kcal: number }[] = [
    // Protéines
    { keywords: ['poulet', 'chicken', 'blanc de poulet'], kcal: 165 },
    { keywords: ['boeuf', 'beef', 'steak', 'viande hachée', 'boeuf haché'], kcal: 250 },
    { keywords: ['porc', 'pork', 'lardons', 'bacon'], kcal: 242 },
    { keywords: ['saumon', 'salmon'], kcal: 208 },
    { keywords: ['thon', 'tuna'], kcal: 130 },
    { keywords: ['crevettes', 'shrimp', 'gambas'], kcal: 85 },
    { keywords: ['oeuf', 'œuf', 'eggs'], kcal: 78 },
    // Produits laitiers
    { keywords: ['lait', 'milk'], kcal: 42 },
    { keywords: ['crème fraîche', 'crème liquide', 'heavy cream', 'crème'], kcal: 300 },
    { keywords: ['beurre', 'butter'], kcal: 717 },
    { keywords: ['gruyère', 'emmental', 'comté', 'parmesan', 'fromage râpé'], kcal: 410 },
    { keywords: ['mozzarella'], kcal: 280 },
    { keywords: ['yaourt', 'yogurt'], kcal: 59 },
    { keywords: ['fromage blanc', 'ricotta'], kcal: 100 },
    // Féculents
    { keywords: ['farine', 'flour'], kcal: 364 },
    { keywords: ['riz', 'rice'], kcal: 130 },
    { keywords: ['pâtes', 'pasta', 'spaghetti', 'tagliatelles', 'fusilli', 'penne'], kcal: 157 },
    { keywords: ['pomme de terre', 'potato', 'patate'], kcal: 77 },
    { keywords: ['pain', 'bread', 'baguette'], kcal: 265 },
    // Matières grasses
    { keywords: ['huile', 'oil', "huile d'olive"], kcal: 884 },
    // Sucres
    { keywords: ['sucre', 'sugar'], kcal: 387 },
    { keywords: ['chocolat', 'chocolate'], kcal: 546 },
    { keywords: ['miel', 'honey'], kcal: 304 },
    // Légumes (faible calorie, ignorés pour l'estimation)
    { keywords: ['tomate', 'tomato'], kcal: 18 },
    { keywords: ['oignon', 'onion'], kcal: 40 },
    { keywords: ['ail', 'garlic'], kcal: 149 },
    { keywords: ['courgette', 'zucchini'], kcal: 17 },
    { keywords: ['aubergine', 'eggplant'], kcal: 25 },
    { keywords: ['carotte', 'carrot'], kcal: 41 },
    { keywords: ['poivron', 'pepper', 'capsicum'], kcal: 31 },
    { keywords: ['épinards', 'spinach'], kcal: 23 },
    { keywords: ['champignon', 'mushroom'], kcal: 22 },
];

// Parse une quantité : "200g" → 200, "3" → 3 (unité), "50cl" → 500ml→50
function parseQuantity(qStr: string): { amount: number; unit: string } {
    if (!qStr) return { amount: 1, unit: 'unit' };
    const cleaned = qStr.toLowerCase().replace(/\s+/g, '');
    const match = cleaned.match(/^([\d.,]+)\s*(g|kg|ml|cl|l|cs|cc|cup|tbsp|tsp)?/);
    if (!match) return { amount: 1, unit: 'unit' };
    const amount = parseFloat(match[1].replace(',', '.'));
    const unit = match[2] || 'unit';
    // Normaliser en grammes/ml
    if (unit === 'kg') return { amount: amount * 1000, unit: 'g' };
    if (unit === 'cl') return { amount: amount * 10, unit: 'ml' };
    if (unit === 'l') return { amount: amount * 1000, unit: 'ml' };
    if (unit === 'cs' || unit === 'tbsp') return { amount: amount * 15, unit: 'ml' };
    if (unit === 'cc' || unit === 'tsp') return { amount: amount * 5, unit: 'ml' };
    if (unit === 'cup') return { amount: amount * 240, unit: 'ml' };
    return { amount, unit: unit || 'g' };
}

function estimateIngredientCalories(name: string, quantity: string): number {
    const nameLow = name.toLowerCase();
    const entry = CALORIE_MAP.find(e => e.keywords.some(k => nameLow.includes(k)));
    if (!entry) return 0;

    const { amount, unit } = parseQuantity(quantity);

    // kcal table est pour 100g/100ml — ratio
    if (unit === 'unit') {
        // Pour les œufs et unités : kcal direct
        return Math.round(entry.kcal * (amount || 1));
    }
    // Pour g/ml : (amount / 100) * kcal
    return Math.round((amount / 100) * entry.kcal);
}

export interface CalorieEstimate {
    total: number;       // kcal totaux pour la recette
    perServing: number;  // kcal par portion
    confidence: 'low' | 'medium' | 'high'; // selon % d'ingrédients reconnus
}

export function estimateRecipeCalories(
    ingredients: { name: string; quantity: string }[],
    servings: number
): CalorieEstimate {
    let total = 0;
    let recognized = 0;

    for (const ing of ingredients) {
        const cal = estimateIngredientCalories(ing.name, ing.quantity);
        if (cal > 0) {
            total += cal;
            recognized++;
        }
    }

    const ratio = ingredients.length > 0 ? recognized / ingredients.length : 0;
    const confidence: 'low' | 'medium' | 'high' =
        ratio >= 0.5 ? 'high' : ratio >= 0.25 ? 'medium' : 'low';

    const perServing = servings > 0 ? Math.round(total / servings) : total;

    return { total: Math.round(total), perServing, confidence };
}
