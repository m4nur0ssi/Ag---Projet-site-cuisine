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
    color: 'rouge' | 'blanc' | 'liqueur';
    note: string;        // phrase de style (corps / acidité / description)
    photo: string;       // URL absolue de la bouteille officielle
    rating: number;      // note Vivino /5 (0 si aucune)
    ratingsCount: number;
    url: string;         // fiche Vivino
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** type_id Vivino → les 3 couleurs de la cave (rosé et bulles rangés en blanc). */
const TYPE_COLOR: Record<number, VivinoWine['color']> = {
    1: 'rouge', 2: 'blanc', 3: 'blanc', 4: 'blanc', 7: 'liqueur', 24: 'liqueur',
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

/** Similarité F1 entre deux sacs de mots (équilibre couverture / bruit). */
function f1(a: string[], b: string[]) {
    const A = new Set(a), B = new Set(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    A.forEach((t) => { if (B.has(t)) inter++; });
    if (!inter) return 0;
    const p = inter / B.size, r = inter / A.size;
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

/** Le meilleur résultat : même domaine, même millésime, photo disponible. */
function bestMatch(matches: any[], query: string, hintYear?: string) {
    const qt = tokens(query);
    let best: any = null, bestScore = -1;
    for (const m of matches.slice(0, 24)) {
        const v = m?.vintage;
        if (!v?.wine) continue;
        const photo = v.image?.variations?.bottle_large || v.image?.variations?.bottle_medium || '';
        const count = v.statistics?.ratings_count || 0;
        let s = 6 * f1(qt, tokens(v.wine.winery?.name || '')) + 4 * f1(qt, tokens(v.name || ''));
        if (photo) s += 3;
        if (hintYear && String(v.year) === String(hintYear)) s += 2.5;
        s += Math.min(1.2, Math.log10(1 + count) / 3); // notoriété, en départage
        if (s > bestScore) { bestScore = s; best = v; }
    }
    // En dessous de ce seuil, le résultat n'a plus rien à voir avec l'étiquette.
    return bestScore >= 3 ? best : null;
}

function toWine(v: any): VivinoWine {
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
        photo: abs(v.image?.variations?.bottle_large || v.image?.variations?.bottle_medium || ''),
        rating: v.statistics?.ratings_average || 0,
        ratingsCount: v.statistics?.ratings_count || 0,
        url: v.seo_name ? `https://www.vivino.com/FR/fr/${v.seo_name}` : 'https://www.vivino.com',
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
        return best ? toWine(best) : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}
