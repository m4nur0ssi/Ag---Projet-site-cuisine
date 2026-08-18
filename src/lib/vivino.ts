// « Ma cave » — recherche d'un vin dans la base Vivino (serveur uniquement).
//
// Vivino n'expose pas d'API publique : on interroge sa page de recherche et on
// lit le JSON que le site embarque lui-même dans l'attribut `data-ssr-props`
// (c'est la donnée qui sert à afficher les résultats). On y récupère la PHOTO
// OFFICIELLE de la bouteille (avec la bonne étiquette), le cépage, l'année,
// l'appellation, le type de vin et la note des utilisateurs.
//
// Fragile par nature (dépend du HTML de Vivino) : tout appelant doit prévoir un
// repli. `findOnVivino` renvoie `null` plutôt que de lever.

export interface VivinoWine {
    name: string;        // « Château Margaux Pavillon Rouge du Château Margaux »
    winery: string;
    year: string;        // '' si non millésimé
    grape: string;       // cépages principaux, « Cabernet Sauvignon, Merlot »
    region: string;      // « Margaux, France »
    color: 'rouge' | 'blanc' | 'rose' | 'liqueur';
    note: string;        // phrase de style (corps / acidité / description)
    photo: string;       // URL absolue de la bouteille officielle
    rating: number;      // note Vivino /5 (0 si aucune)
    ratingsCount: number;
    url: string;         // fiche Vivino
    /**
     * Vrai quand le domaine de la fiche correspond vraiment à l'étiquette lue.
     * Sans ça on garde la photo prise par l'utilisateur : mieux vaut sa propre
     * bouteille qu'une étiquette voisine mais fausse.
     */
    confident: boolean;
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** type_id Vivino → couleurs de la cave (les bulles se rangent avec les blancs). */
const TYPE_COLOR: Record<number, VivinoWine['color']> = {
    1: 'rouge', 2: 'blanc', 3: 'blanc', 4: 'rose', 7: 'liqueur', 24: 'liqueur',
};

function unescapeHtml(s: string) {
    return s
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function tokens(s: string): string[] {
    const flat = (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return flat.split(/[^a-z0-9]+/).filter((t) => t.length > 1);
}

/** Distance d'édition, plafonnée : on s'arrête dès qu'on dépasse `max`. */
function editDistance(a: string, b: string, max: number) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
            best = Math.min(best, row[j]);
        }
        if (best > max) return max + 1;
        prev = row;
    }
    return prev[b.length];
}

/**
 * Deux mots désignent-ils la même chose ? Une étiquette lue par l'IA arrive
 * souvent à une lettre près (« Poças » lu « Bocas », « Rieussec » lu « Riessec ») :
 * on tolère d'autant plus de fautes que le mot est long.
 */
function sameWord(a: string, b: string) {
    if (a === b) return true;
    const len = Math.min(a.length, b.length);
    if (len < 4) return false;
    return editDistance(a, b, len >= 7 ? 2 : 1) <= (len >= 7 ? 2 : 1);
}

/** Nombre de mots de `a` retrouvés dans `b`, à l'orthographe près. */
function overlap(a: string[], b: string[]) {
    const taken = new Set<number>();
    let n = 0;
    for (const t of a) {
        const hit = b.findIndex((u, i) => !taken.has(i) && sameWord(t, u));
        if (hit !== -1) { taken.add(hit); n++; }
    }
    return n;
}

/** Part des mots de `a` présents dans `b` (0 → 1). */
function coverage(a: string[], b: string[]) {
    const A = [...new Set(a)], B = [...new Set(b)];
    return A.length && B.length ? overlap(A, B) / A.length : 0;
}

/** Similarité F1 entre deux sacs de mots, à l'orthographe près. */
function f1(a: string[], b: string[]) {
    const A = [...new Set(a)], B = [...new Set(b)];
    if (!A.length || !B.length) return 0;
    const inter = overlap(A, B);
    if (!inter) return 0;
    const p = inter / B.length, r = inter / A.length;
    return (2 * p * r) / (p + r);
}

function abs(url: string) {
    if (!url) return '';
    return url.startsWith('//') ? `https:${url}` : url;
}

/** Extrait le tableau des résultats du JSON embarqué dans la page. */
function extractMatches(html: string): any[] {
    const attrs = html.match(/="(\{&quot;[^"]{500,})"/g);
    if (!attrs) return [];
    for (const raw of attrs) {
        try {
            const json = JSON.parse(unescapeHtml(raw.slice(2, -1)));
            const matches = json?.initialExploreResults?.matches;
            if (Array.isArray(matches)) return matches;
        } catch { /* attribut suivant */ }
    }
    return [];
}

