/**
 * Données allégées pour l'accueil mobile.
 * ======================================
 *
 * L'accueil chargeait le catalogue ENTIER — 1,36 Mo de JSON, dont 78 % ne sert
 * qu'une fois une fiche ouverte. Sur un téléphone, ce n'est pas le
 * téléchargement qui coûte (264 ko gzip passent vite) mais le parse et
 * l'exécution de 1,5 Mo de JavaScript sur le thread qui doit répondre au doigt.
 *
 * Ce script découpe le catalogue en trois :
 *
 *   • `home-recipes.ts` — ce que l'accueil affiche vraiment, sans les étapes,
 *     les ingrédients ni le HTML d'embed. À la place, les RÉPONSES aux questions
 *     que l'accueil posait à ces champs : `tiktokId` (l'embed n'était lu que
 *     pour ça), `est` et `timed` (temps et difficulté, que le code recalculait
 *     en relisant les étapes des 662 recettes à chaque démarrage), et
 *     `tagsStricts` / `tagsLarges` / `sale` (l'appartenance aux rangées
 *     thématiques, que `themes.ts` décidait en cherchant « poulet » ou « sans
 *     gluten » dans un texte composé des étapes et des ingrédients) ;
 *   • `home-details.ts` — étapes et ingrédients, chargés une fois l'accueil
 *     peint et recollés à l'ouverture d'une fiche ;
 *   • `home-videos.ts` — les embeds, même traitement.
 *
 * Tous les pré-calculs appellent LES FONCTIONS DE L'APPLICATION, jamais une
 * copie de leurs règles : `timing.ts` et `themes.ts` utilisent le champ
 * pré-calculé quand il est là et retombent sur l'ancien chemin sinon, si bien
 * que le desktop, les fiches et le planning ne bougent pas d'un pixel.
 *
 * Lancé par `prebuild`, donc régénéré après chaque synchronisation WordPress —
 * le bot réécrit `mockData.ts` et ne connaît rien à ce fichier.
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const RACINE = path.join(__dirname, '..');
const SOURCE = path.join(RACINE, 'src/mobile/data/mockData.ts');
const SORTIE = path.join(RACINE, 'src/mobile/data/home-recipes.ts');
const VIDEOS = path.join(RACINE, 'src/mobile/data/home-videos.ts');
const DETAILS = path.join(RACINE, 'src/mobile/data/home-details.ts');
const THEMES_MOD = path.join(RACINE, 'src/mobile/screens/tv/themes.ts');
const FILTRES = path.join(RACINE, 'src/mobile/screens/tv/filters.ts');
const TIMING = path.join(RACINE, 'src/lib/recipe-timing.ts');

/**
 * Charge un module TypeScript du projet sans dépendance de build : transpile,
 * évalue, et résout lui-même les imports — les alias `@/` comme les chemins
 * relatifs. Indispensable : les règles qu'on pré-calcule vivent dans le code de
 * l'application, et les recopier ici serait le meilleur moyen de les voir
 * diverger en silence.
 */
const cacheModules = new Map();
function chargerTS(fichier) {
    const chemin = resoudre(fichier);
    if (cacheModules.has(chemin)) return cacheModules.get(chemin);
    const js = ts.transpileModule(fs.readFileSync(chemin, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
    }).outputText;
    const module = { exports: {} };
    cacheModules.set(chemin, module.exports);
    const requerir = (spec) => {
        if (spec.startsWith('@/')) return chargerTS(path.join(RACINE, 'src', spec.slice(2)));
        if (spec.startsWith('.')) return chargerTS(path.join(path.dirname(chemin), spec));
        return require(spec);
    };
    new Function('exports', 'module', 'require', js)(module.exports, module, requerir);
    cacheModules.set(chemin, module.exports);
    return module.exports;
}

/** Ajoute l'extension manquante (.ts, .tsx, /index.ts) comme le ferait bundler. */
function resoudre(base) {
    for (const suffixe of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
        const essai = base + suffixe;
        if (fs.existsSync(essai) && fs.statSync(essai).isFile()) return essai;
    }
    throw new Error(`module introuvable : ${base}`);
}

/** Le tableau de recettes, extrait du fichier généré par la synchro WordPress. */
function lireRecettes() {
    const src = fs.readFileSync(SOURCE, 'utf8');
    const debut = src.indexOf('= [', src.indexOf('mockRecipes')) + 2;
    const fin = src.lastIndexOf('];') + 1;
    return JSON.parse(src.slice(debut, fin));
}

const { estimateRecipeTiming, sumStepMinutes } = chargerTS(TIMING);
const { THEMES, matchesTag, isSavoryMiscat, COLLECTION_TAGS_VALEURS } = chargerTS(THEMES_MOD);
const { COUNTRY_OPTIONS } = chargerTS(FILTRES);

/**
 * TOUS les tags qu'une vue peut demander : les rangées thématiques, les pays du
 * menu, et les libellés de collection (« Comme au resto », « Desserts »…) que
 * `collectionTagOf` traduit. Le pré-calcul doit couvrir cet univers en entier —
 * un tag oublié rendrait une rangée vide sans rien signaler.
 */
const universe = [...new Set([
    ...THEMES.map((t) => t.tag),
    ...COUNTRY_OPTIONS.map((o) => o.token.slice(2)),
    ...COLLECTION_TAGS_VALEURS,
])];

