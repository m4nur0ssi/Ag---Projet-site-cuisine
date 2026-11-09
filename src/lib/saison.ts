/**
 * « 100 % de saison » — règle métier pure. Aucune dépendance React / Next :
 * partagée par le bureau et le téléphone, testable seule.
 *
 * ── Règle (cahier des charges §3) ───────────────────────────────────────────
 * Une recette est éligible si le nombre de légumes principaux DE SAISON atteint
 * au moins les deux tiers du nombre de légumes principaux identifiés, arrondi
 * à l'entier supérieur : minimum = ceil(2 × n / 3). Pas de légume principal
 * identifié → jamais éligible.
 *
 * ── Classification (documentée) ─────────────────────────────────────────────
 * 1. Un ingrédient n'est compté que s'il correspond à une entrée de LEGUMES_SAISON.
 *    Tout le reste (féculents, viandes, produits laitiers, légumineuses sèches,
 *    fruits, etc.) n'est PAS un légume principal.
 * 2. Exclusions avant correspondance : aromates (ail, oignon, échalote, herbes…)
 *    et produits transformés (concentré, sauce, purée, coulis, séché, conserve,
 *    surgelé, en poudre, pâte à choux…). « Tomates séchées » ne compte pas.
 * 3. Synonymes : chaque légume est compté UNE fois (id canonique), même si la
 *    recette écrit « tomate » et « tomates cerises ».
 * 4. Ingrédient non reconnu : ignoré du compte (il n'est pas un légume connu),
 *    il n'est jamais considéré comme de saison.
 *
 * ── Saisonnalité ────────────────────────────────────────────────────────────
 * `mois` = mois de disponibilité courante, numérotés 1 (janvier) à 12, pour la
 * France métropolitaine. Les périodes peuvent se chevaucher et varient selon le
 * légume. ⚠ Table de référence NON validée par source : à relire avant mise en
 * production (cf. notes dans la copie de travail). Aucune précision régionale.
 */

export interface LegumeSaison {
    /** Identifiant canonique (un par légume, sert à dédoublonner les synonymes). */
    readonly id: string;
    readonly nom: string;
    /** Mois de disponibilité, 1 = janvier … 12 = décembre. */
    readonly mois: readonly number[];
    /** Motifs appliqués au nom d'ingrédient normalisé (minuscules, sans accents). */
    readonly motifs: readonly RegExp[];
}

const TOUTE_L_ANNEE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const HIVER_PRINTEMPS = [9, 10, 11, 12, 1, 2, 3] as const;

/**
 * Ordre important : les entrées les plus précises d'abord (ex. « chou-fleur »
 * avant « chou »). La première entrée qui correspond gagne.
 */
