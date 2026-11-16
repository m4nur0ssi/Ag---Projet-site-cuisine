/**
 * Recherche STRICTE d'une recette, pour l'Assistant.
 * =================================================
 *
 * « gâteau aux pommes » doit rendre des gâteaux aux pommes — pas tous les desserts,
 * pas des pommes de terre. Les défauts de l'ancienne recherche :
 *   · « aux » comptait comme un mot clé, donc tout titre contenant « aux » passait ;
 *   · « pommes » était cherché en sous-chaîne : « pommes de terre » correspondait ;
 *   · dire « gâteau » donnait des points à TOUS les desserts, mot trouvé ou non ;
 *   · le modèle avait ordre de ne jamais répondre « rien » et gonflait la liste.
 *
 * Ici, chaque mot de la demande est lu pour ce qu'il est :
 *   · un TYPE de plat (gâteau, tarte, soupe…) se cherche dans le titre, les tags
 *     ou, à défaut, la catégorie compatible (un dessert pour un gâteau) ;
 *   · un INGRÉDIENT (pommes, chocolat…) doit figurer dans le titre, les tags ou les
 *     premiers ingrédients — jamais « un peu partout » ;
 *   · les mots composés ne se coupent pas (pomme de terre ≠ pomme, chou-fleur ≠ chou) ;
 *   · « sans X » exclut, au lieu d'ajouter.
 * Tout mot qui n'est reconnu nulle part est ignoré, SAUF si c'est le seul : on rend
 * alors la main au modèle (demande abstraite : « un plat réconfortant »).
 */

import { motLePlusProche, vocabulaireDe, type Vocabulaire } from './fuzzy';

export interface RecetteRecherche {
    id: string | number;
    title: string;
    category?: string;
    tags?: string[];
    ingredients?: ({ name?: string } | string)[];
}

const norm = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae');

