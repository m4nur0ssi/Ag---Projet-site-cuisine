#!/usr/bin/env node
/**
 * Une image à toi → les deux fichiers que le site attend.
 * =======================================================
 *
 * Pourquoi ce script existe
 * -------------------------
 * `generate-recipe-images.js` ne sait partir que d'une vidéo. Quand la photo
 * vient d'ailleurs — ChatGPT, un appareil photo, une retouche —, il n'y avait
 * aucun chemin : il fallait recopier une ligne de `sharp` à la main, deviner
 * les largeurs, et se tromper de rapport une fois sur deux.
 *
 * Ce que le site attend, exactement
 * ---------------------------------
 * DEUX fichiers par recette, dans `public/recipes-ia`, en WebP :
 *
 *   <id>.webp        1200 px de large — la fiche recette
 *   <id>-carte.webp   760 px de large — les cartes, l'accueil, les catégories
 *
 * N'en remplacer qu'un laisse l'autre sur l'ancienne photo. C'est l'erreur la
 * plus fréquente, et elle ne se voit pas tout de suite : la carte change,
 * la fiche non.
 *
 * Le rapport 3:4, en portrait
 * ---------------------------
 * Toutes les photos du site sont en portrait 3:4. Les cartes recadrent en
 * `object-fit: cover` : une image carrée y perd le haut et le bas, une image
 * paysage y perd presque tout. On recadre donc ICI, au centre, une fois pour
 * toutes — plutôt que de laisser chaque écran rogner comme il veut.
 *
 * Usage
 * -----
 *   node scripts/convertir-photo.js 7467 ~/Downloads/escalope.png
 *
 * Options
 *   --pas-de-sauvegarde   n'archive pas l'ancienne photo sur le Bureau
 *
 * Sort en code 1 si la source est illisible ou la recette inconnue.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const RACINE = path.join(__dirname, '..');
const DOSSIER = path.join(RACINE, 'public', 'recipes-ia');

/*
 * Les mêmes largeurs et les mêmes qualités que `generate-recipe-images.js`.
 * Elles sont recopiées ici À DESSEIN plutôt qu'importées : ce script doit
 * tourner seul, sans charger le générateur (qui lit .env.local, contacte des
 * fournisseurs et pèse plusieurs centaines de lignes). Si les largeurs
 * changent là-bas, elles changent ici — les deux blocs se citent l'un l'autre.
 */
const TAILLES = [
    { suffixe: '', largeur: 1200, qualite: 78 },       // la fiche      ~270 ko
    { suffixe: '-carte', largeur: 760, qualite: 75 },  // les cartes    ~110 ko
];

/** En dessous, la carte serait un agrandissement, et ça se voit. */
const LARGEUR_MINIMALE = 760;

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const sansSauvegarde = process.argv.includes('--pas-de-sauvegarde');
const [id, source] = args;

if (!id || !source) {
    console.error('Usage : node scripts/convertir-photo.js <id> <image>');
    process.exit(1);
}

/** Le titre de la recette, pour nommer l'archive de l'ancienne photo. */
function titreDe(id) {
    try {
        const src = fs.readFileSync(path.join(RACINE, 'src', 'data', 'mockData.ts'), 'utf8');
        const debut = src.indexOf('= [', src.indexOf('mockRecipes')) + 2;
        const recettes = JSON.parse(src.slice(debut, src.lastIndexOf('];') + 1));
        return recettes.find((r) => String(r.id) === String(id))?.title || null;
    } catch {
        return null;   // pas bloquant : l'archive s'appellera par son numéro
    }
}

/**
 * Archive l'ancienne photo sur le Bureau avant de l'écraser.
 * Même dossier que `generate-recipe-images.js` : on retrouve tout au même
 * endroit, qu'on ait régénéré ou remplacé à la main.
 */
