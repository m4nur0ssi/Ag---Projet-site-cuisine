// Estimation COHÉRENTE des temps et de la difficulté d'une recette à partir de ses
// ÉTAPES (les valeurs WordPress étant souvent incohérentes) :
//   • Cuisson  = somme de TOUTES les durées écrites dans les étapes (« 10 min », « 1 h »…).
//   • Préparation = estimation par mots-clés des étapes SANS durée (couper ≈ 5 min, etc.).
//   • Difficulté  = surtout le nombre d'étapes (plus d'étapes = plus long/difficile).

// Somme de toutes les durées mentionnées dans un texte d'étape (minutes).
export function sumStepMinutes(text: string): number {
    const clean = String(text || '').replace(/<[^>]*>/g, '');
    let total = 0;
    const re = /(\d+)\s?(h|heures?|min|minutes?)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(clean))) {
        const v = parseInt(m[1], 10);
        if (!isNaN(v)) total += /^h/i.test(m[2]) ? v * 60 : v;
    }
    return total;
}

// Mots-clés d'action → minutes estimées (on garde le plus élevé trouvé dans l'étape).
const PREP_KEYWORDS: [RegExp, number][] = [
    [/(p[ée]trir)/i, 8],
    [/(couper|d[ée]couper|[ée]mincer|tailler|hacher|ciseler|trancher|d[ée]tailler|d[ée]biter)/i, 5],
    [/([ée]plucher|peler|laver|rincer|nettoyer|parer|vider|d[ée]cortiquer|[ée]queuter|d[ée]sar[êe]ter)/i, 5],
    [/(r[âa]per|presser|zester|mixer|mouliner|blender|[ée]craser|r[ée]duire en pur)/i, 3],
    [/(fouetter|battre|monter|[ée]mulsionner|cr[ée]mer)/i, 3],
    [/(fariner|paner|enrober|former|fa[çc]onner|rouler|[ée]taler|garnir|dresser|disposer|r[ée]partir|farcir)/i, 3],
    [/(m[ée]langer|incorporer|remuer|ajouter|verser|assembler|combiner|d[ée]layer)/i, 2],
    [/(mariner|r[ée]server|filmer|laisser reposer)/i, 2],
    [/(assaisonner|saler|poivrer|saupoudrer|napper|badigeonner|arroser|parsemer)/i, 1],
];
const DEFAULT_PREP_PER_STEP = 3; // étape prépa sans mot-clé reconnu

export interface RecipeTiming {
    prepTime: number;   // minutes
    cookTime: number;   // minutes
    difficulty: string; // 'facile' | 'moyen' | 'difficile'
    steps: number;
}

export function estimateRecipeTiming(steps?: string[]): RecipeTiming {
    const list = (steps || []).map(s => String(s || '').trim()).filter(Boolean);
    let cook = 0;
    let prep = 0;
    for (const step of list) {
        const mins = sumStepMinutes(step);
        if (mins > 0) { cook += mins; continue; } // étape chronométrée = cuisson / repos
        let best = 0;
        for (const [re, min] of PREP_KEYWORDS) if (re.test(step) && min > best) best = min;
        prep += best || DEFAULT_PREP_PER_STEP;
    }
    const n = list.length;
    const difficulty = n >= 9 ? 'difficile' : n >= 5 ? 'moyen' : 'facile';
    return { prepTime: prep, cookTime: cook, difficulty, steps: n };
}
