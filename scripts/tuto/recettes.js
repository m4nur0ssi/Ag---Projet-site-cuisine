/**
 * De la matière pour les scènes : de VRAIES recettes.
 * ==================================================
 *
 * Le navigateur de la caméra est neuf — sa semaine et sa liste de courses sont
 * vides. Les scènes qui filment le planificateur ou les courses doivent donc
 * poser leur décor elles-mêmes. Le faire avec des recettes inventées se voit
 * tout de suite à l'écran (« 200 g de Voir la recette ») : on puise dans les
 * recettes du site, celles-là mêmes que le spectateur retrouvera chez lui.
 */

const fs = require('fs');
const path = require('path');

let cache = null;

function toutes() {
    if (cache) return cache;
    const fichier = path.join(__dirname, '..', '..', 'src', 'data', 'mockData.ts');
    const texte = fs.readFileSync(fichier, 'utf8');
    // Le tableau commence après le signe « = » : chercher le premier crochet
    // depuis le début de la déclaration tomberait sur celui de `Recipe[]`.
    const egal = texte.indexOf('=', texte.indexOf('mockRecipes: Recipe[]'));
    const depart = texte.indexOf('[', egal);
    cache = JSON.parse(texte.slice(depart, texte.lastIndexOf(']') + 1));
    return cache;
}

/**
 * Une recette allégée : ce que le planificateur et la liste de courses lisent.
 * On laisse la vidéo et la description sur le bord de la route — elles pèsent
 * lourd dans `localStorage` sans rien apporter à l'image.
 */
function recette(id) {
    const r = toutes().find((x) => x.id === String(id));
    if (!r) throw new Error(`recette introuvable pour la démo : ${id}`);
    const { videoHtml, description, ...garde } = r;
    return { ...garde, description: '' };
}

/** `meal-planner-week` prêt à poser : { Lun: { Midi: <id>, Soir: <id> }, … } */
function semaine(menu) {
    const out = {};
    for (const [jour, creneaux] of Object.entries(menu)) {
        out[jour] = {};
        for (const [creneau, id] of Object.entries(creneaux)) out[jour][creneau] = recette(id);
    }
    return out;
}

/**
 * `magic-shopping-list` prêt à poser. `source` distingue les origines :
 * sans elle, l'onglet « Par recette » afficherait aussi le menu de la semaine.
 */
function panier(ids, { coches = 3 } = {}) {
    const out = {};
    for (const id of ids) {
        const r = recette(id);
        out[r.id] = {
            title: r.title,
            image: r.image,
            ingredients: r.ingredients.slice(0, coches).map((i) => ({ ...i, checked: true })),
        };
    }
    return out;
}

/**
 * Le jour d'aujourd'hui, nommé comme le planificateur le nomme.
 *
 * La vue « Jour par jour » s'ouvre sur la date du tournage : un décor posé sur
 * un lundi en dur donnerait « Rien de planifié ce jour-là » un mardi.
 */
const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
function jour(decalage = 0) {
    const d = new Date();
    d.setDate(d.getDate() + decalage);
    return JOURS[d.getDay()];
}

module.exports = { recette, semaine, panier, jour };
