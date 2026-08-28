/**
 * Estimation du prix d'une recette.
 * ================================
 *
 * Ce que c'est : une FOURCHETTE, pas un prix. Le bas correspond aux étiquettes
 * d'un hard-discount (Lidl), le haut à une grande surface classique (Carrefour),
 * relevés à l'été 2026 sur les formats courants. Entre les deux se trouve à peu
 * près n'importe quel panier réel.
 *
 * Ce que ce n'est pas : un prix de courses. On facture la QUANTITÉ UTILISÉE —
 * 20 g de beurre coûtent 20 g de beurre — alors qu'en magasin on achète la
 * plaquette entière. Le premier chiffre dit ce que le plat coûte à faire ; le
 * second, ce que coûte le caddie. C'est le premier qui a un sens quand on
 * compare deux recettes ou qu'on additionne une semaine.
 *
 * L'analyse des lignes est CELLE DE LA LISTE DE COURSES (`ingredients.ts`) :
 * mêmes découpages, mêmes noms canoniques. Les deux écrans ne peuvent donc pas
 * diverger sur ce qu'ils croient avoir lu.
 */
/*
 * On lit la version MOBILE d'`ingredients.ts`, pas celle de `src/lib`.
 *
 * Les deux existent, avec les mêmes exports. Ce module sert les deux plateformes,
 * et l'une des deux copies entrera forcément dans le paquet de l'autre. Autant
 * que ce soit le bureau qui embarque celle du téléphone : le mobile importe déjà
 * celle-ci pour sa liste de courses, il n'en chargera donc pas une seconde — et
 * c'est là que le poids compte.
 */
import { parseIngredient, canonicalIng, expandIngredientLines, normalizeIng } from '@/mobile/lib/ingredients';

/** Fourchette de prix, en euros. */
export interface Fourchette { bas: number; haut: number }

/** Estimation d'une recette : la fourchette, et sur quoi elle repose. */
export interface Estimation extends Fourchette {
    /** Lignes d'ingrédients prises en compte. */
    lignes: number;
    /** Combien ont été reconnues dans la table (le reste passe au tarif par défaut). */
    reconnues: number;
}

/** Base de facturation d'un produit : au kilo, au litre, ou à la pièce. */
type Base = 'kg' | 'l' | 'piece';
/** [prix bas, prix haut, base, portion par défaut en g/ml/pièce si non chiffrée] */
type Tarif = [number, number, Base, number?];

/*
 * La table.
 *
 * Un produit par ligne, nom canonique (minuscules, sans accent, au singulier) —
 * la forme que `canonicalIng` produit. Le quatrième champ est la portion retenue
 * quand la ligne ne porte aucune quantité (« Sel », « Thym ») : une pincée pour
 * un condiment, une botte pour une herbe, une part raisonnable pour le reste.
 */
