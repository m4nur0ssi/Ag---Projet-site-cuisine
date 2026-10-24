// Tolérance aux fautes de frappe (« cocola » → « chocolat »).
// Repli seulement : un mot tapé qui existe quelque part dans le catalogue est
// cherché tel quel. Sinon on le remplace par le mot le plus proche qui existe
// (« poire » ne devient donc jamais « poivre »). Textes déjà normalisés
// (minuscules, sans accents).

/** Distance d'édition (Damerau : l'inversion de deux lettres compte pour 1). */
const distance = (a: string, b: string): number => {
    const n = a.length, m = b.length;
    if (Math.abs(n - m) > 2) return 3;
    const d: number[][] = Array.from({ length: n + 1 }, (_, i) => [i, ...Array(m).fill(0)]);
    for (let j = 1; j <= m; j++) d[0][j] = j;
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cout = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cout);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
            }
        }
    }
    return d[n][m];
};

/** `petit` est-il contenu dans `mot` en sautant des lettres (« cocola » dans « chocolat ») ? */
const sousSuite = (petit: string, mot: string): boolean => {
    let i = 0;
    for (let j = 0; j < mot.length && i < petit.length; j++) if (mot[j] === petit[i]) i++;
    return i === petit.length;
};

/** Le mot tapé ressemble-t-il à ce mot du texte ? Trop court (< 5 lettres) : jamais, trop de faux amis. */
export function motRessemble(tape: string, mot: string): boolean {
    if (tape.length < 5 || mot.length < 4) return false;
    if (tape[0] !== mot[0]) return false;
    if (distance(tape, mot) <= 1) return true;
    // Lettres oubliées : on garde l'ordre et au moins 70 % du mot.
    return tape.length / mot.length >= 0.7 && sousSuite(tape, mot);
}

/** Vocabulaire du catalogue : chaque mot avec son nombre d'apparitions. */
export type Vocabulaire = Map<string, number>;

export function vocabulaireDe(textes: string[]): Vocabulaire {
    const voc: Vocabulaire = new Map();
    for (const texte of textes) {
        for (const mot of texte.split(/[^a-z0-9]+/)) if (mot.length >= 4) voc.set(mot, (voc.get(mot) || 0) + 1);
    }
    return voc;
}

/**
 * Mot du catalogue le plus proche du mot tapé, ou null si rien ne lui
 * ressemble. À n'appeler que pour un mot introuvable tel quel.
 * L'écart compte, mais un mot fréquent l'emporte sur un mot rare à peine plus
 * proche : « cocola » → « chocolat » (68 recettes) plutôt que « cocoa » (1).
 */
export function motLePlusProche(tape: string, voc: Vocabulaire): string | null {
    let meilleur: string | null = null, score = Infinity;
    for (const [mot, n] of voc) {
        if (!motRessemble(tape, mot)) continue;
        const s = distance(tape, mot) - Math.log2(n) / 2;
        if (s < score) { meilleur = mot; score = s; }
    }
    return meilleur;
}
