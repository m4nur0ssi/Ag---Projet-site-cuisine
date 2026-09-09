// Thématiques de l'accueil « Apple TV+ » — TEST DE DESIGN (route /tv).
//
// Les anciennes tuiles illustrées (/images/themes/*.png) sont abandonnées ici :
// chaque thème devient une rangée de vraies recettes, avec leurs propres photos.
// Les règles de correspondance sont reprises de l'accueil mobile actuel
// (src/mobile/screens/page.tsx) pour que les résultats restent identiques.

import { Recipe } from '@/mobile/types';
import { totalMinutes, timedMinutes } from './timing';

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
    // Deux rangées de boissons, et deux seulement : « Cocktails » = avec alcool,
    // « Rafraîchissements » = tout le reste, sans alcool.
    { tag: 'cocktail', title: 'Cocktails' },
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
 * Nom d'une collection (rangée, page « Voir tout », entrée du menu) → tag
 * partageable, ou `null` si ce n'en est pas une (« Nouveautés », « Top 10 »…).
 *
 * Partager une collection doit annoncer LA collection d'où l'on vient. Le menu
 * ne connaissait que la recette cliquée : depuis « Voilà l'été », la carte
 * sortait « Plat » ou « Entrée » — la catégorie de cette recette-là.
 */
const COLLECTION_TAGS: Record<string, string> = {
    aperitif: 'aperitifs', aperitifs: 'aperitifs',
    entree: 'entrees', entrees: 'entrees',
    plat: 'plats', plats: 'plats',
    accompagnement: 'accompagnements', accompagnements: 'accompagnements',
    dessert: 'desserts', desserts: 'desserts',
    patisserie: 'patisserie', patisseries: 'patisserie',
    glace: 'glaces', glaces: 'glaces',
    boisson: 'boissons', boissons: 'boissons',
    sauce: 'sauces', sauces: 'sauces',
    'comme au resto': 'restaurant', restaurant: 'restaurant',
    afrique: 'afrique', asie: 'asie', espagne: 'espagne', france: 'france',
    grece: 'grece', italie: 'italie', liban: 'liban', mexique: 'mexique',
    orient: 'orient', usa: 'usa',
};

/**
 * Les tags que `collectionTagOf` sait produire. Sert au script de build à
 * pré-calculer l'appartenance : il doit couvrir TOUS les tags qu'une vue peut
 * demander, sinon une rangée se viderait sans prévenir.
 */
export const COLLECTION_TAGS_VALEURS = [...new Set(Object.values(COLLECTION_TAGS))];

/** Les tags des rangées thématiques — servent à écarter les fiches restaurant. */
const THEME_TAGS = new Set(THEMES.map((t) => t.tag));

export function collectionTagOf(label: string): string | null {
    const n = norm((label || '').toLowerCase()).trim();
    if (!n) return null;
    const theme = THEMES.find((t) => norm(t.title.toLowerCase()) === n || t.tag === n);
    if (theme) return theme.tag;
    return COLLECTION_TAGS[n] || null;
}

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
/**
 * Recette salée rangée par erreur en pâtisserie/dessert (tiramisu salé,
 * cheesecake salé, tarte protéinée…). On la reconnaît au titre.
 */
/**
 * Les tags WordPress sont posés à la louche : « Les Glaces » sur une tarte
 * normande, « Sauces » sur des brochettes de poulet, « Sandwichs » sur un riz
 * façon kebab. Un tag ne suffit donc plus à décider d'une rangée : le TITRE
 * doit dire de quoi il s'agit. Les expressions ci-dessous se lisent sur un
 * titre SANS accents (`norm`).
 */
/** Titre qui annonce vraiment une glace / un sorbet. */
export const ICE_TITLE = /\b(glaces?|glacee?s?|sorbets?|sorbetto|granites?|esquimaux?|mcflurry|milkshakes?|semifreddo|popsicles?|frozen|vacherin)\b/;
/** Titre qui annonce vraiment une sauce, un dip ou un condiment. */
export const SAUCE_TITLE = /\b(sauces?|dips?|tartinades?|vinaigrettes?|marinades?|mayonnaises?|pestos?|tzatzikis?|guacamole|aiolis?|tapenades?|coulis|chimichurri|bearnaise|hollandaise|ketchup|pico de gallo|remoulade|chermoula|toum|ktipiti|houmous|hummus|raita|beurre|creme (?:epaisse|ciboulette|fraiche)|huile pimentee)\b/;
/** Titre qui annonce vraiment un sandwich (pain garni, tenu à la main). */
export const SANDWICH_TITLE = /\b(sandwichs?|burgers?|cheeseburgers?|wraps?|paninis?|croque[- ]?(?:monsieur|madame|mcdo)|bagels?|hot[- ]?dogs?|kebabs?|pitas?|tacos?|fajitas?|shawarmas?|banh mi|pan bagnat)\b/;
/**
 * …mais ces mots-là racontent autre chose qu'un sandwich : une assiette
 * (« Riz façon kebab », « Burger Bowl »), une salade, ou la recette du PAIN
 * lui-même (« Pain spécial pita », « Pain burger pliable »).
 */
