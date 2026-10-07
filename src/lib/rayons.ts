// Classement des ingrédients par rayon de supermarché.
// Couche d'AFFICHAGE uniquement : ne touche pas l'état coché/rayé/sélectionné.
import { normalizeIng } from './ingredients';

export interface Rayon {
    id: string;
    label: string;
    emoji: string;
}

// Ordre = parcours type d'un magasin (frais d'abord, ménager en dernier).
export const RAYONS: Rayon[] = [
    { id: 'fruits-legumes', label: 'Fruits & Légumes', emoji: '🥬' },
    { id: 'cremerie', label: 'Frais / Crémerie', emoji: '🧀' },
    { id: 'viande-poisson', label: 'Viande & Poisson', emoji: '🥩' },
    { id: 'boulangerie', label: 'Boulangerie', emoji: '🥖' },
    { id: 'epicerie', label: 'Épicerie', emoji: '🛒' },
    { id: 'surgele', label: 'Surgelé', emoji: '🧊' },
    { id: 'boissons', label: 'Boissons', emoji: '🥤' },
    { id: 'autre', label: 'Autres / Ménager', emoji: '📦' },
];

export const RAYON_BY_ID: Record<string, Rayon> = Object.fromEntries(RAYONS.map(r => [r.id, r]));
export const RAYON_ORDER: Record<string, number> = Object.fromEntries(RAYONS.map((r, i) => [r.id, i]));
const DEFAULT_RAYON = 'autre';

// Mots-clés par rayon (normalisés sans accents). Premier match gagne, dans cet ordre.
// "surgelé" testé en premier car prioritaire sur le produit lui-même (ex: petits pois surgelés).
const KEYWORDS: [string, string[]][] = [
    ['surgele', ['surgel', 'glace', 'glacon', 'creme glacee', 'sorbet']],
    ['cremerie', [
        'lait', 'beurre', 'oeuf', 'creme', 'yaourt', 'yogourt', 'fromage', 'parmesan', 'mozzarella',
        'gruyere', 'emmental', 'comte', 'feta', 'ricotta', 'mascarpone', 'chevre', 'cheddar', 'roquefort',
        'margarine', 'skyr', 'fromage blanc', 'petit suisse', 'creme fraiche', 'lait de coco',
    ]],
    ['viande-poisson', [
        'poulet', 'boeuf', 'porc', 'veau', 'agneau', 'dinde', 'canard', 'lapin', 'jambon', 'lardon',
        'bacon', 'saucisse', 'chorizo', 'steak', 'viande', 'cote', 'escalope', 'filet', 'magret',
        'merguez', 'saumon', 'thon', 'cabillaud', 'colin', 'crevette', 'poisson', 'sardine', 'maquereau',
        'truite', 'dorade', 'bar', 'moule', 'crabe', 'gambas', 'calamar', 'lieu', 'hache', 'chair a saucisse',
    ]],
    ['fruits-legumes', [
        'tomate', 'salade', 'laitue', 'epinard', 'carotte', 'courgette', 'aubergine', 'poivron', 'oignon',
        'ail', 'echalote', 'pomme de terre', 'patate', 'champignon', 'brocoli', 'chou', 'haricot', 'petit pois',
        'poireau', 'concombre', 'radis', 'betterave', 'navet', 'celeri', 'fenouil', 'courge', 'potiron',
        'avocat', 'mais', 'persil', 'coriandre', 'basilic', 'menthe', 'ciboulette', 'thym', 'romarin', 'aneth',
        'pomme', 'banane', 'poire', 'orange', 'citron', 'fraise', 'framboise', 'myrtille', 'cassis', 'raisin',
        'peche', 'abricot', 'cerise', 'kiwi', 'ananas', 'mangue', 'melon', 'pasteque', 'figue', 'clementine',
        'pamplemousse', 'datte', 'grenade', 'rhubarbe', 'gingembre', 'patate douce', 'endive', 'artichaut',
        'asperge', 'cresson', 'roquette', 'mache', 'blette', 'panais', 'topinambour',
    ]],
    ['boulangerie', [
        'pain', 'baguette', 'brioche', 'croissant', 'biscotte', 'pain de mie', 'pate feuilletee',
        'pate brisee', 'pate sablee', 'pate a pizza', 'pate a tarte', 'tortilla', 'wrap', 'naan',
    ]],
    ['boissons', [
        'eau', 'jus', 'vin', 'biere', 'soda', 'cola', 'limonade', 'sirop', 'the', 'cafe', 'cidre',
        'champagne', 'rhum', 'vodka', 'whisky', 'liqueur', 'porto', 'martini', 'aperitif', 'cognac',
    ]],
    ['epicerie', [
        'farine', 'sucre', 'sel', 'poivre', 'huile', 'vinaigre', 'pate', 'pates', 'riz', 'semoule', 'quinoa',
        'lentille', 'pois chiche', 'haricot sec', 'boulgour', 'polenta', 'levure', 'bicarbonate', 'maizena',
        'fecule', 'chocolat', 'cacao', 'vanille', 'cannelle', 'curry', 'cumin', 'paprika', 'curcuma',
        'muscade', 'epice', 'herbe', 'bouillon', 'moutarde', 'ketchup', 'mayonnaise', 'sauce', 'tomate concassee',
        'concentre de tomate', 'coulis', 'conserve', 'thon en boite', 'mais en boite', 'olive', 'cornichon',
        'capre', 'miel', 'confiture', 'pate a tartiner', 'nutella', 'biscuit', 'cereale', 'flocon', 'avoine',
        'amande', 'noisette', 'noix', 'cacahuete', 'pignon', 'graine', 'raisin sec', 'sucre vanille',
        'sucre glace', 'extrait', 'arome', 'colorant', 'gelatine', 'agar', 'pepite', 'speculoos', 'sucre roux',
    ]],
];

// Regex par mot-clé : bord de mot + pluriel optionnel.
// Évite les faux positifs de sous-chaîne ("cola" dans "chocolat", "sel" dans "vaisselle").
const reCache = new Map<string, RegExp>();
const wordRe = (kw: string): RegExp => {
    let re = reCache.get(kw);
    if (!re) {
        const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        re = new RegExp(`\\b${esc}s?\\b`);
        reCache.set(kw, re);
    }
    return re;
};

// Renvoie l'id du rayon déduit du nom (sans tenir compte des overrides).
export const autoRayon = (name: string): string => {
    const n = normalizeIng(name);
    for (const [rayon, words] of KEYWORDS) {
        for (const w of words) {
            if (wordRe(w).test(n)) return rayon;
        }
    }
    return DEFAULT_RAYON;
};

// ── Overrides manuels (localStorage) : clé = produit normalisé → rayonId ──
const OV_KEY = 'shop-rayon-overrides';

export const readRayonOverrides = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(OV_KEY) || '{}'); } catch { return {}; }
};

export const writeRayonOverride = (name: string, rayonId: string) => {
    const ov = readRayonOverrides();
    ov[normalizeIng(name)] = rayonId;
    localStorage.setItem(OV_KEY, JSON.stringify(ov));
    window.dispatchEvent(new Event('shoppingListUpdated'));
};

// Rayon effectif d'un produit : override manuel sinon classement auto.
export const rayonOf = (name: string, overrides: Record<string, string>): string =>
    overrides[normalizeIng(name)] || autoRayon(name);
