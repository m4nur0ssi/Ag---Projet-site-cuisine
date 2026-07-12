/**
 * Classification des recettes pour le planificateur / Menu IA.
 * Source UNIQUE partagée desktop + mobile (évite le drift des heuristiques).
 *
 * Règles produit :
 *  - Un PLAT = catégorie "plats", cuisinable, avec une protéine viande/poisson,
 *    ni sauce ni sucré (une glace/dessert mal catégorisée n'est jamais un plat).
 *  - Un ACCOMPAGNEMENT = légume / féculent salé. JAMAIS de viande/poisson,
 *    jamais une sauce/dip, jamais un sucré (même si mal taggé en base).
 *  - Une SAUCE / condiment (dip, pesto, tartinade…) n'est ni plat ni accompagnement.
 */

export const MEAT_FISH = new Set(['poisson', 'boeuf', 'agneau', 'porc', 'poulet']);

// Exclut les fiches restaurant / vidéo sans vraie recette.
export const isCookable = (r: any): boolean =>
    (r?.ingredients || []).length > 0 &&
    !(r.ingredients || []).some((i: any) => /détaillés dans la vidéo/i.test(i?.name || ''));

const scanProtein = (t: string): string => {
    if (/poisson|saumon|salmon|thon|tuna|cabillaud|\bcod\b|crevette|shrimp|prawn|\bcolin\b|merlu|sardine|maquereau|gambas|lieu (noir|jaune)|truite|dorade|crustac|seafood|fruits de mer|\bfish\b|anchois|calmar|poulpe|seiche/.test(t)) return 'poisson';
    if (/agneau|mouton|\blamb\b|mutton|m[ée]choui/.test(t)) return 'agneau';
    if (/b[oœ]uf|\bbeef\b|steak|bavette|kefta|kofta|carne|bourguignon|paleron|entrec[ôo]te|rumsteck|merguez|hamburger|\bviande\b|hach[ée]e?\b/.test(t)) return 'boeuf';
    if (/\bporc\b|\bpork\b|lardon|jambon|\bham\b|bacon|saucisse|chorizo|pancetta|p[âa]t[ée]/.test(t)) return 'porc';
    if (/poulet|volaille|dinde|\bchicken\b|pollo|escalope|taouk|shawarma|chawarma/.test(t)) return 'poulet';
    if (/v[ée]g[ée]tarien|\bvegan\b|tofu|pois chiche|lentille|aubergine|courgette|champignon|brocoli|[ée]pinard|l[ée]gume|halloumi|f[ée]ta/.test(t)) return 'vege';
    return 'autre';
};
// Le TITRE (+ tags) prime : il nomme le plat. Les ingrédients ne servent qu'en repli —
// ils contiennent souvent des alternatives ("viande hachée (ou poulet, ou thon)") qui
// faussaient la protéine.
export const proteinOf = (r: any): string => {
    const fromTitle = scanProtein(`${r?.title || ''} ${(r?.tags || []).join(' ')}`.toLowerCase());
    if (fromTitle !== 'autre') return fromTitle;
    return scanProtein((r?.ingredients || []).map((i: any) => i?.name).join(' ').toLowerCase());
};

// Sauces & condiments (dips, pestos, tartinades…) : ni plat, ni accompagnement.
const SAUCE_RX = /\bsauces?\b|\bdips?\b|pesto|houmous|hummus|tzatziki|guacamole|tapenade|tartinade|\bchutney\b|a[ïi]oli|mayonnaise|vinaigrette|\bcoulis\b|\bmarinade\b/i;
export const isSauce = (r: any): boolean =>
    (r?.tags || []).some((t: string) => /sauce|dip|condiment/i.test(t)) || SAUCE_RX.test(r?.title || '');

// Sucré (dessert / pâtisserie / glace / boisson) : exclu des plats ET des accompagnements.
const SWEET_RX = /glace|sorbet|g[âa]teau|cr[êe]pe|gaufre|tiramisu|mousse au chocolat|panna cotta|\bflan\b|cheesecake|clafoutis|crumble|cookie|brownie|muffin|cupcake|macaron|[ée]clair|beignet|churros|pancake|nougat|pavlova|profiterole|riz au lait|pain perdu|pain d['’][ée]pices|compote|salade de fruits|tarte sucr|tarte aux (pomme|fraise|citron|framboise|abricot|poire|myrtille)|cr[èe]me (br[ûu]l[ée]e|p[âa]tissi[èe]re|dessert|anglaise)|fondant au chocolat|loukoum|baklava|halva|makroud|corne de gazelle|kn?[ae]fe|kunefe|chou.{0,18}(vanille|caramel|chantilly|cr[èe]me)|donut|donuts|dessert/i;
export const isSweet = (r: any): boolean =>
    ['desserts', 'dessert', 'patisserie', 'patisseries', 'glaces', 'glace', 'boissons'].includes((r?.category || '').toLowerCase())
    || (r?.tags || []).some((t: string) => /dessert|p[âa]tisserie|glace|sorbet|sucr/i.test(t))
    || SWEET_RX.test(r?.title || '');

// Vrai PLAT = catégorie plats, cuisinable, non-sauce, non-sucré, protéine viande/poisson.
export const isMainDish = (r: any): boolean =>
    r?.category === 'plats' && isCookable(r) && !isSauce(r) && !isSweet(r) && MEAT_FISH.has(proteinOf(r));

// Un plat est "complet" s'il embarque déjà un féculent / légume.
const SIDE_RX = /\briz\b|p[âa]tes|pasta|spaghetti|tagliatelle|nouille|pur[ée]e|pomme de terre|patate|frite|semoule|couscous|boulgour|quinoa|polenta|gnocchi|lentille|haricot|brocoli|[ée]pinard|courgette|aubergine|carotte|poireau|chou|champignon|petits pois|ratatouille|l[ée]gume|salade|gratin|po[êe]l[ée]e/i;
export const hasSideIncluded = (r: any): boolean =>
    SIDE_RX.test(r?.title || '') || (r?.ingredients || []).some((i: any) => SIDE_RX.test(i?.name || ''));

// ACCOMPAGNEMENT = légume OU féculent salé (riz, pâtes, purée, gratin, poêlée de
// légumes…). JAMAIS viande/poisson, jamais sauce/dip, jamais sucré. On exige un
// signal POSITIF (le titre nomme un légume/féculent) plutôt que « n'importe quel plat
// non-viande » — sinon des wraps, desserts mal rangés, etc. passaient en accompagnement.
export const isSideDish = (r: any): boolean => {
    if (!isCookable(r) || isSauce(r) || isSweet(r)) return false;
    if (MEAT_FISH.has(proteinOf(r))) return false;
    if ((r?.tags || []).some((t: string) => /accompagnement/i.test(t))) return true;
    if ((r?.category || '').toLowerCase() === 'accompagnements') return true;
    // Doit ressembler à un légume / féculent (par le titre).
    return SIDE_RX.test(r?.title || '');
};
