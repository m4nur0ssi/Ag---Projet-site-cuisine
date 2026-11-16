/**
 * « Sans X » : exclure un aliment d'une liste de recettes.
 * =======================================================
 *
 * Source UNIQUE, partagée par les pastilles « + Sans… » et par la recherche de
 * l'Assistant (« gâteau sans œufs »). Une exclusion qui laisse passer l'aliment est
 * un bug sérieux (allergie) ; une qui exclut à tort est un bug de confort. D'où :
 *
 *   · le mot est cherché ENTIER (singulier ou pluriel) : « lait » n'attrape pas
 *     « laitue », « vin » pas « vinaigre », « bar » pas « barbecue », « œuf » pas « bœuf » ;
 *   · les recettes ne nomment pas toujours l'aliment comme on le demande : le gluten
 *     est de la farine, le porc du lard — chaque famille liste ses formes ;
 *   · les FAUX AMIS sont neutralisés pour l'aliment concerné : « lait de coco » n'est pas
 *     du lait, « noix de coco » pas une noix, « moule à gâteau » pas une moule ;
 *   · « sans gluten », « sans sucre »… écrits dans une recette ne la font pas exclure.
 */

const nf = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/['’]/g, ' ').replace(/\s+/g, ' ').trim();

/** Aliment demandé → toutes ses formes dans une recette (sans accent, œ lu oe). */
export const FAMILLES: Record<string, string[]> = {
    oeuf: ['oeuf', 'jaune d oeuf', 'blanc d oeuf', 'mayonnaise', 'meringue'],
    lait: ['lait', 'creme', 'beurre', 'fromage', 'yaourt', 'chocolat au lait', 'lait concentre', 'lait en poudre', 'mascarpone', 'ricotta', 'mozzarella', 'parmesan', 'gruyere', 'emmental', 'cheddar', 'feta', 'chevre', 'comte', 'raclette', 'camembert', 'brie', 'roquefort', 'gorgonzola', 'burrata', 'halloumi', 'boursin', 'philadelphia', 'fromage blanc', 'creme fraiche', 'petit suisse', 'kefir'],
    lactose: ['lait', 'creme', 'beurre', 'fromage', 'yaourt', 'mascarpone', 'ricotta', 'mozzarella', 'parmesan', 'gruyere', 'emmental', 'cheddar', 'feta', 'chevre', 'comte', 'raclette', 'camembert', 'brie', 'roquefort', 'gorgonzola', 'burrata', 'halloumi', 'boursin', 'philadelphia', 'fromage blanc', 'creme fraiche'],
    fromage: ['fromage', 'mozzarella', 'parmesan', 'gruyere', 'emmental', 'cheddar', 'feta', 'chevre', 'comte', 'raclette', 'camembert', 'brie', 'roquefort', 'gorgonzola', 'burrata', 'halloumi', 'boursin', 'philadelphia', 'ricotta', 'mascarpone', 'pecorino', 'grana padano', 'cantal', 'reblochon', 'maroilles', 'munster', 'fromage blanc', 'fromage frais'],
    beurre: ['beurre', 'ghee'],
    creme: ['creme', 'creme fraiche', 'creme liquide', 'creme epaisse', 'creme fleurette', 'chantilly', 'mascarpone'],
    yaourt: ['yaourt', 'yogourt', 'yaourt grec', 'skyr'],
    gluten: ['farine', 'ble', 'pate', 'pates', 'pain', 'chapelure', 'semoule', 'boulgour', 'orge', 'seigle', 'epeautre', 'avoine', 'biscuit', 'brioche', 'couscous', 'panko', 'tortilla', 'wrap', 'pita', 'baguette', 'burger', 'sandwich', 'crepe', 'gaufre', 'pizza', 'nouille', 'raviolis', 'gnocchi', 'lasagne', 'spaghetti', 'penne', 'tagliatelle', 'fusilli', 'macaroni', 'vermicelle', 'speculoos', 'boudoir', 'pate feuilletee', 'pate brisee', 'pate sablee'],
    arachide: ['arachide', 'cacahuete', 'peanut', 'beurre de cacahuete'],
    noix: ['noix', 'noisette', 'amande', 'pistache', 'cajou', 'pecan', 'macadamia', 'noix de pecan', 'pralin', 'praline', 'fruits a coque', 'noix du bresil', 'chataigne', 'nutella', 'pate a tartiner'],
    'fruits a coque': ['noix', 'noisette', 'amande', 'pistache', 'cajou', 'pecan', 'macadamia', 'pralin', 'praline', 'nutella'],
    soja: ['soja', 'tofu', 'edamame', 'miso', 'tempeh', 'sauce soja'],
    sesame: ['sesame', 'tahini', 'tahin', 'houmous', 'hummus'],
    poisson: ['poisson', 'saumon', 'thon', 'cabillaud', 'colin', 'merlu', 'sardine', 'maquereau', 'anchois', 'truite', 'bar', 'dorade', 'lieu', 'sole', 'raie', 'espadon', 'haddock', 'morue', 'hareng', 'turbot', 'lotte', 'daurade', 'loup de mer', 'surimi', 'sauce de poisson', 'nuoc mam', 'nuoc-mam'],
    'fruits de mer': ['crevette', 'moule', 'huitre', 'gambas', 'calamar', 'poulpe', 'coquille saint jacques', 'saint jacques', 'langoustine', 'crabe', 'homard', 'coque', 'palourde', 'seiche', 'encornet', 'fruits de mer', 'ecrevisse', 'bulot', 'bigorneau'],
    crevette: ['crevette', 'gambas', 'langoustine'],
    viande: ['viande', 'boeuf', 'porc', 'agneau', 'veau', 'poulet', 'volaille', 'dinde', 'canard', 'lapin', 'lard', 'lardon', 'jambon', 'bacon', 'steak', 'saucisse', 'saucisson', 'chorizo', 'merguez', 'bavette', 'entrecote', 'escalope', 'magret', 'cote', 'gigot', 'rumsteck', 'paleron', 'hache', 'kefta', 'charcuterie', 'andouille', 'boudin', 'rillette', 'pancetta', 'mortadelle', 'coppa', 'poulpe'],
    boeuf: ['boeuf', 'steak', 'bavette', 'entrecote', 'rumsteck', 'paleron', 'hache', 'viande hachee', 'rosbif', 'onglet', 'faux filet', 'tournedos'],
    porc: ['porc', 'lard', 'lardon', 'jambon', 'bacon', 'chorizo', 'saucisson', 'andouille', 'boudin', 'saucisse', 'pancetta', 'rillette', 'coppa', 'mortadelle', 'poitrine', 'echine'],
    poulet: ['poulet', 'volaille', 'blanc de dinde', 'escalope de dinde', 'cuisse de poulet', 'pilon', 'aile de poulet'],
    dinde: ['dinde', 'volaille'],
    canard: ['canard', 'magret', 'confit de canard', 'foie gras'],
    agneau: ['agneau', 'gigot', 'mouton'],
    veau: ['veau'],
    alcool: ['alcool', 'vin', 'biere', 'rhum', 'whisky', 'cognac', 'vodka', 'liqueur', 'porto', 'champagne', 'calvados', 'amaretto', 'baileys', 'pastis', 'gin', 'kirsch', 'cointreau', 'grand marnier', 'armagnac', 'marsala', 'sake', 'mirin', 'saké', 'prosecco', 'cidre', 'tequila'],
    vin: ['vin', 'vin blanc', 'vin rouge', 'vin rose'],
    champignon: ['champignon', 'shiitake', 'cepe', 'girolle', 'morille', 'pleurote', 'portobello', 'trompette de la mort'],
    oignon: ['oignon', 'echalote', 'cebette', 'ciboule', 'poireau'],
    ail: ['ail'],
    tomate: ['tomate', 'coulis de tomate', 'concentre de tomate', 'sauce tomate', 'ketchup', 'passata', 'puree de tomate'],
    chocolat: ['chocolat', 'cacao', 'nutella', 'pepite de chocolat'],
    sucre: ['sucre', 'cassonade', 'sucre glace', 'sucre roux', 'sirop', 'miel', 'confiture', 'caramel', 'sirop d erable', 'sirop d agave', 'nappage', 'glacage'],
    miel: ['miel'],
    celeri: ['celeri', 'celeri rave'],
    moutarde: ['moutarde'],
};

/**
 * Faux amis : pour CET aliment, ces expressions ne comptent pas. Retirées du texte avant
 * de chercher (jamais pour les autres aliments : « beurre de cacahuète » reste de l'arachide).
 */
const FAUX_AMIS: Record<string, RegExp> = {
    lait: /\b(lait (de|d) (coco|amande|soja|riz|avoine|noisette|cajou)|creme (de|d) (coco|soja|amande|avoine|riz|marron)|beurre (de|d) (cacahuete|cacao|karite|amande|noix|noisette|coco)|fromage (vegetal|vegan)|chocolat noir)\b/g,
    beurre: /\bbeurre (de|d) (cacahuete|cacao|karite|amande|noix|noisette|coco)\b/g,
    creme: /\bcreme (de|d) (coco|soja|amande|avoine|riz|marron)\b/g,
    noix: /\bnoix (de|d) (coco|muscade|saint jacques|veau|jambon|beurre|porc|boeuf)\b/g,
    moule: /\bmoules? (a|en|de|au|aux|pour|rond|ronde|carre|carree|rectangulaire|antiadhesif|silicone|souple|manque|cake|tarte|gateau)\b/g,
    vin: /\bvinaigre (de|d) vin\b|\bvin (de|d) riz\b/g,
    poisson: /\bpoisson (pane|rouge)\b/g,
    pate: /\bpate (d|de) (amande|fruits?|curry|piment|tomate|sesame|miso|tamarin)\b/g,
    pain: /\bpain (d|de) epice\b/g,
    sucre: /\bsans sucre\b/g,
    bar: /\bbar (a|de)\b/g,
    coque: /\bcoque (de|d) (tarte|tacos)\b/g,
    lieu: /\b(lieu de cuisson)\b/g,
    cote: /\bcote d azur\b/g,
    gin: /\bgingembre\b/g,
    poitrine: /\bpoitrine (de poulet|de dinde)\b/g,
};

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rxMot = new Map<string, RegExp>();
/** Le mot entier, singulier ou pluriel. */
const mot = (t: string): RegExp => {
    let rx = rxMot.get(t);
    if (!rx) { rx = new RegExp(`(?:^|[^a-z0-9])${echapper(t)}(?:s|x)?(?![a-z0-9])`); rxMot.set(t, rx); }
    return rx;
};

const sansS = (t: string) => (t.length > 3 && /[sx]$/.test(t) ? t.slice(0, -1) : t);

/** Les formes à traquer pour un aliment saisi (« œufs », « oeuf », « lait »…). */
export function motsInterdits(saisi: string): string[] {
    const m = nf(saisi);
    const cle = sansS(m);
    for (const [k, liste] of Object.entries(FAMILLES)) {
        if (k === m || k === cle || sansS(k) === cle) return [...new Set(liste.map(nf))];
    }
    return [...new Set([m, cle])];
}

interface Recherchable { title?: string; tags?: string[]; ingredients?: ({ name?: string } | string)[] }
const textes = new WeakMap<object, string>();
const texteDe = (r: Recherchable): string => {
    let t = textes.get(r);
    if (t == null) {
        const noms = (r.ingredients || []).map((i) => (typeof i === 'string' ? i : String(i?.name || '')));
        t = nf([r.title || '', ...(r.tags || []), ...noms].join(' | '))
            // « sans gluten », « sans sucre » dans une recette ne dit pas qu'elle en contient.
            .replace(/\bsans (gluten|lactose|sucre|oeuf|lait|viande|alcool|arachide|noix)s?\b/g, ' ');
        textes.set(r, t);
    }
    return t;
};

/** La recette contient-elle l'un de ces mots (après neutralisation des faux amis) ? */
export function recetteContient(r: Recherchable, mots: string[]): boolean {
    const brut = texteDe(r);
    return mots.some((w) => {
        const faux = FAUX_AMIS[w];
        const txt = faux ? brut.replace(faux, ' ') : brut;
        return mot(w).test(txt);
    });
}

/** La recette est-elle à écarter pour cette liste d'exclusions saisies ? */
export function recetteExclue(r: Recherchable, exclusions: string[]): boolean {
    return exclusions.some((e) => recetteContient(r, motsInterdits(e)));
}
