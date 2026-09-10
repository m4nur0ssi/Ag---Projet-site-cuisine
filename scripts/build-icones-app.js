/**
 * Icônes de l'app (PWA iOS/Android, Dock macOS).
 * ==============================================
 *
 * Source : public/icons/icon-source.png. Sortie : icon-512, -192, -180, que
 * déclarent public/manifest.json et src/app/layout.tsx.
 *
 * À relancer après toute retouche de la source — et enchaîner avec
 * `node scripts/build-splash-ios.js`, qui fabrique les écrans de lancement
 * iOS À PARTIR de icon-512x512.png.
 *
 * Deux pièges :
 *   • l'image a une marge TRANSPARENTE autour de sa tuile arrondie, et iOS
 *     aplatit la transparence sur du noir → on recadre sur la tuile ;
 *   • il reste les coins arrondis de la tuile, eux aussi transparents → on les
 *     comble avec un dégradé RELEVÉ SUR LA TUILE elle-même (une dizaine de
 *     hauteurs échantillonnées), pour qu'aucune bordure ne se voie.
 */
const sharp = require('sharp');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SOURCE = process.argv[2] || path.join(RACINE, 'public', 'icons', 'icon-source.png');
const DEST = process.argv[3] || path.join(RACINE, 'public', 'icons');
const TAILLES = [512, 192, 180];

(async () => {
    const src = sharp(SOURCE);
    const { width: W, height: H } = await src.metadata();
    const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
    const C = info.channels;
    const alpha = (x, y) => data[(y * W + x) * C + 3];
    const rgb = (x, y) => { const i = (y * W + x) * C; return [data[i], data[i + 1], data[i + 2]]; };

    // La tuile : ce qui est franchement opaque.
    let minX = W, minY = H, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (alpha(x, y) >= 250) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
    }
    const cw = maxX - minX + 1, ch = maxY - minY + 1;

    /**
     * Le fond qui comble les coins arrondis : la tuile elle-même, rognée bien
     * à l'intérieur (donc sans transparence), agrandie et floutée. Un dégradé
     * calculé laissait un halo plus clair dans les angles — la tuile a son
     * propre vignetage, qu'aucune ligne droite ne rattrape.
     */
    const marge = Math.round(Math.min(cw, ch) * 0.12);
    const fond = async (n) => sharp(SOURCE)
        .extract({ left: minX + marge, top: minY + marge, width: cw - 2 * marge, height: ch - 2 * marge })
        .resize(n, n, { fit: 'fill' })
        .blur(Math.max(4, n / 12))
        .removeAlpha()
        .png().toBuffer();

    console.log(`tuile ${cw}×${ch} à (${minX},${minY})`);
    for (const n of TAILLES) {
        const dessus = await sharp(SOURCE)
            .extract({ left: minX, top: minY, width: cw, height: ch })
            .resize(n, n, { fit: 'fill' })
            .png().toBuffer();
        const sortie = path.join(DEST, `icon-${n}x${n}.png`);
        await sharp(await fond(n)).composite([{ input: dessus }]).png({ compressionLevel: 9 }).toFile(sortie);
        console.log(`${sortie}  ${n}×${n}`);
    }
})();
