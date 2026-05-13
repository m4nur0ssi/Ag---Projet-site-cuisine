import marmitonIngredients from '../data/marmiton-ingredients.json';
import ingredientCache from '../data/ingredient-cache.json';
import picNicIngredients from '../data/pic-nic-ingredients.json';

/**
 * Nettoie le nom d'un ingrédient pour la recherche
 */
export function cleanIngredientName(name: string): string {
    if (!name) return '';

    let cleaned = name
        .toLowerCase()
        .replace(/\n/g, ' ')
        // Supprime l'émoji au début
        .replace(/^[ -~]*[\uD83C-􏰀-\uDFFF️]+\s*/, '')
        // Supprime les articles
        .replace(/^(?:les?|la|l['’']|d['’']|des|du|au|une?)\s*/i, '')
        // Supprime les quantités
        .replace(/^(?:\d+[\s,.]*[\d\/-]*|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*(?:cuillères?\s*(?:à\s*café|à\s*soupe)?|cuil\.?\s*(?:à\s*café|à\s*soupe)?|c\.\s*à\s*(?:soupe|café)|cas|cac|c\.a\.c|c\.à\.s|c\.à\.c|pincées?|poignées?|tablettes?|morceaux?|tranches?|gousses?|conserves?|sachets?|briques?|verres?|filets?|filet|blancs?|blanc|jaunes?|jaune|bottes?|tasses?|cuil|cubes?|pots?|boîtes?|boite|grammes?|millilitres?|centilitres?|kilogrammes?|grosses?|petites?|moyennes?|pièces?|mini|belles?|g|cl|ml|kg|jus|zeste|zestes|vanille)\s*(?:de\s+|d['’']|of\s+|du\s+|des\s+)?\s*/i, '')
        .replace(/^(?:de\s+|d['’']|du\s+|des\s+|le\s+|la\s+|l['’']|un\s+|une\s+|au\s+|le\s+jus\s+de\s+|les\s+jus\s+de\s+|le\s+zeste\s+de\s+|les\s+zestes\s+de\s+)/i, '')
        .split(' (')[0]
        .split(',')[0]
        .replace(/\*/g, '')
        .trim();

    return cleaned;
}

/**
 * Traduit un nom d'ingrédient FR/EN vers le format Spoonacular
 * (uniquement pour les ingrédients qu'on sait être dispos sur leur CDN)
 */
const FR_TO_EN: Record<string, string> = {
    // Œufs et laitages
    'oeuf': 'egg',
    'oeufs': 'egg',
    'egg': 'egg',
    'eggs': 'egg',
    'jaune': 'egg-yolk',
    'jaunes': 'egg-yolk',
    'jaune d oeuf': 'egg-yolk',
    'jaunes d oeufs': 'egg-yolk',
    'egg yolk': 'egg-yolk',
    'egg yolks': 'egg-yolk',
    'blanc d oeuf': 'egg-white',
    'lait': 'milk',
    'milk': 'milk',
    'beurre': 'butter',
    'butter': 'butter',
    'creme': 'whipping-cream',
    'cream': 'whipping-cream',
    'whipped cream': 'whipping-cream',
    'whipping cream': 'whipping-cream',
    'yaourt': 'yogurt',
    'yogurt': 'yogurt',
    // Farines / Sucres
    'farine': 'flour',
    'flour': 'flour',
    'cake flour': 'flour',
    'sucre': 'sugar',
    'sugar': 'sugar',
    'cassonade': 'light-brown-sugar',
    'sucre roux': 'light-brown-sugar',
    'levure': 'yeast',
    'yeast': 'yeast',
    // Huiles
    'huile': 'olive-oil',
    'oil': 'olive-oil',
    'vegetable oil': 'olive-oil',
    'huile d olive': 'olive-oil',
    'olive oil': 'olive-oil',
    // Aromates / Épices
    'vanille': 'vanilla',
    'vanilla': 'vanilla',
    'vanilla extract': 'vanilla',
    'cannelle': 'cinnamon',
    'cinnamon': 'cinnamon',
    'paprika': 'paprika',
    'cumin': 'cumin',
    'curry': 'curry-powder',
    'gingembre': 'ginger',
    'ginger': 'ginger',
    'sel': 'salt',
    'salt': 'salt',
    'poivre': 'pepper',
    'pepper': 'pepper',
    // Herbes
    'persil': 'parsley',
    'parsley': 'parsley',
    'basilic': 'basil',
    'basil': 'basil',
    'ciboulette': 'chives',
    'chives': 'chives',
    'menthe': 'mint',
    'mint': 'mint',
    'origan': 'oregano',
    'oregano': 'oregano',
    'thym': 'thyme',
    'thyme': 'thyme',
    'romarin': 'rosemary',
    'rosemary': 'rosemary',
    'aneth': 'dill',
    'dill': 'dill',
    // Fruits
    'fraise': 'strawberries',
    'fraises': 'strawberries',
    'strawberry': 'strawberries',
    'strawberries': 'strawberries',
    'strawberry cubes': 'strawberries',
    'myrtille': 'blueberries',
    'myrtilles': 'blueberries',
    'blueberry': 'blueberries',
    'blueberries': 'blueberries',
    'framboise': 'raspberries',
    'framboises': 'raspberries',
    'raspberry': 'raspberries',
    'raspberries': 'raspberries',
    'citron': 'lemon',
    'lemon': 'lemon',
    'orange': 'orange',
    'pomme': 'apple',
    'apple': 'apple',
    'banane': 'banana',
    'banana': 'banana',
    'mangue': 'mango',
    'mango': 'mango',
    // Légumes
    'tomate': 'tomato',
    'tomates': 'tomato',
    'tomato': 'tomato',
    'tomatoes': 'tomato',
    'tomate cerise': 'cherry-tomatoes',
    'cherry tomato': 'cherry-tomatoes',
    'oignon': 'onion',
    'oignons': 'onion',
    'onion': 'onion',
    'onions': 'onion',
    'ail': 'garlic',
    'garlic': 'garlic',
    'echalote': 'shallots',
    'shallots': 'shallots',
    'carotte': 'carrots',
    'carottes': 'carrots',
    'carrots': 'carrots',
    'carrot': 'carrots',
    'pomme de terre': 'potatoes',
    'pommes de terre': 'potatoes',
    'potato': 'potatoes',
    'potatoes': 'potatoes',
    'courgette': 'zucchini',
    'zucchini': 'zucchini',
    'aubergine': 'eggplant',
    'eggplant': 'eggplant',
    'poivron': 'red-bell-pepper',
    'concombre': 'cucumber',
    'cucumber': 'cucumber',
    'salade': 'lettuce',
    'lettuce': 'lettuce',
    'epinard': 'spinach',
    'spinach': 'spinach',
    'champignon': 'mushrooms',
    'champignons': 'mushrooms',
    'mushroom': 'mushrooms',
    'mushrooms': 'mushrooms',
    'mais': 'corn',
    'corn': 'corn',
    'pois': 'peas',
    'peas': 'peas',
    // Protéines
    'poulet': 'chicken-breasts',
    'chicken': 'chicken-breasts',
    'boeuf': 'beef',
    'beef': 'beef',
    'rumsteck': 'beef',
    'bavette': 'beef',
    'porc': 'pork',
    'pork': 'pork',
    'jambon': 'ham',
    'ham': 'ham',
    'saumon': 'salmon',
    'salmon': 'salmon',
    'thon': 'tuna',
    'tuna': 'tuna',
    'lardon': 'bacon',
    'lardons': 'bacon',
    'bacon': 'bacon',
    // Fromages (Spoonacular en a beaucoup)
    'fromage': 'cheese',
    'cheese': 'cheese',
    'parmesan': 'parmesan',
    'gruyere': 'gruyere',
    'comte': 'gruyere',
    'mozzarella': 'mozzarella',
    'feta': 'feta',
    'cheddar': 'cheddar-cheese',
    'roquefort': 'blue-cheese',
    'camembert': 'camembert',
    'brie': 'brie',
    // Féculents et autres
    'riz': 'rice',
    'rice': 'rice',
    'pates': 'pasta',
    'pasta': 'pasta',
    'pain': 'bread',
    'bread': 'bread',
    // Condiments
    'sauce soja': 'soy-sauce',
    'soy sauce': 'soy-sauce',
    'sauce tomate': 'tomato-sauce',
    'tomato sauce': 'tomato-sauce',
    'vinaigre': 'vinegar',
    'vinegar': 'vinegar',
    'vinaigre de riz': 'rice-vinegar',
    'rice vinegar': 'rice-vinegar',
    'moutarde': 'mustard',
    'mustard': 'mustard',
    'mayonnaise': 'mayonnaise',
    'ketchup': 'ketchup',
    'miel': 'honey',
    'honey': 'honey',
    'sriracha': 'sriracha',
    'olive': 'olives',
    'olives': 'olives',
    // Sucré
    'chocolat': 'milk-chocolate',
    'chocolate': 'milk-chocolate',
    'chocolat noir': 'dark-chocolate',
    'dark chocolate': 'dark-chocolate',
    // Fruits secs
    'noix': 'walnuts',
    'walnuts': 'walnuts',
    'amande': 'almonds',
    'almonds': 'almonds',
    'noisette': 'hazelnuts',
    'hazelnuts': 'hazelnuts',
    'cacahuete': 'peanuts',
    'peanuts': 'peanuts',
    'pistache': 'pistachios',
    'pistaches': 'pistachios',
    'pistachios': 'pistachios',
    // Légumineuses
    'lentille': 'lentils',
    'lentilles': 'lentils',
    'lentils': 'lentils',
    'haricot': 'beans',
    'beans': 'beans',
    'pois chiche': 'chickpeas',
    'chickpeas': 'chickpeas',
    // Divers
    'piment': 'chili-pepper',
    'chili': 'chili-pepper',
    'coco': 'coconut',
    'coconut': 'coconut',
    'lait de coco': 'coconut-milk',
    'coconut milk': 'coconut-milk',
    'red food coloring': 'food-coloring',
    'colorant': 'food-coloring',
    'colorant alimentaire': 'food-coloring',
    'food coloring': 'food-coloring'
};

/**
 * Récupère le meilleur visuel pour un ingrédient.
 * Stratégie :
 *   1. Image LOCALE (/ingredients/*) — qualité garantie
 *   2. Spoonacular CDN avec traduction EN explicite (style Pic Nic, fond blanc)
 *   3. null → l'UI affichera un emoji intelligent
 *
 * Important : on n'accepte PAS les URLs externes (afcdn.com etc.) car elles
 * pointent souvent sur des images cassées ou peu lisibles.
 */
export function getIngredientVisual(name: string): string | null {
    if (!name) return null;

    const cleanName = cleanIngredientName(name);
    if (!cleanName) return null;

    const allDict = {
        ...(ingredientCache as Record<string, string>),
        ...(marmitonIngredients as Record<string, string>),
        ...(picNicIngredients as Record<string, string>)
    };

    const INGREDIENT_ALIASES: Record<string, string> = {
        'sauce salade': 'vinaigrette',
        'chips de pomme de terre': 'pomme de terre',
        'fleur de sel': 'sel',
        'gros sel': 'sel',
        'parmesan rape': 'parmesan',
        'gruyere rape': 'gruyere',
        'emmental rape': 'emmental',
        'comté rape': 'comté',
        'fromage rape': 'parmesan',
        'chocolat en poudre': 'cacao',
        'poudre de cacao': 'cacao',
    };

    // Strips prefixes like "zeste de", "jus de", "extrait de" → keep base ingredient
    const PREFIX_STRIPS = [
        /^zestes?\s+de\s+/i,
        /^jus\s+de\s+/i,
        /^extrait\s+de?\s+/i,
        /^purée\s+de\s+/i,
        /^compote\s+de\s+/i,
        /^crème\s+de\s+/i,
        /^poudre\s+de\s+/i,
        /^huile\s+de\s+/i,
        /^vinaigre\s+de\s+/i,
        /^sirop\s+de\s+/i,
        /^confiture\s+de\s+/i,
        /^coulis\s+de\s+/i,
        /^concentré\s+de\s+/i,
        /^feuilles?\s+de\s+/i,
        /^graines?\s+de\s+/i,
        /^flocons?\s+de\s+/i,
        /^copeaux?\s+de\s+/i,
        /^éclats?\s+de\s+/i,
        /^quartiers?\s+de\s+/i,
        /^tranches?\s+de\s+/i,
    ];

    let searchName = cleanName;
    for (const [key, alias] of Object.entries(INGREDIENT_ALIASES)) {
        if (cleanName.includes(key)) {
            searchName = alias;
            break;
        }
    }

    // Try stripping a prefix to get the base ingredient
    let strippedName: string | null = null;
    for (const prefixRe of PREFIX_STRIPS) {
        if (prefixRe.test(searchName)) {
            strippedName = searchName.replace(prefixRe, '').trim();
            break;
        }
    }

    const normalize = (str: string) => str
        .toLowerCase()
        .replace(/œ/g, 'oe')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/['’]/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const normCleanName = normalize(searchName);
    const normStripped = strippedName ? normalize(strippedName) : null;

    // N'accepte que les URLs locales (fiables)
    const acceptLocal = (url: string | undefined): string | null => {
        if (!url || url === 'no-image') return null;
        if (url.startsWith('/ingredients/')) return url;
        return null;
    };

    // Helper: cherche un nom dans le dict (exact + mot entier)
    const findInDict = (normName: string, keys: string[]): string | null => {
        // Exact match
        for (const key of keys) {
            if (normalize(key) === normName) {
                const local = acceptLocal(allDict[key]);
                if (local) return local;
            }
        }
        // Word match
        const quoteHandler = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const sorted = [...keys].sort((a, b) => b.length - a.length);
        for (const key of sorted) {
            const normKey = normalize(key);
            if (normKey.length < 4) continue;
            try {
                const regex = new RegExp(`\\b${quoteHandler(normKey)}s?\\b`, 'i');
                if (regex.test(normName)) {
                    const local = acceptLocal(allDict[key]);
                    if (local) return local;
                }
            } catch { continue; }
        }
        return null;
    };

    const allKeys = Object.keys(allDict);

    // 1. Cherche le nom complet
    const found1 = findInDict(normCleanName, allKeys);
    if (found1) return found1;

    // 2. Cherche le nom sans préfixe ("zeste de clémentine" → "clémentine")
    if (normStripped) {
        const found2 = findInDict(normStripped, allKeys);
        if (found2) return found2;
    }

    // 3. Essaie aussi avec le nom strippé dans Spoonacular
    const searchForSpoonacular = (normName: string): string | null => {
        if (FR_TO_EN[normName]) {
            return `https://img.spoonacular.com/ingredients_500x500/${FR_TO_EN[normName]}.png`;
        }
        const words = normName.split(/\s+/).filter(w => w.length >= 4);
        const sorted = [...words].sort((a, b) => b.length - a.length);
        for (const word of sorted) {
            if (FR_TO_EN[word]) {
                return `https://img.spoonacular.com/ingredients_500x500/${FR_TO_EN[word]}.png`;
            }
        }
        return null;
    };

    const sp1 = searchForSpoonacular(normCleanName);
    if (sp1) return sp1;

    if (normStripped) {
        const sp2 = searchForSpoonacular(normStripped);
        if (sp2) return sp2;
    }

    // Pas de match fiable → l'UI affichera l'emoji
    return null;
}

/**
 * Traduit (très simplement) un nom d'ingrédient anglais vers le français.
 * On garde les quantités/nombres et on remplace les mots-clés connus.
 * Si rien à traduire, on retourne la chaîne d'origine.
 */
const EN_TO_FR_WORDS: Array<[RegExp, string]> = [
    // ── Adjectifs de préparation (en premier car modifient le nom) ──────────
    [/\bunsalted\b/gi, 'non salé'],
    [/\bsalted\b/gi, 'salé'],
    [/\bmelted\b/gi, 'fondu'],
    [/\bsoftened\b/gi, 'ramolli'],
    [/\bsifted\b/gi, 'tamisé'],
    [/\bsifting\b/gi, 'tamisé'],
    [/\bchopped\b/gi, 'haché'],
    [/\bdiced\b/gi, 'coupé en dés'],
    [/\bsliced\b/gi, 'émincé'],
    [/\bminced\b/gi, 'haché'],
    [/\bgrated\b/gi, 'râpé'],
    [/\bshredded\b/gi, 'râpé'],
    [/\bcrushed\b/gi, 'écrasé'],
    [/\bpeeled\b/gi, 'épluché'],
    [/\bwhole\b/gi, 'entier'],
    [/\bdried\b/gi, 'séché'],
    [/\bfresh\b/gi, 'frais'],
    [/\bfrozen\b/gi, 'surgelé'],
    [/\bcanned\b/gi, 'en conserve'],
    [/\bcooked\b/gi, 'cuit'],
    [/\braw\b/gi, 'cru'],
    [/\bground\b/gi, 'en poudre'],
    [/\bpowdered\b/gi, 'en poudre'],
    [/\bpure\b/gi, 'pur'],
    [/\bnature\b/gi, 'nature'],
    [/\bplain\b/gi, 'nature'],
    [/\bGreek\b/gi, 'grec'],
    [/\bItalian\b/gi, 'italien'],
    [/\bFrench\b/gi, 'français'],
    [/\bDijon\b/gi, 'Dijon'],

    // ── Indications de destination (for the X) ─────────────────────────────
    [/\bfor\s+the\s+swirl\b/gi, 'pour le tourbillon'],
    [/\bfor\s+the\s+filling\b/gi, 'pour la garniture'],
    [/\bfor\s+the\s+topping\b/gi, 'pour le dessus'],
    [/\bfor\s+the\s+glaze\b/gi, 'pour le glaçage'],
    [/\bfor\s+the\s+sauce\b/gi, 'pour la sauce'],
    [/\bfor\s+the\s+dough\b/gi, 'pour la pâte'],
    [/\bfor\s+the\s+batter\b/gi, 'pour la pâte'],
    [/\bfor\s+the\s+frosting\b/gi, 'pour le glaçage'],
    [/\bfor\s+the\s+ganache\b/gi, 'pour la ganache'],
    [/\bfor\s+the\s+crust\b/gi, 'pour la croûte'],
    [/\bfor\s+swirl\b/gi, 'pour le tourbillon'],
    [/\bfor\s+filling\b/gi, 'pour la garniture'],
    [/\bfor\s+topping\b/gi, 'pour le dessus'],
    [/\bfor\s+glaze\b/gi, 'pour le glaçage'],
    [/\bfor\s+garnish\b/gi, 'pour la garniture'],
    [/\bfor\s+serving\b/gi, 'pour servir'],

    // ── Quantités et mesures ───────────────────────────────────────────────
    [/\bteaspoons?\b/gi, 'cuillère à café'],
    [/\btsp\b/gi, 'cuillère à café'],
    [/\btablespoons?\b/gi, 'cuillères à soupe'],
    [/\btbsp\b/gi, 'cuillères à soupe'],
    [/\bcups?\b/gi, 'tasse'],
    [/\bounces?\b/gi, 'oz'],
    [/\bpounds?\b/gi, 'livre'],
    [/\bpinch(?:es)?\b/gi, 'pincée'],
    [/\bhandful\b/gi, 'poignée'],
    [/\bslices?\b/gi, 'tranche'],
    [/\bcloves?\b/gi, 'gousse'],
    [/\bsprigs?\b/gi, 'brin'],
    [/\bstalks?\b/gi, 'tige'],
    [/\bheads?\b/gi, 'tête'],
    [/\bsticks?\b/gi, 'bâton'],
    [/\babout\b/gi, 'environ'],
    [/\bapproximately\b/gi, 'environ'],

    // ── Phrases complexes (longues → prioritaires) ─────────────────────────
    [/\bred\s+food\s+colou?ring\b/gi, 'colorant alimentaire rouge'],
    [/\bfood\s+colou?ring\b/gi, 'colorant alimentaire'],
    [/\bcake\s+flour\b/gi, 'farine à gâteau'],
    [/\bself[\s-]raising\s+flour\b/gi, 'farine avec levure'],
    [/\ball[\s-]purpose\s+flour\b/gi, 'farine'],
    [/\bwhole[\s-]wheat\s+flour\b/gi, 'farine complète'],
    [/\bvegetable\s+oil\b/gi, 'huile végétale'],
    [/\bsunflower\s+oil\b/gi, 'huile de tournesol'],
    [/\bolive\s+oil\b/gi, "huile d'olive"],
    [/\bvanilla\s+extract\b/gi, 'extrait de vanille'],
    [/\bvanilla\s+bean(?:s)?\b/gi, 'gousse de vanille'],
    [/\bvanilla\s+pod(?:s)?\b/gi, 'gousse de vanille'],
    [/\bwhipped\s+cream\b/gi, 'crème fouettée'],
    [/\bwhipping\s+cream\b/gi, 'crème liquide'],
    [/\bheavy\s+cream\b/gi, 'crème épaisse'],
    [/\bdouble\s+cream\b/gi, 'crème entière'],
    [/\bsour\s+cream\b/gi, 'crème aigre'],
    [/\bcoconut\s+milk\b/gi, 'lait de coco'],
    [/\bcoconut\s+cream\b/gi, 'crème de coco'],
    [/\bcoconut\s+oil\b/gi, 'huile de coco'],
    [/\balmond\s+milk\b/gi, "lait d'amande"],
    [/\boat\s+milk\b/gi, "lait d'avoine"],
    [/\bsoy\s+(?:milk|drink)\b/gi, 'lait de soja'],
    [/\bsoy\s+sauce\b/gi, 'sauce soja'],
    [/\btomato\s+sauce\b/gi, 'sauce tomate'],
    [/\btomato\s+paste\b/gi, 'concentré de tomate'],
    [/\btomato\s+puree\b/gi, 'concentré de tomate'],
    [/\brice\s+vinegar\b/gi, 'vinaigre de riz'],
    [/\bwhite\s+wine\s+vinegar\b/gi, 'vinaigre de vin blanc'],
    [/\bapple\s+cider\s+vinegar\b/gi, 'vinaigre de cidre'],
    [/\bbalsamic\s+vinegar\b/gi, 'vinaigre balsamique'],
    [/\begg\s+yolks?\b/gi, "jaune d'œuf"],
    [/\begg\s+whites?\b/gi, "blanc d'œuf"],
    [/\bbrown\s+sugar\b/gi, 'cassonade'],
    [/\bpowdered\s+sugar\b/gi, 'sucre glace'],
    [/\bicing\s+sugar\b/gi, 'sucre glace'],
    [/\bcaster\s+sugar\b/gi, 'sucre en poudre'],
    [/\bgranulated\s+sugar\b/gi, 'sucre'],
    [/\bconfectioners['\s]+sugar\b/gi, 'sucre glace'],
    [/\blight\s+brown\s+sugar\b/gi, 'cassonade claire'],
    [/\bdark\s+brown\s+sugar\b/gi, 'cassonade brune'],
    [/\bcherry\s+tomatoes?\b/gi, 'tomates cerises'],
    [/\bsun[\s-]dried\s+tomatoes?\b/gi, 'tomates séchées'],
    [/\bred\s+bell?\s+pepper(?:s)?\b/gi, 'poivron rouge'],
    [/\bgreen\s+bell?\s+pepper(?:s)?\b/gi, 'poivron vert'],
    [/\byellow\s+bell?\s+pepper(?:s)?\b/gi, 'poivron jaune'],
    [/\bbell\s+pepper(?:s)?\b/gi, 'poivron'],
    [/\bchicken\s+breasts?\b/gi, 'blanc de poulet'],
    [/\bchicken\s+thighs?\b/gi, 'cuisse de poulet'],
    [/\bchicken\s+legs?\b/gi, 'pilon de poulet'],
    [/\bchicken\s+stock\b/gi, 'bouillon de poulet'],
    [/\bvegetable\s+stock\b/gi, 'bouillon de légumes'],
    [/\bbeef\s+stock\b/gi, 'bouillon de bœuf'],
    [/\bground\s+beef\b/gi, 'bœuf haché'],
    [/\bminced\s+beef\b/gi, 'bœuf haché'],
    [/\bminced\s+lamb\b/gi, 'agneau haché'],
    [/\bpork\s+belly\b/gi, 'poitrine de porc'],
    [/\bpork\s+loin\b/gi, 'longe de porc'],
    [/\bpork\s+mince\b/gi, 'porc haché'],
    [/\bcream\s+cheese\b/gi, 'fromage frais'],
    [/\bcheddar\s+cheese\b/gi, 'cheddar'],
    [/\bblue\s+cheese\b/gi, 'fromage bleu'],
    [/\bgoat\s+cheese\b/gi, 'fromage de chèvre'],
    [/\bcottage\s+cheese\b/gi, 'fromage blanc'],
    [/\bGreek\s+yogu?rt\b/gi, 'yaourt grec'],
    [/\bplain\s+yogu?rt\b/gi, 'yaourt nature'],
    [/\bnatural\s+yogu?rt\b/gi, 'yaourt nature'],
    [/\bcake\s+pieces?\b/gi, 'morceaux de gâteau'],
    [/\bstrawberry\s+cubes?\b/gi, 'cubes de fraise'],
    [/\bbaking\s+powder\b/gi, 'levure chimique'],
    [/\bbaking\s+soda\b/gi, 'bicarbonate de soude'],
    [/\bactive\s+dry\s+yeast\b/gi, 'levure boulangère sèche'],
    [/\binstant\s+yeast\b/gi, 'levure boulangère instantanée'],
    [/\bcorn\s+starch\b/gi, 'fécule de maïs'],
    [/\bcorn\s+flour\b/gi, 'fécule de maïs'],
    [/\blemon\s+juice\b/gi, 'jus de citron'],
    [/\blemon\s+zest\b/gi, 'zeste de citron'],
    [/\borange\s+juice\b/gi, "jus d'orange"],
    [/\borange\s+zest\b/gi, "zeste d'orange"],
    [/\bkidney\s+beans?\b/gi, 'haricots rouges'],
    [/\bcannellini\s+beans?\b/gi, 'haricots blancs'],
    [/\bblack\s+beans?\b/gi, 'haricots noirs'],
    [/\bgreen\s+beans?\b/gi, 'haricots verts'],
    [/\bread\s+lentils?\b/gi, 'lentilles rouges'],
    [/\bgreen\s+lentils?\b/gi, 'lentilles vertes'],
    [/\bmaple\s+syrup\b/gi, "sirop d'érable"],
    [/\bfish\s+sauce\b/gi, 'sauce nuoc-mâm'],
    [/\bworcestershire\s+sauce\b/gi, 'sauce Worcestershire'],
    [/\bhot\s+sauce\b/gi, 'sauce piquante'],
    [/\bblack\s+pepper\b/gi, 'poivre noir'],
    [/\bwhite\s+pepper\b/gi, 'poivre blanc'],
    [/\bcayenne\s+pepper\b/gi, 'poivre de Cayenne'],
    [/\bsmoked\s+paprika\b/gi, 'paprika fumé'],
    [/\bcurry\s+powder\b/gi, 'curry en poudre'],
    [/\bGaram\s+masala\b/gi, 'garam masala'],
    [/\bmixed\s+herbs?\b/gi, 'herbes de Provence'],
    [/\bmixed\s+spice(?:s)?\b/gi, "mélange d'épices"],
    [/\bcinnamon\s+stick(?:s)?\b/gi, 'bâton de cannelle'],
    [/\bstar\s+anise?\b/gi, 'anis étoilé'],
    [/\bcloves?\s+garlic\b/gi, "gousses d'ail"],
    [/\bclove(?:s)?\s+of\s+garlic\b/gi, "gousses d'ail"],
    [/\bbay\s+lea(?:f|ves)\b/gi, 'feuille de laurier'],
    [/\bchili\s+flakes?\b/gi, 'flocons de piment'],
    [/\bred\s+chili\b/gi, 'piment rouge'],
    [/\bgreen\s+chili\b/gi, 'piment vert'],
    [/\bpasta\s+sheets?\b/gi, 'feuilles de lasagne'],
    [/\blasagn[ae]\s+sheets?\b/gi, 'feuilles de lasagne'],
    [/\bpuff\s+pastry\b/gi, 'pâte feuilletée'],
    [/\bshort(?:crust)?\s+pastry\b/gi, 'pâte brisée'],
    [/\bfilo\s+pastry\b/gi, 'pâte filo'],
    [/\bpie\s+crust\b/gi, 'pâte brisée'],
    [/\bbasmati\s+rice\b/gi, 'riz basmati'],
    [/\bjasmine\s+rice\b/gi, 'riz jasmin'],
    [/\bwild\s+rice\b/gi, 'riz sauvage'],
    [/\bbrown\s+rice\b/gi, 'riz complet'],
    [/\brisotto\s+rice\b/gi, 'riz à risotto'],
    [/\barb[ou]rio\s+rice\b/gi, 'riz arborio'],
    [/\bsolid\s+butter\b/gi, 'beurre dur'],
    [/\broom\s+temperature\b/gi, 'température ambiante'],
    [/\bat\s+room\s+temp\b/gi, 'à température ambiante'],
    [/\bdark\s+chocolate\b/gi, 'chocolat noir'],
    [/\bwhite\s+chocolate\b/gi, 'chocolat blanc'],
    [/\bmilk\s+chocolate\b/gi, 'chocolat au lait'],
    [/\bcocoa\s+powder\b/gi, 'poudre de cacao'],
    [/\bcocoa\s+nibs?\b/gi, 'éclats de cacao'],
    [/\bgolden\s+syrup\b/gi, 'sirop de maïs'],
    [/\blight\s+corn\s+syrup\b/gi, 'sirop de maïs léger'],
    [/\bcashew\s+nuts?\b/gi, 'noix de cajou'],
    [/\bpecan\s+nuts?\b/gi, 'noix de pécan'],
    [/\bmacadamia\s+nuts?\b/gi, 'noix de macadamia'],
    [/\bpine\s+nuts?\b/gi, 'pignons de pin'],
    [/\bdesiccated\s+coconut\b/gi, 'noix de coco râpée'],
    [/\bcoconut\s+flakes?\b/gi, 'copeaux de noix de coco'],
    [/\bdried\s+fruits?\b/gi, 'fruits secs'],
    [/\bsultanas?\b/gi, 'raisins secs'],
    [/\bcurrents?\b/gi, 'groseilles'],
    [/\bprunes?\b/gi, 'pruneaux'],
    [/\bdates?\b/gi, 'dattes'],
    [/\bfigs?\b/gi, 'figues'],
    [/\bapricots?\b/gi, 'abricots'],
    [/\bcherries\b/gi, 'cerises'],
    [/\bcherry\b/gi, 'cerise'],
    [/\bpeaches?\b/gi, 'pêches'],
    [/\bplums?\b/gi, 'prunes'],
    [/\bkiwi(?:s)?\b/gi, 'kiwi'],
    [/\bmelon\b/gi, 'melon'],
    [/\bwatermelon\b/gi, 'pastèque'],
    [/\bgrapefruits?\b/gi, 'pamplemousse'],
    [/\bpomegranate\b/gi, 'grenade'],
    [/\bpomegranate\s+seeds?\b/gi, 'graines de grenade'],
    [/\bspring\s+onions?\b/gi, 'ciboule'],
    [/\bgreen\s+onions?\b/gi, 'ciboule'],
    [/\bscallions?\b/gi, 'ciboule'],
    [/\bsweet\s+potato(?:es)?\b/gi, 'patate douce'],
    [/\byam(?:s)?\b/gi, 'igname'],
    [/\bparsnips?\b/gi, 'panais'],
    [/\bturnips?\b/gi, 'navet'],
    [/\bradishes?\b/gi, 'radis'],
    [/\bbok\s+choy\b/gi, 'pak-choï'],
    [/\bkale\b/gi, 'chou frisé'],
    [/\barugula\b/gi, 'roquette'],
    [/\brocket\b/gi, 'roquette'],
    [/\bwatercress\b/gi, 'cresson'],
    [/\bendive\b/gi, 'endive'],
    [/\bchicory\b/gi, 'chicorée'],
    [/\bcourgette(?:s)?\b/gi, 'courgette'],
    [/\baubergine(?:s)?\b/gi, 'aubergine'],

    // ── Mots simples (après toutes les phrases) ────────────────────────────
    [/\beggs?\b/gi, 'œuf'],
    [/\byolk(?:s)?\b/gi, "jaune d'œuf"],
    [/\bwhites?\b(?=\s|$)/gi, "blanc d'œuf"],
    [/\bmilk\b/gi, 'lait'],
    [/\bsugar\b/gi, 'sucre'],
    [/\bflour\b/gi, 'farine'],
    [/\bbutter\b/gi, 'beurre'],
    [/\bcream\b/gi, 'crème'],
    [/\bcheese\b/gi, 'fromage'],
    [/\bsalt\b/gi, 'sel'],
    [/\bpepper\b/gi, 'poivre'],
    [/\boil\b/gi, 'huile'],
    [/\bgarlic\b/gi, 'ail'],
    [/\bonions?\b/gi, 'oignon'],
    [/\bshallots?\b/gi, 'échalote'],
    [/\btomato(?:es)?\b/gi, 'tomate'],
    [/\bcarrots?\b/gi, 'carotte'],
    [/\bpotato(?:es)?\b/gi, 'pomme de terre'],
    [/\bzucchini\b/gi, 'courgette'],
    [/\beggplants?\b/gi, 'aubergine'],
    [/\bcucumbers?\b/gi, 'concombre'],
    [/\blettuce\b/gi, 'salade'],
    [/\bspinach\b/gi, 'épinards'],
    [/\bmushrooms?\b/gi, 'champignons'],
    [/\bcorn\b/gi, 'maïs'],
    [/\bpeas\b/gi, 'pois'],
    [/\bchicken\b/gi, 'poulet'],
    [/\bbeef\b/gi, 'bœuf'],
    [/\blamb\b/gi, 'agneau'],
    [/\bpork\b/gi, 'porc'],
    [/\bham\b/gi, 'jambon'],
    [/\bsalmon\b/gi, 'saumon'],
    [/\btuna\b/gi, 'thon'],
    [/\bbacon\b/gi, 'lardons'],
    [/\bprawns?\b/gi, 'crevettes'],
    [/\bshrimps?\b/gi, 'crevettes'],
    [/\bsquid\b/gi, 'calamar'],
    [/\brice\b/gi, 'riz'],
    [/\bpasta\b/gi, 'pâtes'],
    [/\bnoodles?\b/gi, 'nouilles'],
    [/\bbread\b/gi, 'pain'],
    [/\byeast\b/gi, 'levure'],
    [/\bvinegar\b/gi, 'vinaigre'],
    [/\bmustard\b/gi, 'moutarde'],
    [/\bhoney\b/gi, 'miel'],
    [/\bolives?\b/gi, 'olives'],
    [/\bchocolate\b/gi, 'chocolat'],
    [/\bvanilla\b/gi, 'vanille'],
    [/\bcinnamon\b/gi, 'cannelle'],
    [/\bginger\b/gi, 'gingembre'],
    [/\bturmeric\b/gi, 'curcuma'],
    [/\bpaprika\b/gi, 'paprika'],
    [/\bcumin\b/gi, 'cumin'],
    [/\bcoriander\b/gi, 'coriandre'],
    [/\bnutmeg\b/gi, 'muscade'],
    [/\bsaffron\b/gi, 'safran'],
    [/\bparsley\b/gi, 'persil'],
    [/\bbasil\b/gi, 'basilic'],
    [/\bchives\b/gi, 'ciboulette'],
    [/\bmint\b/gi, 'menthe'],
    [/\boregano\b/gi, 'origan'],
    [/\bthyme\b/gi, 'thym'],
    [/\brosemary\b/gi, 'romarin'],
    [/\bdill\b/gi, 'aneth'],
    [/\bsage\b/gi, 'sauge'],
    [/\btarragon\b/gi, 'estragon'],
    [/\bcilantro\b/gi, 'coriandre fraîche'],
    [/\bchervil\b/gi, 'cerfeuil'],
    [/\bstrawberries\b/gi, 'fraises'],
    [/\bstrawberry\b/gi, 'fraise'],
    [/\bblueberries\b/gi, 'myrtilles'],
    [/\bblueberry\b/gi, 'myrtille'],
    [/\braspberries\b/gi, 'framboises'],
    [/\braspberry\b/gi, 'framboise'],
    [/\blemon\b/gi, 'citron'],
    [/\blime\b/gi, 'citron vert'],
    [/\borange\b/gi, 'orange'],
    [/\bapples?\b/gi, 'pomme'],
    [/\bbananas?\b/gi, 'banane'],
    [/\bmango\b/gi, 'mangue'],
    [/\bavocado\b/gi, 'avocat'],
    [/\bpineapple\b/gi, 'ananas'],
    [/\bwalnuts?\b/gi, 'noix'],
    [/\balmonds?\b/gi, 'amandes'],
    [/\bhazelnuts?\b/gi, 'noisettes'],
    [/\bpeanuts?\b/gi, 'cacahuètes'],
    [/\bpistachios?\b/gi, 'pistaches'],
    [/\blentils\b/gi, 'lentilles'],
    [/\bbeans\b/gi, 'haricots'],
    [/\bchickpeas\b/gi, 'pois chiches'],
    [/\bmascarpone\b/gi, 'mascarpone'],
    [/\bparmesan\b/gi, 'parmesan'],
    [/\bmozzarella\b/gi, 'mozzarella'],
    [/\bfeta\b/gi, 'feta'],
    [/\bgruyere\b/gi, 'gruyère'],
    [/\bcamembert\b/gi, 'camembert'],
    [/\bbrie\b/gi, 'brie'],
    [/\bricotta\b/gi, 'ricotta'],
    [/\bcoconut\b/gi, 'noix de coco'],
    [/\bchili\b/gi, 'piment'],
    [/\byogurt\b/gi, 'yaourt'],
    [/\btofu\b/gi, 'tofu'],
    [/\btempeh\b/gi, 'tempeh'],
    [/\bseitan\b/gi, 'seitan'],
    [/\bmayonnaise\b/gi, 'mayonnaise'],
    [/\bketchup\b/gi, 'ketchup'],
    [/\bsriracha\b/gi, 'sriracha'],
    [/\bhummus\b/gi, 'houmous'],
    [/\bpesto\b/gi, 'pesto'],
    [/\bwater\b/gi, 'eau'],
    [/\bstock\b/gi, 'bouillon'],
    [/\bbroth\b/gi, 'bouillon'],
    [/\bwine\b/gi, 'vin'],
    [/\bwhite\s+wine\b/gi, 'vin blanc'],
    [/\bred\s+wine\b/gi, 'vin rouge'],
    [/\bbeer\b/gi, 'bière'],
    [/\brum\b/gi, 'rhum'],
    [/\bwhisky\b/gi, 'whisky'],
    [/\bbrandy\b/gi, 'cognac'],
    [/\bgelatine?\b/gi, 'gélatine'],
    [/\bagar[\s-]agar\b/gi, 'agar-agar'],
    [/\bpectin\b/gi, 'pectine'],
    [/\bxanthan\s+gum\b/gi, 'gomme xanthane'],
];

export function translateIngredientName(name: string): string {
    if (!name) return name;
    let result = name;
    for (const [regex, fr] of EN_TO_FR_WORDS) {
        result = result.replace(regex, fr);
    }
    return result;
}

