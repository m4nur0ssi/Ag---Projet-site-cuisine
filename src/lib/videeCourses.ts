import { ecrireStock } from '@/lib/stockage';

/*
 * « Vider » la liste de courses sans rien perdre.
 *
 * Vider masquait jusqu'aux ingrédients du planificateur, y compris ceux qu'on
 * n'avait pas encore achetés : une erreur de doigt coûtait la liste, et le seul
 * recours était un bouton « Annuler » de deux secondes.
 *
 * Désormais, vider ne touche QU'À la liste fusionnée (« Tout acheter ») et aux
 * ajouts à la main. Le planificateur et les cases barrées ne bougent pas : la
 * vue « Par jour » montre toujours, recette par recette, ce qu'il y a à acheter
 * et ce qui est déjà pris. Une copie des ajouts à la main est gardée ici, avec
 * la signature du plan, pour le bouton « Retrouver ma liste ».
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
}

export function lireVidage(): Vidage | null {
    try {
        const v = JSON.parse(localStorage.getItem(KEY) || 'null');
        return v && typeof v.sig === 'string' && v.list && typeof v.list === 'object' ? v : null;
    } catch { return null; }
}

export function poserVidage(sig: string, list: Liste): void {
    ecrireStock(KEY, JSON.stringify({ sig, list, at: Date.now() } satisfies Vidage));
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
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
    return fusion;
}
