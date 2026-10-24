// Tolérance aux fautes de frappe (« cocola » → « chocolat »).
// Repli seulement : on n'y recourt que si la recherche exacte ne trouve rien
// dans le texte. Les textes arrivent déjà normalisés (minuscules, sans accents).

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

/** Le texte contient-il un mot qui ressemble au mot tapé ? */
export function texteRessemble(tape: string, texte: string): boolean {
    for (const mot of texte.split(/[^a-z0-9]+/)) if (mot && motRessemble(tape, mot)) return true;
    return false;
}
