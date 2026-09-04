/**
 * couleur-image.ts — la couleur d'ambiance d'une fiche vient de SA PHOTO.
 *
 * Avant, chaque catégorie portait une teinte fixe : apéritifs en vert, plats en
 * rose, desserts en violet. Le halo autour de l'image ne parlait donc pas de
 * l'image, mais du rayon où on l'avait rangée — un tiramisu et un gratin
 * partageaient la même lumière alors qu'ils n'ont rien de commun à l'œil.
 *
 * Ici, la teinte est lue dans la photo. Deux précautions font toute la
 * différence entre un halo joli et une bouillie beige :
 *
 *  1. On ignore ce qui n'est pas une couleur — le noir, le blanc, le gris de
 *     l'assiette et du plan de travail. Une photo de cuisine en est pleine, et
 *     leur moyenne donne toujours du brun.
 *  2. On ne garde de la photo que sa TEINTE. La saturation et la clarté sont
 *     ramenées dans une plage lisible sur fond noir : sans cela, une photo
 *     sombre donnerait un halo invisible, et une photo pâle un halo laiteux.
 */

export interface AmbianceImage {
    accent: string;      // #rrggbb — traits, pilules
    rgb: string;         // « r, g, b » — pour les rgba() des feuilles de style
    glow: string;        // ombre portée colorée
    bg: string;          // fond très dilué
    teinte: number;      // 0-360, après écartement — celle qui s'affiche
    teinteBrute: number; // 0-360, telle que lue dans la photo (tests, journaux)
}

/* ─────────────────────────── conversions ─────────────────────────── */