/** Les mots composés ne se coupent pas : « pomme de terre » n'est pas une pomme. */
const COMPOSES: [RegExp, string][] = [
    [/\bpommes?\s+de\s+terre\b/g, 'pommedeterre'],
    [/\bpatates?\s+douces?\b/g, 'patatedouce'],
    [/\bchou[\s-]?fleurs?\b/g, 'choufleur'],
    [/\bchoux?\s+rouges?\b/g, 'chourouge'],
    [/\bnoix\s+de\s+(coco|cajou|muscade|pecan|macadamia)\b/g, 'noixde$1'],
    [/\blait\s+de\s+coco\b/g, 'laitdecoco'],
    [/\bpetits?\s+pois\b/g, 'petitpois'],
    [/\bharicots?\s+verts?\b/g, 'haricotvert'],
    [/\bcitrons?\s+verts?\b/g, 'citronvert'],
    [/\bpommes?\s+d['’]\s*amour\b/g, 'pommedamour'],
];
const fusionner = (s: string) => COMPOSES.reduce((t, [rx, to]) => t.replace(rx, to), norm(s));

const STOP = new Set([
    'recette', 'recettes', 'idee', 'idees', 'envie', 'truc', 'plat', 'plats',
    'de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'avec', 'pour', 'et', 'en', 'au', 'aux',
    'ne', 'pas', 'mon', 'ma', 'mes', 'qui', 'je', 'veux', 'voudrais', 'cherche', 'chercher',
    'donne', 'donner', 'moi', 'the', 'me', 'fait', 'faire', 'quelque', 'chose', 'sur', 'dans',
    'ou', 'est', 'bon', 'bonne', 'bons', 'bien', 'tres', 'petit', 'petite', 'grand', 'grande',
    'trouve', 'trouver', 'aimerais', 'avoir', 'manger', 'cuisiner', 'preparer', 'ce', 'soir', 'midi',
    'que', 'comme', 'type', 'genre', 'style', 'facon', 'maison', 'simple', 'facile', 'rapide',
]);

/** Mots d'ambiance : ils décrivent une envie, pas un produit. Ni cherchés, ni jugés inconnus. */
const ABSTRAITS = new Set([
    'reconfortant', 'hiver', 'ete', 'automne', 'printemps', 'leger', 'legere', 'gourmand', 'gourmande', 'original', 'originale',
    'delicieux', 'delicieuse', 'savoureux', 'savoureuse', 'chaud', 'chaude', 'froid', 'froide', 'enfant', 'famille', 'convivial',
    'festif', 'fete', 'dimanche', 'semaine', 'weekend', 'vite', 'healthy', 'equilibre', 'copieux', 'copieuse', 'fondant', 'fondante',
    'croustillant', 'croustillante', 'moelleux', 'moelleuse', 'cremeux', 'cremeuse', 'ultra', 'super', 'meilleur', 'meilleure', 'special',
    'speciale', 'classique', 'traditionnel', 'traditionnelle', 'inspire', 'inspiree', 'idee', 'nouveau', 'nouvelle', 'pratique', 'economique',
]);

/** Un produit en vaut un autre pour la même envie : « potiron » trouve aussi la courge. */
const SYNONYMES: Record<string, string[]> = {
    potiron: ['potiron', 'courge', 'potimarron', 'butternut'],
    courge: ['courge', 'potiron', 'potimarron', 'butternut'],
    potimarron: ['potimarron', 'courge', 'potiron'],
    butternut: ['butternut', 'courge', 'potiron'],
    patate: ['patate', 'pommedeterre'],
    frite: ['frite', 'pommedeterre'],
    yaourt: ['yaourt', 'yogourt'],
    spaghetti: ['spaghetti', 'pate'],
    aubergine: ['aubergine'],
};

/** « sans viande » exclut aussi le poulet, le bœuf… pas seulement le mot « viande ». */
const EXCLUSIONS_ETENDUES: Record<string, string[]> = {
    viande: ['viande', 'poulet', 'boeuf', 'steak', 'bavette', 'veau', 'agneau', 'porc', 'lardon', 'jambon', 'bacon', 'saucisse', 'chorizo', 'merguez', 'canard', 'dinde', 'magret', 'kefta', 'hache', 'charcuterie', 'poulpe'],
    poisson: ['poisson', 'saumon', 'thon', 'cabillaud', 'dorade', 'crevette', 'gambas', 'moule', 'truite', 'sardine', 'anchois', 'poulpe', 'calamar', 'crabe'],
    gluten: ['gluten', 'farine', 'ble', 'pate', 'semoule', 'chapelure', 'pain'],
    lactose: ['lactose', 'lait', 'creme', 'fromage', 'beurre', 'yaourt', 'mozzarella', 'parmesan'],
};

/** Types voisins : pour « gâteau », une tarte ou un cake sont de meilleurs « presque » qu'un dessert quelconque. */
const PROCHES: Record<string, string[]> = {
    gateau: ['cake', 'tarte', 'crumble', 'clafoutis', 'muffin', 'brownie', 'cheesecake', 'flan'],
    tarte: ['gateau', 'crumble', 'clafoutis', 'quiche'],
    cake: ['gateau', 'muffin', 'brownie'],
    crumble: ['gateau', 'tarte', 'clafoutis'],
};

const INVARIABLES = new Set(['pois', 'mais', 'noix', 'riz', 'ananas', 'cassis', 'couscous', 'jus', 'radis', 'anchois', 'tamaris', 'bras', 'pas', 'plus', 'dans', 'sans', 'tres', 'gros', 'frais', 'epais', 'houmous']);
const singulier = (w: string) => {
    if (w.length <= 3 || INVARIABLES.has(w)) return w;
    if (/eaux$/.test(w)) return w.slice(0, -1);        // gateaux → gateau
    if (/[sx]$/.test(w)) return w.slice(0, -1);        // pommes → pomme
    return w;
};

/** Type de plat → ce qui le reconnaît dans un titre / des tags, et les catégories compatibles. */
const DESSERTS = ['desserts', 'patisserie'];
const TYPES: Record<string, { rx: RegExp; cats: string[] }> = {
    gateau: { rx: /\bgateau\b/, cats: DESSERTS },
    tarte: { rx: /\b(tartes?|tartelettes?)\b/, cats: DESSERTS },
    cake: { rx: /\bcakes?\b/, cats: DESSERTS },
    crumble: { rx: /\bcrumbles?\b/, cats: DESSERTS },
    clafoutis: { rx: /\bclafoutis\b/, cats: DESSERTS },
    mousse: { rx: /\bmousses?\b/, cats: DESSERTS },
    tiramisu: { rx: /\btiramisus?\b/, cats: DESSERTS },
    cheesecake: { rx: /\bcheesecakes?\b/, cats: DESSERTS },
    brownie: { rx: /\bbrownies?\b/, cats: DESSERTS },
    cookie: { rx: /\bcookies?\b/, cats: DESSERTS },
    muffin: { rx: /\bmuffins?\b/, cats: DESSERTS },
    flan: { rx: /\bflans?\b/, cats: DESSERTS },
    crepe: { rx: /\bcrepes?\b/, cats: DESSERTS },
    gaufre: { rx: /\bgaufres?\b/, cats: DESSERTS },
    beignet: { rx: /\bbeignets?\b/, cats: DESSERTS },
    biscuit: { rx: /\bbiscuits?\b/, cats: DESSERTS },
    verrine: { rx: /\bverrines?\b/, cats: [] },
    glace: { rx: /\b(glaces?|sorbets?)\b/, cats: ['glaces', ...DESSERTS] },
    sorbet: { rx: /\b(glaces?|sorbets?)\b/, cats: ['glaces', ...DESSERTS] },
    soupe: { rx: /\b(soupes?|veloutes?|potages?)\b/, cats: [] },
    salade: { rx: /\bsalades?\b/, cats: [] },
    gratin: { rx: /\bgratins?\b/, cats: [] },
    quiche: { rx: /\bquiches?\b/, cats: [] },
    pizza: { rx: /\bpizzas?\b/, cats: [] },
    burger: { rx: /\bburgers?\b/, cats: [] },
    sandwich: { rx: /\bsandwich(?:e?s)?\b/, cats: [] },
    wrap: { rx: /\bwraps?\b/, cats: [] },
    curry: { rx: /\bcurr(?:y|ies)\b/, cats: [] },
    risotto: { rx: /\brisottos?\b/, cats: [] },
    lasagne: { rx: /\blasagnes?\b/, cats: [] },
    omelette: { rx: /\bomelettes?\b/, cats: [] },
    sauce: { rx: /\bsauces?\b/, cats: ['sauces'] },
    smoothie: { rx: /\bsmoothies?\b/, cats: [] },
    cocktail: { rx: /\bcocktails?\b/, cats: ['rafraichissements', 'cocktails'] },
};

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rxCache = new Map<string, RegExp>();
/** Le mot entier, au singulier ou au pluriel : « pomme » trouve « pommes », jamais « pommedeterre ». */
const mot = (tok: string): RegExp => {
    let rx = rxCache.get(tok);
    if (!rx) { rx = new RegExp(`(?:^|[^a-z0-9])${echapper(tok)}(?:s|x)?(?![a-z0-9])`); rxCache.set(tok, rx); }
    return rx;
};

interface Meule { titre: string; tags: string; cat: string; ings: string; principaux: string }
const meules = new WeakMap<object, Meule>();
const meuleDe = (r: RecetteRecherche): Meule => {
    let m = meules.get(r);
    if (!m) {
        const noms = (r.ingredients || []).map((i) => fusionner(typeof i === 'string' ? i : String(i?.name || '')));
        m = {
            titre: fusionner(r.title || ''),
            tags: fusionner((r.tags || []).join(' ')),
            cat: norm(r.category || ''),
            ings: noms.join(' | '),
            principaux: noms.slice(0, 6).join(' | '),
        };
        meules.set(r, m);
    }
    return m;
};

export interface DemandeLue {
    types: string[];
    ingredients: string[];
    exclus: string[];
    /** Mots de la demande que le catalogue ne connaît pas (ni synonyme, ni faute corrigeable). */
    inconnus: string[];
    /** Au moins un mot de la demande désigne quelque chose que le catalogue connaît. */
    concrete: boolean;
}

/** Lit la demande : types, ingrédients (corrigés des fautes), exclusions. */
/** Restaurants, sorties, villes : hors du champ de cette recherche (c'est le modèle qui les traite). */
export const demandeDeRestaurant = (query: string) => /\b(restaurants?|resto|restos|terrasse|brasserie|bistrot|ou\s+manger|sortir)\b/.test(norm(query));

export function lireDemande(recettes: RecetteRecherche[], query: string): DemandeLue {
    let q = fusionner(query);
    const exclus: string[] = [];
    q = q.replace(/\bsans\s+([a-z]+)/g, (_, w) => {
        if (w.length > 2) { const sg = singulier(w); (EXCLUSIONS_ETENDUES[sg] || [sg]).forEach((x) => exclus.push(x)); }
        return ' ';
    });

    const brut = q.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)).map(singulier);
    const types: string[] = [];
    const ingredients: string[] = [];
    const inconnus: string[] = [];
    let voc: Vocabulaire | null = null;
    const presente = (w: string) => recettes.some((r) => { const m = meuleDe(r); return mot(w).test(m.titre) || mot(w).test(m.tags) || mot(w).test(m.ings); });

    for (const w of brut) {
        if (ABSTRAITS.has(w)) continue;
        if (TYPES[w]) { if (!types.includes(w)) types.push(w); continue; }
        if (SYNONYMES[w]) { if (!ingredients.includes(w)) ingredients.push(w); continue; }
        if (presente(w)) { if (!ingredients.includes(w)) ingredients.push(w); continue; }
        // Faute de frappe : « pomes » → « pomme ». Sans mot proche, le terme est inconnu.
        voc ??= vocabulaireDe(recettes.map((r) => { const m = meuleDe(r); return `${m.titre} ${m.tags}`; }));
        const corrige = motLePlusProche(w, voc);
        const sg = corrige ? singulier(corrige) : '';
        if (sg && TYPES[sg]) { if (!types.includes(sg)) types.push(sg); }
        else if (sg) { if (!ingredients.includes(sg)) ingredients.push(sg); }
        else inconnus.push(w);
    }
    return { types, ingredients, exclus, inconnus, concrete: types.length > 0 || ingredients.length > 0 || exclus.length > 0 };
}

