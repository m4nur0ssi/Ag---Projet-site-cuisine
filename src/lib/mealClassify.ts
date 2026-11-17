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
/**
 * Recette dont les ingrédients ne sont pas écrits : la fiche renvoie à la
 * vidéo. Elles restent cuisinables — on regarde — mais ne peuvent pas nourrir
 * une liste de courses ni servir d'accompagnement.
 */
export const isVideoOnly = (r: any): boolean =>
    (r?.ingredients || []).some((i: any) => /détaillés dans la vidéo/i.test(i?.name || ''));

/**
 * Recette qu'on peut mettre au menu. Les recettes « détaillées dans la vidéo »
 * en font partie : les écarter revenait à les rendre impossibles à planifier
 * alors qu'elles s'affichent partout ailleurs.
 */
export const isCookable = (r: any): boolean => (r?.ingredients || []).length > 0;

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

/**
 * Une sauce, c'est une recette DE sauce — pas un plat qui vient avec.
 *
 * Le tag WordPress « Sauces » est posé sur tout ce qui se sert nappé, et le mot
 * se promène dans les titres : « Poulet croustillant sauce aigre-douce »,
 * « Nachos avec un déluge de sauce cheddar », « Arayes libanais et Tzatziki
 * maison ». Pris pour des sauces, ces 38 plats n'avaient plus de place au
 * planificateur — l'entrée « Ajouter au planificateur » disparaissait du menu.
 *
 * La recette est rangée en sauces (la synchro a déjà vérifié le titre), ou son
 * titre COMMENCE par le mot : « Sauce Roquefort » et « Dip de courgette » en
 * sont, « Poulet croustillant sauce aigre-douce » est un plat.
 */
const OUVRE_SUR_SAUCE = new RegExp(`^(?:la |le |les |l['’])?\\s*(?:${SAUCE_RX.source})`, 'i');
export const isSauce = (r: any): boolean =>
    (r?.category || '').toLowerCase() === 'sauces'
    || OUVRE_SUR_SAUCE.test(String(r?.title || '').trim());