const PRIX: Record<string, Tarif> = {
    // ── Viandes ────────────────────────────────────────────────────────────
    'poulet': [6, 11, 'kg'], 'blanc de poulet': [9, 14, 'kg'], 'filet de poulet': [9, 14, 'kg'],
    'escalope de poulet': [10, 15, 'kg'], 'cuisse de poulet': [4, 7, 'kg'], 'aiguillette de poulet': [10, 15, 'kg'],
    'dinde': [8, 13, 'kg'], 'escalope de dinde': [9, 14, 'kg'],
    'boeuf': [12, 20, 'kg'], 'viande hachee': [9, 15, 'kg'], 'steak hache': [9, 15, 'kg'],
    'boeuf hache': [9, 15, 'kg'], 'steak': [15, 24, 'kg'], 'entrecote': [20, 32, 'kg'],
    'bavette': [16, 25, 'kg'], 'rumsteck': [18, 28, 'kg'], 'paleron': [10, 16, 'kg'], 'bourguignon': [11, 17, 'kg'],
    'veau': [18, 28, 'kg'], 'agneau': [15, 26, 'kg'], 'gigot': [14, 24, 'kg'], 'cotelette': [12, 20, 'kg'],
    'porc': [7, 12, 'kg'], 'filet mignon': [12, 19, 'kg'], 'echine': [7, 11, 'kg'], 'travers de porc': [7, 12, 'kg'],
    'lardon': [8, 13, 'kg'], 'poitrine fumee': [8, 13, 'kg'], 'bacon': [12, 19, 'kg'],
    'jambon': [11, 18, 'kg'], 'jambon cru': [25, 40, 'kg'], 'chorizo': [12, 20, 'kg'],
    'saucisse': [8, 13, 'kg'], 'merguez': [9, 14, 'kg'], 'saucisson': [14, 22, 'kg'],
    'canard': [12, 20, 'kg'], 'magret': [18, 28, 'kg'], 'confit de canard': [14, 22, 'kg'],
    'lapin': [10, 16, 'kg'], 'foie gras': [60, 110, 'kg'], 'merguez de boeuf': [9, 14, 'kg'],

    // ── Poissons et fruits de mer ──────────────────────────────────────────
    'saumon': [16, 26, 'kg'], 'pave de saumon': [18, 28, 'kg'], 'saumon fume': [28, 45, 'kg'],
    'cabillaud': [13, 22, 'kg'], 'colin': [10, 17, 'kg'], 'lieu': [10, 17, 'kg'], 'merlu': [11, 18, 'kg'],
    'dorade': [12, 20, 'kg'], 'bar': [16, 26, 'kg'], 'truite': [11, 18, 'kg'], 'sole': [22, 36, 'kg'],
    'thon': [10, 18, 'kg'], 'sardine': [5, 10, 'kg'], 'maquereau': [5, 10, 'kg'], 'anchois': [14, 24, 'kg'],
    'crevette': [12, 22, 'kg'], 'gambas': [16, 28, 'kg'], 'moule': [4, 7, 'kg'], 'palourde': [8, 14, 'kg'],
    'calamar': [9, 16, 'kg'], 'poulpe': [12, 20, 'kg'], 'saint-jacques': [22, 38, 'kg'], 'crabe': [10, 18, 'kg'],
    'surimi': [7, 12, 'kg'], 'poisson': [11, 19, 'kg'],

    // ── Légumes ────────────────────────────────────────────────────────────
    'pomme de terre': [1.1, 2, 'kg'], 'patate douce': [2.2, 4, 'kg'],
    'carotte': [1.1, 2, 'kg'], 'oignon': [1.2, 2.2, 'kg'], 'oignon rouge': [1.6, 2.8, 'kg'],
    'echalote': [3, 5, 'kg'], 'ail': [6, 11, 'kg', 5], 'poireau': [2, 3.5, 'kg'],
    'tomate': [2.2, 4.2, 'kg'], 'tomate cerise': [5, 9, 'kg'], 'tomate concassee': [1.5, 2.8, 'kg'],
    'coulis de tomate': [1.5, 2.8, 'l'], 'concentre de tomate': [4, 7, 'kg', 30],
    'courgette': [1.8, 3.4, 'kg'], 'aubergine': [2.2, 4, 'kg'], 'poivron': [2.8, 5, 'kg'],
    'champignon': [4, 7.5, 'kg'], 'champignon de paris': [4, 7.5, 'kg'], 'cepe': [20, 40, 'kg'],
    'brocoli': [2.4, 4.2, 'kg'], 'chou-fleur': [2, 3.6, 'kg'], 'chou': [1.5, 2.8, 'kg'],
    'epinard': [3, 6, 'kg'], 'haricot vert': [3.5, 6.5, 'kg'], 'petit pois': [2.2, 4, 'kg'],
    'concombre': [2, 3.5, 'kg'], 'salade': [2.5, 4.5, 'kg'], 'roquette': [8, 14, 'kg'], 'mache': [8, 14, 'kg'],
    'celeri': [2, 3.6, 'kg'], 'fenouil': [2.5, 4.2, 'kg'], 'navet': [1.6, 3, 'kg'], 'betterave': [2.4, 4, 'kg'],
    'potiron': [1.4, 2.8, 'kg'], 'courge': [1.6, 3, 'kg'], 'butternut': [1.8, 3.2, 'kg'],
    'radis': [2.5, 4.5, 'kg'], 'endive': [2.5, 4.2, 'kg'], 'asperge': [7, 13, 'kg'],
    'artichaut': [3, 5.5, 'kg'], 'mais': [2.5, 4.5, 'kg'], 'olive': [7, 13, 'kg', 40],
    'cornichon': [5, 9, 'kg', 30], 'poivron grille': [5, 9, 'kg'], 'gingembre': [8, 14, 'kg', 10],
    'citronnelle': [12, 20, 'kg', 5], 'avocat': [5, 9, 'kg'], 'chou rouge': [1.8, 3.2, 'kg'],

    // ── Fruits ─────────────────────────────────────────────────────────────
    'pomme': [1.8, 3.2, 'kg'], 'poire': [2.2, 3.8, 'kg'], 'banane': [1.4, 2.4, 'kg'],
    'orange': [1.7, 3, 'kg'], 'citron': [2.4, 4, 'kg'], 'citron vert': [4, 7, 'kg'],
    'fraise': [6, 12, 'kg'], 'framboise': [12, 22, 'kg'], 'myrtille': [12, 22, 'kg'], 'mure': [12, 22, 'kg'],
    'peche': [2.4, 4.4, 'kg'], 'abricot': [3, 6, 'kg'], 'prune': [2.5, 4.5, 'kg'], 'cerise': [6, 12, 'kg'],
    'raisin': [3, 5.5, 'kg'], 'kiwi': [3, 5.5, 'kg'], 'mangue': [4, 7, 'kg'], 'ananas': [2, 3.6, 'kg'],
    'melon': [2, 4, 'kg'], 'pasteque': [1, 2.2, 'kg'], 'figue': [6, 11, 'kg'], 'grenade': [4, 7, 'kg'],
    'datte': [7, 13, 'kg'], 'raisin sec': [5, 9, 'kg'], 'abricot sec': [7, 12, 'kg'],
    'fruit rouge': [8, 15, 'kg'], 'noix de coco': [4, 7, 'kg'], 'lait de coco': [2.5, 4.5, 'l'],

    // ── Crémerie et œufs ───────────────────────────────────────────────────
    'lait': [0.9, 1.4, 'l'], 'lait entier': [1, 1.5, 'l'], 'lait de soja': [1.4, 2.4, 'l'],
    'lait d amande': [2, 3.4, 'l'], 'creme liquide': [2.6, 4.6, 'l'], 'creme fraiche': [3, 5.2, 'l'],
    'creme epaisse': [3, 5.2, 'l'], 'mascarpone': [6, 10, 'kg'], 'ricotta': [5, 9, 'kg'],
    'beurre': [8, 13, 'kg'], 'margarine': [3, 5.5, 'kg'],
    'oeuf': [0.24, 0.45, 'piece', 1],
    'yaourt': [0.3, 0.6, 'piece', 1], 'yaourt grec': [0.5, 0.9, 'piece', 1],
    'fromage blanc': [2.4, 4.4, 'kg'], 'skyr': [4, 7, 'kg'],
    'fromage': [9, 16, 'kg'], 'fromage rape': [8, 14, 'kg'], 'gruyere': [9, 15, 'kg'],
    'emmental': [8, 14, 'kg'], 'comte': [15, 24, 'kg'], 'parmesan': [16, 28, 'kg'],
    'mozzarella': [7, 12, 'kg'], 'burrata': [14, 24, 'kg'], 'feta': [8, 14, 'kg'],
    'chevre': [11, 19, 'kg'], 'roquefort': [16, 26, 'kg'], 'bleu': [12, 20, 'kg'],
    'raclette': [10, 17, 'kg'], 'reblochon': [12, 20, 'kg'], 'camembert': [8, 14, 'kg'],
    'cheddar': [10, 17, 'kg'], 'boursin': [12, 20, 'kg'], 'philadelphia': [10, 17, 'kg'],
    'creme de coco': [3, 5.5, 'l'],

    // ── Épicerie sèche ─────────────────────────────────────────────────────
    'farine': [0.8, 1.6, 'kg', 150], 'fecule de mais': [2, 3.6, 'kg', 20], 'maizena': [2, 3.6, 'kg', 20],
    'sucre': [0.9, 1.7, 'kg', 80], 'sucre glace': [2, 3.6, 'kg', 40], 'cassonade': [1.6, 3, 'kg', 60],
    'levure': [8, 15, 'kg', 8], 'levure chimique': [8, 15, 'kg', 8], 'levure de boulanger': [10, 18, 'kg', 8],
    'bicarbonate': [4, 8, 'kg', 5], 'sel': [0.5, 1.2, 'kg', 3], 'fleur de sel': [8, 15, 'kg', 2],
    'poivre': [18, 35, 'kg', 2], 'sucre vanille': [12, 22, 'kg', 8],
    'riz': [1.4, 2.8, 'kg'], 'riz basmati': [2, 3.8, 'kg'], 'riz arborio': [2.6, 4.6, 'kg'],
    'pate': [1.1, 2.4, 'kg'], 'spaghetti': [1.1, 2.4, 'kg'], 'tagliatelle': [1.6, 3, 'kg'],
    'lasagne': [1.8, 3.2, 'kg'], 'nouille': [2, 3.6, 'kg'], 'semoule': [1.4, 2.6, 'kg'],
    'boulgour': [2, 3.6, 'kg'], 'quinoa': [4, 7.5, 'kg'], 'lentille': [2, 3.6, 'kg'],
    'pois chiche': [1.8, 3.2, 'kg'], 'haricot rouge': [1.8, 3.2, 'kg'], 'haricot blanc': [1.8, 3.2, 'kg'],
    'flocon d avoine': [1.8, 3.2, 'kg'], 'chapelure': [2, 3.6, 'kg', 40],
    'pain': [2.5, 4.5, 'kg', 60], 'pain de mie': [2.5, 4.5, 'kg', 60], 'baguette': [1, 1.5, 'piece', 1],
    'tortilla': [4, 7, 'kg', 60], 'pita': [4, 7, 'kg', 60], 'bagel': [5, 9, 'kg', 90],
    'pate feuilletee': [1.5, 2.8, 'piece', 1], 'pate brisee': [1.3, 2.4, 'piece', 1],
    'pate sablee': [1.5, 2.8, 'piece', 1], 'pate a pizza': [1.5, 2.8, 'piece', 1],
    'feuille de brick': [2, 3.6, 'piece', 1], 'biscuit': [6, 11, 'kg'], 'speculoos': [7, 12, 'kg'],
    'boudoir': [7, 12, 'kg'], 'petit-beurre': [4, 8, 'kg'],

    // ── Matières grasses, condiments, sauces ───────────────────────────────
    'huile d olive': [6, 11, 'l', 20], 'huile': [2, 4, 'l', 20], 'huile de tournesol': [1.8, 3.4, 'l', 20],
    'huile de sesame': [10, 18, 'l', 8], 'huile de coco': [8, 15, 'l', 15],
    'vinaigre': [1.5, 3, 'l', 15], 'vinaigre balsamique': [4, 8, 'l', 12],
    'sauce soja': [4, 8, 'l', 15], 'sauce worcestershire': [8, 14, 'l', 8],
    'moutarde': [3.5, 6.5, 'kg', 15], 'ketchup': [2.8, 5, 'kg', 20], 'mayonnaise': [4, 7.5, 'kg', 20],
    'miel': [8, 16, 'kg', 20], 'sirop d erable': [16, 28, 'l', 20], 'confiture': [4, 7.5, 'kg', 30],
    'tahini': [10, 18, 'kg', 20], 'beurre de cacahuete': [7, 13, 'kg', 25],
    'bouillon': [12, 22, 'kg', 10], 'fond de veau': [14, 24, 'kg', 10], 'fond de volaille': [14, 24, 'kg', 10],
    'harissa': [8, 15, 'kg', 10], 'pesto': [10, 18, 'kg', 30], 'tapenade': [10, 18, 'kg', 25],
    'creme de balsamique': [8, 14, 'l', 8], 'sauce tomate': [2, 3.8, 'kg'],

    // ── Épices et herbes ───────────────────────────────────────────────────
    'paprika': [16, 30, 'kg', 3], 'curry': [16, 30, 'kg', 3], 'cumin': [16, 30, 'kg', 3],
    'curcuma': [14, 26, 'kg', 3], 'cannelle': [20, 38, 'kg', 3], 'muscade': [40, 75, 'kg', 1],
    'piment': [18, 34, 'kg', 2], 'piment d espelette': [60, 110, 'kg', 2], 'herbe de provence': [14, 26, 'kg', 3],
    'thym': [20, 36, 'kg', 3], 'laurier': [20, 36, 'kg', 1], 'romarin': [20, 36, 'kg', 3],
    'origan': [18, 34, 'kg', 3],     'safran': [3000, 6000, 'kg', 0.1],
    /*
     * « Vanille » seule, c'est l'extrait ou le sucre vanillé — le mot « gousse »
     * est retiré du nom par l'analyseur, on ne peut pas les distinguer. Au tarif
     * de la gousse (≈ 600 €/kg), une cuillère de vanille chiffrait 90 € et
     * emportait toute la recette. On facture donc l'extrait ; les vraies gousses
     * sont sous-estimées de deux ou trois euros, ce qui ne se voit pas.
     */
    'vanille': [50, 95, 'l', 5],
    'cacao': [10, 20, 'kg', 15], 'cannelle en poudre': [20, 38, 'kg', 3],
    'ail en poudre': [16, 30, 'kg', 3], 'oignon en poudre': [16, 30, 'kg', 3],
    'gingembre en poudre': [18, 32, 'kg', 3], 'coriandre en poudre': [16, 30, 'kg', 3],
    'persil': [9, 16, 'kg', 20], 'coriandre': [9, 16, 'kg', 20], 'basilic': [14, 25, 'kg', 15],
    'menthe': [12, 22, 'kg', 15], 'ciboulette': [14, 25, 'kg', 10], 'aneth': [14, 25, 'kg', 10],
    'estragon': [16, 28, 'kg', 8], 'sauge': [18, 32, 'kg', 5],

    // ── Sucré ──────────────────────────────────────────────────────────────
    'chocolat': [8, 16, 'kg'], 'chocolat noir': [8, 16, 'kg'], 'chocolat au lait': [8, 15, 'kg'],
    'chocolat blanc': [9, 17, 'kg'], 'pepite de chocolat': [10, 18, 'kg'],
    'praline': [14, 25, 'kg'], 'nutella': [7, 12, 'kg', 30], 'caramel': [8, 15, 'kg', 30],
    'gelatine': [40, 80, 'kg', 6], 'agar-agar': [80, 150, 'kg', 2],
    'amande': [12, 22, 'kg'], 'poudre d amande': [12, 22, 'kg'], 'noisette': [12, 22, 'kg'],
    'noix': [10, 19, 'kg'], 'noix de cajou': [14, 24, 'kg'], 'pistache': [20, 36, 'kg'],
    'pignon de pin': [40, 75, 'kg'], 'cacahuete': [5, 10, 'kg'], 'graine de sesame': [6, 12, 'kg'],
    'noix de pecan': [16, 28, 'kg'], 'graine de courge': [8, 15, 'kg'], 'graine de tournesol': [5, 10, 'kg'],
    'chantilly': [6, 11, 'l'], 'glace': [4, 9, 'l'],

    // ── Boissons et alcools ────────────────────────────────────────────────
    'eau': [0.2, 0.6, 'l'], 'eau gazeuse': [0.4, 1, 'l'], 'jus d orange': [1.2, 2.4, 'l'],
    'vin blanc': [3, 8, 'l'], 'vin rouge': [3, 8, 'l'], 'biere': [1.6, 3.5, 'l'],
    'rhum': [15, 26, 'l'], 'vodka': [14, 24, 'l'], 'tequila': [20, 36, 'l'], 'gin': [16, 30, 'l'],
    'whisky': [18, 34, 'l'], 'cognac': [30, 55, 'l'], 'aperol': [12, 20, 'l'], 'campari': [16, 26, 'l'],
    'limoncello': [14, 24, 'l'], 'cointreau': [22, 38, 'l'], 'champagne': [20, 42, 'l'],
    'prosecco': [5, 11, 'l'], 'porto': [8, 15, 'l'], 'cidre': [2, 4, 'l'],
    'sirop': [3, 6, 'l', 20], 'the': [40, 80, 'kg', 3], 'cafe': [12, 24, 'kg', 10],
    'tonic': [1, 2.4, 'l'], 'limonade': [0.8, 2, 'l'], 'jus de citron': [2.5, 4.5, 'l'],

    // ── Divers ─────────────────────────────────────────────────────────────
    'tofu': [7, 13, 'kg'], 'seitan': [10, 18, 'kg'], 'lentille corail': [3, 5.5, 'kg'],
    'levure maltee': [20, 36, 'kg', 8], 'graine de chia': [10, 18, 'kg', 15],
    'sucre de coco': [8, 15, 'kg', 40], 'compote': [2.5, 4.5, 'kg', 100],
    // Repérés sur le catalogue : sans eux, l'extrait se facturait au prix de la
    // gousse et la glace à la vanille au prix de la vanille.
    'extrait de vanille': [50, 95, 'l', 5], 'arome vanille': [40, 80, 'l', 5],
    'glace vanille': [4, 9, 'l'], 'glacon': [0.2, 0.6, 'kg', 150],
    'fruit de la passion': [10, 18, 'kg'], 'jus de fruit': [1.5, 3, 'l'],
    'lait concentre': [3, 5.5, 'l'], 'lait concentre sucre': [4, 7, 'l'],
    'nectarine': [2.4, 4.4, 'kg'], 'amande amere': [40, 80, 'l', 5],
    'levure seche': [10, 18, 'kg', 8],
    'creme speciale cuisson': [2.6, 4.6, 'l'], 'straccetti': [16, 26, 'kg'],
};