/**
 * La photo d'un résultat, par ordre de beauté : bouteille détourée (`_pb_`),
 * puis à défaut la photo d'étiquette. Beaucoup de vins de petits producteurs
 * n'ont que la seconde — c'est déjà bien mieux qu'une bouteille dessinée.
 */
function pickPhoto(v: any): { url: string; bottle: boolean } {
    const va = v?.image?.variations || {};
    const bottle = va.bottle_large || va.bottle_medium || '';
    if (bottle) return { url: abs(bottle), bottle: true };
    return { url: abs(va.large || va.medium || ''), bottle: false };
}

/** Le meilleur résultat : même domaine, même millésime, photo disponible. */
function bestMatch(matches: any[], query: string, hintYear?: string) {
    const qt = tokens(query);
    let best: any = null, bestScore = -1, bestSure = false;
    for (const m of matches.slice(0, 24)) {
        const v = m?.vintage;
        if (!v?.wine) continue;
        const photo = pickPhoto(v);
        const count = v.statistics?.ratings_count || 0;
        const wt = tokens(v.wine.winery?.name || ''), nt = tokens(v.name || '');
        const winery = f1(qt, wt);
        let s = 6 * winery + 4 * f1(qt, nt);
        if (photo.url) s += photo.bottle ? 3 : 1.5;
        // Le millésime lu sur l'étiquette de l'utilisateur pèse LOURD : Vivino
        // liste le même vin en vingt années, et la fiche 2010 d'un Meursault
        // porte une photo et un nom qui contrediraient sa bouteille 2022.
        if (hintYear) s += String(v.year) === String(hintYear) ? 6 : -2;
        // Sans millésime lu, un même vin sort en 20 exemplaires : on préfère le
        // plus récent et le plus commenté plutôt que le premier de la liste.
        else s += Math.min(1, Math.max(0, (Number(v.year) - 1980) / 45));
        s += Math.min(1.2, Math.log10(1 + count) / 3); // notoriété, en départage
        // « Sûr » = le nom du domaine figure bien dans l'étiquette lue, ET
        // l'étiquette est largement couverte par la fiche. On raisonne en
        // couverture et non en F1 : « Ferreira » face à cinq mots lus est un
        // domaine parfaitement reconnu, alors que son F1 plafonne à 0,33.
        // Seuil haut sur le domaine : à 0,6 un négociant qui s'appelle comme
        // l'appellation (« Négociant-Éleveur Châteauneuf-du-Pape ») passait pour
        // le bon producteur sur une simple appellation lue.
        const sure = coverage(wt, qt) >= 0.75 && coverage(qt, nt) >= 0.5;
        if (s > bestScore) { bestScore = s; best = v; bestSure = sure; }
    }
    // En dessous de ce seuil, le résultat n'a plus rien à voir avec l'étiquette.
    if (bestScore < 3) return null;
    return { vintage: best, confident: bestSure };
}

function toWine(v: any, confident: boolean): VivinoWine {
    const w = v.wine || {};
    const style = w.style || {};
    const grapes: any[] = v.grapes || style.grapes || [];
    const region = [w.region?.name, w.region?.country?.native_name || w.region?.country?.name]
        .filter(Boolean).join(', ');
    const note = [style.body_description && `Corps ${String(style.body_description).toLowerCase()}`,
        style.acidity_description && `acidité ${String(style.acidity_description).toLowerCase()}`]
        .filter(Boolean).join(' · ');
    const year = v.year && /^\d{4}$/.test(String(v.year)) ? String(v.year) : '';
    return {
        name: v.name || w.name || 'Vin',
        winery: w.winery?.name || '',
        year,
        grape: grapes.slice(0, 3).map((g) => g?.name).filter(Boolean).join(', '),
        region,
        color: TYPE_COLOR[w.type_id] || 'rouge',
        note,
        photo: pickPhoto(v).url,
        rating: v.statistics?.ratings_average || 0,
        ratingsCount: v.statistics?.ratings_count || 0,
        url: v.seo_name ? `https://www.vivino.com/FR/fr/${v.seo_name}` : 'https://www.vivino.com',
        confident,
    };
}

/**
 * Cherche `query` dans la base Vivino et renvoie la bouteille la plus proche.
 * `null` si Vivino ne répond pas, ne connaît pas (spiritueux…), ou si aucun
 * résultat ne ressemble assez à la requête.
 */
export async function findOnVivino(query: string, hintYear?: string, timeoutMs = 7000): Promise<VivinoWine | null> {
    const q = query.trim();
    if (!q) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(`https://www.vivino.com/search/wines?q=${encodeURIComponent(q)}`, {
            headers: { 'user-agent': UA, accept: 'text/html', 'accept-language': 'fr-FR,fr;q=0.9' },
            signal: ctrl.signal,
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const best = bestMatch(extractMatches(await res.text()), q, hintYear);
        return best ? toWine(best.vintage, best.confident) : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}