export const NOT_SANDWICH_TITLE = /^(?:pains?|pate|pates|brioches?)\b|\b(?:bowls?|riz|assiettes?|salades?|soupes?|gratins?)\b/;
/** Titre qui annonce vraiment une salade. */
export const SALAD_TITLE = /\b(salades?|taboules?|taboulehs?|tabbouleh|insalata|coleslaw|shirazi)\b/;

/** Ingrédients et plats franchement salés — s'ils sont dans le TITRE d'une
 *  « pâtisserie », c'est un rangement raté (tarte tatin aux aubergines…). */
export const SAVORY_TITLE = new RegExp(
    '\\b(aubergines?|courgettes?|poireaux?|thon|saumon|truite|sardines?|anchois|crabe|crevettes?'
    + '|jambon|lardons?|bacon|chorizo|saucisses?|poulet|dinde|boeuf|veau|agneau|porc'
    + '|chevre|roquefort|feta|mozzarella|comte|gruyere|parmesan|raclette|reblochon'
    + '|epinards?|poivrons?|oignons?|echalotes?|tomates?|champignons?|brocolis?|chou[- ]fleur|courges?'
    + '|potiron|butternut|betteraves?|petits? pois|lentilles?|pois chiches?'
    + '|quiches?|pizzas?|croque|feuillete au|cake aux? (olives?|lardons?|thon)'
    + '|olives?|pesto|moutarde|curry|chevre)\\b'
);

/**
 * Recette salée rangée par erreur en pâtisserie/dessert (tiramisu salé,
 * cheesecake salé au thon, tarte tatin aux aubergines, tarte protéinée…).
 * On la reconnaît à son titre.
 */
/**
 * Recettes de l'accueil : leur appartenance aux rangées est calculée au build
 * (scripts/build-home-data.js) par CES fonctions-ci, ce qui permet de ne plus
 * embarquer étapes ni ingrédients — ils ne servaient qu'à composer le texte
 * fouillé ci-dessous. Une recette venue d'ailleurs (desktop, fiche, planning)
 * n'a pas ces champs et suit l'ancien chemin, intact.
 */
type PreCalculee = Recipe & { tagsStricts?: string[]; tagsLarges?: string[]; sale?: boolean };

