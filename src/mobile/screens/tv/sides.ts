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
import { isCookable, isSauce, isSweet } from '@/lib/mealClassify';

/** Viandes, poissons et charcuteries — cherchés dans le titre ET les ingrédients. */
const MEAT_RX = /(viandes?|hach[ée]e?s?\b|b[oœ]ufs?|beef|carne|steaks?|bavettes?|paleron|entrec[ôo]tes?|rumsteck|veau|agneaux?|mouton|lamb|porcs?|pork|lardons?|lard\b|jambons?|ham\b|bacon|saucisse|saucisson|chorizo|merguez|pancetta|coppa|charcuterie|rillettes?|terrines?|p[âa]t[ée]s?\b|poulets?|volailles?|dindes?|canards?|chicken|escalopes?|magrets?|nuggets?|cordon bleu|keftas?|koftas?|foie gras|poissons?|saumons?|thons?|cabillauds?|colin\b|merlu|lieu noir|dorades?|daurades?|sardines?|maquereaux?|truites?|soles?\b|anchois|crevettes?|gambas|moules?\b|hu[îi]tres?|saint[- ]jacques|crabes?|homards?|langoustines?|calamars?|encornets?|poulpes?|seiches?|surimi|crustac|fruits de mer)/i;

/** Formats qui ne sont pas des garnitures, même sans viande. */
const NOT_SIDE_RX = /\b(wraps?|sandwichs?|burgers?|croque|pizzas?|tacos|bagels?|paninis?|hot[- ]dogs?|kebab|pita|club|brunch|cocktail)\b/i;

/** Bases d'accompagnement : féculents et légumes. */
const BASE_RX = /\b(riz|p[âa]tes|pasta|spaghetti|tagliatelle|linguine|penne|rigatoni|macaroni|nouille|vermicelle|semoule|couscous|boulgour|quinoa|polenta|gnocchi|pomme de terre|patate|puree|pur[ée]e|frite|wedges|lentille|haricot|pois chiche|f[èe]ve|l[ée]gume|courgette|aubergine|carotte|poireau|brocoli|chou[- ]fleur|chou|[ée]pinard|haricot vert|petits pois|champignon|potiron|courge|butternut|panais|c[ée]leri|betterave|asperge|artichaut|salade|roquette|m[âa]che|tomate|poivron|ratatouille|gratin|po[êe]l[ée]e|wok de l[ée]gumes|tian|caponata)\b/i;

const text = (r: Recipe) =>
    `${r.title || ''} ${(r.ingredients || []).map((i) => i.name).join(' ')}`;

/**
 * Vrai accompagnement : légume ou féculent, sans la moindre trace de viande
 * ou de poisson, ni sauce, ni sucré.
 */
export function isTVSide(r: Recipe): boolean {
    if (!isCookable(r) || isSauce(r) || isSweet(r)) return false;
    const cat = (r.category || '').toLowerCase();
    if (['boissons', 'sauces', 'aperitifs'].includes(cat)) return false;
    if (NOT_SIDE_RX.test(r.title || '')) return false;

    const full = text(r);
    // Une seule mention de viande ou de poisson, où que ce soit, disqualifie.
    if (MEAT_RX.test(full)) return false;

    // Rangé explicitement comme accompagnement : on fait confiance.
    const tags = (r.tags || []).map((t) => t.toLowerCase());
    if (tags.some((t) => t.includes('accompagnement'))) return true;
    if (cat === 'accompagnements') return true;

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
    if (!isCookable(r) || isSauce(r) || isSweet(r)) return false;
    return (r.category || '').toLowerCase() === 'plats';
}
