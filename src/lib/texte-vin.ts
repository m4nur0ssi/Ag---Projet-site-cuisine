/**
 * Comparer un nom lu sur une étiquette à un nom de fiche marchand.
 * ===============================================================
 *
 * Ces fonctions servaient à Vivino ; elles servent maintenant aussi à Viniou.
 * Les laisser dupliquées, c'était garantir que les deux sources finiraient par
 * juger différemment la même bouteille.
 *
 * Tout part d'un constat : une étiquette lue par un modèle vision arrive
 * souvent à une lettre près — « Poças » lu « Bocas », « Rieussec » lu
 * « Riessec ». On compare donc des sacs de mots, à l'orthographe près.
 */

export interface BouteilleTrouvee {
    name: string;        // « Château Margaux Pavillon Rouge »
    winery: string;      // domaine / château
    year: string;        // '' si non millésimé
    grape: string;       // cépages principaux
    region: string;      // « Côte-rôtie, France »
    color: 'rouge' | 'blanc' | 'rose' | 'liqueur';
    note: string;        // phrase de style
    photo: string;       // URL absolue de la bouteille
    rating: number;      // note /5 (0 si la source n'en donne pas)
    ratingsCount: number;
    url: string;         // fiche d'origine
    /** D'où vient la fiche — affiché tel quel dans « Ma cave ». */
    source: 'vivino' | 'viniou';
    /**
     * Vrai quand le domaine de la fiche correspond vraiment à l'étiquette lue.
     * Sans ça on garde la photo prise par l'utilisateur : mieux vaut sa propre
     * bouteille qu'une étiquette voisine mais fausse.
     */
    confident: boolean;
}

export const UA_NAVIGATEUR =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export function unescapeHtml(s: string) {
    return String(s || '')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
        .replace(/&#x2B;/g, '+').replace(/&nbsp;/g, ' ')
        // Entités numériques (&#xE9; = é) : les pages de Viniou en sont pleines.
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

export function tokens(s: string): string[] {
    const flat = (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return flat.split(/[^a-z0-9]+/).filter((t) => t.length > 1);
}

/** Distance d'édition, plafonnée : on s'arrête dès qu'on dépasse `max`. */
export function editDistance(a: string, b: string, max: number) {
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

/** Deux mots désignent-ils la même chose ? On tolère d'autant plus de fautes
 *  que le mot est long. */
export function sameWord(a: string, b: string) {
    if (a === b) return true;
    const len = Math.min(a.length, b.length);
    if (len < 4) return false;
    return editDistance(a, b, len >= 7 ? 2 : 1) <= (len >= 7 ? 2 : 1);
}

/** Nombre de mots de `a` retrouvés dans `b`, à l'orthographe près. */
export function overlap(a: string[], b: string[]) {
    const taken = new Set<number>();
    let n = 0;
    for (const t of a) {
        const hit = b.findIndex((u, i) => !taken.has(i) && sameWord(t, u));
        if (hit !== -1) { taken.add(hit); n++; }
    }
    return n;
}

/** Part des mots de `a` présents dans `b` (0 → 1). */
export function coverage(a: string[], b: string[]) {
    const A = [...new Set(a)], B = [...new Set(b)];
    return A.length && B.length ? overlap(A, B) / A.length : 0;
}

/** Similarité F1 entre deux sacs de mots, à l'orthographe près. */
export function f1(a: string[], b: string[]) {
    const A = [...new Set(a)], B = [...new Set(b)];
    if (!A.length || !B.length) return 0;
    const inter = overlap(A, B);
    if (!inter) return 0;
    const p = inter / B.length, r = inter / A.length;
    return (2 * p * r) / (p + r);
}

/** Mots qui ne distinguent aucune bouteille : ils fausseraient la comparaison. */
const VIDES = new Set(['vin', 'vins', 'wine', 'domaine', 'chateau', 'clos', 'cuvee', 'grand', 'cru', 'appellation', 'controlee', 'mis', 'bouteille', 'propriete', 'france', 'product', 'of', 'red', 'white', 'rouge', 'blanc', 'sec', 'aoc', 'aop', 'igp']);

/** Les mots qui font vraiment l'identité d'une étiquette. */
export function motsUtiles(s: string): string[] {
    const t = tokens(s).filter((w) => !VIDES.has(w) && !/^(19|20)\d{2}$/.test(w));
    return t.length ? t : tokens(s);
}

/**
 * Un mot DISTINCTIF écrit exactement pareil des deux côtés.
 *
 * `sameWord` tolère deux fautes sur un mot long — indispensable pour une
 * étiquette lue de travers, mais dangereux pour choisir un domaine parmi sept
 * mille : « Montfrin » et « Montmain » ne diffèrent que de deux lettres, et le
 * mauvais vigneron passait pour le bon. On exige donc, en plus de la
 * ressemblance, qu'au moins un mot de quatre lettres tombe juste.
 */
export function motCommunExact(a: string[], b: string[]): boolean {
    const B = new Set(b);
    return a.some((w) => w.length >= 4 && B.has(w));
}
