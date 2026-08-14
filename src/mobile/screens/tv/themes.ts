// Thématiques de l'accueil « Apple TV+ » — TEST DE DESIGN (route /tv).
//
// Les anciennes tuiles illustrées (/images/themes/*.png) sont abandonnées ici :
// chaque thème devient une rangée de vraies recettes, avec leurs propres photos.
// Les règles de correspondance sont reprises de l'accueil mobile actuel
// (src/mobile/screens/page.tsx) pour que les résultats restent identiques.

import { Recipe } from '@/mobile/types';
import { totalMinutes } from './timing';

export interface Theme {
    /** Tag interne (identique à celui de l'accueil actuel). */
    tag: string;
    /** Libellé affiché en tête de rangée. */
    title: string;
}

/** Ordre d'affichage des rangées thématiques (du plus grand public au plus pointu). */
export const THEMES: Theme[] = [
    { tag: 'pates', title: 'Pâtes' },
    { tag: 'express', title: 'Express' },
    { tag: 'famille', title: 'En famille' },
    { tag: 'healthy', title: 'Healthy' },
    { tag: 'barbecue', title: 'Barbecue' },
    { tag: 'airfryer', title: 'Airfryer' },
    { tag: 'salades', title: 'Salades' },
    { tag: 'soupes', title: 'Soupes' },
    { tag: 'gratins', title: 'Gratins' },
    { tag: 'tarte', title: 'Tartes, quiches & pizzas' },
    { tag: 'poissons', title: 'Poissons et crustacés' },
    { tag: 'sandwich', title: 'Sandwichs' },
    { tag: 'epice', title: 'Épicé' },
    { tag: 'pas cher', title: 'Pas cher' },
    { tag: 'glaces', title: 'Les glaces' },
    { tag: 'boissons', title: 'Rafraîchissements' },
    { tag: 'sauces', title: 'Sauces' },
    { tag: 'dolce-vita', title: 'La Dolce Vita' },
    { tag: 'voila-lete', title: "Voilà l'été" },
    { tag: 'cest-lhiver', title: "C'est l'hiver" },
    { tag: 'pâques', title: 'Pâques' },
    { tag: 'noël', title: 'Noël' },
    { tag: 'simplissime', title: 'Simplissime' },
    { tag: 'astuces', title: 'Astuces' },
    { tag: 'vegetarien', title: 'Végétarien' },
    { tag: 'minceur', title: 'Léger & minceur' },
    { tag: 'sans-gluten', title: 'Sans gluten' },
    { tag: 'sans-lactose', title: 'Sans lactose' },
    { tag: 'sans-sucre', title: 'Sans sucre' },
    { tag: 'sans-sel', title: 'Sans sel' },
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Texte complet d'une recette (titre + description + étapes + ingrédients), mis en
 * cache : 30 thèmes × 600 recettes = 18 000 appels, le recalcul coûterait ~100 ms.
 */
const textCache = new WeakMap<Recipe, { full: string; normFull: string }>();
function recipeText(recipe: Recipe) {
    let entry = textCache.get(recipe);
    if (!entry) {
        const full = `${recipe.title || ''} ${recipe.description || ''} ${(recipe.steps || []).join(' ')} ${(recipe.ingredients || [])
            .map((i) => i.name)
            .join(' ')}`.toLowerCase();
        entry = { full, normFull: norm(full) };
        textCache.set(recipe, entry);
    }
    return entry;
}

/**
 * Une recette appartient-elle au thème `tag` ?
 * Port fidèle des règles de l'accueil mobile (heuristiques titre/tags/ingrédients).
 */
export function matchesTag(
    recipe: Recipe,
    tag: string,
    /**
     * Certains thèmes excluent des catégories pour garder les rangées propres
     * (« Express » écarte les desserts). Quand l'utilisateur coche LUI-MÊME une
     * catégorie dans les filtres, ces garde-fous n'ont plus lieu d'être : il a
     * demandé un dessert express en connaissance de cause.
     */
    opts?: { ignoreCategoryGuards?: boolean }
): boolean {
    const guards = !opts?.ignoreCategoryGuards;
    const tagLower = tag.toLowerCase();
    const recipeTags = (recipe.tags || []).map((t) => t.toLowerCase());
    const recipeCat = (recipe.category || '').toLowerCase();
    const titleLower = (recipe.title || '').toLowerCase();
    const { full: fullText, normFull } = recipeText(recipe);

    if (tagLower === 'boissons') {
        return (
            recipeCat === 'boissons' ||
            recipeTags.some((t) => t.includes('boisson') || t.includes('cocktail') || t.includes('jus') || t.includes('rafra')) ||
            ['boisson', 'cocktail', 'jus', 'smoothie', 'mojito', 'limonade', 'café', 'thé'].some((k) => titleLower.includes(k))
        );
    }

    if (tagLower === 'vegetarien') {
        if (recipeTags.some((t) => t.includes('végé') || t.includes('vege') || t.includes('vegetarien')) || recipeCat === 'vegetarien') return true;
        const meat = ['poulet', 'bœuf', 'boeuf', 'porc', 'veau', 'agneau', 'canard', 'dinde', 'saucisse', 'chorizo', 'lardon', 'jambon', 'poisson', 'saumon', 'thon', 'crevette', 'cabillaud', 'fruits de mer'];
        const hasMeat = meat.some((m) => fullText.includes(m));
        const isSweet =
            ['gâteau', 'cake', 'tarte', 'chocolat', 'sucre', 'dessert', 'patisserie', 'glace'].some((s) => titleLower.includes(s)) ||
            ['desserts', 'patisserie', 'glaces'].includes(recipeCat);
        return !hasMeat && !isSweet;
    }

    if (tagLower === 'glaces') {
        return (
            recipeCat === 'glaces' ||
            recipeTags.some((t) => t.includes('glace') || t.includes('sorbet')) ||
            ['glace', 'sorbet', 'crème glacée', 'bûche glacée'].some((k) => titleLower.includes(k))
        );
    }

    if (tagLower === 'famille' || tagLower === 'familial') {
        if (recipeTags.some((t) => t === 'famille' || t === 'familial') || titleLower.includes('familial') || titleLower.includes('famille')) return true;
        if (!(fullText.includes('four') && (recipe.servings || 0) >= 4)) return false;
        return !guards || !['desserts', 'patisserie', 'glaces', 'boissons', 'aperitifs', 'sauces'].includes(recipeCat);
    }

    if (tagLower === 'express') {
        if (recipeTags.some((t) => t === 'express' || t === 'rapide') || titleLower.includes('express') || titleLower.includes('rapide')) return true;
        // Durée ESTIMÉE depuis les étapes (les champs WP valent 45 min partout,
        // ce qui rendait ce test toujours faux).
        const total = totalMinutes(recipe);
        if (total <= 0 || total > 30) return false;
        return !guards || !['desserts', 'patisserie', 'glaces', 'boissons', 'sauces'].includes(recipeCat);
    }

    if (tagLower === 'pas cher' || tagLower === 'pas-cher') {
        if (recipeTags.some((t) => t === 'pas cher' || t === 'pas-cher') || titleLower.includes('pas cher')) return true;
        const cheap = ['pâtes', 'pasta', 'riz', 'pommes de terre', 'patate', 'oeuf', 'œuf', 'lentilles', 'haricots'];
        const pricey = ['bœuf', 'boeuf', 'agneau', 'saumon', 'truffe', 'caviar', 'foie gras', 'veau'];
        if (!cheap.some((k) => titleLower.includes(k) || fullText.includes(k))) return false;
        if (pricey.some((k) => fullText.includes(k))) return false;
        return !guards || !['desserts', 'patisserie', 'glaces', 'boissons', 'sauces'].includes(recipeCat);
    }

    if (tagLower === 'pates') {
        const pasta = ['pâtes', 'pasta', 'spaghetti', 'tagliatelle', 'linguine', 'penne', 'rigatoni', 'lasagne', 'gnocchi', 'fettuccine', 'carbonara', 'bolognese', 'bolognaise', 'tortellini', 'ravioli', 'macaroni'];
        return recipeTags.some((t) => t === 'pates' || t === 'pâtes') || recipeCat === 'pates' || pasta.some((k) => titleLower.includes(k));
    }

    if (tagLower === 'dolce-vita') {
        return recipeTags.some((t) => t === 'italie' || t === 'italy') || recipeCat === 'italie';
    }

    if (tagLower === 'pâques' || tagLower === 'paques') {
        return recipeTags.some((t) => /p[âa]ques/i.test(t)) || /p[âa]ques/i.test(fullText);
    }
    if (tagLower === 'noël' || tagLower === 'noel') {
        return recipeTags.some((t) => /no[eë]l/i.test(t)) || /no[eë]l/i.test(fullText);
    }

    if (tagLower === 'voila-lete') {
        return (
            recipeTags.some((t) => /voila.?l.?[eé]t[eé]/i.test(t) || t === 'voila-lete' || /[eé]t[eé]|estival|barbecue|soleil|frais/i.test(t)) ||
            /[eé]t[eé]|estival|barbecue|soleil|grillad/i.test(titleLower)
        );
    }
    if (tagLower === 'cest-lhiver') {
        return (
            recipeTags.some((t) => /hiver|hivernal|chaud|r[eé]confort/i.test(t) || t === 'cest-lhiver') ||
            /hiver|hivernal|chaud|r[eé]confort|mijoté|fondue/i.test(titleLower)
        );
    }

    // Thèmes stricts : tag explicite ou catégorie (barbecue exclut les sauces).
    if (['sauces', 'airfryer', 'barbecue', 'healthy', 'simplissime', 'astuces'].includes(tagLower)) {
        if (tagLower === 'barbecue' && recipeTags.some((t) => t === 'sauces')) return false;
        return recipeCat === tagLower || recipeTags.some((t) => t === tagLower);
    }

    if (tagLower === 'salades') {
        return recipeTags.some((t) => t.startsWith('salade')) || /\bsalade(s)?\b/.test(fullText);
    }
    if (tagLower === 'soupes') {
        return recipeTags.some((t) => t.startsWith('soupe')) || /\b(soupe(s)?|velout[ée](s)?|gaspacho|potage|minestrone|ramen)\b/.test(titleLower);
    }
    if (tagLower === 'gratins') {
        return recipeTags.some((t) => t.startsWith('gratin')) || /\bgratin(s|[ée]e?)?\b/.test(fullText);
    }
    if (tagLower === 'epice' || tagLower === 'épicé') {
        return (
            recipeTags.some((t) => /^[ée]pic/.test(t)) ||
            /\b([ée]pic[ée]?|piquant|piment|harissa|sambal|sriracha|jalape[ñn]o|habanero|chili)\b/.test(fullText)
        );
    }
    if (tagLower === 'tarte' || tagLower === 'tartes') {
        return (
            recipeTags.some((t) => /\b(tarte|quiche|pizza)/.test(t)) ||
            /\b(tarte(let)?(te)?s?|quiches?|pizz?as?|pissaladi[èe]re|flammenk[uü]che|tourtes?)\b/.test(titleLower)
        );
    }
    if (tagLower === 'poissons') {
        return (
            recipeTags.some((t) => /poisson|crustac|fruits de mer/.test(t)) ||
            /\b(poissons?|saumon|thon|cabillaud|colin|merlu|lieu|dorade|daurade|sardines?|maquereau|truite|sole|bar\b|loup de mer|crevettes?|gambas|moules?|saint[- ]jacques|st[- ]jacques|crabe|homard|langoustines?|calamars?|encornets?|poulpe|seiche|hu[îi]tres?|fruits de mer|crustac[ée]s?)\b/.test(titleLower)
        );
    }
    if (tagLower === 'sandwich' || tagLower === 'sandwichs') {
        return (
            recipeTags.some((t) => t.startsWith('sandwich')) ||
            /\b(sandwichs?|burgers?|wraps?|paninis?|croque[- ](monsieur|madame)|bagels?|hot[- ]dogs?|kebab|pita|club|tacos|pan bagnat)\b/.test(titleLower)
        );
    }

    // ── Régimes : PREUVE EXPLICITE UNIQUEMENT ──────────────────────────────
    // L'accueil actuel déduit ces thèmes par ABSENCE de mot-clé interdit, ce qui
    // range un tiramisu dans « Sans sel » et la moitié du catalogue dans
    // « Sans gluten ». Ici on exige que la recette se déclare : tag, titre,
    // description, étape ou ingrédient qui dit « sans gluten », « sans lactose »…
    const DIET_PATTERNS: Record<string, RegExp> = {
        'sans-gluten': /sans[\s-]?gluten|gluten[\s-]?free/,
        'sans-lactose': /sans[\s-]?lactose|sans[\s-]?produits?[\s-]?laitiers?|lactose[\s-]?free/,
        'sans-sucre': /sans[\s-]?sucre(s)?[\s-]?(ajout[ée]s?)?|sugar[\s-]?free/,
        'sans-sel': /sans[\s-]?sel|pauvre en sel|hyposod/,
    };
    const dietPattern = DIET_PATTERNS[tagLower];
    if (dietPattern) {
        return dietPattern.test(normFull) || recipeTags.some((t) => dietPattern.test(norm(t)));
    }

    if (tagLower === 'minceur') {
        // Idem : la recette doit se présenter comme légère (titre, description ou
        // tag), pas simplement « ne pas contenir de beurre ».
        const claim = /minceur|hypocalorique|all[ée]g[ée]|l[ée]g[èe]re?\b/;
        const declared =
            recipeTags.some((t) => claim.test(norm(t))) ||
            claim.test(norm(recipe.title || '')) ||
            claim.test(norm(recipe.description || ''));
        if (!declared) return false;
        // Un « gâteau léger » reste un gâteau : les catégories sucrées sortent…
        // sauf si l'utilisateur a explicitement coché une catégorie.
        return !guards || !['desserts', 'patisserie', 'glaces', 'boissons', 'sauces'].includes(recipeCat);
    }

    // Repli générique : texte, catégorie ou tag (avec et sans accents).
    const normTag = norm(tagLower);
    return (
        fullText.includes(tagLower) ||
        normFull.includes(normTag) ||
        recipeCat === tagLower ||
        norm(recipeCat) === normTag ||
        recipeTags.some((t) => t === tagLower || norm(t) === normTag)
    );
}