export function isSavoryMiscat(recipe: Recipe): boolean {
    const pre = (recipe as PreCalculee).sale;
    if (pre !== undefined) return pre;
    const cat = (recipe.category || '').toLowerCase();
    if (!['patisserie', 'desserts', 'glaces'].includes(cat)) return false;
    // Sans accents : `\b` ne reconnaît pas « é » comme une lettre, si bien que
    // /\bsalée?\b/ ne trouvait JAMAIS « salé » — d'où les cheesecakes au thon
    // restés en desserts.
    const t = norm((recipe.title || '').toLowerCase());
    if (/protein/.test(t)) return true;
    // « caramel au beurre salé », « cacahuètes salées » : sucré malgré le mot.
    const sweetSalt = /caramel|beurre|cacahu|pistache|amande|noisette|chocolat|popcorn|pop[- ]corn/.test(t);
    if (!sweetSalt && /\bsalee?s?\b/.test(t)) return true;
    return SAVORY_TITLE.test(t);
}

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
    const pre = recipe as PreCalculee;
    if (pre.tagsStricts && pre.tagsLarges) {
        const liste = opts?.ignoreCategoryGuards ? pre.tagsLarges : pre.tagsStricts;
        return liste.includes(tag.toLowerCase());
    }
    const guards = !opts?.ignoreCategoryGuards;
    const tagLower = tag.toLowerCase();
    const recipeTags = (recipe.tags || []).map((t) => t.toLowerCase());
    const recipeCat = (recipe.category || '').toLowerCase();
    const titleLower = (recipe.title || '').toLowerCase();
    const { full: fullText, normFull } = recipeText(recipe);
    const normTitle = norm(titleLower);

    // Une fiche restaurant n'est pas une recette : elle n'a rien à faire dans
    // une rangée thématique. « Le club des cinq » tombait dans les Sandwichs
    // (le mot « club »), « Bistrot à Burger » aussi, et « Le Balthazar » dans
    // les Salades — le texte de la fiche parle de salade, forcément.
    if (recipeCat === 'restaurant' && tagLower !== 'restaurant' && THEME_TAGS.has(tagLower)) return false;

    // Recettes salées mal rangées en pâtisserie (tiramisu salé, cheesecake salé,
    // tarte protéinée…) : on les sort des vues sucrées.
    if ((tagLower === 'patisserie' || tagLower === 'desserts') && isSavoryMiscat(recipe)) return false;

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
        // Le tag « Les Glaces » de WordPress traîne sur des tartes, des
        // pancakes et des cheesecakes : il ne décide plus rien tout seul.
        if (recipeCat === 'glaces') return true;
        // « Thé glacé » est une boisson : le rayon des glaces n'en veut pas.
        return recipeCat !== 'rafraichissements' && ICE_TITLE.test(normTitle);
    }

    if (tagLower === 'famille' || tagLower === 'familial') {
        if (recipeTags.some((t) => t === 'famille' || t === 'familial') || titleLower.includes('familial') || titleLower.includes('famille')) return true;
        if (!(fullText.includes('four') && (recipe.servings || 0) >= 4)) return false;
        return !guards || !['desserts', 'patisserie', 'glaces', 'boissons', 'aperitifs', 'sauces'].includes(recipeCat);
    }

    if (tagLower === 'express') {
        // « Express » est une PROMESSE de durée : on ne l'accorde qu'aux recettes
        // qui disent leur temps. Une étape chronométrée au moins (cuisson, repos,
        // frigo, levée) ; sinon la recette sort, quoi qu'annonce son titre.
        // Le raccourci d'avant — titre ou tag contenant « express » / « rapide » —
        // passait outre le chronomètre et gonflait la rangée à 325 recettes sur
        // 617 : un thème qui contient la moitié du site ne trie plus rien.
        if (timedMinutes(recipe) <= 0) return false;
        // Préparation + cuisson (repos et frigo compris), strictement sous 30 min.
        if (totalMinutes(recipe) >= 30) return false;
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
        // Le tag, ou la recette qui se présente elle-même comme un plat de
        // Pâques. Chercher le mot dans les ÉTAPES faisait entrer n'importe quoi.
        if (recipeTags.some((t) => /p[âa]ques/i.test(t))) return true;
        return /p[âa]ques/i.test(`${recipe.title || ''} ${recipe.description || ''}`);
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

    // Les boissons se partagent en DEUX rangées, et deux seulement :
    //   • « Cocktails »          = boisson AVEC alcool ;
    //   • « Rafraîchissements »  = toutes les autres boissons, SANS alcool
    //     (mocktails, smoothies, jus, thés glacés, limonades…).
    // L'alcool est cherché dans le TEXTE COMPLET (titre + description +
    // ingrédients + étapes), pas seulement dans le titre.
    // `cocktail-sans-alcool` reste accepté : d'anciens raccourcis épinglés dans
    // la Bibliothèque portent encore ce jeton, il pointe désormais la même
    // rangée que « Rafraîchissements ».
    if (tagLower === 'cocktail' || tagLower === 'cocktail-sans-alcool' || tagLower === 'boissons') {
        // Vrais cocktails (avec ou sans alcool selon la préparation).
        const cocktailWords = /\b(cocktails?|mojitos?|margaritas?|daiquiris?|spritz(er)?|mimosas?|sangrias?|punchs?|cosmopolitans?|colada|caipirinhas?|negronis?|bloody mary|mai[- ]?tai|cuba libre|gin[- ]?tonic|tequila sunrise|sex on the beach|mocktails?|virgin|piscine|americano|bellini|kir|sangria)\b/;
        // Boissons fraîches non alcoolisées → rangée « sans alcool » (pour la garnir).
        const softWords = /\b(smoothies?|milkshakes?|frapp[ée]s?|limonades?|jus\b|nectar|the glac[ée]|th[ée] glac[ée]|iced tea|granit[ée]s?|slush|infusion glac[ée]e|eau infus[ée]e|lassi)\b/;
        const alcohol = /\b(rhum|vodkas?|gin|t[ée]quilas?|whiskys?|whiskey|cognac|liqueurs?|cura[cç]ao|cointreau|triple[- ]sec|aperol|campari|martini|vermouth|prosecco|champagne|vin[- ](blanc|rouge|ros[ée]|mousseux|p[ée]tillant)|ros[ée]|bi[èe]res?|cidre|kahlua|baileys|amaretto|malibu|limoncello|porto|absinthe|calvados|armagnac|marsala|sak[ée]|pastis|ricard|schnaps|grand marnier|chartreuse|alcool|liquor|spirit)\b/;
        // « Sans alcool », « vierge », « virgin », « mocktail » : le mot « alcool »
        // de « sans alcool » déclenchait le test et envoyait les mocktails chez
        // les cocktails. La négation prime sur tout le reste.
        const noAlcohol = /\b(sans[ -]alcool|vierge|virgin|mocktails?|sans[ -]rhum|sans[ -]vodka)\b/
            .test(normFull);
        // Un mojito reste un mojito même si la recette ne nomme pas le rhum :
        // les cocktails classiquement alcoolisés comptent comme tels.
        const boozyNames = /\b(mojitos?|margaritas?|daiquiris?|spritz(er)?|negronis?|caipirinhas?|cosmopolitans?|bloody mary|cuba libre|gin[- ]?tonic|tequila sunrise|sex on the beach|mai[- ]?tai|colada|sangrias?|bellini|americano|mimosas?|aperol|spritz)\b/;
        const hasAlcohol = !noAlcohol && (alcohol.test(normFull) || boozyNames.test(norm(titleLower)));
        const isCocktail =
            recipeTags.some((t) => /cocktail|mojito|mocktail/.test(norm(t))) ||
            cocktailWords.test(norm(titleLower)) ||
            (recipeCat === 'boissons' && cocktailWords.test(normFull));
        const isSoft = softWords.test(norm(titleLower)) || (recipeCat === 'boissons' && softWords.test(normFull));
        // Est-ce une boisson, tout court ? (la catégorie du site fait foi, sinon
        // les tags, sinon les mots du titre).
        // Indices FAIBLES (« café », « thé », « jus » dans le titre) : ils ne
        // valent que hors des catégories de plats, sinon un « gâteau petit
        // beurre café chocolat » finissait en rafraîchissement.
        const looseDrink =
            recipeTags.some((t) => /boisson|cocktail|jus|rafra/.test(norm(t))) ||
            /\b(boissons?|jus|smoothies?|limonades?|cafes?|thes?|infusions?|sirops?|chocolat chaud)\b/.test(norm(titleLower));
        const isDrink =
            recipeCat === 'boissons' ||
            isCocktail ||
            isSoft ||
            (looseDrink && !['desserts', 'patisserie', 'glaces', 'plats', 'entrees', 'accompagnements', 'sauces', 'restaurant'].includes(recipeCat));

        if (tagLower === 'cocktail') return isDrink && hasAlcohol;
        return isDrink && !hasAlcohol;
    }

    if (tagLower === 'sauces') {
        // Le tag « Sauces » est posé sur tout plat QUI VIENT AVEC une sauce —
        // brochettes de poulet, tataki de saumon, poisson-frites. Une sauce se
        // reconnaît à son titre, et au fait qu'elle l'ouvre : « Sauce Roquefort »
        // en est une, « Kefta de poisson, sauce yaourt menthe » est un plat.
        if (recipeCat !== 'sauces' || SALAD_TITLE.test(normTitle)) return false;
        return SAUCE_TITLE.test(normTitle.split(/\s+/).slice(0, 3).join(' '));
    }

    // Thèmes stricts : tag explicite ou catégorie (barbecue exclut les sauces).
    if (['airfryer', 'barbecue', 'healthy', 'simplissime', 'astuces'].includes(tagLower)) {
        if (tagLower === 'barbecue' && recipeTags.some((t) => t === 'sauces')) return false;
        return recipeCat === tagLower || recipeTags.some((t) => t === tagLower);
    }

    if (tagLower === 'salades') {
        // Le texte complet (étapes + ingrédients) rangeait ici tout ce qui
        // contient de la salade : sandwichs, wraps, nems, moussaka. Le titre et
        // le tag décident, et un sandwich reste un sandwich.
        if (SANDWICH_TITLE.test(normTitle)) return false;
        // Une vinaigrette porte souvent le tag « Salades » : elle reste au rayon
        // des sauces, on ne sert pas un bol de vinaigrette.
        if (recipeCat === 'sauces' && SAUCE_TITLE.test(normTitle)) return false;
        return recipeTags.some((t) => t.startsWith('salade')) || SALAD_TITLE.test(normTitle);
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
        // Ici, rien que du pain garni. Le tag WordPress ne passe plus en force :
        // « Riz façon kebab » et « Crispy Chicken Burger Bowl » sont des
        // assiettes, « Pain spécial pita » est une recette de pain.
        if (NOT_SANDWICH_TITLE.test(normTitle)) return false;
        return SANDWICH_TITLE.test(normTitle) || recipeTags.some((t) => t.startsWith('sandwich'));
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
