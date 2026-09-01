/**
 * Du texte tapé vers des identifiants de recette.
 *
 * On peut donner un numéro (« 7402 »), plusieurs (« 7402 7398 »), ou tout
 * simplement le NOM du plat (« Chèvre rôti au miel ») — c'est ce qu'on a sous
 * les yeux, pas un identifiant. Accents et majuscules sont ignorés.
 *
 * Écrit les identifiants trouvés sur la sortie standard, séparés par un espace.
 * En cas d'ambiguïté ou d'absence, écrit l'explication sur la sortie d'erreur
 * et sort en code 1 — l'appelant s'arrête là plutôt que de travailler à vide.
 */
const fs = require('fs');
const path = require('path');

const saisie = process.argv.slice(2).join(' ').trim();
if (!saisie) { console.error('Rien saisi.'); process.exit(1); }

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'mockData.ts'), 'utf8');
const debut = src.indexOf('= [', src.indexOf('mockRecipes')) + 2;
const recettes = JSON.parse(src.slice(debut, src.lastIndexOf('];') + 1));

// Des numéros : on vérifie seulement qu'ils existent.
if (/^[\d\s,]+$/.test(saisie)) {
    const ids = saisie.split(/[\s,]+/).filter(Boolean);
    const absents = ids.filter((id) => !recettes.some((r) => String(r.id) === id));
    if (absents.length) {
        console.error(`Identifiant(s) introuvable(s) : ${absents.join(', ')}`);
        process.exit(1);
    }
    process.stdout.write(ids.join(' '));
    process.exit(0);
}

// Un nom : on cherche, accents et casse ignorés.
const nu = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const q = nu(saisie);
const exact = recettes.filter((r) => nu(r.title) === q);
const partiel = exact.length ? exact : recettes.filter((r) => nu(r.title).includes(q));

if (partiel.length === 0) {
    console.error(`Aucune recette ne correspond à « ${saisie} ».`);
    process.exit(1);
}
if (partiel.length > 1) {
    console.error(`Plusieurs recettes correspondent à « ${saisie} » — reprends avec le numéro :`);
    partiel.slice(0, 10).forEach((r) => console.error(`   ${r.id}  ${r.title}`));
    if (partiel.length > 10) console.error(`   … et ${partiel.length - 10} autres.`);
    process.exit(1);
}
console.error(`→ ${partiel[0].title} (${partiel[0].id})`);
process.stdout.write(String(partiel[0].id));