// Sucré (dessert / pâtisserie / glace / boisson) : exclu des plats ET des accompagnements.
const SWEET_RX = /glace|sorbet|g[âa]teau|cr[êe]pe|gaufre|tiramisu|mousse au chocolat|panna cotta|\bflan\b|cheesecake|clafoutis|crumble|cookie|brownie|muffin|cupcake|macaron|[ée]clair|beignet|churros|pancake|nougat|pavlova|profiterole|riz au lait|pain perdu|pain d['’][ée]pices|compote|salade de fruits|tarte sucr|tarte aux (pomme|fraise|citron|framboise|abricot|poire|myrtille)|cr[èe]me (br[ûu]l[ée]e|p[âa]tissi[èe]re|dessert|anglaise)|fondant au chocolat|loukoum|baklava|halva|makroud|corne de gazelle|kn?[ae]fe|kunefe|chou.{0,18}(vanille|caramel|chantilly|cr[èe]me)|donut|donuts|dessert/i;
export const isSweet = (r: any): boolean =>
    ['desserts', 'dessert', 'patisserie', 'patisseries', 'glaces', 'glace', 'boissons'].includes((r?.category || '').toLowerCase())
    || (r?.tags || []).some((t: string) => /dessert|p[âa]tisserie|glace|sorbet|sucr/i.test(t))
    || SWEET_RX.test(r?.title || '');

// Vrai PLAT = catégorie plats, cuisinable, non-sauce, non-sucré, protéine viande/poisson.
export const isMainDish = (r: any): boolean =>
    r?.category === 'plats' && isCookable(r) && !isSauce(r) && !isSweet(r) && MEAT_FISH.has(proteinOf(r));

/*
 * Un plat est « complet » quand il n'a pas besoin qu'on lui ajoute quoi que ce
 * soit pour faire un repas. On le juge sur ce qu'il CONTIENT, pas sur un mot
 * isolé : l'ancienne règle cherchait « champignon », « chou », « salade »… dans
 * le titre ou dans UN SEUL ingrédient, si bien que des brochettes de
 * champignons (aucune viande, aucun féculent) passaient pour un plat complet.
 *
 * Règles, dans l'ordre :
 *   1. Le titre nomme un plat qui se sert seul (couscous, lasagnes, gratin,
 *      risotto, paella, hachis parmentier, soupe, tarte, burger…). Curry,
 *      tajine et chili n'en sont PAS : on les sert avec du riz ou de la semoule.
 *   2. Il contient un FÉCULENT (riz, pâtes, pommes de terre, semoule, pain,
 *      légumineuses…) : complet, avec ou sans viande.
 *   3. Viande ou poisson SANS féculent : complet seulement s'il y a aussi des
 *      LÉGUMES (poulet et courgettes). Viande ou poisson seul = servi nu.
 *   4. Sans viande ni poisson ni féculent (brochettes de champignons, omelette,
 *      légumes rôtis) : complet seulement avec légumes ET protéine (œuf, tofu,
 *      fromage frais…). Sinon il manque de quoi faire un repas : on propose
 *      un accompagnement.
 */
const TITRE_COMPLET_RX = /couscous|lasagne|cannelloni|gratin|risotto|paella|hachis|parmentier|pot[- ]au[- ]feu|moussaka|cassoulet|choucroute|ratatouille|soupe|velout[ée]|potage|gaspacho|burger|hamburger|pizza|calzone|focaccia|quiche|tourte|tarte|tatin|feuillet|friand|chausson|empanada|samoussa|samosa|brick|gyoza|b[öo]rek|pastilla|sandwich|croque|tartine|toast|bagel|pan bagnat|hot ?dog|corn dog|quesadilla|burrito|enchilada|tacos?\b|fajita|kebab|wrap|bo bun|pad thai|nasi|biryani|pilaf|polenta|gnocchi|raviolis?|p[âa]tes|pasta|spaghetti|tagliatelle|farfalle|orecchiette|rigatoni|tortellini|conchiglie|bucatini|paccheri|paninis?|\\bpains?\\b|flammek|casatiello|samboussek|sambousek|patatas|papas|couronne|salade compos|salade (ni[çc]oise|c[ée]sar|grecque|de p[âa]tes|de riz)|poke/i;
const PROTEINE_COMPLETE_RX = /\b[œo]eufs?\b|tofu|tempeh|seitan|halloumi|f[ée]ta|mozzarella|ricotta|ch[èe]vre|cottage|burrata|skyr|yaourt grec|fromage blanc|poulet|dinde|jambon|lardon|thon|saumon|crevette/i;
const VIANDE_PLUS_RX = /\bveau\b|\blapin\b|\bcanard\b|\blard\b|\bjarret\b|\bcuisses?\b|\bcôtes?\b|\bc[ôo]telettes?\b|\bgigot\b|\bépaule\b/i;
export const hasSideIncluded = (r: any): boolean => {
    if (TITRE_COMPLET_RX.test(r?.title || '')) return true;
    const a = assietteOf(r);
    if (a.feculents) return true;
    const textes = [r?.title || '', ...(r?.ingredients || []).map((i: any) => i?.name || '')];
    // proteinOf ne connaît ni le veau, ni le lard, ni le canard : on les lit ici.
    const viande = a.viandeRouge || a.viandeBlanche || a.poisson || textes.some((t: string) => VIANDE_PLUS_RX.test(t));
    if (viande) return a.legumes;
    return a.legumes && textes.some((t: string) => PROTEINE_COMPLETE_RX.test(t));
};

// Mots qui disent qu'un TITRE nomme un légume ou un féculent (sert à reconnaître
// un accompagnement, pas à juger si un plat est complet : voir hasSideIncluded).
const SIDE_RX = /\briz\b|p[âa]tes|pasta|spaghetti|tagliatelle|nouille|pur[ée]e|pomme de terre|patate|frite|semoule|couscous|boulgour|quinoa|polenta|gnocchi|lentille|haricot|brocoli|[ée]pinard|courgette|aubergine|carotte|poireau|chou|champignon|petits pois|ratatouille|l[ée]gume|salade|gratin|po[êe]l[ée]e/i;

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

/*
 * Ce qu'il y a dans l'assiette, pour les statistiques du planificateur.
 *
 * La protéine vient de `proteinOf` (titre d'abord). Légumes et féculents se
 * lisent dans les INGRÉDIENTS : un « poulet basquaise » est plein de poivrons
 * sans le dire dans son titre. Les aromates (oignon, ail, échalote, herbes) et
 * les liants (farine, fécule, chapelure) ne comptent pas — sinon tout plat
 * serait « avec légumes » et « avec féculent ».
 */
const LEGUME_RX = /carotte|courgette|aubergine|poivron|(?<!concentr[ée] de |sauce |coulis de |pur[ée]e de |p[âa]te de )tomates?(?!s? (concentr|s[ée]ch))|brocoli|\bchou|[ée]pinard|haricots? verts?|petits? pois|poireau|champignon|salade|laitue|roquette|m[âa]che|concombre|courge|potiron|potimarron|butternut|c[ée]leri|fenouil|asperge|artichaut|betterave|navet|radis|endive|blette|cresson|(?<!f[ée]cule de |farine de )\bma[ïi]s\b|avocat|l[ée]gume|ratatouille|pak ?cho[iï]|edamame|okra|gombo/i;
const FECULENT_RX = /\briz\b|risotto|p[âa]tes|spaghetti|tagliatelle|penne|fusilli|linguine|macaroni|lasagne|nouille|vermicelle|ramen|udon|soba|gnocchi|pomme(s)? de terre|patate|frites?\b|pur[ée]e|semoule|couscous|boulgour|quinoa|polenta|lentille|pois chiche|haricots? (blancs?|rouges?|noirs?|secs?)|flageolet|\bpain\b(?! d['’][ée]pice)|baguette|pita|tortilla|wrap|naan|galette de bl|bun\b/i;
const PROTEINE_VEGE_RX = /\b[œo]eufs?\b|tofu|tempeh|seitan|lentille|pois chiche|haricots? rouges|halloumi|f[ée]ta|mozzarella|parmesan|fromage|ricotta|skyr|yaourt grec/i;

export interface Assiette {
    viandeRouge: boolean;
    viandeBlanche: boolean;
    poisson: boolean;
    proteines: boolean;
    legumes: boolean;
    feculents: boolean;
}

export const assietteOf = (r: any): Assiette => {
    const p = proteinOf(r);
    const textes = [r?.title || '', ...(r?.ingredients || []).map((i: any) => i?.name || '')];
    const a = (rx: RegExp) => textes.some((t) => rx.test(t));
    // Porc avec la volaille : c'est ainsi qu'on le range en cuisine, en France.
    const viandeRouge = p === 'boeuf' || p === 'agneau';
    const viandeBlanche = p === 'poulet' || p === 'porc';
    const poisson = p === 'poisson';
    return {
        viandeRouge,
        viandeBlanche,
        poisson,
        proteines: viandeRouge || viandeBlanche || poisson || a(PROTEINE_VEGE_RX),
        legumes: a(LEGUME_RX),
        feculents: a(FECULENT_RX),
    };
};
