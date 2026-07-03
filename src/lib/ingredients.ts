// Helpers partagés pour parser / illustrer les ingrédients

export const normalizeIng = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/œ/g, 'oe').replace(/æ/g, 'ae').trim();

// Unités de MESURE réelles uniquement. Les contenants (gousse, tranche, sachet, verre…)
// sont volontairement EXCLUS : ils sont retirés du nom (stripMeasure) pour que
// "1 gousse d'ail" fusionne avec "ail" (clé par nom, pas par contenant).
const KNOWN_UNITS = ['g', 'kg', 'mg', 'ml', 'cl', 'l', 'dl', 'cas', 'cac', 'cs', 'cc', 'c.à.s', 'c.à.c'];

// Conversion vers une unité de base (g pour le poids, ml pour le volume) afin
// d'ADDITIONNER des quantités exprimées dans des unités différentes (ex. 1 kg + 200 g,
// 1 brique + 10 cl). facteur = combien d'unités de base vaut 1 unité.
const WEIGHT_TO_G: Record<string, number> = { g: 1, gr: 1, gramme: 1, grammes: 1, mg: 0.001, kg: 1000 };
const VOLUME_TO_ML: Record<string, number> = { ml: 1, cl: 10, dl: 100, l: 1000, litre: 1000, litres: 1000 };
// Contenants à volume standard connu (en ml). "1 brique de crème" = 20 cl = 200 ml.
const CONTAINER_TO_ML: Record<string, number> = { brique: 200, briques: 200 };

// Ramène (qty, unit) à l'unité de base (g ou ml). Renvoie l'unité d'origine si inconnue.
const toBaseUnit = (qty: number | null, unit: string): { qty: number | null; unit: string } => {
    const u = normalizeIng(unit);
    if (qty == null) return { qty, unit: u };
    if (WEIGHT_TO_G[u] != null) return { qty: qty * WEIGHT_TO_G[u], unit: 'g' };
    if (VOLUME_TO_ML[u] != null) return { qty: qty * VOLUME_TO_ML[u], unit: 'ml' };
    return { qty, unit: u };
};

// Affichage lisible d'une quantité en unité de base : g→kg si ≥1000, ml→l/cl.
export const prettyQtyUnit = (qty: number, unit: string): string => {
    if (unit === 'g') return qty >= 1000 && qty % 1000 === 0 ? `${qty / 1000} kg`
        : qty >= 1000 ? `${Math.round(qty / 10) / 100} kg` : `${fmtQty(qty)} g`;
    if (unit === 'ml') {
        if (qty >= 1000 && qty % 1000 === 0) return `${qty / 1000} L`;
        if (qty % 10 === 0) return `${qty / 10} cl`;
        return `${fmtQty(qty)} ml`;
    }
    return `${fmtQty(qty)}${unit ? ' ' + unit : ''}`;
};

// Mots de mesure/conditionnement à retirer du nom (pour affichage + recherche)
const MEASURE_WORDS = [
    'sachet', 'sachets', 'cuillere', 'cuilleres', 'cuillère', 'cuillères', 'cas', 'cac', 'càs', 'càc',
    'pincee', 'pincees', 'pincée', 'pincées', 'gousse', 'gousses', 'tranche', 'tranches',
    'tete', 'tetes', 'tête', 'têtes',
    'verre', 'verres', 'tasse', 'tasses', 'boite', 'boites', 'boîte', 'boîtes', 'brin', 'brins',
    'tige', 'tiges', 'bouquet', 'bouquets', 'pot', 'pots', 'barquette', 'barquettes', 'poignee', 'poignée',
    'brique', 'briques', 'dl',
    'g', 'gr', 'gramme', 'grammes', 'kg', 'mg', 'ml', 'cl', 'l', 'litre', 'litres',
];

export interface ParsedIng { qty: number | null; unit: string; name: string; }

// Retire les émojis (et puces) en tête de chaîne — sans flag /u (target ES5)
const stripLeadingEmoji = (s: string) =>
    s.replace(/^(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[←-⇿⌀-➿⬀-⯿️•\-\s])+/, '');