function sauvegarderAncienne(id, titre) {
    const dest = path.join(os.homedir(), 'Desktop', 'anciennes-photos-recettes', 'remplacees');
    let archivees = 0;
    fs.mkdirSync(dest, { recursive: true });
    const safe = String(titre || id).replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 60);
    const horodatage = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    for (const suf of ['.webp', '-carte.webp']) {
        const src = path.join(DOSSIER, `${id}${suf}`);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(dest, `${id}_${safe}_${horodatage}${suf}`));
            archivees++;
        }
    }
    return archivees;
}

(async () => {
    const chemin = source.replace(/^~/, os.homedir());
    if (!fs.existsSync(chemin)) {
        console.error(`Image introuvable : ${chemin}`);
        process.exit(1);
    }

    let meta;
    try {
        meta = await sharp(chemin).metadata();
    } catch (e) {
        console.error(`Image illisible (${e.message}).`);
        console.error('Formats sûrs : PNG, JPEG, WebP. Un HEIC d\'iPhone doit être exporté avant.');
        process.exit(1);
    }
    if (!meta.width || !meta.height) {
        console.error('Image sans dimensions exploitables.');
        process.exit(1);
    }

    const titre = titreDe(id);
    console.log(`   source  ${meta.width}×${meta.height} ${meta.format}`);

    // ── Recadrage centré en 3:4 ─────────────────────────────────────────────
    // On part de la plus grande fenêtre 3:4 qui tienne dans l'image. Si elle
    // est déjà au bon rapport, `extract` ne coupe rien.
    let largeurUtile = Math.min(meta.width, Math.round(meta.height * 0.75));
    let hauteurUtile = Math.round(largeurUtile / 0.75);
    if (hauteurUtile > meta.height) {
        hauteurUtile = meta.height;
        largeurUtile = Math.round(hauteurUtile * 0.75);
    }
    const rogne = meta.width - largeurUtile > 1 || meta.height - hauteurUtile > 1;
    if (rogne) {
        console.log(`   recadré ${largeurUtile}×${hauteurUtile} (3:4, centré)`);
    }

    if (largeurUtile < LARGEUR_MINIMALE) {
        console.log('');
        console.log(`   ⚠️  ${largeurUtile} px de large après recadrage, il en faudrait ${LARGEUR_MINIMALE}.`);
        console.log('      Les cartes seront agrandies, donc légèrement molles.');
        console.log('      Demande une image plus grande si tu peux — on continue quand même.');
        console.log('');
    }

    const base = sharp(chemin).extract({
        left: Math.round((meta.width - largeurUtile) / 2),
        top: Math.round((meta.height - hauteurUtile) / 2),
        width: largeurUtile,
        height: hauteurUtile,
    });
    const recadree = await base.png().toBuffer();

    // ── Archivage, puis écriture des deux tailles ───────────────────────────
    if (!sansSauvegarde) {
        const n = sauvegarderAncienne(id, titre);
        if (n) console.log(`   ancienne photo archivée sur le Bureau (${n} fichier${n > 1 ? 's' : ''})`);
    }

    fs.mkdirSync(DOSSIER, { recursive: true });
    for (const { suffixe, largeur, qualite } of TAILLES) {
        const sortie = path.join(DOSSIER, `${id}${suffixe}.webp`);
        let img = sharp(recadree).resize({ width: largeur, kernel: sharp.kernel.lanczos3 });
        // L'accentuage ne se justifie QUE sur un agrandissement : sur une
        // réduction, il fait ressortir le grain et durcit les bords.
        if (largeurUtile < largeur) img = img.sharpen({ sigma: 0.7 });
        await img.webp({ quality: qualite }).toFile(sortie);
        const ko = Math.round(fs.statSync(sortie).size / 1024);
        console.log(`   écrit   ${path.basename(sortie)}  ${largeur} px  ${ko} ko`);
    }
})().catch((e) => {
    console.error(`Échec : ${e.message}`);
    process.exit(1);
});
