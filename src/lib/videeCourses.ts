import { ecrireStock } from '@/lib/stockage';

/*
 * « Vider » la liste de courses sans rien perdre.
 *
 * Vider masquait jusqu'aux ingrédients du planificateur, y compris ceux qu'on
 * n'avait pas encore achetés : une erreur de doigt coûtait la liste, et le seul
 * recours était un bouton « Annuler » de deux secondes.
 *
 * Désormais, vider n'efface de la liste principale (« Tout acheter ») QUE les
 * articles barrés (déjà pris). Ceux qui ne sont pas barrés restent affichés.
 * Une copie (ajouts à la main, lignes masquées, cases barrées) est gardée ici,
 * avec la signature du plan, pour le bouton « Retrouver ma liste ».
 */

type Liste = Record<string, any>;

const KEY = 'courses-videe';
const LISTE = 'magic-shopping-list';

export interface Vidage {
    /** Signature du plan au moment du vidage : si le plan change, la liste revient. */
    sig: string;
    /** La liste (ajouts à la main) telle qu'elle était. */
    list: Liste;
    at: number;
    /** Lignes du planificateur masquées par le vidage (à démasquer en retrouvant la liste). */
    masque?: string[];
    /** Cases barrées retirées par le vidage (à re-barrer en retrouvant la liste). */
    marques?: string[];
}

export function lireVidage(): Vidage | null {
    try {
        const v = JSON.parse(localStorage.getItem(KEY) || 'null');
        return v && typeof v.sig === 'string' && v.list && typeof v.list === 'object' ? v : null;
    } catch { return null; }
}

export function poserVidage(sig: string, list: Liste, masque: string[] = [], marques: string[] = []): void {
    ecrireStock(KEY, JSON.stringify({ sig, list, at: Date.now(), masque, marques } satisfies Vidage));
}

/** Oublie la copie (le plan a changé : ce qu'elle rendrait n'a plus de sens). */
export function oublierVidage(): void {
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

/** Les ajouts de la copie rejoignent la liste en cours, sans doublon. */
function fusionner(courante: Liste, copie: Liste): Liste {
    const out: Liste = { ...courante };
    Object.entries(copie).forEach(([k, entree]) => {
        const deja = out[k];
        if (!deja) { out[k] = entree; return; }
        const nom = (i: any) => (typeof i === 'string' ? i : i?.name);
        const connus = new Set((deja.ingredients || []).map(nom));
        out[k] = { ...deja, ingredients: [...(deja.ingredients || []), ...(entree.ingredients || []).filter((i: any) => !connus.has(nom(i)))] };
    });
    return out;
}

/**
 * Retrouve la liste : remet les ajouts à la main, efface la marque de vidage.
 * Renvoie la liste obtenue, ou `null` s'il n'y avait rien à rendre.
 */
export function rendreListe(): Liste | null {
    const v = lireVidage();
    if (!v) return null;
    let courante: Liste = {};
    try { courante = JSON.parse(localStorage.getItem(LISTE) || '{}'); } catch { /* liste illisible : repart de la copie */ }
    const fusion = fusionner(courante, v.list);
    ecrireStock(LISTE, JSON.stringify(fusion));
    // Les lignes du planificateur masquées par le vidage redeviennent visibles…
    if (v.masque?.length) {
        try {
            const m = new Set<string>(JSON.parse(localStorage.getItem('meal-week-checked') || '[]'));
            v.masque.forEach((k) => m.delete(k));
            ecrireStock('meal-week-checked', JSON.stringify([...m]));
        } catch { /* masque illisible : on laisse tel quel */ }
    }
    // … et les cases barrées reviennent barrées : c'est ce qu'on avait acheté.
    if (v.marques?.length) {
        try {
            const d = new Set<string>(JSON.parse(localStorage.getItem('shop-done') || '[]'));
            v.marques.forEach((k) => d.add(k));
            ecrireStock('shop-done', JSON.stringify([...d]));
        } catch { /* noop */ }
    }
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
    return fusion;
}
