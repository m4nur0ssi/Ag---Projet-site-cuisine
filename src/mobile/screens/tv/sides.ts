// Accompagnements — planificateur « Apple TV+ » (route /tv-planner).
//
// L'ancien `isSideDish` juge surtout d'après le TITRE : « n'importe quelle
// recette non carnée dont le titre nomme un légume ou un féculent ». Il laisse
// donc passer des plats complets (une poêlée au chorizo dont le titre parle de
// courgettes) et rate des garnitures dont le titre ne dit rien du contenu.
//
// Ici on relit CHAQUE recette par ses INGRÉDIENTS : aucune viande ni poisson
// nulle part, et une base légume ou féculent réellement présente.

import { Recipe } from '@/mobile/types';
import { isCookable, isSauce, isSweet, isVideoOnly } from '@/lib/mealClassify';

/** Viandes, poissons et charcuteries — cherchés dans le titre ET les ingrédients. */
const MEAT_RX = /(viandes?|b[oœ]ufs?|beef|carne|steaks?|bavettes?|paleron|entrec[ôo]tes?|rumsteck|veau|agneaux?|mouton|lamb|porcs?|pork|lardons?|lard\b|jambons?|ham\b|bacon|saucisse|saucisson|chorizo|merguez|pancetta|coppa|charcuterie|rillettes?|terrines?|p[âa]t[ée]s?\b|poulets?|volailles?|dindes?|canards?|chicken|escalopes?|magrets?|nuggets?|cordon bleu|keftas?|koftas?|foie gras|poissons?|saumons?|thons?|cabillauds?|colin\b|merlu|lieu noir|dorades?|daurades?|sardines?|maquereaux?|truites?|soles?\b|anchois|crevettes?|gambas|moules?\b|hu[îi]tres?|saint[- ]jacques|crabes?|homards?|langoustines?|calamars?|encornets?|poulpes?|seiches?|surimi|crustac|fruits de mer)/i;

/** Formats qui ne sont pas des garnitures, même sans viande. */
const NOT_SIDE_RX = /\b(wraps?|sandwichs?|burgers?|croque|pizzas?|tacos|bagels?|paninis?|hot[- ]dogs?|kebab|pita|club|brunch|cocktail)\b/i;

/** Bases d'accompagnement : féculents et légumes. */
const BASE_RX = /\b(riz|p[âa]tes|pasta|spaghetti|tagliatelle|linguine|penne|rigatoni|macaroni|nouille|vermicelle|semoule|couscous|boulgour|quinoa|polenta|gnocchi|pomme de terre|patate|puree|pur[ée]e|frite|wedges|lentille|haricot|pois chiche|f[èe]ve|l[ée]gume|courgette|aubergine|carotte|poireau|brocoli|chou[- ]fleur|chou|[ée]pinard|haricot vert|petits pois|champignon|potiron|courge|butternut|panais|c[ée]leri|betterave|asperge|artichaut|salade|roquette|m[âa]che|tomate|poivron|ratatouille|gratin|po[êe]l[ée]e|wok de l[ée]gumes|tian|caponata)\b/i;

/** Charcuteries : de la viande, mais au rôle de garniture. */
const CHARCUTERIE_RX = /(lardons?|lard\b|bacon|jambons?|ham\b|pancetta|coppa|chorizo|saucisson)/i;

/**
 * Ce qui NOMME de la viande sans en mettre dans l'assiette : un bouillon de
 * volaille, un fond de veau, une sauce d'huître, de la graisse de canard.
 * Sans ce ménage, « Riz à l'ail », « Riz Pilaf » et « Les pommes boulangères »
 * étaient refusés comme accompagnements à cause de leur bouillon.
 */
const AROME_MOTS = '(?:bouillons?|fonds?|cubes?|gras|graisses?|sauces?|ar[\u00f4o]mes?|extraits?)';
/** « bouillon (volaille, légume ou bœuf) » : la parenthèse entière part avec. */
const AROMES_PARENTHESE_RX = new RegExp(`\\b${AROME_MOTS}\\b[^()\\n]{0,12}\\([^)]*\\)`, 'gi');
const AROMES_RX = new RegExp(
    `\\b${AROME_MOTS}\\b[^,;.\\n]{0,24}?(?:volailles?|b[o\u0153]ufs?|veau|poules?|canards?|hu[\u00eei]tres?|poissons?|crustac[\u00e9e]s?)`,
    'gi'
);

const text = (r: Recipe) =>
    `${r.title || ''} ${(r.ingredients || []).map((i) => i.name).join(' ')}`
        .replace(AROMES_PARENTHESE_RX, ' ')
        .replace(AROMES_RX, ' ');

/**
 * Vrai accompagnement : légume ou féculent, sans la moindre trace de viande
 * ou de poisson, ni sauce, ni sucré.
 */
export function isTVSide(r: Recipe): boolean {
    if (!isCookable(r) || isVideoOnly(r) || isSauce(r) || isSweet(r)) return false;
    const cat = (r.category || '').toLowerCase();
    if (['boissons', 'sauces', 'aperitifs'].includes(cat)) return false;
    if (NOT_SIDE_RX.test(r.title || '')) return false;

    const full = text(r);
    const viande = full.match(MEAT_RX);

    /*
     * Rangé explicitement comme accompagnement : on fait confiance, même s'il
     * y a de la charcuterie — des haricots verts en fagots liés au lard sont
     * une garniture, pas un plat. Une vraie viande (poulet, bœuf, saumon…)
     * reste disqualifiante : le tag WordPress se pose à la louche.
     */
    const tags = (r.tags || []).map((t) => t.toLowerCase());
    const range = tags.some((t) => t.includes('accompagnement')) || cat === 'accompagnements';
    if (range) return !viande || CHARCUTERIE_RX.test(viande[0]);

    // Une seule mention de viande ou de poisson, où que ce soit, disqualifie.
    if (viande) return false;

    // Sinon la base doit apparaître dans le TITRE (le plat porte le nom de sa
    // garniture) ou parmi les trois premiers ingrédients (les principaux).
    if (BASE_RX.test(r.title || '')) return true;
    const first = (r.ingredients || []).slice(0, 3).map((i) => i.name).join(' ');
    return BASE_RX.test(first);
}

/** Toutes les recettes utilisables en accompagnement, photo comprise. */
export const sidePool = (all: Recipe[]) => all.filter((r) => r.image && isTVSide(r));

/**
 * PLAT au sens du planificateur : une recette de la catégorie « plats »,
 * cuisinable, ni sauce ni sucrée. Volontairement différent de `isMainDish`,
 * qui exige une protéine viande ou poisson — cette exigence rendait un menu
 * végétarien impossible à composer, et écartait des plats complets sans viande.
 */
export function isTVMain(r: Recipe): boolean {
    if (!isCookable(r) || isVideoOnly(r) || isSauce(r) || isSweet(r)) return false;
    return (r.category || '').toLowerCase() === 'plats';
}