/**
 * Poids d'UNE pièce, en grammes.
 *
 * Sert quand la ligne compte des unités sans le dire : « 2 oignons », « 3
 * pommes ». Sans ça, on ne saurait pas quoi facturer.
 */
const POIDS_PIECE: Record<string, number> = {
    'oeuf': 60, 'oignon': 110, 'oignon rouge': 110, 'echalote': 25, 'ail': 5, 'gousse d ail': 5,
    'tomate': 120, 'tomate cerise': 10, 'carotte': 90, 'pomme de terre': 150, 'patate douce': 250,
    'courgette': 250, 'aubergine': 300, 'poivron': 160, 'concombre': 350, 'poireau': 180,
    'citron': 100, 'citron vert': 60, 'orange': 180, 'pomme': 160, 'poire': 170, 'banane': 120,
    'peche': 140, 'abricot': 45, 'kiwi': 80, 'mangue': 350, 'avocat': 180, 'ananas': 1200,
    'melon': 1000, 'pasteque': 3000, 'grenade': 300, 'figue': 50, 'salade': 300,
    'brocoli': 500, 'chou-fleur': 800, 'fenouil': 300, 'betterave': 150, 'navet': 100,
    'blanc de poulet': 160, 'filet de poulet': 160, 'escalope de poulet': 150, 'cuisse de poulet': 200,
    'escalope de dinde': 140, 'steak': 150, 'cotelette': 120, 'saucisse': 80, 'merguez': 60,
    'pave de saumon': 130, 'dorade': 400, 'truite': 250, 'crevette': 12, 'gambas': 25,
    'saint-jacques': 20, 'tranche de jambon': 40, 'jambon': 40, 'bacon': 20,
    'tortilla': 60, 'pita': 70, 'bagel': 90, 'baguette': 250, 'pain': 60, 'pain de mie': 30,
    'feuille de brick': 12, 'biscuit': 10, 'boudoir': 8, 'speculoos': 6,
    'champignon': 20, 'olive': 4, 'cornichon': 10, 'datte': 8, 'noix': 5, 'radis': 10,
    'piment': 15, 'gousse': 5, 'laurier': 0.2, 'oeuf de caille': 10,
    'yaourt': 125, 'mozzarella': 125, 'burrata': 125, 'camembert': 250,
};