function versTSL(r: number, v: number, b: number): [number, number, number] {
    r /= 255; v /= 255; b /= 255;
    const max = Math.max(r, v, b), min = Math.min(r, v, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let t: number;
    if (max === r) t = ((v - b) / d + (v < b ? 6 : 0));
    else if (max === v) t = (b - r) / d + 2;
    else t = (r - v) / d + 4;
    return [t * 60, s, l];
}

function versRVB(t: number, s: number, l: number): [number, number, number] {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((t / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, v = 0, b = 0;
    if (t < 60) [r, v, b] = [c, x, 0];
    else if (t < 120) [r, v, b] = [x, c, 0];
    else if (t < 180) [r, v, b] = [0, c, x];
    else if (t < 240) [r, v, b] = [0, x, c];
    else if (t < 300) [r, v, b] = [x, 0, c];
    else [r, v, b] = [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((v + m) * 255), Math.round((b + m) * 255)];
}

/* ─────────────────────────── le cœur ─────────────────────────── */

const SECTEURS = 24;                 // 24 secteurs de 15° sur la roue
const SECTEUR = 360 / SECTEURS;

/**
 * ÉCARTEMENT DES TEINTES — la partie qui mérite qu'on s'y arrête.
 *
 * Mesuré sur les 652 photos du site : 92 % d'entre elles ressortent orange, et
 * la moitié du catalogue tient entre 26° et 36°. Ce n'est pas un défaut de la
 * lecture — ces photos sont générées avec la même lumière dorée, et le brun de
 * la sauce, le bois de la planche et le doré de la cuisson les rapprochent
 * toutes. Prise telle quelle, la teinte donnerait le MÊME halo à neuf fiches
 * sur dix : moins de variété qu'avec les couleurs de catégorie qu'on remplace.
 *
 * On écarte donc les teintes voisines autour de la médiane du catalogue, comme
 * on étire un histogramme photo : une photo un peu plus rouge que la moyenne
 * devient franchement rouge, une photo un peu plus jaune devient jaune. L'ORDRE
 * est conservé — c'est bien la photo qui décide — mais l'écart devient visible.
 *
 * Les photos déjà franches (le sorbet bleu, la sauce verte) sont laissées
 * intactes : elles n'ont besoin d'aucune aide.
 */
const TEINTE_MEDIANE = 30;      // médiane mesurée sur le catalogue
const ECARTEMENT = 3;           // facteur d'étirement
const ZONE_CHAUDE = 40;         // au-delà, la photo se distingue déjà seule
// L'étirement reste enfermé entre le rouge et le vert. Sans cette borne, une
// photo franchement rouge (le cheesecake aux fruits rouges, lu à 1°) passait
// SOUS le rouge et ressortait en magenta : un dessert aux framboises avec un
// halo fuchsia, ce qui ne ressemble plus du tout à sa photo.
const COURSE_MIN = -50;         // 340° — rouge
const COURSE_MAX = 80;          // 110° — vert

function ecarter(teinte: number): number {
    let ecart = ((teinte - TEINTE_MEDIANE + 540) % 360) - 180;
    if (Math.abs(ecart) > ZONE_CHAUDE) return teinte;
    ecart = Math.min(COURSE_MAX, Math.max(COURSE_MIN, ecart * ECARTEMENT));
    return (TEINTE_MEDIANE + ecart + 360) % 360;
}

/**
 * Lit une teinte dominante dans un tableau de pixels RVBA (ou RVB).
 * Exporté à part pour être vérifiable hors navigateur, sur les vraies photos.
 */
export function ambianceDepuisPixels(
    pixels: Uint8ClampedArray | Uint8Array | number[],
    canaux: 3 | 4 = 4
): AmbianceImage | null {
    const poids = new Float64Array(SECTEURS);
    const sommeS = new Float64Array(SECTEURS);
    const sommeL = new Float64Array(SECTEURS);
    const sommeSin = new Float64Array(SECTEURS);
    const sommeCos = new Float64Array(SECTEURS);
    let colores = 0, total = 0;

    for (let i = 0; i + canaux - 1 < pixels.length; i += canaux) {
        if (canaux === 4 && pixels[i + 3] < 200) continue;   // pixel transparent
        total++;
        const [t, s, l] = versTSL(pixels[i], pixels[i + 1], pixels[i + 2]);
        // Ni presque noir, ni presque blanc, ni gris : sinon la moyenne d'une
        // photo de cuisine est toujours un beige d'assiette.
        if (l < 0.12 || l > 0.92 || s < 0.18) continue;
        colores++;
        const k = Math.min(SECTEURS - 1, Math.floor(t / SECTEUR));
        // Un pixel très coloré pèse plus qu'un pixel à peine teinté.
        const p = s * s;
        poids[k] += p;
        sommeS[k] += s * p;
        sommeL[k] += l * p;
        // La teinte est un angle : on la moyenne en vecteurs, sinon 350° et 10°
        // donneraient du vert au lieu du rouge.
        const rad = (t * Math.PI) / 180;
        sommeSin[k] += Math.sin(rad) * p;
        sommeCos[k] += Math.cos(rad) * p;
    }

    // Une photo quasiment sans couleur (noir et blanc, plan de travail nu) :
    // on ne force pas une teinte inventée, l'appelant gardera son repli.
    if (!total || colores / total < 0.04) return null;

    // Le secteur gagnant emporte ses deux voisins : un rouge réparti sur 0-15°
    // et 345-360° ne doit pas perdre contre un vert unique.
    let meilleur = 0;
    for (let k = 1; k < SECTEURS; k++) {
        const cumul = (i: number) => poids[(i + SECTEURS) % SECTEURS];
        if (cumul(k) + cumul(k - 1) + cumul(k + 1) > cumul(meilleur) + cumul(meilleur - 1) + cumul(meilleur + 1)) meilleur = k;
    }
    const voisins = [(meilleur - 1 + SECTEURS) % SECTEURS, meilleur, (meilleur + 1) % SECTEURS];
    let p = 0, sin = 0, cos = 0, s = 0, l = 0;
    for (const k of voisins) { p += poids[k]; sin += sommeSin[k]; cos += sommeCos[k]; s += sommeS[k]; l += sommeL[k]; }
    if (!p) return null;

    let teinte = (Math.atan2(sin, cos) * 180) / Math.PI;
    if (teinte < 0) teinte += 360;
    const brute = Math.round(teinte);
    teinte = ecarter(teinte);

    // La saturation et la clarté, elles, varient VRAIMENT d'une photo à l'autre
    // (mesuré : de 0,19 à 0,35 et de 0,44 à 0,65 entre le premier et le dernier
    // quartile). On les étire plutôt que de les écraser sur une valeur unique :
    // un gâteau au chocolat garde son halo sombre et profond, une salade son
    // halo clair. Les bornes empêchent seulement l'invisible et l'aveuglant.
    const etirer = (v: number, bas: number, haut: number, versBas: number, versHaut: number) =>
        Math.min(versHaut, Math.max(versBas, versBas + ((v - bas) / (haut - bas)) * (versHaut - versBas)));
    const sat = etirer(s / p, 0.25, 0.75, 0.42, 0.88);
    const clair = etirer(l / p, 0.3, 0.7, 0.4, 0.62);
    const [r, v, b] = versRVB(teinte, sat, clair);

    return {
        accent: `#${[r, v, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`,
        rgb: `${r}, ${v}, ${b}`,
        glow: `0 0 20px rgba(${r}, ${v}, ${b}, 0.4)`,
        bg: `rgba(${r}, ${v}, ${b}, 0.1)`,
        teinte: Math.round(teinte),
        teinteBrute: brute,
    };
}

/** Nom lisible d'une teinte — sert aux tests et aux journaux, pas à l'écran. */
export function nomDeTeinte(t: number): string {
    if (t < 15 || t >= 345) return 'rouge';
    if (t < 45) return 'orange';
    if (t < 70) return 'jaune';
    if (t < 160) return 'vert';
    if (t < 200) return 'turquoise';
    if (t < 250) return 'bleu';
    if (t < 290) return 'violet';
    return 'rose';
}

/* ─────────────────────── lecture dans le navigateur ─────────────────────── */

const TAILLE_LECTURE = 48;   // 2 304 pixels suffisent largement pour une teinte
const memoire = new Map<string, AmbianceImage | null>();

/**
 * Lit l'ambiance d'une image du site. Les photos sont servies depuis le même
 * domaine (`/recipes-ia/…`), donc le canevas n'est pas « teinté » et ses pixels
 * restent lisibles — inutile de passer par un service d'analyse.
 *
 * Le résultat est gardé en mémoire : rouvrir une fiche ne relit pas la photo.
 */
export function lireAmbiance(src: string): Promise<AmbianceImage | null> {
    if (!src) return Promise.resolve(null);
    if (memoire.has(src)) return Promise.resolve(memoire.get(src)!);

    return new Promise((resoudre) => {
        const img = new Image();
        img.decoding = 'async';
        // Sans effet en même origine, indispensable si les photos déménagent
        // un jour vers un autre domaine.
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width = TAILLE_LECTURE;
                c.height = TAILLE_LECTURE;
                const ctx = c.getContext('2d', { willReadFrequently: true });
                if (!ctx) { memoire.set(src, null); return resoudre(null); }
                ctx.drawImage(img, 0, 0, TAILLE_LECTURE, TAILLE_LECTURE);
                const { data } = ctx.getImageData(0, 0, TAILLE_LECTURE, TAILLE_LECTURE);
                const a = ambianceDepuisPixels(data, 4);
                memoire.set(src, a);
                resoudre(a);
            } catch {
                // Canevas verrouillé (image d'un autre domaine sans en-tête) :
                // l'appelant gardera sa couleur de repli.
                memoire.set(src, null);
                resoudre(null);
            }
        };
        img.onerror = () => { memoire.set(src, null); resoudre(null); };
        img.src = src;
    });
}