/**
 * Note d'une recette pour la demande, ou null si elle ne convient pas.
 * Plus c'est haut, plus c'est exact. Un type trouvé dans le titre pèse plus que la
 * seule catégorie ; un ingrédient dans le titre pèse plus qu'un ingrédient listé.
 */
function noter(r: RecetteRecherche, d: DemandeLue): { score: number; exact: boolean } | null {
    const m = meuleDe(r);
    if (m.cat === 'restaurant') return null;
    for (const x of d.exclus) if (mot(x).test(m.titre) || mot(x).test(m.tags) || mot(x).test(m.ings)) return null;
    if (!d.types.length && !d.ingredients.length) return { score: 0, exact: true };

    let score = 0;
    let exact = true;

    for (const t of d.types) {
        const def = TYPES[t];
        if (def.rx.test(m.titre) || def.rx.test(m.tags)) score += 4;
        else if (def.cats.includes(m.cat)) {
            score += 1; exact = false;
            // Un voisin direct (tarte, cake, crumble pour un gâteau) passe avant un dessert quelconque.
            if ((PROCHES[t] || []).some((v) => TYPES[v]?.rx.test(m.titre) || TYPES[v]?.rx.test(m.tags))) score += 2;
        }
        else return null;
    }
    for (const ing of d.ingredients) {
        const variantes = SYNONYMES[ing] || [ing];
        const meilleur = (re: RegExp, txt: string) => variantes.some((v) => (v === ing ? re : mot(v)).test(txt));
        const rx = mot(ing);
        if (variantes.some((v) => mot(v).test(m.titre))) score += 4;
        else if (variantes.some((v) => mot(v).test(m.tags))) score += 3;
        else if (variantes.some((v) => mot(v).test(m.principaux))) { score += 1.5; exact = false; }
        else return null;
        void meilleur; void rx;
    }
    return { score, exact };
}