/** Ce qu'on facture quand un produit est inconnu de la table. */
const DEFAUT: Tarif = [4, 10, 'kg', 80];

/*
 * Contenants et cuillères.
 *
 * L'analyseur de la liste de courses les RETIRE du nom et vide l'unité : « 2
 * cuillères à soupe d'huile » lui donne une quantité de 2 et pas d'unité. Pour
 * facturer, il faut les retrouver — dans le texte brut, celui-là ne ment pas.
 * Ordre important : les motifs les plus spécifiques d'abord.
 */
const MESURES: Array<[RegExp, number, 'g' | 'ml']> = [
    // Les séparateurs varient : « c. à soupe », « c-à-soupe », « 1c.c », « càs ».
    [/cuill?[eè]res?\s*[-.]?\s*[àa]\s*[-.]?\s*soupe|\bc\s*[-.]?\s*[àa]\s*[-.]?\s*s\b|\bcas\b|\bcs\b/, 15, 'ml'],
    [/cuill?[eè]res?\s*[-.]?\s*[àa]\s*[-.]?\s*caf[ée]|\bc\s*[-.]?\s*[àa]\s*[-.]?\s*c\b|\bcac\b|\bcc\b/, 5, 'ml'],
    [/pinc[ée]e/, 1, 'g'],
    [/gousse/, 5, 'g'],
    [/poign[ée]e/, 30, 'g'],
    [/\bbotte\b/, 80, 'g'],
    [/\bbrin\b|\bbranche\b/, 3, 'g'],
    [/\btranche\b/, 25, 'g'],
    [/\bsachet\b/, 10, 'g'],
    [/\bverre\b|\btasse\b|\bmug\b/, 200, 'ml'],
    [/\bbo[iî]te\b|\bconserve\b|\bbocal\b/, 400, 'g'],
    [/\bpot\b/, 200, 'g'],
    [/\bcube\b/, 10, 'g'],
    [/\bmorceau\b/, 30, 'g'],
    [/cuill?[eè]res?\s*[àa]\s*table/, 15, 'ml'],
    [/\bfeuille\b/, 2, 'g'],
    [/\bbouchon\b/, 20, 'ml'],
    [/\bnoisette\s+de\b/, 8, 'g'],
];

