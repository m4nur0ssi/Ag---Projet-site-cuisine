/**
 * Source unique des groupes de filtres de recherche (catégories, pays, tendances).
 * Utilisée par SpotlightSearch (desktop + mobile) ET le picker du planificateur
 * (desktop + mobile) — évite le drift de listes copiées à la main.
 *
 * - CATEGORIES : ordre culinaire imposé (apéritif → pâtisserie), PAS alphabétique.
 * - PAYS : ordre alphabétique.
 * - TENDANCES : toutes les tendances, déjà triées alphabétiquement (par nom).
 *
 * Les consommateurs affichent `FILTER_GROUPS[group]` tel quel, sans re-trier.
 */

export interface FilterItem {
    label: string;
    tag: string;
}

// Ordre culinaire (demande produit) : apéritif, entrée, plat, pâtes, accompagnement, dessert, pâtisserie.
export const CATEGORIES: FilterItem[] = [
    { label: '🍹 Apéritifs', tag: 'aperitifs' },
    { label: '🥗 Entrées', tag: 'entrees' },
    { label: '🍽 Plats', tag: 'plats' },
    { label: '🍝 Pâtes', tag: 'pates' },
    { label: '🥘 Accompagnements', tag: 'accompagnements' },
    { label: '🍰 Desserts', tag: 'desserts' },
    { label: '🥐 Pâtisserie', tag: 'patisserie' },
];

// Alphabétique.
export const PAYS: FilterItem[] = [
    { label: '🌍 Afrique', tag: 'Afrique' },
    { label: '🥢 Asie', tag: 'Asie' },
    { label: '🇪🇸 Espagne', tag: 'Espagne' },
    { label: '🇫🇷 France', tag: 'France' },
    { label: '🇬🇷 Grèce', tag: 'Grece' },
    { label: '🇮🇹 Italie', tag: 'Italie' },
    { label: '🇱🇧 Liban', tag: 'Liban' },
    { label: '🇲🇽 Mexique', tag: 'Mexique' },
    { label: '🕌 Orient', tag: 'Orient' },
    { label: '🇵🇹 Portugal', tag: 'Portugal' },
    { label: '🇺🇸 USA', tag: 'USA' },
];

// Toutes les tendances (alignées sur l'accueil), triées alphabétiquement par nom.
export const TENDANCES: FilterItem[] = [
    { label: '🔥 Airfryer', tag: 'Airfryer' },
    { label: '💡 Astuces', tag: 'Astuces' },
    { label: '🥩 Barbecue', tag: 'Barbecue' },
    { label: '❄️ C\'est l\'hiver', tag: 'cest-lhiver' },
    { label: '🍝 Dolce Vita', tag: 'dolce-vita' },
    { label: '🌶️ Épicé', tag: 'epice' },
    { label: '⚡ Express', tag: 'Express' },
    { label: '👨‍👩‍👧 Famille', tag: 'famille' },
    { label: '🍦 Les Glaces', tag: 'glaces' },
    { label: '🧀 Gratins', tag: 'gratins' },
    { label: '🌿 Healthy', tag: 'Healthy' },
    { label: '🪶 Minceur', tag: 'minceur' },
    { label: '🎄 Noël', tag: 'Noël' },
    { label: '🐰 Pâques', tag: 'pâques' },
    { label: '💰 Pas Cher', tag: 'Pas cher' },
    { label: '🍝 Pâtes', tag: 'pates' },
    { label: '🐟 Poissons', tag: 'poissons' },
    { label: '🥤 Rafraîchissements', tag: 'boissons' },
    { label: '🥗 Salades', tag: 'salades' },
    { label: '🥪 Sandwichs', tag: 'sandwich' },
    { label: '🌾 Sans gluten', tag: 'sans-gluten' },
    { label: '🥛 Sans lactose', tag: 'sans-lactose' },
    { label: '🧂 Sans sel', tag: 'sans-sel' },
    { label: '🍬 Sans sucre', tag: 'sans-sucre' },
    { label: '🥫 Sauces', tag: 'sauces' },
    { label: '✨ Simplissime', tag: 'simplissime' },
    { label: '🍲 Soupes', tag: 'soupes' },
    { label: '🥧 Tarte', tag: 'tarte' },
    { label: '🥬 Végé', tag: 'vegetarien' },
    { label: '☀️ Voilà l\'été', tag: 'voila-lete' },
];

export const FILTER_GROUPS: Record<'categorie' | 'pays' | 'tendances', FilterItem[]> = {
    categorie: CATEGORIES,
    pays: PAYS,
    tendances: TENDANCES,
};

export type FilterGroup = keyof typeof FILTER_GROUPS;
