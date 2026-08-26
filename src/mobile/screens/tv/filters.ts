import { THEMES } from './themes';

// ── Options de filtre ──────────────────────────────────────────────────────
// Jeton = « groupe:valeur ». c = catégorie, t = tendance, p = pays.

export const CATEGORY_OPTIONS: { token: string; label: string }[] = [
    { token: 'c:aperitifs', label: 'Apéritifs' },
    { token: 'c:entrees', label: 'Entrées' },
    { token: 'c:plats', label: 'Plats' },
    { token: 'c:accompagnements', label: 'Accompagnements' },
    { token: 'c:desserts', label: 'Desserts' },
    { token: 'c:patisserie', label: 'Pâtisseries' },
    { token: 'c:glaces', label: 'Glaces' },
    { token: 'c:restaurant', label: 'Comme au resto' },
];

/** Toutes les thématiques du feed, dans le même ordre alphabétique. */
export const TREND_OPTIONS = [...THEMES]
    .sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }))
    .map((t) => ({ token: `t:${t.tag}`, label: t.title }));

// Ordre alphabétique français (accents/casse ignorés), comme les catégories.
export const COUNTRY_OPTIONS: { token: string; label: string }[] = [
    { token: 'p:afrique', label: 'Afrique' },
    { token: 'p:asie', label: 'Asie' },
    { token: 'p:espagne', label: 'Espagne' },
    { token: 'p:france', label: 'France' },
    { token: 'p:grece', label: 'Grèce' },
    { token: 'p:italie', label: 'Italie' },
    { token: 'p:liban', label: 'Liban' },
    { token: 'p:mexique', label: 'Mexique' },
    { token: 'p:orient', label: 'Orient' },
    { token: 'p:usa', label: 'USA' },
];
