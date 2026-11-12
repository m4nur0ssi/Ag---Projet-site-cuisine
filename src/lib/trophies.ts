// Trophées — calcul partagé (page Palmarès + révélation globale).
/*
 * Le catalogue ALLÉGÉ.
 *
 * On ne lit ici que les `tags` des recettes cuisinées, et le module léger les
 * porte. Le complet pèse 1,5 Mo de JavaScript à analyser — or le guetteur de
 * trophées est monté à CHAQUE page : il faisait à lui seul télécharger tout le
 * catalogue au démarrage, en plus des données de l'accueil.
 */
import { homeRecipes as mockRecipes } from '@/mobile/data/home-recipes';

export const TROPHY_SEEN_KEY = 'trophies-seen-v1';
const COUNTRY_TAGS = ['france', 'italie', 'espagne', 'grece', 'liban', 'usa', 'mexique', 'orient', 'asie', 'afrique', 'portugal'];

export const TROPHY_ICON: Record<string, string> = {
    flame: 'M12 3c1.4 2.8.6 4.6-.9 6.1C9.4 10.8 8.5 12 8.5 14a3.5 3.5 0 0 0 7 0c0-1.2-.5-2.1-1-2.9 1.6.4 2.3 2 2.3 3.5A4.8 4.8 0 0 1 12 19.5 4.8 4.8 0 0 1 7 14.6c0-2.9 2-4.4 3.4-6.1C11.5 7 12 5.6 12 3z',
    hat: 'M6 13v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5M5 13a3 3 0 0 1 .5-6 4 4 0 0 1 7.5-1 4 4 0 0 1 5.5 1A3 3 0 0 1 19 13z',
    pot: 'M4 10h16M6 10v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7M9 10V7m6 3V7',
    heart: 'M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18',
    calendar: 'M7 3v3m10-3v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 5z',
    apron: 'M8 3c0 2 1.8 3.5 4 3.5S16 5 16 3M6 8h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1zM9 13h6',
    party: 'M4 20l4.5-12L16 15.5zM14 4.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6zM18.5 9l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5zM11 3v2M20 13h-2',
    video: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 17.5zM16 10l4-2.5v9L16 14M8.5 9.5v5l4-2.5z',
};

export interface Trophy { icon: string; name: string; desc: string; val: number; goal: number; tint: string; got: boolean; }

const lireListe = (cle: string): string[] => {
    try { const v = JSON.parse(localStorage.getItem(cle) || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
};

/** Préparations lancées (drapeaux `recipe-cooking-<id>`). */
function cookedIds(): string[] {
    const out: string[] = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ''; if (k.startsWith('recipe-cooking-')) out.push(k.slice(15)); } } catch { /* noop */ }
    return out;
}

/** Ce que le palmarès compte, lu sur l'appareil. */
export interface Activite {
    lancees: number;
    cuisinees: number;
    categories: number;
    pays: number;
    favoris: number;
    flammes: number;
    semaine: boolean;
    jourJ: boolean;
    videos: number;
}

export function lireActivite(): Activite {
    const vide: Activite = { lancees: 0, cuisinees: 0, categories: 0, pays: 0, favoris: 0, flammes: 0, semaine: false, jourJ: false, videos: 0 };
    if (typeof window === 'undefined') return vide;
    const lancees = cookedIds();
    // Cuisinée = préparation lancée OU marquée « déjà cuisinée ».
    const cuisinees = [...new Set([...lancees, ...lireListe('deja-cuisine-v1')])];
    const byId = new Map(mockRecipes.map((r: any) => [String(r.id), r]));
    const pays = new Set<string>();
    const cats = new Set<string>();
    cuisinees.forEach((id) => {
        const r: any = byId.get(id);
        if (!r) return;
        if (r.category) cats.add(String(r.category).toLowerCase());
        (r.tags || []).forEach((t: string) => { const k = t.toLowerCase(); if (COUNTRY_TAGS.includes(k)) pays.add(k); });
    });
    let semaine = false; let jourJ = false;
    try {
        const p = JSON.parse(localStorage.getItem('meal-planner-week') || '{}') || {};
        semaine = Object.keys(p).some((d) => d !== 'JourJ' && Object.keys(p[d] || {}).length);
        jourJ = Object.keys(p.JourJ || {}).length > 0;
    } catch { /* noop */ }
    let videos = 0;
    try { videos = Number(localStorage.getItem('videos-importees-v1') || 0) || 0; } catch { /* noop */ }
    return {
        lancees: lancees.length,
        cuisinees: cuisinees.length,
        categories: cats.size,
        pays: pays.size,
        favoris: lireListe('favorites').length,
        flammes: lireListe('voted_recipes').length,
        semaine,
        jourJ,
        videos,
    };
}

export function computeTrophies(a: Activite = lireActivite()): Trophy[] {
    if (typeof window === 'undefined') return [];
    // Chef de maison : 30 recettes ET au moins 5 catégories différentes.
    // La jauge avance avec les recettes, mais plafonne tant que les catégories manquent.
    const chefVal = a.categories >= 5 ? a.cuisinees : Math.min(a.cuisinees, 29);
    const raw = [
        { icon: 'flame', name: 'Première flamme', desc: 'Clique la flamme en haut à droite de la photo d’une recette. Plus elle a de flammes, plus la recette est exceptionnelle.', val: a.flammes, goal: 1, tint: '#FF6B4A' },
        { icon: 'apron', name: 'Premier tablier', desc: 'Lance ta première préparation', val: a.lancees, goal: 1, tint: '#FF9F0A' },
        { icon: 'hat', name: 'Apprenti', desc: 'Cuisine 10 recettes', val: a.cuisinees, goal: 10, tint: '#FFC24B' },
        { icon: 'pot', name: 'Chef de maison', desc: `Cuisine 30 recettes dans au moins 5 catégories différentes (${Math.min(a.categories, 5)}/5)`, val: chefVal, goal: 30, tint: '#FF3B6B' },
        { icon: 'heart', name: 'Collectionneur', desc: '10 recettes en favoris', val: a.favoris, goal: 10, tint: '#FF2E63' },
        { icon: 'globe', name: 'Tour du monde', desc: 'Cuisine 5 pays différents', val: a.pays, goal: 5, tint: '#0A84FF' },
        { icon: 'calendar', name: 'Organisé', desc: 'Planifie une semaine', val: a.semaine ? 1 : 0, goal: 1, tint: '#30D158' },
        { icon: 'party', name: 'Jour J', desc: 'Prépare le menu d’un grand jour dans le planificateur', val: a.jourJ ? 1 : 0, goal: 1, tint: '#BF5AF2' },
        { icon: 'video', name: 'J’ai vu une vidéo', desc: 'Transforme une vidéo en recette', val: a.videos, goal: 1, tint: '#64D2FF' },
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
