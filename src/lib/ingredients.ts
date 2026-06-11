// Helpers partagés pour parser / illustrer les ingrédients

export const normalizeIng = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/œ/g, 'oe').replace(/æ/g, 'ae').trim();

// Unités de MESURE réelles uniquement. Les contenants (gousse, tranche, sachet, verre…)
// sont volontairement EXCLUS : ils sont retirés du nom (stripMeasure) pour que
// "1 gousse d'ail" fusionne avec "ail" (clé par nom, pas par contenant).
const KNOWN_UNITS = ['g', 'kg', 'mg', 'ml', 'cl', 'l', 'cas', 'cac', 'cs', 'cc', 'c.à.s', 'c.à.c'];

// Mots de mesure/conditionnement à retirer du nom (pour affichage + recherche)
const MEASURE_WORDS = [
    'sachet', 'sachets', 'cuillere', 'cuilleres', 'cuillère', 'cuillères', 'cas', 'cac', 'càs', 'càc',
    'pincee', 'pincees', 'pincée', 'pincées', 'gousse', 'gousses', 'tranche', 'tranches',
    'verre', 'verres', 'tasse', 'tasses', 'boite', 'boites', 'boîte', 'boîtes', 'brin', 'brins',
    'tige', 'tiges', 'bouquet', 'bouquets', 'pot', 'pots', 'barquette', 'barquettes', 'poignee', 'poignée',
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
        const qty = parseFloat(m[1].replace(',', '.'));
        let unit = (m[2] || '').toLowerCase().replace(/\.$/, '');
        let name = (m[3] || '').trim();
        if (unit && !KNOWN_UNITS.includes(unit)) {
            name = `${m[2]} ${name}`.trim();
            unit = '';
        }
        name = stripMeasure(name.replace(/^(de la |de l'|du |des |de |d'|d’)/i, '').trim());
        return { qty, unit, name: name || s };
    }
    return { qty: null, unit: '', name: stripMeasure(s) || s };
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
        const key = `${normalizeIng(p.name)}|${p.unit}`;
        const existing = map.get(key);
        if (existing) {
            existing.count++;
            if (p.qty != null) existing.qty = (existing.qty || 0) + p.qty;
            if (opts?.slotKey) existing.keys.push(opts.slotKey);
            if (opts?.manual) { existing.manual = true; existing.ord = ++ord; }
            // Fusionné → on recompose un affichage avec la quantité additionnée.
            existing.display = existing.qty != null
                ? `${fmtQty(existing.qty)}${existing.unit ? ' ' + existing.unit : ''} ${existing.name}`.trim()
                : existing.name;
        } else {
            map.set(key, {
                key, icon: getIngIcon(p.name), name: capFirst(p.name), unit: p.unit, qty: p.qty,
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
    // Tri : alphabétique par NOM d'ingrédient uniquement (quantités ignorées).
    return Array.from(map.values()).sort((a, b) =>
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