/*
 * Lecture de la quantité, sur le texte brut.
 *
 * On ne se sert PAS de celle de l'analyseur de la liste de courses. Sa table
 * d'unités ignore « gr », et « 500gr de farfalle » lui donnait une quantité de
 * 500 sans unité — cinq cents pâtes, soit 388 € de farfalle. Il lit très bien
 * les NOMS ; pour les quantités, une addition demande plus de rigueur.
 *
 * Trois formes couvrent le corpus : la fourchette (« 400 à 500 g »), le nombre
 * suivi d'une unité (« 40 cl », « 100gr »), et la fraction (« 1/2 c. à café »).
 */
const UNITES: Record<string, { v: number; t: 'g' | 'ml' }> = {
    kg: { v: 1000, t: 'g' }, kilo: { v: 1000, t: 'g' }, kilos: { v: 1000, t: 'g' },
    kilogramme: { v: 1000, t: 'g' }, kilogrammes: { v: 1000, t: 'g' },
    g: { v: 1, t: 'g' }, gr: { v: 1, t: 'g' }, gramme: { v: 1, t: 'g' }, grammes: { v: 1, t: 'g' },
    mg: { v: 0.001, t: 'g' },
    l: { v: 1000, t: 'ml' }, litre: { v: 1000, t: 'ml' }, litres: { v: 1000, t: 'ml' },
    dl: { v: 100, t: 'ml' }, cl: { v: 10, t: 'ml' }, ml: { v: 1, t: 'ml' },
    millilitre: { v: 1, t: 'ml' }, millilitres: { v: 1, t: 'ml' },
};
const UNITES_RE = Object.keys(UNITES).sort((a, b) => b.length - a.length).join('|');
const NOMBRE = '(\\d+(?:[.,]\\d+)?)';
const RE_FOURCHETTE = new RegExp(`^${NOMBRE}\\s*(?:a|-|ou)\\s*${NOMBRE}\\s*(${UNITES_RE})\\b`);
const RE_MESURE = new RegExp(`^${NOMBRE}\\s*(${UNITES_RE})\\b`);
const RE_FRACTION = /^(\d+)\s*\/\s*(\d+)/;
const RE_NOMBRE = new RegExp(`^${NOMBRE}`);
const nb = (s: string) => parseFloat(s.replace(',', '.'));

