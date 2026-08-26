/**
 * Données allégées pour l'accueil mobile.
 * ======================================
 *
 * L'accueil chargeait le catalogue ENTIER — 1,36 Mo de JSON, dont 78 % ne sert
 * qu'une fois une fiche ouverte. Sur un téléphone, ce n'est pas le
 * téléchargement qui coûte (264 ko gzip passent vite) mais le parse et
 * l'exécution de 1,5 Mo de JavaScript sur le thread qui doit répondre au doigt.
 *
 * Ce script produit `src/mobile/data/home-recipes.ts`, une copie du catalogue
 * SANS `videoHtml`, avec à la place :
 *
 *   • `tiktokId`  — l'accueil ne lisait `videoHtml` que pour en extraire cet
 *     identifiant par une expression régulière (289 ko de HTML pour 12 ko de
 *     chiffres) ;
 *   • `est` et `timed` — le résultat des deux fonctions qui, à chaque
 *     démarrage, relisaient les étapes des 662 recettes pour recalculer temps
 *     et difficulté. Le calcul est fait ici, une fois, avec les mêmes
 *     fonctions : `timing.ts` s'en sert quand le champ est là et retombe sur
 *     l'ancien chemin sinon, donc le desktop et les fiches ne bougent pas.
 *
 * Les étapes et les ingrédients RESTENT dans ces données : `themes.ts` s'en
 * sert pour décider quelles recettes entrent dans quelle rangée. Les enlever
 * changerait le contenu de l'accueil, pas seulement son poids.
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
const TIMING = path.join(RACINE, 'src/lib/recipe-timing.ts');

/** Charge un module TypeScript sans dépendance de build : transpile puis évalue. */
function chargerTS(fichier) {
    const js = ts.transpileModule(fs.readFileSync(fichier, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
    }).outputText;
    const module = { exports: {} };
    new Function('exports', 'module', 'require', js)(module.exports, module, require);
    return module.exports;
}

/** Le tableau de recettes, extrait du fichier généré par la synchro WordPress. */
function lireRecettes() {
    const src = fs.readFileSync(SOURCE, 'utf8');
    const debut = src.indexOf('= [', src.indexOf('mockRecipes')) + 2;
    const fin = src.lastIndexOf('];') + 1;
    return JSON.parse(src.slice(debut, fin));
}

const { estimateRecipeTiming, sumStepMinutes } = chargerTS(TIMING);

const recettes = lireRecettes();
const allegees = recettes.map((r) => {
    const { videoHtml, ...reste } = r;
    const id = String(videoHtml || '').match(/data-video-id="(\d+)"/)?.[1] || null;
    return {
        ...reste,
        ...(id ? { tiktokId: id } : {}),
        est: estimateRecipeTiming(r.steps),
        timed: (r.steps || []).reduce((n, step) => n + sumStepMinutes(step), 0),
    };
});

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
console.log(`home-videos.ts  — ${Object.keys(videos).length} embeds, `
    + `${(octets(videos) / 1024).toFixed(0)} ko sortis du chargement initial`);
