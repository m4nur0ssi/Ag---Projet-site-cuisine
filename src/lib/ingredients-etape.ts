/**
 * Quels ingrédients faut-il pour UNE étape ?
 *
 * Les recettes ne disent pas quel ingrédient va avec quelle étape : on le
 * retrouve en cherchant, dans le texte de l'étape, les mots qui nomment chaque
 * ingrédient (« farine », « citron », « sel »…). Comparaison par mots entiers,
 * sans accents ni pluriel, pour que « citron » ne se trouve pas dans « citronnade »
 * et que « œufs » retrouve « œuf ».
 */
import type { Ingredient } from '@/types';

/** Mots qui qualifient un ingrédient sans le nommer : ils ne suffisent jamais à le reconnaître. */
const MOTS_VIDES = new Set([
    'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'ou', 'au', 'aux', 'en', 'a', 'd', 'l',
    'frais', 'fraiche', 'fraiches', 'petit', 'petite', 'petits', 'petites', 'grand', 'grande', 'gros', 'grosse',
    'moyen', 'moyenne', 'entier', 'entiere', 'rape', 'rapee', 'hache', 'hachee', 'emince', 'eminces',
    'cuit', 'cuite', 'cuits', 'cuites', 'mur', 'mure', 'murs', 'pele', 'pelee', 'coupe', 'coupee',
    'jus', 'zeste', 'poudre', 'sauce', 'pate', 'pates', 'filet', 'morceau', 'morceaux', 'tranche', 'tranches',
    'bon', 'bonne', 'selon', 'gout', 'peu', 'pincee', 'cuillere', 'verre', 'bol', 'sachet', 'boite',
]);

/** Minuscules, sans accents ni ligature, uniquement des lettres séparées par des espaces. */
function normaliser(s: string): string {
    return s
        .toLowerCase()
        .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/[^a-z]+/g, ' ')
        .trim();
}

/** Singulier approximatif : « œufs » → « oeuf », « pommes » → « pomme ». */
function racine(mot: string): string {
    return mot.length > 3 && /[sx]$/.test(mot) ? mot.slice(0, -1) : mot;
}

/** Les ingrédients de la recette dont le nom apparaît dans le texte de l'étape. */
export function ingredientsDeLEtape<T extends Ingredient>(etape: string, ingredients: T[]): T[] {
    const mots = new Set(normaliser(etape).split(' ').filter(Boolean).map(racine));
    if (!mots.size) return [];

    const analyses = ingredients.map((ing) => {
        // Les parenthèses (« (2 ½ tasses) », « (pour badigeonner) ») ne nomment pas l'ingrédient.
        const significatifs = new Set(
            normaliser((ing.name || '').replace(/\([^)]*\)/g, ' '))
                .split(' ')
                .filter((m) => m.length >= 3 && !MOTS_VIDES.has(m))
                .map(racine),
        );
        const trouves = [...significatifs].filter((m) => mots.has(m));
        return { ing, trouves, complet: significatifs.size > 0 && trouves.length === significatifs.size };
    });

    // Un nom entièrement retrouvé (« sucre ») l'emporte sur un nom plus long dont
    // seul un mot colle (« sucre glace ») : l'étape parle du premier, pas du second.
    const motsComplets = new Set(analyses.filter((a) => a.complet).flatMap((a) => a.trouves));
    return analyses
        .filter((a) => a.complet || (a.trouves.length > 0 && !a.trouves.some((m) => motsComplets.has(m))))
        .map((a) => a.ing);
}

/** Libellé court d'une étape pour un minuteur (50 caractères max, sans balises). */
export function libelleMinuteur(etape: string): string {
    const propre = etape.replace(/<[^>]*>/g, '').trim();
    return propre.length > 50 ? propre.substring(0, 47) + '...' : propre;
}

/**
 * Nom court à dire à la fin du minuteur (« carottes : c'est prêt »). Premier
 * ingrédient cité dans l'étape, sans quantité ni parenthèses. Sinon null.
 */
export function nomPourAnnonce<T extends Ingredient>(etape: string, ingredients: T[]): string | null {
    const trouve = ingredientsDeLEtape(etape, ingredients)[0];
    if (!trouve?.name) return null;
    const nom = trouve.name
        .replace(/\([^)]*\)/g, ' ')
        .replace(/^[\s\d½¼¾⅓⅔.,/-]*(?:g|kg|ml|cl|l|cac|cas|c\.\s*à\s*(?:soupe|café)|pincées?|gousses?|tranches?|sachets?)?\s*/i, '')
        .replace(/^(?:de\s+|d'|du\s+|des\s+)/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    return nom ? nom.toLowerCase() : null;
}