/**
 * Cherche strictement. Renvoie `null` quand la demande n'a rien de concret (le
 * modèle prend alors le relais), sinon la liste classée — éventuellement vide.
 */
export function rechercheStricte<T extends RecetteRecherche>(
    recettes: T[],
    query: string,
    max = 40,
): { recettes: T[]; message: string; exactes: number } | null {
    if (demandeDeRestaurant(query)) return null;
    const d = lireDemande(recettes, query);
    if (!d.concrete) return null;
    // « soupe de potiron » : le type est connu, l'ingrédient non. Répondre « toutes les soupes »
    // serait hors sujet : le modèle (qui sait que potiron ~ courge) prend le relais.
    if (d.ingredients.length === 0 && d.inconnus.length > 0) return null;

    const notees = recettes
        .map((r) => ({ r, n: noter(r, d) }))
        .filter((x): x is { r: T; n: { score: number; exact: boolean } } => !!x.n)
        .sort((a, b) => b.n.score - a.n.score);

    // Les « presque » (catégorie compatible, ingrédient seulement listé) ne passent
    // qu'en renfort : s'il y a au moins quelques réponses exactes, elles seules comptent.
    const exactes = notees.filter((x) => x.n.exact);
    const sansTermePositif = !d.types.length && !d.ingredients.length;
    const gardees = (exactes.length >= 4 || sansTermePositif ? exactes : notees).slice(0, sansTermePositif ? 2000 : max);

    const libelle = [...d.types, ...d.ingredients].join(' ');
    let message = '';
    if (sansTermePositif) {
        message = gardees.length
            ? `${gardees.length} recettes sans ${d.exclus[0] ?? 'ce produit'}`
            : 'Aucune recette ne correspond à cette exclusion.';
    } else if (gardees.length) {
        message = exactes.length >= 4 || exactes.length === gardees.length
            ? `${gardees.length} recette${gardees.length > 1 ? 's' : ''} pour « ${query.trim()} »`
            : exactes.length === 0
                ? `Rien d'exact pour « ${query.trim()} » — voici les plus proches`
                : `${exactes.length} recette${exactes.length > 1 ? 's' : ''} exacte${exactes.length > 1 ? 's' : ''}, puis les plus proches`;
    } else {
        message = `Aucune recette du site ne correspond à « ${libelle} ».`;
    }
    return { recettes: gardees.map((x) => x.r), message, exactes: exactes.length };
}

/**
 * Garde-fou pour ce que renvoie le modèle : on retire tout ce qui ne contient pas
 * l'ingrédient ou le type demandé. Demande sans mot concret : rien n'est retiré.
 */
export function filtrerParDemande<T extends RecetteRecherche>(recettes: T[], query: string, all: RecetteRecherche[] = recettes): T[] {
    if (demandeDeRestaurant(query)) return recettes;
    const d = lireDemande(all, query);
    if (!d.concrete) return recettes;
    return recettes.filter((r) => noter(r, d) !== null);
}
