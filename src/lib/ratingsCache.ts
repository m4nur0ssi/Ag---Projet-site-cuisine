// Cache persistant des moyennes de notes (toutes recettes confondues).
//
// Chaque ouverture de l'app relisait TOUTE la table `ratings` (une ligne par
// note de chaque visiteur) : c'est ce qui consomme la bande passante Supabase
// (egress). Les moyennes changent lentement ; on les garde 30 minutes dans le
// navigateur et on ne redemande qu'ensuite — ou juste après un vote.
import { ecrireStock } from './stockage';

export interface StatNote { avg: number; count: number; last?: number }

const CLE = 'ratings-stats-v1';
const DUREE_MS = 30 * 60 * 1000;

/** Les moyennes gardées, ou null si absentes ou périmées (`perime` : on les prend quand même). */
export function lireStatsNotes(perime = false): Map<string, StatNote> | null {
    try {
        const brut = localStorage.getItem(CLE);
        if (!brut) return null;
        const { t, d } = JSON.parse(brut) as { t: number; d: [string, StatNote][] };
        if (!Array.isArray(d) || !d.length) return null;
        if (!perime && Date.now() - t > DUREE_MS) return null;
        return new Map(d);
    } catch { return null; }
}

export function ecrireStatsNotes(m: Map<string, StatNote>): void {
    if (!m.size) return; // ne jamais figer un « aucune note » issu d'une réponse refusée
    ecrireStock(CLE, JSON.stringify({ t: Date.now(), d: [...m.entries()] }));
}

export function oublierStatsNotes(): void {
    try { localStorage.removeItem(CLE); } catch { /* noop */ }
}
