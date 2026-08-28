// « Ma cave » — base locale des vins de l'utilisateur (maquette).
// Stockage localStorage ; chaque vin : nom, cépage, année, couleur, région, note,
// photo de la bouteille (celle du marchand quand elle a été retrouvée, sinon
// celle scannée). La SCÈNE (tonneau + cave) est rendue en CSS côté composant :
// seule la bouteille change.

import { ecrireStock } from '@/lib/stockage';
export type WineColor = 'rouge' | 'blanc' | 'rose' | 'liqueur';

export interface CaveWine {
    id: string;
    name: string;
    grape: string;      // cépage
    year: string;       // millésime
    color: WineColor;
    region: string;
    note?: string;
    photo?: string;     // bouteille officielle (URL Vivino) ou photo scannée
    rating?: number;    // note globale /5 (dégustateurs du marchand)
    myRating?: number;  // note personnelle /5, saisie à la main
    vivinoUrl?: string; // fiche marchand d'origine
    /** Déjà bue au moins une fois : sert à prévenir « déjà dégusté » au scan. */
    tasted?: boolean;
    qty?: number;       // nombre de bouteilles en cave
    /**
     * Sur quelle étagère la bouteille se range :
     *   • `cave`   — en stock, on l'a chez soi (défaut) ;
     *   • `tasted` — « Goûté & approuvé » : bue et notée, mais plus en cave.
     *     C'est là qu'atterrissent les vins bus ailleurs (chez un ami, au
     *     restaurant) et ceux dont la dernière bouteille vient d'être ouverte.
     */
    shelf?: WineShelf;
    addedAt: number;
}

export type WineShelf = 'cave' | 'tasted';

/** L'étagère d'une bouteille, `cave` par défaut (fiches d'avant la nouveauté). */
export const shelfOf = (w: CaveWine): WineShelf => w.shelf === 'tasted' ? 'tasted' : 'cave';

export type DrinkStatus = 'jeune' | 'pret' | 'apogee' | 'tard';

/** Phrase d'œnologue (sans dates) selon couleur + millésime. */
export function drinkWindow(wine: CaveWine): { status: DrinkStatus; label: string } | null {
    const y = parseInt(wine.year, 10);
    if (!y || y < 1900) return null;
    const span = wine.color === 'rouge' ? [3, 15]
        : wine.color === 'blanc' ? [1, 6]
        : wine.color === 'rose' ? [1, 3]   // un rosé se boit jeune
        : [5, 30];
    const from = y + span[0], to = y + span[1];
    const now = new Date().getFullYear();
    if (now < from) return { status: 'jeune', label: 'Encore un peu jeune' };
    if (now > to) return { status: 'tard', label: 'À déguster sans tarder' };
    if (now <= from + (to - from) * 0.5) return { status: 'pret', label: 'Prêt à boire' };
    return { status: 'apogee', label: 'À son apogée' };
}

export const CAVE_KEY = 'ma-cave-v1';
export const CAVE_EVENT = 'ma-cave-change';

