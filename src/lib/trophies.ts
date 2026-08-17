// Trophées — calcul partagé (page Palmarès + révélation globale).
import { mockRecipes } from '@/mobile/data/mockData';

export const TROPHY_SEEN_KEY = 'trophies-seen-v1';
const COUNTRY_TAGS = ['france', 'italie', 'espagne', 'grece', 'liban', 'usa', 'mexique', 'orient', 'asie', 'afrique'];

export const TROPHY_ICON: Record<string, string> = {
    flame: 'M12 3c1.4 2.8.6 4.6-.9 6.1C9.4 10.8 8.5 12 8.5 14a3.5 3.5 0 0 0 7 0c0-1.2-.5-2.1-1-2.9 1.6.4 2.3 2 2.3 3.5A4.8 4.8 0 0 1 12 19.5 4.8 4.8 0 0 1 7 14.6c0-2.9 2-4.4 3.4-6.1C11.5 7 12 5.6 12 3z',
    hat: 'M6 13v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5M5 13a3 3 0 0 1 .5-6 4 4 0 0 1 7.5-1 4 4 0 0 1 5.5 1A3 3 0 0 1 19 13z',
    pot: 'M4 10h16M6 10v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7M9 10V7m6 3V7',
    heart: 'M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18',
    calendar: 'M7 3v3m10-3v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 5z',
};

export interface Trophy { icon: string; name: string; desc: string; val: number; goal: number; tint: string; got: boolean; }

function cookedIds(): string[] {
    const out: string[] = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ''; if (k.startsWith('recipe-cooking-')) out.push(k.slice(15)); } } catch { /* noop */ }
    return out;
}

export function computeTrophies(): Trophy[] {
    if (typeof window === 'undefined') return [];
    const cooked = cookedIds();
    const n = cooked.length;
    let favs = 0;
    try { favs = (JSON.parse(localStorage.getItem('favorites') || '[]') || []).length; } catch { /* noop */ }
    let hasWeek = false;
    try { const p = JSON.parse(localStorage.getItem('meal-planner-week') || '{}'); hasWeek = Object.keys(p).some((d) => d !== 'JourJ' && Object.keys(p[d] || {}).length); } catch { /* noop */ }
    const byId = new Map(mockRecipes.map((r: any) => [String(r.id), r]));
    const countrySet = new Set<string>();
    cooked.forEach((id) => { const r: any = byId.get(id); (r?.tags || []).forEach((t: string) => { const k = t.toLowerCase(); if (COUNTRY_TAGS.includes(k)) countrySet.add(k); }); });
    const countries = countrySet.size;

    const raw = [
        { icon: 'flame', name: 'Première flamme', desc: 'Lance ta 1re préparation', val: n, goal: 1, tint: '#FF6B4A' },
        { icon: 'hat', name: 'Apprenti', desc: 'Cuisine 5 recettes', val: n, goal: 5, tint: '#FFC24B' },
        { icon: 'pot', name: 'Chef de maison', desc: 'Cuisine 20 recettes', val: n, goal: 20, tint: '#FF3B6B' },
        { icon: 'heart', name: 'Collectionneur', desc: '10 recettes en favoris', val: favs, goal: 10, tint: '#FF2E63' },
        { icon: 'globe', name: 'Tour du monde', desc: 'Cuisine 5 pays différents', val: countries, goal: 5, tint: '#0A84FF' },
        { icon: 'calendar', name: 'Organisé', desc: 'Planifie une semaine', val: hasWeek ? 1 : 0, goal: 1, tint: '#30D158' },
    ];
    return raw.map((b) => ({ ...b, got: b.val >= b.goal }));
}

/** Trophées débloqués depuis la dernière fois (et marque comme vus). */
export function pullNewlyUnlocked(): Trophy[] {
    if (typeof window === 'undefined') return [];
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem(TROPHY_SEEN_KEY) || '[]'); } catch { /* noop */ }
    const newly = computeTrophies().filter((b) => b.got && !seen.includes(b.name));
    if (newly.length) {
        try { localStorage.setItem(TROPHY_SEEN_KEY, JSON.stringify([...new Set([...seen, ...newly.map((b) => b.name)])])); } catch { /* noop */ }
    }
    return newly;
}