// Retire les mots/locutions de mesure, "jus/zeste de", articles… en tête
// ex: "sachets de levure" → "levure", "c. à café d'herbes" → "herbes",
//     "le jus d'1 citron" → "citron"
const stripMeasure = (s: string) => {
    let out = s;
    let changed = true;
    while (changed) {
        changed = false;
        const before = out;
        // Locutions de cuillère abrégées : "c. à café", "c à c", "cuillère à soupe"…
        out = out
            .replace(/^c\.?\s*[aà]\.?\s*(c\.?|caf[ée]e?|s\.?|soupe)\.?\s+/i, '')
            .replace(/^cuill[eè]res?\s*[aà]\s*(caf[ée]e?|soupe)s?\s+/i, '')
            // "jus / zeste / écorce / pulpe de X" (avec quantité éventuelle "1", "un")
            .replace(/^(jus|zestes?|ecorces?|écorces?|peau|pulpe)\b\s*(de\s+|du\s+|des\s+|d['’]\s*)?(\d+\s+|un\s+|une\s+)?/i, '');
        if (out !== before) changed = true;
        for (const w of MEASURE_WORDS) {
            const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp("^" + esc + "(?:\\s+(?:de|d|du|des))?\\s+", 'i');
            if (re.test(out)) { out = out.replace(re, ''); changed = true; }
        }
        // Articles / "de" en tête : le, la, les, l', un, une, de la, du, des, de, d'
        const de = /^(le |la |les |l['’]|un |une |de la |de l['’]|du |des |de |d['’])\s*/i;
        if (de.test(out)) { out = out.replace(de, ''); changed = true; }
    }
    return out.trim();
};

export const parseIngredient = (raw: string): ParsedIng => {
    let s = (raw || '').replace(/\s+/g, ' ').trim();
    s = stripLeadingEmoji(s).trim();
    // Fraction en tête : "1/2 oignon rouge" → 0.5
    const frac = s.match(/^(\d+)\s*\/\s*(\d+)\s+(.*)$/);
    if (frac) {
        const q = parseInt(frac[1], 10) / parseInt(frac[2], 10);
        const name = stripMeasure(frac[3].trim());
        return { qty: Number.isFinite(q) ? q : null, unit: '', name: name || frac[3].trim() };
    }
    const m = s.match(/^(\d+(?:[.,]\d+)?)\s*([^\s\d]+)?\s*(.*)$/);
    if (m) {
        let qty: number | null = parseFloat(m[1].replace(',', '.'));
        let unit = (m[2] || '').toLowerCase().replace(/\.$/, '');
        let name = (m[3] || '').trim();
        const unitNorm = normalizeIng(unit);
        if (unit && CONTAINER_TO_ML[unitNorm] != null) {
            // Contenant à volume connu (brique = 20 cl) → convertit en ml.
            qty = qty * CONTAINER_TO_ML[unitNorm];
            unit = 'ml';
        } else if (unit && !KNOWN_UNITS.includes(unit)) {
            name = `${m[2]} ${name}`.trim();
            unit = '';
        }
        name = stripMeasure(name.replace(/^(de la |de l'|du |des |de |d'|d’)/i, '').trim());
        return { qty, unit, name: name || s };
    }
    return { qty: null, unit: '', name: stripMeasure(s) || s };
};

// ── Canonicalisation des noms d'ingrédients (fusion liste de courses) ──────────
// But : regrouper les variantes du MÊME ingrédient (orthographe, pluriel, forme).
// Synonymes explicites (normalisés, sans accent) → nom canonique. Extensible.
const SYNONYMS: Record<string, string> = {
    // Ail
    'ail semoule': 'ail en poudre', 'ail moulu': 'ail en poudre', 'poudre d ail': 'ail en poudre',
    'ail deshydrate': 'ail en poudre', 'ail en poudre': 'ail en poudre',
    // Oignon
    'oignon semoule': 'oignon en poudre', 'oignon moulu': 'oignon en poudre', 'poudre d oignon': 'oignon en poudre',
    // Gingembre
    'gingembre moulu': 'gingembre en poudre', 'poudre de gingembre': 'gingembre en poudre',
    'coriandre moulue': 'coriandre en poudre', 'coriandre en poudre': 'coriandre en poudre',
    // Herbes : fraîche / plat / frisé = même produit
    'persil plat': 'persil', 'persil frise': 'persil', 'persil frais': 'persil',
    'coriandre fraiche': 'coriandre', 'basilic frais': 'basilic', 'menthe fraiche': 'menthe',
    'citron vert': 'citron vert', 'jus de citron': 'citron',
    // Crème liquide : variantes du même produit (≠ crème fraîche / épaisse).
    'creme': 'creme liquide', 'creme entiere': 'creme liquide', 'creme fleurette': 'creme liquide',
    'creme liquide entiere': 'creme liquide', 'creme fraiche liquide': 'creme liquide',
    'creme de soja': 'creme liquide', 'creme liquide 30': 'creme liquide',
};

// Ingrédients où la forme "en poudre" est un PRODUIT distinct du frais
// (on garde 2 lignes : "<x>" et "<x> en poudre"). Pour le reste, on fusionne tout.
// Ré-accentuation pour l'affichage des noms canoniques normalisés (sans accent).
const DISPLAY_ACCENT: Record<string, string> = {
    'creme liquide': 'crème liquide', 'creme fraiche': 'crème fraîche', 'creme epaisse': 'crème épaisse',
};

const POWDER_DISTINCT = ['ail', 'oignon', 'gingembre', 'coriandre'];
const SPOON_UNITS = ['cac', 'cas', 'cc', 'cs', 'càc', 'càs', 'c.à.c', 'c.à.s'];
const POWDER_RE = /\s*(en poudre|semoule|moulus?|moulue?s?|deshydrates?)\b.*$/;

// Détecte une mesure "cuillère" depuis le texte BRUT (càc, cac, c. à café, c à s,
// cuillère à soupe…), accents ignorés. Sert à classer "càc d'ail" en "ail en poudre".
// Abréviations cuillère collées (càc/cac/cs…) en token isolé, OU forme verbeuse
// "c. à café / c à s" (le 'a' doit être séparé par . ou espace, sinon "concassé"
// déclencherait un faux positif), OU "cuillère".
const SPOON_RAW_RE = /(^|[^a-z])(cac|cas|cc|cs)([^a-z]|$)|\bc[.\s]+a[.\s]*(c|caf|s|soup)|cuiller/;
const isSpoonRaw = (raw: string) => SPOON_RAW_RE.test(normalizeIng(raw));

// Pluriel → singulier (par mot). Exceptions : mots déjà terminés en 's' au singulier.
const SING_EXCEPT = new Set(['ananas', 'anchois', 'jus', 'riz', 'mais', 'couscous', 'houmous', 'hummus', 'cassis', 'cresson', 'chips', 'pois', 'abats', 'epices', 'des']);
const depluralize = (n: string) => n.split(' ').map(w => {
    if (SING_EXCEPT.has(w) || w.length <= 3) return w;
    if (/eaux$/.test(w)) return w.slice(0, -1);   // gateaux → gateau
    if (/x$/.test(w)) return w.slice(0, -1);       // choux → chou
    if (/s$/.test(w)) return w.slice(0, -1);       // oignons → oignon
    return w;
}).join(' ');

// Retourne {name, unit} canoniques utilisés comme CLÉ de fusion.
// ex: "càc d'ail" → {ail en poudre, ''} ; "gousse d'ail" / "tête d'ail" → {ail, ''} ;
//     "ail semoule" → {ail en poudre, ''}.
// Adjectifs de préparation retirés pour la fusion (oignon émincé = oignon).
// NB : on ne retire PAS "frais/fraiche" (crème fraîche ≠ crème) ni les couleurs
// (oignon rouge ≠ oignon blanc), qui distinguent de vrais produits.
const PREP_RE = /\s+(haches?|hachees?|eminces?|emincees?|concasses?|concassees?|ciseles?|ciselees?|rapes?|rapees?|coupes?|coupees?|fondus?|fondues?|surgeles?|surgelees?|congeles?|congelees?|decongeles?|decongelees?|grilles?|grillees?|rotis?|roties?|cuits?|cuites?|precuits?|precuites?|crus?|crues?|blanchis?|blanchies?|revenus?|revenues?|mixes?|mixees?|moulines?|moulinees?|ecrases?|ecrasees?|presses?|pressees?|bouillis?|bouillies?|natures?|en des|en lamelles|en rondelles|en tranches|en morceaux|en quartiers|en cubes|en julienne)\b/g;
// Suffixe "section de recette" collé au nom (ex. "ail pour la sauce", "oignon pour la
// marinade") → on retire pour fusionner avec le même ingrédient sans suffixe.
const SECTION_SUFFIX_RE = /\s+pour\s+(l[ae]s?|l['’]|du|des|une?|le)\s+.+$/;
const stripPrep = (n: string) => n.replace(SECTION_SUFFIX_RE, '').replace(PREP_RE, '').replace(/\s+/g, ' ').trim();

export const canonicalIng = (name: string, unit: string = '', raw: string = ''): { name: string; unit: string } => {
    let n = depluralize(stripPrep(normalizeIng(name).replace(/\s+/g, ' ').trim()));
    if (SYNONYMS[n]) n = SYNONYMS[n];
    const u = normalizeIng(unit);
    const isPowder = POWDER_RE.test(n) || /\bsemoule\b/.test(n);
    const base = n.replace(POWDER_RE, '').trim();
    if (POWDER_DISTINCT.includes(base)) {
        // càc/càs d'ail = ail en poudre (convention demandée), unité neutralisée pour fusionner.
        if (isPowder || SPOON_UNITS.includes(u) || (raw && isSpoonRaw(raw))) {
            return { name: base + ' en poudre', unit: '' };
        }
        return { name: base, unit }; // frais : conserve l'unité (g, etc.) pour additionner
    }
    return { name: n, unit };
};

const ICONS: [string, string][] = [
    // ── Produits non-alimentaires / ménagers (placés en tête : matchs multi-mots
    //    prioritaires avant les aliments, ex. "vaisselle" contient "sel") ──
    ['papier toilette', '🧻'], ['papier wc', '🧻'], ['papier hygienique', '🧻'],
    ['essuie-tout', '🧻'], ['essuie tout', '🧻'], ['sopalin', '🧻'], ['mouchoir', '🤧'],
    ['serviette hygienique', '🩸'], ['hygienique', '🩸'], ['protege-slip', '🩸'], ['protege slip', '🩸'], ['tampon', '🩸'],
    ['liquide vaisselle', '🧴'], ['produit vaisselle', '🧴'], ['vaisselle', '🧴'],
    ['produit nettoyant', '🧴'], ['nettoyant', '🧴'], ['detergent', '🧴'], ['multi-usage', '🧴'], ['multi usage', '🧴'],
    ['desinfectant', '🧴'], ['degraissant', '🧴'], ['anticalcaire', '🧴'], ['anti-calcaire', '🧴'],
    ['eau de javel', '🧪'], ['javel', '🧪'],
    ['lessive', '🧺'], ['adoucissant', '🧺'], ['assouplissant', '🧺'],
    ['savon', '🧼'], ['gel douche', '🧴'], ['shampoing', '🧴'], ['shampooing', '🧴'], ['apres-shampoing', '🧴'],
    ['dentifrice', '🪥'], ['brosse a dents', '🪥'], ['brosse a dent', '🪥'],
    ['eponge', '🧽'], ['lingette', '🧻'],
    ['sac poubelle', '🗑'], ['sac-poubelle', '🗑'], ['poubelle', '🗑'],
    ['aluminium', '📄'], ['papier cuisson', '📄'], ['papier sulfurise', '📄'], ['film alimentaire', '📄'], ['cellophane', '📄'],
    ['coton-tige', '🧴'], ['coton tige', '🧴'], ['coton', '🧴'], ['deodorant', '🧴'], ['rasoir', '🪒'], ['mousse a raser', '🧴'],
    ['pile', '🔋'], ['ampoule', '💡'], ['bougie', '🕯'], ['allumette', '🔥'], ['briquet', '🔥'],
    ['croquette', '🐾'], ['litiere', '🐾'], ['pâtee', '🐾'], ['patee', '🐾'],
    // ── Aliments ──
    ['lait de coco', '🥥'], ['noix de coco', '🥥'], ['coco', '🥥'],
    ['pomme de terre', '🥔'], ['patate', '🥔'], ['pomme', '🍎'],
    ['farine', '🌾'], ['sucre', '🧁'], ['sel', '🧂'], ['poivre', '🌶'],
    ['oeuf', '🥚'], ['œuf', '🥚'], ['lait', '🥛'], ['creme', '🥛'], ['yaourt', '🥛'],
    ['beurre', '🧈'], ['huile', '🫒'], ['olive', '🫒'],
    ['tomate', '🍅'], ['oignon', '🧅'], ['ail', '🧄'], ['citron', '🍋'],
    ['banane', '🍌'], ['fraise', '🍓'], ['framboise', '🍓'], ['orange', '🍊'],
    ['pasteque', '🍉'], ['avocat', '🥑'], ['chocolat', '🍫'],
    ['parmesan', '🧀'], ['mozzarella', '🧀'], ['fromage', '🧀'],
    ['poulet', '🍗'], ['boeuf', '🥩'], ['agneau', '🍖'], ['porc', '🥓'],
    ['lardon', '🥓'], ['jambon', '🥓'], ['bacon', '🥓'],
    ['saumon', '🐟'], ['thon', '🐟'], ['poisson', '🐟'], ['crevette', '🦐'],
    ['riz', '🍚'], ['pate', '🍝'], ['pâte', '🍝'], ['nouille', '🍜'], ['pain', '🍞'],
    ['carotte', '🥕'], ['courgette', '🥒'], ['concombre', '🥒'], ['aubergine', '🍆'],
    ['champignon', '🍄'], ['epinard', '🥬'], ['salade', '🥬'], ['mais', '🌽'],
    ['poivron', '🫑'], ['piment', '🌶'], ['miel', '🍯'], ['vanille', '🍦'],
    ['menthe', '🌿'], ['basilic', '🌿'], ['persil', '🌿'], ['coriandre', '🌿'],
    ['cafe', '☕'], ['eau', '💧'], ['vin', '🍷'], ['biere', '🍺'],
    ['noisette', '🌰'], ['noix', '🌰'], ['amande', '🥜'], ['cacahuete', '🥜'],
    ['haricot', '🫘'], ['lentille', '🫘'], ['pois chiche', '🫛'], ['petit pois', '🫛'],
    ['gingembre', '🫚'], ['curry', '🍛'], ['epice', '🧂'],
    // ── Fromages (emoji 🧀 quand pas d'image dédiée) ──
    ['pecorino', '🧀'], ['scamorza', '🧀'], ['halloumi', '🧀'], ['leerdammer', '🧀'],
    ['comte', '🧀'], ['gruyere', '🧀'], ['emmental', '🧀'], ['cheddar', '🧀'],
    ['raclette', '🧀'], ['chevre', '🧀'], ['feta', '🧀'], ['boursin', '🧀'],
    ['ricotta', '🧀'], ['burrata', '🧀'], ['mascarpone', '🧀'], ['gorgonzola', '🧀'],
    ['roquefort', '🧀'], ['bleu', '🧀'], ['brie', '🧀'], ['camembert', '🧀'],
    // ── Épices / condiments ──
    ['tahini', '🥜'], ['tahin', '🥜'], ['sesame', '🌰'],
    ['harissa', '🌶'], ['baharat', '🧂'], ['ras el hanout', '🧂'], ['7 epices', '🧂'],
    ['5 epices', '🧂'], ['epices libanaises', '🧂'], ['paprika', '🌶'], ['cumin', '🧂'],
    ['cannelle', '🧂'], ['muscade', '🧂'], ['sumac', '🧂'], ['herbes de provence', '🌿'],
    ['laurier', '🌿'], ['thym', '🌿'], ['romarin', '🌿'], ['aneth', '🌿'], ['ciboulette', '🌿'],
    ['sauce soja', '🍶'], ['soja', '🍶'], ['worcestershire', '🍶'], ['huitre', '🍶'],
    ['moutarde', '🟡'], ['ketchup', '🍅'], ['mayonnaise', '🥚'], ['vinaigre', '🧴'],
    // ── Féculents / divers ──
    ['semoule', '🌾'], ['boulgour', '🌾'], ['quinoa', '🌾'], ['polenta', '🌽'],
    ['chapelure', '🍞'], ['panko', '🍞'], ['gnocchi', '🥟'], ['raviolis', '🥟'],
    ['gelatine', '🍮'], ['agar', '🍮'], ['levure', '🧁'], ['bicarbonate', '🧁'],
    ['maizena', '🌽'], ['fecule', '🌽'], ['cacao', '🍫'], ['pralin', '🍫'],
    // ── Sucré / biscuits ──
    ['speculoos', '🍪'], ['boudoir', '🍪'], ['biscuit', '🍪'], ['tuc', '🍪'],
    ['nutella', '🍫'], ['pate a tartiner', '🍫'], ['daim', '🍫'], ['kinder', '🍫'],
    ['guimauve', '🍬'], ['chamallow', '🍬'], ['bonbon', '🍬'], ['caramel', '🍬'],
    ['confiture', '🍓'], ['cranberries', '🔴'], ['canneberge', '🔴'], ['raisin sec', '🍇'],
    // ── Légumes / fruits complémentaires ──
    ['brocoli', '🥦'], ['chou-fleur', '🥦'], ['chou fleur', '🥦'], ['chou', '🥬'],
    ['fenouil', '🥬'], ['poireau', '🥬'], ['celeri', '🥬'], ['radis', '🥬'],
    ['betterave', '🥬'], ['navet', '🥬'], ['patate douce', '🍠'], ['potiron', '🎃'],
    ['courge', '🎃'], ['cebette', '🧅'], ['echalote', '🧅'], ['poireau', '🧅'],
    ['grenade', '🍎'], ['figue', '🍐'], ['datte', '🌰'], ['abricot', '🍑'],
    ['peche', '🍑'], ['cerise', '🍒'], ['poire', '🍐'], ['kiwi', '🥝'], ['ananas', '🍍'],
    ['mangue', '🥭'], ['melon', '🍈'], ['raisin', '🍇'], ['myrtille', '🫐'],
    ['germes de soja', '🌱'], ['pousse', '🌱'], ['shiitake', '🍄'], ['tofu', '⬜'],
    // ── Boissons / alcools ──
    ['rhum', '🥃'], ['whisky', '🥃'], ['cognac', '🥃'], ['brandy', '🥃'],
    ['liqueur', '🍶'], ['sirop', '🍯'], ['sirop erable', '🍁'], ['erable', '🍁'],
    ['sirop agave', '🍯'], ['the', '🍵'], ['jus', '🧃'], ['limonade', '🥤'], ['soda', '🥤'],
];

export const getIngIcon = (name: string) => {
    const n = normalizeIng(name);
    for (const [k, e] of ICONS) if (n.includes(normalizeIng(k))) return e;
    return '🛒';
};

// Terme simplifié pour la recherche (Carrefour) : juste l'élément à chercher
// Qualificatifs de taille / préparation / état à retirer (on garde le produit nu).
// NB : on NE retire PAS "frais/fraiche" (casserait "fromage frais", "crème fraîche").
const QUALIFIERS = /\b(moyens?|moyennes?|gros|grosse|grosses|petits?|petites?|grands?|grandes?|haches?|hachee|hachees|eminces?|emincee|emincees|rapes?|rapee|rapees|surgeles?|surgelee|surgelees|en poudre|en morceaux|en des|en rondelles|en lamelles|murs?|mure|mures|bio|coupes?|coupee|coupees|peles?|pelee|pelees|epluches?|epluchee|epluchees|concasses?|concassee|concassees|tamises?|tamisee|tamisees|fondus?|fondue|fondues|ramollis?|ramollie|ramollies|battus?|battue|battues|egouttes?|egouttee|egouttees|rinces?|rincee|rincees|ciseles?|ciselee|ciselees|effiloches?|effilochee|effilochees|equeutes?|equeutee|equeutees|denoyautes?|denoyautee|denoyautees|entiers?|entiere|entieres)\b/g;

// Produit "nu" : sans quantité, mesure, qualificatif. Peut renvoyer "" si la
// chaîne n'était qu'une préparation (ex: "pelées" → "").
const productCore = (name: string) => {
    let s = normalizeIng(name)
        .replace(/^[-•\s]+/, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/^[\d\/.,½¼¾\s]+/, '');
    s = stripMeasure(s).replace(/^[\d\/.,½¼¾\s]+/, '');
    return s.replace(QUALIFIERS, ' ').replace(/\s+/g, ' ').trim();
};

export const carrefourTerm = (name: string) => {
    let s = productCore(name);
    // singularise un mot unique terminé par "s"
    if (/^\S+s$/.test(s) && !/(ss|as|is|os|us|x)$/.test(s) && s.length > 4) s = s.replace(/s$/, '');
    return s || name;
};

// Sépare une ligne combinée en plusieurs ingrédients : "sel et poivre" → ["sel","poivre"],
// "sel, poivre" → idem. Ne coupe PAS les décimales "1,5 l" (virgule requiert un espace après).
export const splitIngredients = (raw: string): string[] => {
    const parts = (raw || '')
        .split(/\s+et\s+|\s+ou\s+|\s*&\s*|\s*\+\s*|,\s+/i)
        .map(p => p.trim())
        .filter(Boolean);
    // Ne garde que les segments porteurs d'un vrai produit (écarte "tamisée", "pelées"…)
    const kept = parts.filter(p => productCore(p).length > 1);
    return kept.length ? kept : [raw];
};

// Découpe une ligne groupée ("Pour le biscuit : 155g farine, 100g beurre, …")
// en ingrédients individuels : retire le préfixe de section puis splitte (virgules / et / ou).
export const expandIngredientLines = (raw: string): string[] => {
    const s = cleanIngredientText(raw).replace(/^pour\s+[^:]{1,45}:\s*/i, '').trim();
    if (!s) return [];
    return splitIngredients(s);
};

export const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export const fmtQty = (q: number) => (Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100));

export interface ConsolItem {
    key: string;
    icon: string;
    name: string;        // produit "nu" (pour Carrefour / clé de fusion)
    unit: string;
    qty: number | null;
    keys: string[];      // clés de créneau `day|meal|idx` qui composent cette ligne (pour cocher)
    manual?: boolean;    // ajout manuel → affiché en tête de liste
    ord?: number;        // ordre d'ajout (manuel récent = plus grand)
    display: string;     // texte FIDÈLE à afficher (quantité + unité telles qu'écrites)
    count: number;       // nb d'occurrences fusionnées (>1 = additionné)
}

// ── État "rayé / fait" d'une ligne consolidée ──
// Identité persistée dans localStorage 'shop-done'. Pour un item planifié on raye toutes
// ses clés de créneau ; pour un ajout manuel on utilise `m:<clé>`.
export const doneKeysOf = (it: ConsolItem): string[] => (it.keys.length ? it.keys : ['m:' + it.key]);
export const isItemDone = (it: ConsolItem, done: Set<string>): boolean => doneKeysOf(it).every(k => done.has(k));

// Texte d'ingrédient fidèle : retire seulement l'emoji / la puce de tête et normalise
// les espaces. Conserve la quantité et l'unité exactement comme écrites dans la recette.
export const cleanIngredientText = (raw: string) => {
    let s = (raw || '').replace(/\s+/g, ' ').trim();
    s = s.replace(/^(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[←-⇿⌀-➿⬀-⯿️•\-\s])+/, '').trim();
    return s;
};

// Titre de section / étape (pas un vrai ingrédient) — ex "**Pour la sauce :**"
const isHeadingLine = (raw: string) => {
    if (/\*\*/.test(raw)) return true;
    const s = raw.replace(/[*_#]/g, '').trim();
    if (!s) return true;
    if (/:\s*$/.test(s)) return true;
    if (/^pour\b/i.test(s) && /\b(sauce|boulettes?|garniture|p[âa]te|montage|d[ée]cor|service|accompagnement|marinade|farce|cr[èe]me|gla[çc]age|sirop|nappage|topping|base|fond|dressage|finition)\b/i.test(s)) return true;
    return false;
};

// Liste fusionnée = ingrédients de la semaine planifiée (hors cochés) + ajouts manuels.
// Source unique partagée par la page liste ET la pastille de la nav.
export const buildConsolidatedItems = (
    weekPlan: Record<string, Record<string, any>>,
    weekChecked: Set<string>,
    shoppingList: Record<string, any>,
    includeJourJ: boolean = true,
): ConsolItem[] => {
    const map = new Map<string, ConsolItem>();
    let ord = 0;
    // 1 ligne d'ingrédient = 1 entrée (pas de découpage) → identique à la recette.
    // Fusion par produit+unité UNIQUEMENT pour additionner les quantités entre recettes.
    const add = (raw: string, opts?: { slotKey?: string; manual?: boolean }) => {
        if (isHeadingLine(raw)) return;
        const clean = cleanIngredientText(raw);
        const p = parseIngredient(raw);
        if (!p.name) return;
        // Canonicalisation : regroupe les variantes du même ingrédient (ex. ail).
        const c = canonicalIng(p.name, p.unit, raw);
        // Unité ramenée à la base (g / ml) pour additionner cl + ml + brique, kg + g…
        const b = toBaseUnit(p.qty, c.unit);
        // Nom AFFICHÉ : on garde l'accentuation d'origine si le canonique = l'original
        // (juste normalisé) ; sinon on ré-accentue les cas connus, sinon le canonique.
        const dispName = normalizeIng(p.name) === c.name ? p.name : (DISPLAY_ACCENT[c.name] || c.name);
        p.name = dispName; p.unit = b.unit;
        const key = `${c.name}|${b.unit}`;
        const existing = map.get(key);
        if (existing) {
            existing.count++;
            if (b.qty != null) existing.qty = (existing.qty || 0) + b.qty;
            if (opts?.slotKey) existing.keys.push(opts.slotKey);
            if (opts?.manual) { existing.manual = true; existing.ord = ++ord; }
            // Fusionné → on recompose un affichage avec la quantité additionnée (unité lisible).
            existing.display = existing.qty != null
                ? `${prettyQtyUnit(existing.qty, existing.unit)} ${existing.name}`.trim()
                : existing.name;
        } else {
            map.set(key, {
                key, icon: getIngIcon(p.name), name: capFirst(p.name), unit: b.unit, qty: b.qty,
                keys: opts?.slotKey ? [opts.slotKey] : [],
                manual: opts?.manual, ord: opts?.manual ? ++ord : undefined,
                display: clean || capFirst(p.name), count: 1,
            });
        }
    };
    Object.keys(weekPlan || {}).forEach(dayKey => {
        if (dayKey === 'JourJ' && !includeJourJ) return; // Jour J exclu de la liste fusionnée
        const day = weekPlan[dayKey] || {};
        Object.keys(day).forEach(mealKey => {
            const recipe = day[mealKey];
            (recipe?.ingredients || []).forEach((ing: any, idx: number) => {
                if (weekChecked.has(`${dayKey}|${mealKey}|${idx}`)) return;
                const raw = `${ing?.quantity || ''} ${ing?.name || ''}`.trim();
                if (!raw) return;
                // Découpe les blocs groupés en ingrédients individuels (clé sous-indexée).
                expandIngredientLines(raw).forEach((piece, sub) => {
                    add(piece, { slotKey: `${dayKey}|${mealKey}|${idx}|${sub}` });
                });
            });
            // Accompagnement suggéré par le Menu IA (recipe.side) : ses ingrédients
            // comptent aussi (clés préfixées `s` → pas de collision avec celles du plat).
            (recipe?.side?.ingredients || []).forEach((ing: any, idx: number) => {
                const raw = `${ing?.quantity || ''} ${ing?.name || ''}`.trim();
                if (!raw) return;
                expandIngredientLines(raw).forEach((piece, sub) => {
                    add(piece, { slotKey: `${dayKey}|${mealKey}|s${idx}|${sub}` });
                });
            });
        });
    });
    Object.values(shoppingList || {}).forEach((r: any) => {
        if (r?.source === 'planner') return;
        (r?.ingredients || []).forEach((ing: any) => {
            const raw = typeof ing === 'string' ? ing : ing?.name;
            if (raw) add(raw, { manual: true });
        });
    });
    // 2e passe : un MÊME produit exprimé en unités différentes (ex. "brocoli" sans
    // quantité + "100 g de brocoli précuit") arrive ici en 2 lignes (clés `brocoli|`
    // et `brocoli|g`). On les regroupe en UNE seule ligne pour ne pas donner l'illusion
    // de 2 produits distincts. Les vrais produits distincts (ail / ail en poudre /
    // pâte d'ail) ont un nom canonique différent → restent séparés.
    const byName = new Map<string, ConsolItem[]>();
    for (const it of map.values()) {
        const canon = it.key.split('|')[0];
        const arr = byName.get(canon);
        if (arr) arr.push(it); else byName.set(canon, [it]);
    }
    const merged: ConsolItem[] = [];
    for (const group of byName.values()) {
        if (group.length === 1) { merged.push(group[0]); continue; }
        const base = group[0];
        const amounts = group
            .filter(g => g.qty != null)
            .map(g => prettyQtyUnit(g.qty as number, g.unit));
        const display =
            amounts.length === 0 ? base.name
            : amounts.length === 1 ? `${amounts[0]} ${base.name}`.trim()
            : `${base.name} : ${amounts.join(' + ')}`;
        merged.push({
            ...base,
            keys: group.flatMap(g => g.keys),
            count: group.reduce((s, g) => s + g.count, 0),
            manual: group.some(g => g.manual),
            ord: group.reduce<number | undefined>((m, g) => (g.ord != null && (m == null || g.ord > m) ? g.ord : m), base.ord),
            display,
        });
    }
    // Tri : alphabétique par NOM d'ingrédient uniquement (quantités ignorées).
    return merged.sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
    );
};

// Compte le nombre de lignes de la liste fusionnée (pour la pastille de nav).
export const countConsolidatedLines = (): number => {
    if (typeof window === 'undefined') return 0;
    const j = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) || d); } catch { return JSON.parse(d); } };
    const weekPlan = j('meal-planner-week', '{}');
    const shoppingList = j('magic-shopping-list', '{}');
    const weekChecked = new Set<string>(j('meal-week-checked', '[]'));
    const includeJourJ = localStorage.getItem('jourj-in-fused') !== 'false';
    return buildConsolidatedItems(weekPlan, weekChecked, shoppingList, includeJourJ).length;
};
