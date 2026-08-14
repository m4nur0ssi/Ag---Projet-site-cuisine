// Substitutions d'ingrédients (feature « Apple TV+ » — appui long sur un
// ingrédient). Table par mot-clé : on renvoie 2–3 remplacements courants.
// Volontairement simple et hors-ligne : pas d'IA, pas de réseau.

export interface Substitution {
    emoji: string;
    label: string;
}

interface Rule {
    match: RegExp;
    subs: Substitution[];
}

const RULES: Rule[] = [
    { match: /safran/i, subs: [{ emoji: '🌿', label: 'Curcuma + paprika' }, { emoji: '🌼', label: 'Pistils de carthame' }, { emoji: '🧂', label: 'Bouillon safrané' }] },
    { match: /beurre/i, subs: [{ emoji: '🫒', label: "Huile d'olive" }, { emoji: '🥥', label: 'Huile de coco' }, { emoji: '🍏', label: 'Compote de pomme' }] },
    { match: /crème (fraîche|liquide|épaisse)?|creme/i, subs: [{ emoji: '🥥', label: 'Lait de coco' }, { emoji: '🌰', label: 'Crème de soja' }, { emoji: '🧀', label: 'Mascarpone détendu' }] },
    { match: /lait(?! de coco)/i, subs: [{ emoji: '🌾', label: "Lait d'avoine" }, { emoji: '🥥', label: 'Lait de coco' }, { emoji: '🌰', label: 'Lait de soja' }] },
    { match: /parmesan|grana|pecorino/i, subs: [{ emoji: '🧀', label: 'Grana Padano' }, { emoji: '🌰', label: 'Levure maltée' }, { emoji: '🧀', label: 'Pecorino' }] },
    { match: /\boeufs?\b|œufs?/i, subs: [{ emoji: '🍌', label: '½ banane écrasée' }, { emoji: '🌾', label: "Graines de lin + eau" }, { emoji: '🍏', label: 'Compote de pomme' }] },
    { match: /farine( de blé)?/i, subs: [{ emoji: '🌽', label: 'Maïzena (¾)' }, { emoji: '🌰', label: "Farine d'amande" }, { emoji: '🍚', label: 'Farine de riz' }] },
    { match: /sucre(?! vanillé)/i, subs: [{ emoji: '🍯', label: 'Miel (¾)' }, { emoji: '🍁', label: "Sirop d'érable" }, { emoji: '🥥', label: 'Sucre de coco' }] },
    { match: /citron\b/i, subs: [{ emoji: '🍋', label: 'Vinaigre blanc' }, { emoji: '🍊', label: 'Jus de lime' }, { emoji: '🍶', label: 'Vinaigre de cidre' }] },
    { match: /vin blanc/i, subs: [{ emoji: '🍶', label: 'Bouillon + vinaigre' }, { emoji: '🍎', label: 'Jus de pomme' }, { emoji: '🍋', label: 'Jus de citron dilué' }] },
    { match: /vin rouge/i, subs: [{ emoji: '🍇', label: 'Jus de raisin' }, { emoji: '🍶', label: 'Bouillon de bœuf' }, { emoji: '🍒', label: 'Jus de cranberry' }] },
    { match: /échalote|echalote/i, subs: [{ emoji: '🧅', label: 'Oignon doux' }, { emoji: '🧅', label: 'Oignon nouveau' }, { emoji: '🧄', label: 'Ail + ciboulette' }] },
    { match: /ail\b/i, subs: [{ emoji: '🧅', label: 'Échalote' }, { emoji: '🌰', label: "Poudre d'ail" }, { emoji: '🧅', label: 'Oignon râpé' }] },
    { match: /basilic/i, subs: [{ emoji: '🌿', label: 'Origan' }, { emoji: '🌿', label: 'Persil + menthe' }, { emoji: '🌿', label: 'Roquette' }] },
    { match: /riz(?! )/i, subs: [{ emoji: '🌾', label: 'Quinoa' }, { emoji: '🥦', label: 'Riz de chou-fleur' }, { emoji: '🌾', label: 'Boulgour' }] },
    { match: /pâtes|pates|spaghetti|penne|tagliatelle/i, subs: [{ emoji: '🥒', label: 'Courgette en tagliatelles' }, { emoji: '🌾', label: 'Pâtes complètes' }, { emoji: '🍜', label: 'Nouilles de riz' }] },
    { match: /tomate/i, subs: [{ emoji: '🥫', label: 'Tomates concassées' }, { emoji: '🌶️', label: 'Concentré dilué' }, { emoji: '🫑', label: 'Poivron rouge rôti' }] },
    { match: /miel/i, subs: [{ emoji: '🍁', label: "Sirop d'érable" }, { emoji: '🌾', label: "Sirop d'agave" }, { emoji: '🍯', label: 'Sucre + eau' }] },
    { match: /piment|pimenté/i, subs: [{ emoji: '🌶️', label: 'Paprika fort' }, { emoji: '🌶️', label: 'Poivre de Cayenne' }, { emoji: '🥫', label: 'Harissa' }] },
    { match: /yaourt|yogourt/i, subs: [{ emoji: '🥥', label: 'Yaourt de coco' }, { emoji: '🧀', label: 'Fromage blanc' }, { emoji: '🌰', label: 'Yaourt de soja' }] },
];

const GENERIC: Substitution[] = [
    { emoji: '🔁', label: 'Version sans (retirer)' },
    { emoji: '🧂', label: 'Épice au choix' },
];

// Renvoie une liste de remplacements pour un nom d'ingrédient, ou null si rien
// de pertinent (on n'affiche alors pas le menu).
export function getSubstitutions(name: string): Substitution[] | null {
    if (!name) return null;
    // Retire les émojis/espaces en tête sans plage Unicode fragile.
    const clean = name.replace(/^[^\p{L}]+/u, '').trim() || name.trim();
    for (const rule of RULES) {
        if (rule.match.test(clean)) return rule.subs;
    }
    return GENERIC;
}