export const LEGUMES_SAISON: readonly LegumeSaison[] = [
    { id: 'chou-fleur', nom: 'Chou-fleur', mois: [9, 10, 11, 12, 1, 2, 3, 4], motifs: [/\bchou[- ]fleurs?\b/] },
    { id: 'chou', nom: 'Chou', mois: HIVER_PRINTEMPS, motifs: [/\bchoux?\b/] },
    { id: 'brocoli', nom: 'Brocoli', mois: HIVER_PRINTEMPS, motifs: [/\bbrocolis?\b/] },
    { id: 'carotte', nom: 'Carotte', mois: TOUTE_L_ANNEE, motifs: [/\bcarottes?\b/] },
    { id: 'courgette', nom: 'Courgette', mois: [5, 6, 7, 8, 9, 10], motifs: [/\bcourgettes?\b/] },
    { id: 'aubergine', nom: 'Aubergine', mois: [6, 7, 8, 9, 10], motifs: [/\baubergines?\b/] },
    { id: 'poivron', nom: 'Poivron', mois: [6, 7, 8, 9, 10], motifs: [/\bpoivrons?\b/] },
    { id: 'tomate', nom: 'Tomate', mois: [6, 7, 8, 9, 10], motifs: [/\btomates?\b/] },
    { id: 'concombre', nom: 'Concombre', mois: [5, 6, 7, 8, 9], motifs: [/\bconcombres?\b/] },
    { id: 'epinard', nom: 'Épinard', mois: [3, 4, 5, 6, 9, 10, 11], motifs: [/\bepinards?\b/] },
    { id: 'haricot-vert', nom: 'Haricot vert', mois: [6, 7, 8, 9], motifs: [/\bharicots? verts?\b/] },
    { id: 'petit-pois', nom: 'Petit pois', mois: [5, 6, 7, 8], motifs: [/\bpetits? pois\b/] },
    { id: 'poireau', nom: 'Poireau', mois: [9, 10, 11, 12, 1, 2, 3, 4], motifs: [/\bpoireaux?\b/] },
    { id: 'navet', nom: 'Navet', mois: [10, 11, 12, 1, 2, 3, 4], motifs: [/\bnavets?\b/] },
    { id: 'radis', nom: 'Radis', mois: [3, 4, 5, 6, 9, 10, 11], motifs: [/\bradis\b/] },
    { id: 'celeri', nom: 'Céleri', mois: HIVER_PRINTEMPS, motifs: [/\bcelerie?s?\b/] },
    { id: 'fenouil', nom: 'Fenouil', mois: [10, 11, 12, 1, 2, 3], motifs: [/\bfenouils?\b/] },
    { id: 'courge', nom: 'Courge', mois: [9, 10, 11, 12, 1, 2], motifs: [/\bcourges?\b/, /\bbutternut\b/, /\bpotiron\b/, /\bpotimarron\b/] },
    { id: 'asperge', nom: 'Asperge', mois: [4, 5, 6], motifs: [/\basperges?\b/] },
    { id: 'artichaut', nom: 'Artichaut', mois: [3, 4, 5, 6, 10, 11], motifs: [/\bartichauts?\b/] },
    { id: 'betterave', nom: 'Betterave', mois: HIVER_PRINTEMPS, motifs: [/\bbetteraves?\b/] },
    { id: 'blette', nom: 'Blette', mois: [5, 6, 7, 8, 9, 10], motifs: [/\bblettes?\b/] },
    { id: 'endive', nom: 'Endive', mois: [10, 11, 12, 1, 2, 3, 4], motifs: [/\bendives?\b/] },
];

/** Aromates, condiments de base : jamais des légumes principaux. */
const AROMATES_RX = /\b(ails?|oignons?|echalotes?|cebettes?|ciboulettes?|persil|basilic|coriandre|menthe|thym|romarin|laurier|estragon|aneth|sauge|origan|herbes?|epices?|sel|poivre|piments?)\b/;

/** Produits transformés ou formes non fraîches : ne comptent pas comme légume de saison. */
const PRODUITS_TRANSFORMES_RX = /\b(concentres?|sech\w*|sauces?|purees?|pures?|pates? (de|a)|coulis|jus|conserves?|surgel\w*|congel\w*|poudres?|en poudre|cubes?|bouillons?|extraits?|confits?|chips|frites?|soupes?|gaspachos?|ketchup|pestos?|pates? a choux|choux? a la creme)\b/;

