/**
 * Écrans de lancement iOS.
 * =======================
 *
 * Sans eux, une PWA iOS s'ouvre sur un rectangle vide le temps du démarrage —
 * l'inverse de l'effet « vraie application » qu'on cherche. Apple ne sait pas
 * les mettre à l'échelle : il faut une image par taille d'écran, à la bonne
 * densité, sinon iOS l'ignore et retombe sur le vide.
 *
 * On garde les tailles des iPhone encore en service, du SE au Pro Max, en
 * portrait — l'app est verrouillée dans ce sens.
 *
 * Depuis le 2026-09-16 : fond noir UNI, sans logo. On veut arriver directement
 * sur le carrousel ; un logo au lancement, c'est un écran de plus. On garde
 * pourtant les images — sans elles, iOS montre un rectangle BLANC, qui claque
 * bien plus qu'un noir raccord avec l'accueil.
 *
 * Les fichiers portent un suffixe de version : iOS garde les anciens écrans de
 * lancement en cache tant que l'adresse ne change pas.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SORTIE = path.join(__dirname, '..', 'public', 'splash');
const FOND = '#0a0a0c'; // même noir que le manifeste : aucune bascule au lancement
const VERSION = 'v2';     // à changer à chaque nouveau dessin, sinon iOS garde l'ancien

/** [largeur, hauteur] en pixels physiques. */
const ECRANS = [
    [1290, 2796], // 15/16 Pro Max, 14 Pro Max
    [1179, 2556], // 15/16, 14 Pro
    [1206, 2622], // 16 Pro
    [1320, 2868], // 16 Pro Max
    [1170, 2532], // 12/13/14
    [1125, 2436], // X, XS, 11 Pro
    [828, 1792],  // XR, 11
    [750, 1334],  // SE 2/3, 8
];

(async () => {
    fs.mkdirSync(SORTIE, { recursive: true });
    for (const [l, h] of ECRANS) {
        await sharp({ create: { width: l, height: h, channels: 4, background: FOND } })
            .png()
            .toFile(path.join(SORTIE, `splash-${VERSION}-${l}x${h}.png`));
    }
    console.log(`${ECRANS.length} écrans de lancement écrits dans public/splash`);
})();