export function readCave(): CaveWine[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = JSON.parse(localStorage.getItem(CAVE_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
    } catch { return []; }
}

function write(list: CaveWine[]) {
    ecrireStock(CAVE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(CAVE_EVENT));
}

export function addWine(w: Omit<CaveWine, 'id' | 'addedAt'>): CaveWine {
    const wine: CaveWine = { qty: 1, ...w, id: `w${Date.now()}${Math.floor(Math.random() * 999)}`, addedAt: Date.now() };
    write([wine, ...readCave()]);
    return wine;
}

export function updateWine(id: string, patch: Partial<CaveWine>) {
    write(readCave().map((w) => (w.id === id ? { ...w, ...patch } : w)));
}

/**
 * Change le stock (min 0). Tomber à zéro ne fait pas disparaître la bouteille :
 * elle passe sur l'étagère « Goûté & approuvé », avec sa photo, sa note et ses
 * commentaires. On ne perd jamais un vin qu'on a aimé.
 */
export function setQty(id: string, qty: number) {
    const n = Math.max(0, Math.round(qty));
    if (n === 0) {
        updateWine(id, { qty: 0, shelf: 'tasted', tasted: true });
        return;
    }
    // Remonter le stock d'une bouteille rangée en « goûté » la remet en cave.
    updateWine(id, { qty: n, shelf: 'cave' });
}

/** Range la bouteille sur l'étagère « Goûté & approuvé » (glissé ou menu). */
export function moveToTasted(id: string) {
    updateWine(id, { shelf: 'tasted', tasted: true, qty: 0 });
}

/** Remet la bouteille en cave, avec une bouteille en stock. */
export function moveToCave(id: string, qty = 1) {
    updateWine(id, { shelf: 'cave', qty: Math.max(1, Math.round(qty)) });
}

/** « Ouvrir une bouteille » → décrémente le stock. */
export function openBottle(id: string) {
    const w = readCave().find((x) => x.id === id);
    if (!w) return;
    // Ouvrir marque le vin comme dégusté : c'est ce qui permet, des mois plus
    // tard, d'annoncer « déjà dégusté » quand on rescanne la même étiquette.
    const left = Math.max(0, (w.qty ?? 1) - 1);
    // Dernière bouteille ouverte : le vin quitte la cave pour « Goûté & approuvé ».
    updateWine(id, { qty: left, tasted: true, shelf: left === 0 ? 'tasted' : 'cave' });
}

/** Nom réduit à sa forme comparable (accents, casse et ponctuation ignorés). */
export function wineKey(name: string) {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Bouteille déjà connue de la cave, millésime ignoré : c'est le même vin qu'on
 * a déjà bu ou qu'on a encore en stock.
 */
export function findKnownWine(name: string, cave = readCave()): CaveWine | undefined {
    const k = wineKey(name);
    return cave.find((w) => wineKey(w.name) === k);
}

export function removeWine(id: string) {
    write(readCave().filter((w) => w.id !== id));
}

// Quelques vins d'exemple pour que la maquette ne soit pas vide au 1er
// lancement. Ils portent LEUR VRAIE PHOTO de bouteille (relevée chez le
// marchand) : sans `photo`, la carte retombe sur la bouteille dessinée, et la
// cave de démonstration ne ressemblait pas du tout à ce qu'elle donne une fois
// remplie par un scan.
export function seedCaveIfEmpty() {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(CAVE_KEY)) return;
    const seed: CaveWine[] = [
        { id: 's1', name: 'Château Margaux', grape: 'Cabernet Sauvignon', year: '2016', color: 'rouge', region: 'Margaux, Bordeaux', note: 'Grand cru, tanins soyeux.', qty: 2, rating: 4.6, photo: 'https://images.vivino.com/thumbs/IKYGOPzNQgW34bK7oGA31A_pb_x960.png', addedAt: Date.now() - 5000 },
        { id: 's2', name: 'Chablis Premier Cru', grape: 'Chardonnay', year: '2021', color: 'blanc', region: 'Chablis, Bourgogne', note: 'Minéral, vif, notes d’agrumes.', qty: 4, rating: 4.1, photo: 'https://images.vivino.com/thumbs/6cD6an_qQ5m3v5aWDH1T4A_pb_x960.png', addedAt: Date.now() - 4000 },
        { id: 's3', name: 'Sauternes Château Rieussec', grape: 'Sémillon', year: '2015', color: 'liqueur', region: 'Sauternes, Bordeaux', note: 'Liquoreux, miel et abricot.', qty: 1, rating: 4.4, photo: 'https://images.vivino.com/thumbs/qVrbJA2pRIykyEELJe1vWw_pb_x960.png', addedAt: Date.now() - 3000 },
        { id: 's4', name: 'Châteauneuf-du-Pape', grape: 'Grenache', year: '2019', color: 'rouge', region: 'Vallée du Rhône', note: 'Puissant, épicé, fruits noirs.', qty: 3, rating: 4.2, photo: 'https://images.vivino.com/thumbs/7-9SDusGT9uwT1KApZT-Bw_375x500.jpg', addedAt: Date.now() - 2000 },
        // Deux bouteilles bues ailleurs : de quoi voir la seconde étagère remplie.
        { id: 's5', name: 'Pouilly-Fumé', grape: 'Sauvignon blanc', year: '2022', color: 'blanc', region: 'Loire', note: 'Bu chez Marc — vif, silex.', qty: 0, shelf: 'tasted', tasted: true, myRating: 4, rating: 3.9, photo: 'https://images.vivino.com/thumbs/6zF_pudDSCOMI_aR6r7Z0A_pb_x960.png', addedAt: Date.now() - 1500 },
        { id: 's6', name: 'Barolo', grape: 'Nebbiolo', year: '2017', color: 'rouge', region: 'Piémont, Italie', note: 'Au restaurant — tanins fermes, rose et goudron.', qty: 0, shelf: 'tasted', tasted: true, myRating: 5, rating: 4.5, photo: 'https://images.vivino.com/thumbs/8mjJbyNNTsybefZwPaYcXA_pb_x960.png', addedAt: Date.now() - 1000 },
    ];
    write(seed);
}

// ── Accord vin → recettes du site ─────────────────────────────────────────
// Un vin de la cave → une dizaine de recettes qui lui vont, extraites du site.
const RED_KW = /(b[œo]euf|agneau|canard|gibier|magret|c[ôo]te|entrec[ôo]te|bourguignon|daube|mijot|steak|porc|saucisse|chorizo|champignon|fromage|gratin|lasagne|rago[ûu]t)/i;
const WHITE_KW = /(poisson|saumon|cabillaud|dorade|bar\b|truite|crevette|gambas|moule|hu[îi]tre|coquille|saint[- ]jacques|volaille|poulet|dinde|ch[èe]vre|fromage|risotto|asperge|l[ée]gume|salade|quiche|tarte sal)/i;
const LIQ_KW = /(dessert|g[âa]teau|tarte(?! sal)|cr[èe]me|mousse|fondant|cheesecake|chocolat|fruit|glace|cr[êe]pe|clafoutis|flan|tiramisu|p[âa]tisserie|foie gras|roquefort|bleu)/i;

/** Couleur de vin idéale pour un plat (heuristique simple). */
export function idealColorForRecipe(recipe: { title?: string; category?: string; tags?: string[]; ingredients?: any[] }): WineColor {
    const cat = (recipe.category || '').toLowerCase();
    if (['desserts', 'patisserie', 'glaces'].includes(cat)) return 'liqueur';
    const hay = `${recipe.title || ''} ${(recipe.tags || []).join(' ')} ${(recipe.ingredients || []).map((i: any) => i?.name || i).join(' ')}`.toLowerCase();
    if (LIQ_KW.test(hay) && !RED_KW.test(hay)) return 'liqueur';
    if (WHITE_KW.test(hay) && !RED_KW.test(hay)) return 'blanc';
    if (RED_KW.test(hay)) return 'rouge';
    return cat === 'entrees' ? 'blanc' : 'rouge';
}

/**
 * Vins de LA cave qui vont avec ce plat, VRAIMENT classés.
 *
 * Le tri d'avant se contentait de remonter la bonne couleur puis déroulait
 * toute la cave : on annonçait « un rouge » et on listait les vingt bouteilles.
 * On note désormais chaque bouteille sur trois critères, et l'écran n'en met que
 * deux en avant :
 *   • la COULEUR attendue par le plat, qui pèse le plus lourd ;
 *   • la QUALITÉ — ta note d'abord, celle des dégustateurs à défaut ;
 *   • le MOMENT — une bouteille à son apogée passe devant une qu'il faut encore
 *     attendre, et une bouteille qu'on n'a plus en stock descend tout en bas.
 */
export function caveMatchForRecipe(
    recipe: { title?: string; category?: string; tags?: string[]; ingredients?: any[] },
    cave: CaveWine[],
): { ideal: WineColor; wines: CaveWine[]; why: (w: CaveWine) => string } {
    const ideal = idealColorForRecipe(recipe);

    const score = (w: CaveWine) => {
        let s = w.color === ideal ? 100 : 0;
        s += (w.myRating || w.rating || 0) * 9;
        const when = drinkWindow(w)?.status;
        if (when === 'apogee') s += 18;
        else if (when === 'pret') s += 14;
        else if (when === 'tard') s += 8;      // à boire sans tarder : l'occasion
        else if (when === 'jeune') s -= 14;
        return s;
    };

    /** L'a-t-on encore ? Une bouteille bue ne se sert pas ce soir. */
    const inStock = (w: CaveWine) => shelfOf(w) === 'cave' && (w.qty ?? 0) > 0;

    /** En une ligne : pourquoi celle-ci plutôt qu'une autre. */
    const why = (w: CaveWine) => {
        const bits: string[] = [];
        bits.push(w.color === ideal ? `${COLOR_WORD[w.color]}, la couleur qu'appelle ce plat` : COLOR_WORD[w.color]);
        const when = drinkWindow(w);
        if (when && when.status !== 'jeune') bits.push(when.label.toLowerCase());
        const note = w.myRating || w.rating;
        if (note) bits.push(w.myRating ? `ta note ${w.myRating}/5` : `noté ${note.toFixed(1)}/5`);
        return bits.join(' · ');
    };

    // On conseille d'abord ce qu'on a sous la main ; les bouteilles bues ne
    // viennent qu'en dernier recours, quand la cave ne propose rien d'autre.
    // Une pénalité de score ne suffisait pas : un coup de cœur noté 5/5 mais
    // vide remontait devant une bouteille bien réelle.
    const here = [...cave].filter(inStock).sort((a, b) => score(b) - score(a));
    const gone = [...cave].filter((w) => !inStock(w)).sort((a, b) => score(b) - score(a));
    return { ideal, wines: [...here, ...gone], why };
}

const COLOR_WORD: Record<WineColor, string> = {
    rouge: 'Un rouge', blanc: 'Un blanc', rose: 'Un rosé', liqueur: 'Une liqueur',
};

/**
 * Une boisson ne s'accorde pas avec un vin — on ne sert pas un Barolo « avec un
 * mojito ». Cocktails, jus, smoothies et compagnie sortent donc des accords,
 * qu'ils soient rangés en boissons ou repérés à leur titre.
 */
const DRINK_KW = /(cocktails?|mojitos?|margaritas?|daiquiris?|spritz|negronis?|caipirinhas?|colada|sangrias?|punchs?|mocktails?|smoothies?|milkshakes?|frapp[ée]s?|limonades?|citronnade|jus\b|nectar|th[ée] glac[ée]|iced (tea|latte|coffee)|latte|cappuccino|caf[ée]\b|infusion|granit[ée]s?|slush|lassi|bissap|shots?\b|sours?\b|gin[- ]tonic|bloody mary)/i;

const isDrinkRecipe = (r: { title?: string; category?: string; tags?: string[] }) => {
    const cat = (r.category || '').toLowerCase();
    if (cat === 'boissons') return true;
    if ((r.tags || []).some((t) => /boisson|cocktail|jus|rafra/i.test(t))) return true;
    return DRINK_KW.test(r.title || '');
};

/**
 * PROFIL D'UN VIN — ce qui décide vraiment d'un accord.
 *
 * La couleur ne suffit pas : elle mettait tous les rouges de la cave sur les
 * mêmes plats, et tous les blancs sur les mêmes autres. Un gamay de Beaujolais
 * et un cabernet de Bordeaux n'appellent pourtant pas le même dîner.
 *
 * On lit donc le cépage, la région et le nom pour en tirer quelques traits —
 * ceux dont un sommelier se sert : tanin, corps, acidité, sucre, aromatique,
 * élevage, bulle.
 */
export interface WineProfile {
    tanin: boolean;        // structure qui demande de la matière grasse
    corse: boolean;        // vin puissant (corsé)
    leger: boolean;        // rouge délicat, chair fine
    vif: boolean;          // acidité franche, minéralité
    gras: boolean;         // blanc ample, souvent élevé en fût
    aromatique: boolean;   // muscaté, épicé, demi-sec
    sucre: boolean;        // vin doux, vin de liqueur
    bulle: boolean;
    /** Cuisine régionale à laquelle le vin appartient, s'il en revendique une. */
    terroir: 'italie' | 'espagne' | 'portugal' | 'alsace' | 'provence' | null;
    /** Phrase courte affichée en tête de la feuille d'accord. */
    style: string;
}

export function wineProfile(wine: CaveWine): WineProfile {
    const t = `${wine.grape || ''} ${wine.region || ''} ${wine.name || ''}`
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const a = (re: RegExp) => re.test(t);

    // Chaque trait est réservé à la couleur qui peut le porter : « Cabernet
    // Sauvignon » contient « sauvignon » et déclenchait les règles du sauvignon
    // BLANC — un bordeaux se retrouvait sur un tartare de crevettes, avec pour
    // raison « son acidité relève l'iode ».
    const rouge = wine.color === 'rouge';
    const blanc = wine.color === 'blanc';

    const tannique = rouge && a(/cabernet|tannat|nebbiolo|barolo|barbaresco|syrah|shiraz|malbec|mourvedre|madiran|sagrantino|aglianico|bordeaux|medoc|pauillac|saint[- ]est|margaux|cahors/);
    const leger = rouge && a(/pinot noir|gamay|beaujolais|cinsault|poulsard|trousseau|zweigelt/);
    const vif = blanc && a(/\bsauvignon\b|muscadet|chablis|albarino|vermentino|verdejo|riesling|picpoul|melon de bourgogne|txakoli|assyrtiko|loire|sancerre|pouilly|entre[- ]deux[- ]mers/) && !a(/cabernet/);
    const gras = blanc && a(/meursault|puligny|chassagne|corton|chardonnay|viognier|roussanne|marsanne|bourgogne blanc|macon|pouilly[- ]fuisse|saint[- ]veran/);
    const aromatique = blanc && a(/gewurz|muscat|pinot gris|riesling|torrontes|alsace|jurancon|vouvray|chenin/);
    const sucre = wine.color === 'liqueur' || a(/porto|banyuls|maury|rasteau|pineau|sauternes|monbazillac|coteaux du layon|jurancon moelleux|vin doux|liqueur|moelleux|tawny|late harvest/);
    const bulle = a(/champagne|cremant|prosecco|cava|petillant|brut|blanquette|franciacorta/);

    const terroir: WineProfile['terroir'] =
        a(/italie|toscan|chianti|piemont|barolo|barbaresco|veneto|amarone|valpolicella|sicil|nebbiolo|sangiovese|primitivo/) ? 'italie'
        : a(/espagne|rioja|ribera|priorat|tempranillo|albarino|cava/) ? 'espagne'
        : a(/portugal|douro|porto|alentejo|dao|vinho verde/) ? 'portugal'
        : a(/alsace|gewurz|riesling d alsace|edelzwicker/) ? 'alsace'
        : a(/provence|bandol|cassis|coteaux d aix|var\b/) ? 'provence'
        : null;

    const corse = tannique || (rouge && a(/grenache|carignan|primitivo|zinfandel|amarone|chateauneuf|rhone|priorat|douro|alentejo/));

    const style = sucre ? 'un vin doux'
        : bulle ? 'une bulle'
        : wine.color === 'rose' ? 'un rosé'
        : wine.color === 'blanc' ? (gras ? 'un blanc ample' : aromatique ? 'un blanc aromatique' : 'un blanc vif')
        : leger ? 'un rouge délicat'
        : tannique ? 'un rouge tannique'
        : corse ? 'un rouge charpenté'
        : 'un rouge souple';

    return { tanin: tannique, corse, leger, vif, gras, aromatique, sucre, bulle, terroir, style };
}

/** Une règle d'accord : ce qu'on cherche dans le plat, ce que ça vaut, pourquoi. */
interface Regle { quoi: RegExp; poids: number; pourquoi: string }

function reglesPour(wine: CaveWine, profil: WineProfile, maturite: DrinkStatus | null): Regle[] {
    const r: Regle[] = [];

    if (profil.tanin) {
        r.push({ quoi: /(b[œo]euf|entrec[oô]te|c[oô]te de b|steak|bavette|onglet|agneau|gigot|magret|canard|gibier|chevreuil|sanglier|biche)/, poids: 10, pourquoi: 'ses tanins se fondent dans une viande rouge' });
        r.push({ quoi: /(grill|barbecue|brais|r[oô]ti|mijot|daube|bourguignon|rago[uû]t)/, poids: 6, pourquoi: 'le grillé et le mijoté appellent sa structure' });
        r.push({ quoi: /(comt[ée]|cantal|tomme|fromage affin|vieux fromage)/, poids: 4, pourquoi: 'un fromage de garde tient tête à ses tanins' });
    }
    if (profil.leger) {
        r.push({ quoi: /(volaille|poulet|dinde|pintade|lapin|veau|charcuterie|jambon|saucisson|terrine)/, poids: 9, pourquoi: 'sa légèreté respecte une chair fine' });
        r.push({ quoi: /(champignon|c[eè]pe|girolle|truffe|betterave|lentille)/, poids: 7, pourquoi: 'ses notes de sous-bois répondent aux champignons' });
        r.push({ quoi: /(saumon|thon mi[- ]cuit|anguille)/, poids: 5, pourquoi: 'un rouge léger passe sur un poisson gras, servi frais' });
    }
    if (profil.corse && !profil.leger) {
        r.push({ quoi: /(chili|chorizo|merguez|paella|cassoulet|tajine|couscous|p[aâ]tes? [aà] la viande|lasagne|bolognaise|gratin)/, poids: 7, pourquoi: 'un plat nourrissant supporte sa puissance' });
    }
    if (profil.vif) {
        r.push({ quoi: /(hu[iî]tre|coquillage|moule|palourde|crevette|gambas|langoustine|ceviche|tartare de poisson|sushi|sashimi)/, poids: 10, pourquoi: 'son acidité relève l’iode comme un trait de citron' });
        r.push({ quoi: /(cabillaud|bar\b|dorade|truite|sole|merlan|lieu|poisson blanc|papillote)/, poids: 8, pourquoi: 'sa fraîcheur laisse parler un poisson blanc' });
        r.push({ quoi: /(ch[eè]vre|feta|salade|asperge|citron|herbes fra[iî]ches|aneth)/, poids: 7, pourquoi: 'chèvre, herbes et agrumes sont son terrain' });
    }
    if (profil.gras) {
        r.push({ quoi: /(risotto|cr[eè]me|beurre blanc|velout[ée]|gratin|quiche|vol[- ]au[- ]vent|blanquette)/, poids: 9, pourquoi: 'son gras épouse une sauce crémée' });
        r.push({ quoi: /(homard|langoustine|saint[- ]jacques|noix de p[eé]toncle|turbot|lotte)/, poids: 9, pourquoi: 'il a l’ampleur qu’exige un crustacé noble' });
        r.push({ quoi: /(volaille|poulet r[oô]ti|chapon|champignon)/, poids: 6, pourquoi: 'volaille rôtie et blanc de garde s’entendent' });
    }
    if (profil.aromatique) {
        r.push({ quoi: /(curry|tha[iï]|indien|asiatique|wok|gingembre|coco|[eé]pic|piment|colombo|tandoori|tajine|marocain|libanais)/, poids: 10, pourquoi: 'son aromatique tient tête aux épices' });
        r.push({ quoi: /(munster|fromage fort|choucroute|flammekueche|porc fum)/, poids: 6, pourquoi: 'accord de région, éprouvé' });
    }
    if (wine.color === 'rose') {
        r.push({ quoi: /(salade|grill|barbecue|tapas|m[eé]diterran|tomate|courgette|aubergine|poivron|ratatouille|pizza|sandwich|brochette|melon|past[eè]que)/, poids: 9, pourquoi: 'la cuisine du soleil est faite pour lui' });
    }
    if (profil.sucre) {
        r.push({ quoi: /(foie gras|roquefort|gorgonzola|stilton|fourme d ambert)/, poids: 10, pourquoi: 'le sucré et le salé-persillé se répondent' });
    }
    if (profil.bulle) {
        r.push({ quoi: /(ap[eé]ritif|friture|beignet|tempura|chips|feuillet|toast|blini|saumon fum|hu[iî]tre|tapas|verrine)/, poids: 10, pourquoi: 'la bulle nettoie le gras et lance le repas' });
    }
    if (profil.terroir) {
        const cuisine: Record<string, RegExp> = {
            italie: /(p[aâ]tes|pasta|risotto|osso buco|lasagne|parmes|mozzarella|pizza|italien|milanaise|carbonara|gnocchi)/,
            espagne: /(paella|tapas|chorizo|gazpacho|tortilla|espagnol|paprika|paella|jambon serrano)/,
            portugal: /(morue|bacalhau|portugais|pastel|caldo)/,
            alsace: /(choucroute|flammekueche|munster|baeckeoffe|alsacien|bretzel)/,
            provence: /(ratatouille|proven[cç]al|tapenade|anchoïade|bouillabaisse|pistou|olive)/,
        };
        r.push({ quoi: cuisine[profil.terroir], poids: 8, pourquoi: 'ce qui pousse ensemble va ensemble' });
    }
    if (maturite === 'apogee' || maturite === 'tard') {
        r.push({ quoi: /(mijot|brais[ée]|daube|truffe|champignon|civet|confit|cuisson lente)/, poids: 5, pourquoi: 'un vin à maturité aime les cuissons lentes' });
    }
    return r;
}

/**
 * Recettes du site qui vont avec CE vin — et la raison de chacune.
 *
 * On note chaque plat contre le profil du vin (voir `wineProfile`) plutôt que
 * contre sa seule couleur. La couleur reste un filet de sécurité, à petit poids,
 * pour qu'une cave exotique ne renvoie jamais une liste vide.
 */
export interface PairSuggestion<T> { recipe: T; why: string }

export function recipesForWine<T extends { id: string | number; title: string; category?: string; tags?: string[]; ingredients?: any[]; image?: string }>(
    wine: CaveWine, all: T[], limit = 12,
): PairSuggestion<T>[] {
    const profil = wineProfile(wine);
    const regles = reglesPour(wine, profil, drinkWindow(wine)?.status ?? null);
    const filet = wine.color === 'rouge' ? RED_KW : wine.color === 'liqueur' ? LIQ_KW : WHITE_KW;
    const sucreOuPas = /(dessert|g[âa]teau|tarte(?! sal)|chocolat|cr[èe]me p[âa]tissi|mousse|cheesecake|tiramisu|glace|p[âa]tisserie)/i;

    const texte = (r: T) => `${r.title} ${(r.tags || []).join(' ')} ${(r.ingredients || []).map((i: any) => i?.name || i).join(' ')}`
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const notes = all
        .filter((r) => r.image && (r.category || '').toLowerCase() !== 'restaurant' && !isDrinkRecipe(r))
        .map((r) => {
            const h = texte(r);
            let note = 0;
            let pourquoi = '';
            for (const regle of regles) {
                if (!regle.quoi.test(h)) continue;
                note += regle.poids;
                if (!pourquoi || regle.poids > 8) pourquoi = regle.pourquoi;
            }
            // Le dessert se reconnaît à sa CATÉGORIE d'abord : « tarte tatin oignons,
            // chèvre & chorizo » contient « tarte » sans être un dessert.
            const cat = (r.category || '').toLowerCase();
            // Certaines recettes salées sont rangées en pâtisserie à la source
            // (« Tarte tatin aux aubergines ») : un mot franchement salé dans le
            // titre l'emporte sur la catégorie.
            const titreSale = /(aubergine|oignon|chorizo|lardon|jambon|poulet|b[œo]euf|porc|saumon|thon|crevette|courgette|tomate|poireau|epinard|champignon|ch[eè]vre|feta|comt[ée]|sal[ée]e?s?\b)/i
                .test((r.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
            const dessert = !titreSale && (['desserts', 'patisserie', 'glaces'].includes(cat)
                || (sucreOuPas.test(h) && !['plats', 'entrees', 'aperitifs', 'accompagnements'].includes(cat)));
            if (dessert && profil.sucre) { note += 10; if (!pourquoi) pourquoi = 'le sucre du vin doit égaler celui du dessert'; }
            // Un dessert sous un vin sec, ou un plat salé sous un vin doux : accord raté.
            if (dessert && !profil.sucre) note -= 12;
            if (!dessert && profil.sucre) note -= 6;
            if (filet.test(h)) note += 1;
            return { r, note, pourquoi };
        })
        .filter((x) => x.note > 0)
        .sort((a, b) => b.note - a.note);

    return notes.slice(0, limit).map((x) => ({
        recipe: x.r,
        why: x.pourquoi || `l’accord classique d’${profil.style}`,
    }));
}
