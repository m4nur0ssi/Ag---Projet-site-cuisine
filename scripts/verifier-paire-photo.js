#!/usr/bin/env node
/**
 * Les deux photos d'une recette sont-elles bien là, et bien la même image ?
 * ========================================================================
 *
 * Pourquoi ce script existe
 * -------------------------
 * Le site attend DEUX fichiers par recette, et n'en remplacer qu'un est la
 * panne la plus sournoise du projet : la carte change, la fiche garde
 * l'ancienne photo, et ça ne se voit qu'une fois en ligne — en ouvrant une
 * recette dont la vignette vient pourtant d'être refaite.
 *
 * Ce contrôle est donc passé APRÈS chaque conversion, et il affiche les
 * dimensions : on ne se contente pas de croire que ça a marché, on le montre.
 *
 * Ce qu'il vérifie
 * ----------------
 *   1. les deux fichiers existent ;
 *   2. leurs largeurs sont les bonnes (1200 pour la fiche, 760 pour la carte) ;
 *   3. c'est bien LA MÊME photo dans les deux — comparaison en 16×16 niveaux
 *      de gris. Deux tailles d'une même image se ressemblent à moins de 3/255 ;
 *      au-delà, l'une des deux est restée en arrière.
 *
 * Usage
 * -----
 *   node scripts/verifier-paire-photo.js 7467
 *
 * Sort en code 1 si la paire est incomplète ou incohérente — l'appelant
 * s'arrête là plutôt que d'envoyer une recette à moitié faite.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DOSSIER = path.join(__dirname, '..', 'public', 'recipes-ia');

/* Les mêmes largeurs que convertir-photo.js et generate-recipe-images.js. */
const ATTENDU = [
    { suffixe: '', largeur: 1200, role: 'la fiche' },
    { suffixe: '-carte', largeur: 760, role: 'les cartes' },
];

/** Au-delà, ce ne sont plus deux tailles d'une même photo. */
const ECART_MAX = 3;

const id = process.argv[2];
if (!id) {
    console.error('Usage : node scripts/verifier-paire-photo.js <id>');
    process.exit(1);
}

/** Empreinte grossière : 16×16 en niveaux de gris. */
async function empreinte(fichier) {
    return sharp(fichier).greyscale().resize(16, 16, { fit: 'fill' }).raw().toBuffer();
}

(async () => {
    let probleme = false;
    const empreintes = [];

    for (const { suffixe, largeur, role } of ATTENDU) {
        const fichier = path.join(DOSSIER, `${id}${suffixe}.webp`);
        if (!fs.existsSync(fichier)) {
            console.log(`   ✗ ${id}${suffixe}.webp  ABSENT — plus de photo pour ${role}`);
            probleme = true;
            continue;
        }
        const meta = await sharp(fichier).metadata();
        const ko = Math.round(fs.statSync(fichier).size / 1024);
        const bonneLargeur = meta.width === largeur;
        console.log(
            `   ${bonneLargeur ? '✓' : '✗'} ${id}${suffixe}.webp`.padEnd(30) +
            `${meta.width}×${meta.height}  ${ko} ko  (${role})` +
            (bonneLargeur ? '' : `  ← attendu ${largeur} px de large`)
        );
        if (!bonneLargeur) probleme = true;
        empreintes.push(await empreinte(fichier));
    }

    // Même photo des deux côtés ?
    if (empreintes.length === 2) {
        const [a, b] = empreintes;
        let somme = 0;
        for (let i = 0; i < a.length; i++) somme += Math.abs(a[i] - b[i]);
        const ecart = somme / a.length;
        if (ecart > ECART_MAX) {
            console.log(`   ✗ Les deux fichiers ne montrent PAS la même photo (écart ${ecart.toFixed(1)}/255).`);
            console.log('     L\'un des deux est resté sur l\'image précédente.');
            probleme = true;
        }
    }

    process.exit(probleme ? 1 : 0);
})().catch((e) => {
    console.error(`   ✗ Vérification impossible : ${e.message}`);
    process.exit(1);
});
