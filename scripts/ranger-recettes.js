/**
 * Remet les recettes dans le bon rayon.
 * =====================================
 *
 * Les tags de WordPress sont posés à la louche : « Les Glaces » sur une tarte
 * normande, « Sauces » sur des brochettes de poulet, « Pâques » sur une harira
 * marocaine. La synchro s'en servait pour décider de la CATÉGORIE, si bien que
 * la tarte finissait au rayon des glaces et le poulet au rayon des sauces —
 * dans la fiche, dans les filtres, partout.
 *
 * Ce script relit `mockData.ts` (les deux copies, desktop et mobile) et :
 *   • sort des « glaces » ce dont le titre ne parle pas de glace ni de sorbet ;
 *   • sort des « sauces » ce qui n'est pas une sauce, un dip ou un condiment ;
 *   • retire les tags franchement faux, listés dans TAGS_A_RETIRER.
 *
 * Les règles ne sont pas recopiées ici : elles viennent de `themes.ts`, le même
 * fichier que consultent l'accueil et le desktop. `sync-recipes.js` applique
 * les mêmes, pour que la prochaine synchro ne défasse pas le rangement.
 *
 *   node scripts/ranger-recettes.js            (écrit)
 *   node scripts/ranger-recettes.js --essai    (montre, n'écrit pas)
 */
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const FICHIERS = [
    path.join(RACINE, 'src/data/mockData.ts'),
    path.join(RACINE, 'src/mobile/data/mockData.ts'),
];
const { estGlace, estSauce, categoriePourTitre, TAGS_A_RETIRER } = require('./rangement');

const essai = process.argv.includes('--essai');

function lire(fichier) {
    const src = fs.readFileSync(fichier, 'utf8');
    const debut = src.indexOf('= [', src.indexOf('mockRecipes')) + 2;
    const fin = src.lastIndexOf('];') + 1;
    return { src, debut, fin, recettes: JSON.parse(src.slice(debut, fin)) };
}

const journal = [];
let premier = true;

for (const fichier of FICHIERS) {
    const { src, debut, fin, recettes } = lire(fichier);

    for (const r of recettes) {
        const mauvaisRayon =
            (r.category === 'glaces' && !estGlace(r.title)) ||
            (r.category === 'sauces' && !estSauce(r.title));
        if (mauvaisRayon) {
            const avant = r.category;
            r.category = categoriePourTitre(r.title, r.tags || []);
            if (premier) journal.push(`  ${r.id} ${r.title} : ${avant} → ${r.category}`);
        }

        const aRetirer = TAGS_A_RETIRER[String(r.id)];
        if (aRetirer && Array.isArray(r.tags)) {
            const avant = r.tags.length;
            r.tags = r.tags.filter((t) => !aRetirer.some((x) => x.toLowerCase() === String(t).toLowerCase()));
            if (premier && r.tags.length !== avant) journal.push(`  ${r.id} ${r.title} : tag ${aRetirer.join(', ')} retiré`);
        }
    }

    if (!essai) {
        const sortie = src.slice(0, debut) + JSON.stringify(recettes, null, 4) + src.slice(fin);
        fs.writeFileSync(fichier, sortie);
    }
    premier = false;
}

console.log(journal.length ? journal.join('\n') : '  (rien à ranger)');
console.log(`\n${journal.length} correction(s)${essai ? ' — essai, rien écrit' : ` écrites dans ${FICHIERS.length} fichiers`}.`);