const recettes = lireRecettes();
const allegees = recettes.map((r) => {
    const { videoHtml, steps, ingredients, ...reste } = r;
    const id = String(videoHtml || '').match(/data-video-id="(\d+)"/)?.[1] || null;
    /*
     * Appartenance aux rangées, calculée ici par les fonctions de l'application
     * elles-mêmes. C'est ce qui permet de laisser étapes et ingrédients au
     * vestiaire : `themes.ts` s'en servait pour composer le texte où il cherche
     * « poulet » ou « sans gluten », soit 776 ko que le téléphone décodait pour
     * répondre par oui ou par non.
     *
     * Deux listes, parce que `matchesTag` répond différemment selon que
     * l'utilisateur a coché une catégorie lui-même (les garde-fous de catégorie
     * des thèmes sautent alors).
     */
    const strict = universe.filter((tag) => matchesTag(r, tag));
    const large = universe.filter((tag) => matchesTag(r, tag, { ignoreCategoryGuards: true }));
    return {
        ...reste,
        ...(id ? { tiktokId: id } : {}),
        est: estimateRecipeTiming(r.steps),
        timed: (r.steps || []).reduce((n, step) => n + sumStepMinutes(step), 0),
        tagsStricts: strict,
        tagsLarges: large,
        sale: isSavoryMiscat(r),
    };
});

/** Étapes et ingrédients : tout ce qui ne sert qu'une fois la fiche ouverte. */
const details = {};
for (const r of recettes) details[r.id] = { steps: r.steps || [], ingredients: r.ingredients || [] };

/*
 * Le HTML d'embed part dans son propre module, chargé seulement quand une fiche
 * s'ouvre. On le RECOPIE tel quel : les 662 recettes portent 27 gabarits
 * différents (certains citent la page du créateur, d'autres l'URL courte), donc
 * le reconstruire depuis le seul identifiant changerait le balisage.
 */
const videos = {};
for (const r of recettes) if (r.videoHtml) videos[r.id] = r.videoHtml;

/*
 * Les données partent en JSON.parse plutôt qu'en littéral d'objet : le moteur
 * lit du JSON nettement plus vite qu'il n'évalue le même objet écrit en
 * JavaScript, et c'est ce coût-là qui bloquait le thread au démarrage.
 *
 * Mesuré sur ce catalogue : la forme JSON.parse pèse 4 ko gzip de plus que le
 * même objet écrit en JavaScript — le prix de l'échappement des guillemets, et
 * une misère face au temps de parse gagné. Un essai avec String.raw pour éviter
 * cet échappement a fait DOUBLER le fichier : webpack ré-échappe la chaîne.
 */
const litteral = (donnees) => 'JSON.parse(' + JSON.stringify(JSON.stringify(donnees)) + ')';

const octets = (o) => JSON.stringify(o).length;
const avant = octets(recettes);
const apres = octets(allegees);

fs.writeFileSync(SORTIE, `import { Recipe } from '@/mobile/types';
import type { RecipeTiming } from '@/lib/recipe-timing';

/**
 * FICHIER GÉNÉRÉ — ne pas modifier à la main.
 * Produit par \`scripts/build-home-data.js\` (lancé par \`npm run prebuild\`)
 * à partir de \`src/mobile/data/mockData.ts\`.
 *
 * Voir l'en-tête du script pour ce qui est retiré et pourquoi.
 */
export type HomeRecipe = Recipe & {
    /** Identifiant de la vidéo TikTok, extrait de \`videoHtml\` au build. */
    tiktokId?: string;
    /** Temps et difficulté déjà calculés depuis les étapes. */
    est?: RecipeTiming;
    /** Minutes écrites noir sur blanc dans les étapes. */
    timed?: number;
};

export const homeRecipes: HomeRecipe[] = ${litteral(allegees)};
`);

fs.writeFileSync(VIDEOS, `/**
 * FICHIER GÉNÉRÉ — ne pas modifier à la main.
 * Produit par \`scripts/build-home-data.js\` (lancé par \`npm run prebuild\`).
 *
 * Le HTML d'embed TikTok, sorti du catalogue de l'accueil : il pèse un cinquième
 * du poids des données et ne sert que dans une fiche ouverte. L'accueil le
 * charge en tâche de fond une fois affiché.
 */
export const videoHtmlById: Record<string, string> = ${litteral(videos)};
`);

console.log(`home-recipes.ts — ${recettes.length} recettes, `
    + `${(avant / 1048576).toFixed(2)} Mo → ${(apres / 1048576).toFixed(2)} Mo `
    + `(${Math.round((1 - apres / avant) * 100)} % en moins)`);
fs.writeFileSync(DETAILS, `/**
 * FICHIER GÉNÉRÉ — ne pas modifier à la main.
 * Produit par \`scripts/build-home-data.js\` (lancé par \`npm run prebuild\`).
 *
 * Étapes et ingrédients des 662 recettes : les trois quarts du poids des
 * données, et rien de tout cela ne s'affiche sur l'accueil. Chargé en tâche de
 * fond une fois les rangées peintes, puis recollé sur la recette à l'ouverture
 * d'une fiche.
 */
import type { Ingredient } from '@/mobile/types';

export const detailById: Record<string, { steps: string[]; ingredients: Ingredient[] }> =
    ${litteral(details)};
`);

console.log(`home-details.ts — ${(octets(details) / 1024).toFixed(0)} ko d'étapes et d'ingrédients sortis du chargement initial`);
console.log(`home-videos.ts  — ${Object.keys(videos).length} embeds, `
    + `${(octets(videos) / 1024).toFixed(0)} ko sortis du chargement initial`);