/** Normalisation : minuscules, sans accents, ponctuation et emojis retirés. */
export function normaliserIngredient(nom: string): string {
    return nom
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/['’]/g, ' ')
        .replace(/[^a-z0-9\- ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Renvoie le légume principal reconnu pour un ingrédient, ou null.
 * `null` = pas un légume de la liste, ou aromate, ou produit transformé.
 */
export function identifierLegume(nom: string): LegumeSaison | null {
    const n = normaliserIngredient(nom);
    if (!n) return null;
    if (AROMATES_RX.test(n)) return null;
    if (PRODUITS_TRANSFORMES_RX.test(n)) return null;
    return LEGUMES_SAISON.find((l) => l.motifs.some((m) => m.test(n))) ?? null;
}

/** Minimum de légumes de saison requis pour n légumes principaux : ceil(2n/3). */
export function minimumRequis(n: number): number {
    if (n <= 0) return 0;
    return Math.ceil((2 * n) / 3);
}

/** Vrai si le légume est disponible au mois donné (1 = janvier). */
export function estDeSaison(legume: LegumeSaison, mois: number): boolean {
    return legume.mois.includes(mois);
}

export interface AnalyseSaison {
    /** Éligible à « 100 % de saison ». */
    eligible: boolean;
    /** Nombre de légumes principaux identifiés (synonymes comptés une fois). */
    total: number;
    /** Nombre de ces légumes disponibles au mois demandé. */
    deSaison: number;
    /** Minimum requis pour `total`. */
    minimum: number;
    /** Ids des légumes principaux identifiés. */
    legumes: string[];
    /** Ids des légumes de saison. */
    legumesDeSaison: string[];
}

/**
 * Analyse une recette : `ingredients` = noms d'ingrédients (texte libre accepté,
 * les quantités ne gênent pas), `mois` = mois courant 1–12.
 */
export function analyserSaison(ingredients: readonly string[], mois: number): AnalyseSaison {
    const trouves = new Map<string, LegumeSaison>();
    for (const nom of ingredients) {
        const l = identifierLegume(nom);
        if (l && !trouves.has(l.id)) trouves.set(l.id, l);
    }
    const legumes = [...trouves.values()];
    const legumesDeSaison = legumes.filter((l) => estDeSaison(l, mois));
    const total = legumes.length;
    const minimum = minimumRequis(total);
    return {
        eligible: total > 0 && legumesDeSaison.length >= minimum,
        total,
        deSaison: legumesDeSaison.length,
        minimum,
        legumes: legumes.map((l) => l.id),
        legumesDeSaison: legumesDeSaison.map((l) => l.id),
    };
}

/** Tag de filtre « 100 % de saison » (recherche). Calculé, jamais stocké sur la recette. */
export const TAG_SAISON = 'saison-100';

/**
 * Ids canoniques des légumes principaux d'une liste d'ingrédients (dédoublonnés).
 * Sert au build : l'accueil n'a pas les ingrédients, seulement ces ids.
 */
export function legumesDeIngredients(noms: readonly string[]): string[] {
    const ids = new Set<string>();
    for (const nom of noms) {
        const l = identifierLegume(nom);
        if (l) ids.add(l.id);
    }
    return [...ids];
}

/** Règle des deux tiers à partir d'ids de légumes déjà identifiés. */
export function estEligibleIds(ids: readonly string[], mois: number): boolean {
    const legumes = [...new Set(ids)]
        .map((id) => LEGUMES_SAISON.find((l) => l.id === id))
        .filter((l): l is LegumeSaison => Boolean(l));
    const deSaison = legumes.filter((l) => estDeSaison(l, mois)).length;
    return legumes.length > 0 && deSaison >= minimumRequis(legumes.length);
}

/** Forme minimale d'une recette pour le calcul (structurelle, sans dépendance). */
export interface RecetteAvecIngredients {
    /** Ids pré-calculés au build (prioritaires : pas d'ingrédients côté accueil). */
    legumes?: readonly string[] | null;
    ingredients?: readonly { name?: string }[] | null;
}

/**
 * Vrai si la recette est éligible à « 100 % de saison » au mois donné.
 * Calcul à la volée : une recette entre et sort de la sélection avec le mois.
 * Les ids pré-calculés (`legumes`) l'emportent sur les ingrédients bruts.
 */
export function estRecetteDeSaison(recette: RecetteAvecIngredients, mois: number = moisCourantParis()): boolean {
    if (Array.isArray(recette.legumes)) return estEligibleIds(recette.legumes, mois);
    const noms = (recette.ingredients ?? []).map((i) => i?.name ?? '');
    return analyserSaison(noms, mois).eligible;
}

/**
 * Mois courant en France métropolitaine (1–12), indépendant du fuseau du
 * navigateur ou du serveur. `date` est injectable pour les tests.
 */
const formatMois = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', month: 'numeric' });

export function moisCourantParis(date: Date = new Date()): number {
    const partie = formatMois.formatToParts(date).find((p) => p.type === 'month');
    return Number(partie?.value);
}