/** Quantité lue : en grammes, en millilitres, ou en nombre d'unités. */
type Quantite = { g: number } | { ml: number } | { n: number } | null;

/**
 * La quantité est celle du PREMIER nombre de la ligne, pas la première qu'on
 * trouve d'un format donné.
 *
 * « 2 sachets de thé à la vanille pour 1,5 litre d'eau » : chercher une unité
 * n'importe où livrait « 1,5 litre », et l'on facturait un litre et demi de
 * gousses de vanille — 1 363 €. Le nombre qui compte est celui qui ouvre la
 * ligne ; le reste appartient à la phrase, pas au produit.
 */
const quantiteBrute = (n: string): Quantite => {
    const i = n.search(/\d/);
    if (i < 0) return null;
    const reste = n.slice(i);

    const f = reste.match(RE_FOURCHETTE);
    if (f) {
        const u = UNITES[f[3]];
        const moyenne = ((nb(f[1]) + nb(f[2])) / 2) * u.v;
        return u.t === 'g' ? { g: moyenne } : { ml: moyenne };
    }
    const m = reste.match(RE_MESURE);
    if (m) {
        const u = UNITES[m[2]];
        const q = nb(m[1]) * u.v;
        return u.t === 'g' ? { g: q } : { ml: q };
    }
    const fr = reste.match(RE_FRACTION);
    if (fr) {
        const q = parseInt(fr[1], 10) / parseInt(fr[2], 10);
        return Number.isFinite(q) && q > 0 ? { n: q } : null;
    }
    const d = reste.match(RE_NOMBRE);
    return d ? { n: nb(d[1]) } : null;
};

