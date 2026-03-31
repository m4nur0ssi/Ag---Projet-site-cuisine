import marmitonIngredients from '../data/marmiton-ingredients.json';

/**
 * Nettoie le nom d'un ingrédient pour la recherche
 */
export function cleanIngredientName(name: string): string {
    if (!name) return '';
    
    let cleaned = name
        .toLowerCase()
        .replace(/\n/g, ' ')
        // Supprime l'émoji au début (ex: 🥣 ou 🥚)
        .replace(/^[\u0020-\u007E]*[\uD83C-\uDBFF\uDC00-\uDFFF\uFE0F]+\s*/, '')
        // Supprime les articles
        .replace(/^(?:les?|la|l['’\u0027]|d['’\u0027]|des|du|au|une?)\s*/i, '')
        // Supprime les quantités (ex: 3 oeufs, 200g de...)
        .replace(/^(?:\d+[\s,.]*[\d\/-]*|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*(?:cuillères?\s*(?:à\s*café|à\s*soupe)?|cuil\.?\s*(?:à\s*café|à\s*soupe)?|c\.\s*à\s*(?:soupe|café)|cas|cac|c\.a\.c|c\.à\.s|c\.à\.c|pincées?|poignées?|tablettes?|morceaux?|tranches?|gousses?|conserves?|sachets?|briques?|verres?|filets?|filet|blancs?|blanc|jaunes?|jaune|bottes?|tasses?|cuil|cubes?|pots?|boîtes?|boite|grammes?|millilitres?|centilitres?|kilogrammes?|grosses?|petites?|moyennes?|pièces?|mini|belles?|g|cl|ml|kg|jus|zeste|zestes|vanille)\s*(?:de\s+|d['’\u0027]|of\s+|du\s+|des\s+)?\s*/i, '')
        .replace(/^(?:de\s+|d['’\u0027]|du\s+|des\s+|le\s+|la\s+|l['’\u0027]|un\s+|une\s+|au\s+|le\s+jus\s+de\s+|les\s+jus\s+de\s+|le\s+zeste\s+de\s+|les\s+zestes\s+de\s+)/i, '')
        .split(' (')[0]
        .split(',')[0]
        .trim();
    
    return cleaned;
}

/**
 * Récupère le meilleur visuel RÉALISTE pour un ingrédient
 */
export function getIngredientVisual(name: string): string | null {
    if (!name) return null;

    const cleanName = cleanIngredientName(name);
    if (!cleanName) return null;

    const marmitonDict = marmitonIngredients as Record<string, string>;

    const normalize = (str: string) => str.toLowerCase().replace(/œ/g, 'oe').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normCleanName = normalize(cleanName);

    // 1. Recherche par terme exact (normalisé)
    const allKeys = Object.keys(marmitonDict);
    for (const key of allKeys) {
        if (normalize(key) === normCleanName) {
            return marmitonDict[key];
        }
    }

    // 2. Recherche par inclusion de MOT ENTIER (ex: "ail" dans "ail haché", mais pas "sel" dans "ciselé")
    const sortedKeys = allKeys.sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
        const normKey = normalize(key);
        // On utilise des "word boundaries" (\b) pour éviter les inclusions partielles type "ciSELé"
        // On accepte un 's' optionnel pour les pluriels
        const regex = new RegExp(`\\b${normKey}s?\\b`, 'i');
        if (regex.test(normCleanName)) {
            return marmitonDict[key];
        }
    }

    return null;
}
