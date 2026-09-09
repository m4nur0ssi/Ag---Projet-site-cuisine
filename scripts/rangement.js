/**
 * Les règles de rangement, en un seul exemplaire.
 * ==============================================
 *
 * Ce qui décide qu'une recette est une glace, une sauce, un sandwich ou une
 * salade vit dans `src/mobile/screens/tv/themes.ts` — le fichier que lisent
 * l'accueil mobile ET le desktop. Ce module ne fait que le charger pour les
 * scripts Node (la synchro WordPress, le rangement de `mockData.ts`) : recopier
 * les expressions ici serait le meilleur moyen de les voir diverger.
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const RACINE = path.join(__dirname, '..');
const cache = new Map();

function resoudre(base) {
    for (const suffixe of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
        const essai = base + suffixe;
        if (fs.existsSync(essai) && fs.statSync(essai).isFile()) return essai;
    }
    throw new Error(`module introuvable : ${base}`);
}

function chargerTS(fichier) {
    const chemin = resoudre(fichier);
    if (cache.has(chemin)) return cache.get(chemin);
    const js = ts.transpileModule(fs.readFileSync(chemin, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
    }).outputText;
    const module = { exports: {} };
    cache.set(chemin, module.exports);
    const requerir = (spec) => {
        if (spec.startsWith('@/')) return chargerTS(path.join(RACINE, 'src', spec.slice(2)));
        if (spec.startsWith('.')) return chargerTS(path.join(path.dirname(chemin), spec));
        return require(spec);
    };
    new Function('exports', 'module', 'require', js)(module.exports, module, requerir);
    cache.set(chemin, module.exports);
    return module.exports;
}

const themes = chargerTS(path.join(RACINE, 'src/mobile/screens/tv/themes.ts'));

/** Titre sans accents ni majuscules — la forme que lisent les expressions. */
const sansAccents = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Est-ce vraiment une glace ? (le tag WordPress ne suffit pas) */
const estGlace = (titre) => themes.ICE_TITLE.test(sansAccents(titre));

/**
 * Est-ce vraiment une sauce ? Le mot doit OUVRIR le titre : « Sauce Roquefort »
 * en est une, « Kefta de poisson, sauce yaourt menthe » est un plat.
 */
const estSauce = (titre) =>
    !themes.SALAD_TITLE.test(sansAccents(titre)) &&
    themes.SAUCE_TITLE.test(sansAccents(titre).split(/\s+/).slice(0, 3).join(' '));

/**
 * Où va une recette sortie des glaces ou des sauces ? Son titre le dit :
 * une tarte et un cheesecake vont en pâtisserie, une salade en entrée, le
 * reste au rayon des plats.
 */
function categoriePourTitre(titre, tags = []) {
    const t = sansAccents(titre);
    const tagsBas = tags.map((x) => sansAccents(x));
    // Un tag « Apéritifs » posé à la main est le renseignement le plus sûr.
    if (tagsBas.includes('aperitifs') || tagsBas.includes('aperitif')) return 'aperitifs';
    const sale = themes.SAVORY_TITLE.test(t);
    // Le salé passe devant : « Beignets de courgettes à la feta » n'est pas une
    // pâtisserie, et une « Mousse d'avocat » n'est pas un dessert.
    if (!sale) {
        if (/\b(tartes?|tartelettes?|cheesecakes?|gateaux?|pavlova|crumbles?|pancakes?|madeleines?|cookies?|muffins?|brownies?|cupcakes?|donuts?|churros?)\b/.test(t)
            || tagsBas.includes('patisserie')) return 'patisserie';
        if (/\b(chocolat|tiramisu|mousse|compotee?|panna cotta|riz au lait|dessert)\b/.test(t)) return 'desserts';
    }
    if (themes.SALAD_TITLE.test(t)) return 'entrees';
    if (tagsBas.includes('aperitifs') || tagsBas.includes('aperitif')) return 'aperitifs';
    if (tagsBas.includes('entrees') || tagsBas.includes('entree')) return 'entrees';
    return 'plats';
}

/**
 * Tags franchement faux, posés sur WordPress et impossibles à deviner par une
 * règle : une harira marocaine et un DIBI sénégalais étiquetés « Pâques ».
 * Retirés à la synchro comme au rangement — sinon ils reviendraient.
 */
const TAGS_A_RETIRER = {
    5567: ['Pâques'], // Harira marocaine — soupe de Ramadan, pas de Pâques.
    6108: ['Pâques'], // DIBI sénégalais — grillade, pas de Pâques.
};

module.exports = { chargerTS, sansAccents, estGlace, estSauce, categoriePourTitre, TAGS_A_RETIRER, themes };