/** Nom prêt pour la table : minuscules, sans accent, apostrophes en espaces. */
const cle = (s: string) => normalizeIng(s).replace(/['’]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Le tarif d'un produit.
 *
 * Exact d'abord, puis la plus longue entrée dont TOUS les mots se suivent dans
 * le nom : « huile d olive vierge extra » trouve « huile d olive » et pas
 * « huile ». On compare des suites de mots, jamais des sous-chaînes — sinon
 * « sel » se reconnaîtrait dans « persil ».
 */
const ENTREES = Object.keys(PRIX).map((k) => ({ k, mots: k.split(' ') }));

/**
 * Le tarif d'un produit.
 *
 * Départage : d'abord la position — en français le nom de tête ouvre le groupe,
 * « glace vanille bourbon » est une glace. Chercher l'entrée la plus LONGUE
 * d'abord retenait « vanille », et cent cinquante grammes de glace se facturaient
 * au prix de la gousse : 135 €. À position égale, la plus précise l'emporte
 * (« huile d olive » avant « huile »).
 */
const tarifDe = (nom: string): { tarif: Tarif; connu: boolean } => {
    const n = cle(nom);
    if (PRIX[n]) return { tarif: PRIX[n], connu: true };
    const mots = n.split(' ');
    let meilleur: { k: string; pos: number; long: number } | null = null;
    for (const e of ENTREES) {
        for (let i = 0; i + e.mots.length <= mots.length; i++) {
            let ok = true;
            for (let j = 0; j < e.mots.length; j++) {
                if (mots[i + j] !== e.mots[j]) { ok = false; break; }
            }
            if (!ok) continue;
            if (!meilleur || i < meilleur.pos || (i === meilleur.pos && e.mots.length > meilleur.long)) {
                meilleur = { k: e.k, pos: i, long: e.mots.length };
            }
            break;   // pour cette entrée, la première position suffit
        }
    }
    return meilleur ? { tarif: PRIX[meilleur.k], connu: true } : { tarif: DEFAUT, connu: false };
};

/** Prix d'UNE ligne d'ingrédient, en euros. */
function prixLigne(brut: string): { bas: number; haut: number; connu: boolean } | null {
    const p = parseIngredient(brut);
    if (!p.name) return null;
    const nom = canonicalIng(p.name, p.unit, brut).name;
    const { tarif, connu } = tarifDe(nom);
    const [bas, haut, base, portion] = tarif;
    const n = cle(brut);
    const poids = POIDS_PIECE[cle(nom)] || 100;
    const q = quantiteBrute(n);

    /** Quantité retenue, dans l'unité de la base : kg, l, ou nombre de pièces. */
    let quantite: number;

    if (q && 'g' in q) {
        quantite = base === 'piece' ? q.g / poids : q.g / 1000;
    } else if (q && 'ml' in q) {
        quantite = base === 'piece' ? q.ml / 100 : q.ml / 1000;
    } else if (q) {
        /*
         * Un nombre nu : cuillère, contenant, ou décompte.
         *
         * Le contenant doit suivre le nombre de PRÈS. « 6 piments chipotles en
         * conserve » compte six piments, pas six conserves — chercher le mot
         * n'importe où dans la ligne facturait 2,4 kg de piment. On ne regarde
         * donc que les quelques mots qui suivent le chiffre.
         */
        const fenetre = n.slice(n.search(/\d/)).split(' ').slice(0, 3).join(' ');
        const mesure = MESURES.find(([re]) => re.test(fenetre));
        if (mesure) {
            const total = q.n * mesure[1];   // g ou ml, même ordre de grandeur
            quantite = base === 'piece' ? total / poids : total / 1000;
        } else if (q.n > 12) {
            // Douze pommes, oui ; deux cents, non. Un grand nombre sans unité est
            // un poids dont l'unité s'est perdue en route.
            quantite = base === 'piece' ? q.n / poids : q.n / 1000;
        } else {
            quantite = base === 'piece' ? q.n : (q.n * poids) / 1000;
        }
    } else {
        /*
         * Aucune quantité (« Sel », « Thym », « Pommes de terre »).
         *
         * Faute de portion déclarée, on la déduit du PRIX : ce qui est bon
         * marché s'emploie en quantité, ce qui est cher se compte en pincées.
         * Une règle grossière, mais qui ne dérape pas — et les produits où elle
         * comptait vraiment portent leur portion en toutes lettres.
         */
        const parDefaut = base === 'piece' ? 2
            : haut < 3 ? 400
            : haut < 10 ? 200
            : haut < 25 ? 120
            : 10;
        const par = portion ?? parDefaut;
        quantite = base === 'piece' ? par : par / 1000;
    }

    if (!Number.isFinite(quantite) || quantite <= 0) return null;
    // Garde-fou : une ligne mal lue ne doit pas emporter l'addition. Personne ne
    // met huit kilos de farine dans un gâteau ; c'est l'analyse qui a dérapé.
    quantite = Math.min(quantite, base === 'piece' ? 24 : 8);
    return { bas: quantite * bas, haut: quantite * haut, connu };
}

/** Toutes les lignes d'ingrédients d'une recette, brutes. */
const lignesDe = (recette: { ingredients?: Array<{ name?: string; quantity?: string }> }): string[] =>
    (recette.ingredients || [])
        .map((i) => [i.quantity, i.name].filter(Boolean).join(' ').trim())
        .filter(Boolean)
        // Même découpage que la liste de courses : « 155g farine, 100g beurre »
        // compte pour deux produits, pas pour un.
        .flatMap((l) => expandIngredientLines(l));

/** Estimation du prix d'une recette. `null` si elle n'a aucun ingrédient. */
export function prixRecette(recette: { ingredients?: Array<{ name?: string; quantity?: string }> }): Estimation | null {
    const lignes = lignesDe(recette);
    if (!lignes.length) return null;
    let bas = 0, haut = 0, reconnues = 0, comptees = 0;
    for (const l of lignes) {
        const p = prixLigne(l);
        if (!p) continue;
        bas += p.bas; haut += p.haut; comptees++;
        if (p.connu) reconnues++;
    }
    /*
     * Pas de chiffre sans matière.
     *
     * « Ingrédients détaillés dans la vidéo » donnait 0,50 € — un prix, pour une
     * recette dont on ne sait rien. Sous trois lignes, ou quand la moitié
     * échappe à la table, on préfère ne rien afficher qu'afficher n'importe quoi.
     */
    if (comptees < 3 || reconnues / comptees < 0.5) return null;
    return { bas, haut, lignes: comptees, reconnues };
}

/** Additionne plusieurs estimations (une journée, une semaine). */
export function additionner(estimations: Array<Fourchette | null | undefined>): Fourchette {
    return estimations.reduce<Fourchette>(
        (t, e) => (e ? { bas: t.bas + e.bas, haut: t.haut + e.haut } : t),
        { bas: 0, haut: 0 },
    );
}

/**
 * Arrondi d'affichage.
 *
 * Sous dix euros, le demi-euro veut encore dire quelque chose ; au-delà, non —
 * « 23,40 € » sur une estimation à ±40 % serait une précision mensongère.
 */
const arrondir = (v: number) => (v < 10 ? Math.round(v * 2) / 2 : Math.round(v));

/** « 12 – 15 € », ou « 3,50 – 5 € » pour les petites sommes. */
export function formatFourchette(f: Fourchette | null): string {
    if (!f) return '';
    const nombre = (v: number) => String(arrondir(v)).replace('.', ',');
    const bas = arrondir(f.bas), haut = arrondir(f.haut);
    if (bas === haut) return `${nombre(bas)} €`;
    return `${nombre(bas)} – ${nombre(haut)} €`;
}
