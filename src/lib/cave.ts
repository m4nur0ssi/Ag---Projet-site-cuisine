// « Ma cave » — base locale des vins de l'utilisateur (maquette).
// Stockage localStorage ; chaque vin : nom, cépage, année, couleur, région, note,
// photo de la bouteille (celle du marchand quand elle a été retrouvée, sinon
// celle scannée). La SCÈNE (tonneau + cave) est rendue en CSS côté composant :
// seule la bouteille change.

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
    localStorage.setItem(CAVE_KEY, JSON.stringify(list));
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

// Quelques vins d'exemple pour que la maquette ne soit pas vide au 1er lancement.
export function seedCaveIfEmpty() {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(CAVE_KEY)) return;
    const seed: CaveWine[] = [
        { id: 's1', name: 'Château Margaux', grape: 'Cabernet Sauvignon', year: '2016', color: 'rouge', region: 'Margaux, Bordeaux', note: 'Grand cru, tanins soyeux.', qty: 2, addedAt: Date.now() - 5000 },
        { id: 's2', name: 'Chablis Premier Cru', grape: 'Chardonnay', year: '2021', color: 'blanc', region: 'Chablis, Bourgogne', note: 'Minéral, vif, notes d’agrumes.', qty: 4, addedAt: Date.now() - 4000 },
        { id: 's3', name: 'Sauternes Château Rieussec', grape: 'Sémillon', year: '2015', color: 'liqueur', region: 'Sauternes, Bordeaux', note: 'Liquoreux, miel et abricot.', qty: 1, addedAt: Date.now() - 3000 },
        { id: 's4', name: 'Châteauneuf-du-Pape', grape: 'Grenache', year: '2019', color: 'rouge', region: 'Vallée du Rhône', note: 'Puissant, épicé, fruits noirs.', qty: 3, addedAt: Date.now() - 2000 },
        // Deux bouteilles bues ailleurs : de quoi voir la seconde étagère remplie.
        { id: 's5', name: 'Pouilly-Fumé', grape: 'Sauvignon blanc', year: '2022', color: 'blanc', region: 'Loire', note: 'Bu chez Marc — vif, silex.', qty: 0, shelf: 'tasted', tasted: true, myRating: 4, addedAt: Date.now() - 1500 },
        { id: 's6', name: 'Barolo', grape: 'Nebbiolo', year: '2017', color: 'rouge', region: 'Piémont, Italie', note: 'Au restaurant — tanins fermes, rose et goudron.', qty: 0, shelf: 'tasted', tasted: true, myRating: 5, addedAt: Date.now() - 1000 },
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

/** Vins de LA cave qui vont avec ce plat (bonne couleur en tête). */
export function caveMatchForRecipe(recipe: { title?: string; category?: string; tags?: string[]; ingredients?: any[] }, cave: CaveWine[]): { ideal: WineColor; wines: CaveWine[] } {
    const ideal = idealColorForRecipe(recipe);
    const wines = [...cave].sort((a, b) => (a.color === ideal ? -1 : 0) - (b.color === ideal ? -1 : 0));
    return { ideal, wines };
}

export function recipesForWine<T extends { id: string | number; title: string; category?: string; tags?: string[]; ingredients?: any[]; image?: string }>(wine: CaveWine, all: T[], limit = 12): T[] {
    const kw = wine.color === 'rouge' ? RED_KW : wine.color === 'liqueur' ? LIQ_KW : WHITE_KW;
    const hay = (r: T) => `${r.title} ${(r.tags || []).join(' ')} ${(r.ingredients || []).map((i: any) => i?.name || i).join(' ')}`.toLowerCase();
    const scored = all
        .filter((r) => r.image && (r.category || '').toLowerCase() !== 'restaurant')
        .map((r) => ({ r, s: kw.test(hay(r)) ? 1 : 0 }))
        .filter((x) => x.s > 0);
    // Repli si trop peu : catégorie plausible selon la couleur.
    if (scored.length < 4) {
        const cat = wine.color === 'liqueur' ? ['desserts', 'patisserie'] : wine.color === 'rouge' ? ['plats'] : ['plats', 'entrees'];
        all.filter((r) => r.image && cat.includes((r.category || '').toLowerCase())).forEach((r) => {
            if (!scored.find((x) => String(x.r.id) === String(r.id))) scored.push({ r, s: 0.5 });
        });
    }
    return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.r);
}
