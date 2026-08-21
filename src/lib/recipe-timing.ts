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

// Actions de prépa → minutes de BASE (pour 1 unité). Une étape peut cumuler
// plusieurs actions ; on les ADDITIONNE (« éplucher ET couper » compte les deux).
const PREP_ACTIONS: [RegExp, number][] = [
    [/(p[ée]trir)/i, 8],
    [/([ée]taler.*(p[âa]te)|abaisser)/i, 5],
    [/([ée]mincer|hacher|ciseler)/i, 2],           // émincer 1 oignon ≈ 2 min
    [/(couper|d[ée]couper|tailler|trancher|d[ée]tailler|d[ée]biter|d[ée]s(?:o|)ss?er)/i, 2],
    [/([ée]plucher|peler|[ée]queuter|d[ée]cortiquer|d[ée]sar[êe]ter|parer|vider)/i, 1.5], // 2 carottes ≈ 3 min
    [/(laver|rincer|nettoyer|essuyer|s[ée]cher)/i, 1.5],
    [/(r[âa]per|presser|zester|mixer|mouliner|blender|[ée]craser|r[ée]duire en pur)/i, 2],
    [/(fouetter|battre|monter|[ée]mulsionner|cr[ée]mer|blanchir les (?:jaunes|oeufs|œufs))/i, 3],
    [/(fariner|paner|enrober|former|fa[çc]onner|rouler|garnir|dresser|disposer|r[ée]partir|farcir|monter le)/i, 3],
    [/([ée]taler|[ée]tendre)/i, 2],
    [/(m[ée]langer|incorporer|remuer|ajouter|verser|assembler|combiner|d[ée]layer|fondre)/i, 1.5],
    [/(assaisonner|saler|poivrer|saupoudrer|napper|badigeonner|arroser|parsemer)/i, 0.5],
];
const DEFAULT_PREP_PER_STEP = 2.5; // étape prépa sans action reconnue

// Nombre d'unités à préparer dans l'étape (« 2 carottes », « 3 gousses »…).
// Sert à allonger un peu le temps quand il y a de la quantité (default 1).
function stepQuantity(text: string): number {
    const clean = text.replace(/<[^>]*>/g, '');
    let max = 1;
    const words: Record<string, number> = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8 };
    for (const [w, n] of Object.entries(words)) if (new RegExp(`\\b${w}\\b`, 'i').test(clean)) max = Math.max(max, n);
    const re = /(\d+)\s*(carotte|oignon|[ée]chalote|gousse|pomme|patate|courgette|poivron|tomate|blanc|jaune|oeuf|œuf|filet|escalope|tranche|pi[èe]ce|l[ée]gume)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(clean))) { const v = parseInt(m[1], 10); if (v > 0) max = Math.max(max, v); }
    return Math.min(max, 8); // on plafonne : au-delà, on ne cumule pas indéfiniment
}

/** Minutes de prépa estimées pour une étape (somme des actions × facteur quantité). */
function prepMinutesForStep(step: string): number {
    let sum = 0;
    for (const [re, base] of PREP_ACTIONS) if (re.test(step)) sum += base;
    if (sum === 0) return DEFAULT_PREP_PER_STEP;
    const qty = stepQuantity(step);
    const qtyFactor = 1 + (qty - 1) * 0.4; // 2 unités = ×1,4 ; 3 = ×1,8…
    // Plancher d'une minute : aucune étape ne se fait en trente secondes, et
    // douze étapes « saler / poivrer » finissaient par voler dix minutes au
    // total. On ne se trompe jamais en comptant large.
    return Math.max(1, sum * qtyFactor);
}

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
        prep += prepMinutesForStep(step);
    }
    // Petite marge de sécurité : on cuisine rarement plus vite que prévu.
    prep = Math.ceil(prep * 1.15);
    const n = list.length;
    const difficulty = n >= 9 ? 'difficile' : n >= 5 ? 'moyen' : 'facile';
    return { prepTime: prep, cookTime: cook, difficulty, steps: n };
}
