// Déroulé de préparation « un seul cuisinier ».
//
// Principe : un plat = une phase ACTIVE (le cuisinier : prépa, dressage) puis une
// phase PASSIVE (four, frigo, repos — sans lui). On ne peut faire qu'UNE phase
// active à la fois, mais les phases passives se chevauchent librement. On planifie
// donc à rebours depuis l'heure de service : chaque phase passive doit finir à
// temps, et on empile les phases actives dans les creux, sans jamais superposer
// deux tâches du cuisinier.

import { estimateRecipeTiming } from '@/lib/recipe-timing';

export interface TimelineInput {
    key: string;
    label: string;      // « Entrée », « Plat »…
    title: string;      // nom de la recette
    /** Minutes de travail actif (prépa/dressage). */
    active: number;
    /** Minutes passives (four, frigo, repos). */
    passive: number;
    activeLabel?: string;   // « Prépa »
    passiveLabel?: string;  // « Au four », « Au frais »
    /** Minutes de décalage du moment « prêt » par rapport à l'heure de service. */
    readyOffset: number;
}

export interface TimelineTask extends TimelineInput {
    ready: number;         // minute où le plat est prêt
    passiveStart: number;  // début de la phase passive
    activeStart: number;   // début de la phase active (toi)
    activeEnd: number;     // fin de la phase active
}

export interface TimelineResult {
    tasks: TimelineTask[];        // ordre chronologique (par début actif)
    start: number;                // 1re minute de travail
    serve: number;                // heure de service (minutes depuis minuit)
    activeTotal: number;          // minutes de travail réel
    naiveTotal: number;           // minutes si tout était bout à bout
    span: number;                 // durée réelle du 1er geste au service
}

/** Devine actif/passif d'une recette : prépa = actif, cuisson/repos = passif. */
export function timingFromSteps(steps?: string[]): { active: number; passive: number } {
    const t = estimateRecipeTiming(steps);
    return { active: Math.max(t.prepTime, 4), passive: t.cookTime };
}

/**
 * Décalage du moment « prêt » par rapport à l'heure de SERVICE.
 * Règle voulue : TOUT est prêt pour l'heure de service (0 = prêt pile à l'heure).
 * On garde 0 partout — la timeline place les prépas AVANT, jamais après le service.
 */
export const COURSE_OFFSET: Record<string, number> = {
    'Apéritif': 0, 'Apéritifs': 0,
    'Entrée': 0, 'Entrées': 0,
    'Plat': 0, 'Plats': 0,
    'Accompagnement': 0,
    'Dessert': 0, 'Desserts': 0,
    'Pâtisserie': 0, 'Patisserie': 0,
    'Midi': 0, 'Soir': 0,
};

export function passiveLabelFor(steps?: string[]): string {
    const txt = (steps || []).join(' ').toLowerCase();
    if (/\b(frigo|frais|r[ée]frig[ée]rer|reposer au frais|prendre au froid)\b/.test(txt)) return 'Au frais';
    if (/\b(repos|lever|pousser|mariner)\b/.test(txt)) return 'Repos';
    if (/\b(four|enfourn|cuire|cuisson|r[ôo]tir|gratiner)\b/.test(txt)) return 'Au four';
    if (/\b(mijot|frémir|bouillir|pocher)\b/.test(txt)) return 'Sur le feu';
    return 'Cuisson';
}

export function buildCookingTimeline(items: TimelineInput[], serve: number): TimelineResult {
    // 1) Deadlines de chaque plat (fin passive → début passif → deadline active).
    const d: TimelineTask[] = items.map((x) => {
        const ready = serve + x.readyOffset;
        const passiveStart = ready - x.passive;
        return { ...x, ready, passiveStart, activeStart: 0, activeEnd: passiveStart };
    });
    // 2) Cuisinier unique : on place les phases actives à rebours, deadline la plus
    //    tardive d'abord, sans chevauchement.
    const order = [...d].sort((a, b) => b.activeEnd - a.activeEnd);
    let free = Infinity;
    for (const x of order) {
        const end = Math.min(x.passiveStart, free);
        x.activeEnd = end;
        x.activeStart = end - x.active;
        free = x.activeStart;
    }
    const tasks = [...d].sort((a, b) => a.activeStart - b.activeStart);
    const start = Math.min(...tasks.map((x) => x.activeStart));
    const activeTotal = tasks.reduce((s, x) => s + x.active, 0);
    const naiveTotal = tasks.reduce((s, x) => s + x.active + x.passive, 0);
    return { tasks, start, serve, activeTotal, naiveTotal, span: serve - start };
}

/** Formate des minutes-depuis-minuit en « 20:05 ». */
export function fmtClock(min: number): string {
    const m = ((Math.round(min) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
