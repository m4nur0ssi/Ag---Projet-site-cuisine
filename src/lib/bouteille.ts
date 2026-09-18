'use client';

/**
 * Normalisation des visuels de bouteille.
 *
 * LE PROBLÈME QU'ON RÈGLE ICI
 * ---------------------------
 * Une cave, c'est un mur de bouteilles. L'œil y lit d'abord des SILHOUETTES :
 * si elles n'ont ni la même taille ni la même ligne de pose, la grille paraît
 * bâclée quelles que soient les photos. L'ancien `toStudio` mettait à l'échelle
 * le FICHIER et non la BOUTEILLE : un visuel marchand avec 30 % de marge
 * sortait deux fois plus petit que le même vin photographié serré.
 *
 * D'où les trois règles, dans cet ordre :
 *
 *   1. DÉTOURER   — retirer le fond, quel qu'il soit ;
 *   2. RECADRER   — mesurer la bouteille elle-même (sa boîte englobante) ;
 *   3. POSER      — la redessiner à hauteur fixe, sur une ligne de pose fixe,
 *                   au centre d'un cadre au format fixe.
 *
 * Le résultat sort sur FOND TRANSPARENT. Le décor (tonneau, projecteur,
 * vignette) appartient au CSS de la carte : le cuire dans le JPEG, comme
 * avant, superposait deux décors et laissait voir le rectangle de la photo.
 */

/** Cadre de sortie. Le rapport 3/4 est celui de la scène des cartes. */
export const CADRE_L = 460;
export const CADRE_H = 614;

/** Part de la hauteur du cadre occupée par la bouteille. */
const HAUTEUR_BOUTEILLE = 0.85;
/** Largeur maximale, pour un visuel large (bouteille couchée, étiquette seule). */
const LARGEUR_MAX = 0.82;
/**
 * Ligne de pose : le bas de la bouteille tombe toujours ici.
 *
 * Pas 100 % : il faut laisser sous la bouteille de quoi poser l'ombre de
 * contact qui, sur les cartes de bureau, remplace l'étagère dessinée. Collée
 * au bord, la bouteille paraît coupée plutôt que posée.
 */
const LIGNE_DE_POSE = 0.93;

export type Detourage = {
    /** Le masque obtenu couvre-t-il une bouteille plausible ? 0 → non, 1 → oui. */
    confiance: number;
    /** Nom du moteur qui a produit le masque, pour les traces. */
    moteur: 'fond-uni' | 'modele' | 'aucun';
};

export type Normalisation = {
    /** Data-url webp (ou png) à fond transparent, prête à stocker. */
    dataUrl: string;
    /** Redressement appliqué, en degrés. 0 = la bouteille était déjà d'aplomb. */
    redresse?: number;
} & Detourage;

/* ── Chargement ───────────────────────────────────────────────────────────── */

function charger(src: string): Promise<HTMLImageElement | null> {
    return new Promise((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        // Une image d'un autre domaine teinte le canevas et rend `getImageData`
        // impossible : l'appelant doit la rapatrier par /api/img avant d'arriver
        // ici. On tente quand même le mode anonyme, gratuit s'il passe.
        if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
        img.src = src;
    });
}

/** Dessine l'image dans un canevas de travail, côté long plafonné. */
function canevasDeTravail(img: HTMLImageElement, max = 900) {
    const r = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.width * r));
    cv.height = Math.max(1, Math.round(img.height * r));
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    return { cv, ctx };
}

/* ── 1. Détourage sur fond uni ────────────────────────────────────────────── */

/**
 * Efface le fond quand il est UNI — blanc de packshot, mais aussi gris, crème
 * ou pastel. L'ancienne version n'acceptait que le blanc très clair et très
 * terne (`min > 228`), ce qui laissait un rectangle sur tout visuel marchand au
 * fond légèrement teinté.
 *
 * On part des bords et on progresse de proche en proche : ne disparaît que ce
 * qui TOUCHE le bord. Un seuil global aurait troué la bouteille partout où
 * l'étiquette est de la même couleur que le fond.
 *
 * Renvoie la confiance : la part du pourtour effectivement effacée. Un fond
 * chargé (photo de cuisine) bloque la progression dès les premiers pixels et
 * sort donc avec une confiance basse — c'est le signal qui déclenche le modèle.
 */
function detourerFondUni(img: ImageData): number {
    const { width: w, height: h, data } = img;

    // Couleur du fond : médiane des quatre coins, chacun échantillonné sur un
    // carré de 6 px. Un seul pixel suffit à se faire piéger par du bruit JPEG.
    const coins: number[][] = [];
    const carre = (x0: number, y0: number) => {
        const r: number[] = [], g: number[] = [], b: number[] = [];
        for (let y = y0; y < y0 + 6 && y < h; y++) {
            for (let x = x0; x < x0 + 6 && x < w; x++) {
                const i = (y * w + x) * 4;
                r.push(data[i]); g.push(data[i + 1]); b.push(data[i + 2]);
            }
        }
        const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1] ?? 0;
        coins.push([med(r), med(g), med(b)]);
    };
    carre(0, 0); carre(w - 6, 0); carre(0, h - 6); carre(w - 6, h - 6);

    // Les quatre coins doivent se ressembler : sinon le fond n'est pas uni et
    // le remplissage déborderait dans la bouteille.
    let ecartMax = 0;
    for (const a of coins) for (const b of coins) {
        ecartMax = Math.max(ecartMax, Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]));
    }
    if (ecartMax > 120) return 0;

    const fond = [0, 1, 2].map((k) => coins.reduce((s, c) => s + c[k], 0) / coins.length);

    // Tolérance : large sur un fond clair (le JPEG y bruite beaucoup), serrée
    // sur un fond sombre (où la bouteille est souvent proche du fond).
    const clarte = (fond[0] + fond[1] + fond[2]) / 3;
    const tolerance = clarte > 200 ? 46 : clarte > 120 ? 34 : 24;

    const proche = (i: number) => {
        if (data[i + 3] < 8) return true;
        const d = Math.abs(data[i] - fond[0]) + Math.abs(data[i + 1] - fond[1]) + Math.abs(data[i + 2] - fond[2]);
        return d < tolerance * 3;
    };

    const vus = new Uint8Array(w * h);
    const pile: number[] = [];
    const pousser = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const p = y * w + x;
        if (vus[p]) return;
        vus[p] = 1;
        if (proche(p * 4)) pile.push(p);
    };
    for (let x = 0; x < w; x++) { pousser(x, 0); pousser(x, h - 1); }
    for (let y = 0; y < h; y++) { pousser(0, y); pousser(w - 1, y); }

    let efface = 0;
    while (pile.length) {
        const p = pile.pop() as number;
        data[p * 4 + 3] = 0;
        efface++;
        const x = p % w, y = (p / w) | 0;
        pousser(x + 1, y); pousser(x - 1, y); pousser(x, y + 1); pousser(x, y - 1);
    }

    // Confiance = part du POURTOUR devenue transparente. Mesurer sur l'image
    // entière récompenserait un fond immense autour d'une bouteille minuscule.
    let bord = 0, bordEfface = 0;
    const testerBord = (x: number, y: number) => {
        const i = (y * w + x) * 4;
        bord++;
        if (data[i + 3] === 0) bordEfface++;
    };
    for (let x = 0; x < w; x++) { testerBord(x, 0); testerBord(x, h - 1); }
    for (let y = 0; y < h; y++) { testerBord(0, y); testerBord(w - 1, y); }

    // Un fond uni qui n'efface presque rien n'est pas un fond uni.
    return efface > w * h * 0.04 ? bordEfface / Math.max(1, bord) : 0;
}

/* ── 1 bis. Un seul objet ─────────────────────────────────────────────────── */

/**
 * Ne garde que la PLUS GRANDE TACHE du masque, et efface les autres.
 *
 * LE CAS QUI L'IMPOSE
 * -------------------
 * On ne photographie presque jamais une bouteille seule. Il y a un verre à
 * côté, une deuxième bouteille, un bol, un tire-bouchon. Le modèle de
 * segmentation détecte l'objet SAILLANT — au pluriel : il rapporte tout ce qui
 * se détache du fond, dans un seul masque.
 *
 * `plausibleBouteille` était censé écarter ces cas, et n'y arrive pas : une
 * bouteille flanquée d'un verre garde un élancement et un remplissage tout à
 * fait ordinaires. Mesuré sur huit photos de table : deux passaient le contrôle
 * avec une confiance de 0,80 — donc acceptées — et l'étiquette extraite était
 * un mélange de papier et de pied de verre.
 *
 * La bonne mesure n'est pas la forme de l'ensemble, c'est le NOMBRE d'objets.
 * Deux objets posés côte à côte ne se touchent pas : ils forment deux taches
 * séparées dans le masque. On les compte, on garde la plus grosse — la
 * bouteille, qui est toujours l'objet le plus haut de la table — et on efface
 * le reste.
 *
 * Ça ne sauve pas tout : un verre POSÉ DEVANT la bouteille la touche, et les
 * deux ne font qu'une tache. Mais ça règle le cas courant, celui du verre ou de
 * la bouteille voisine, à un parcours d'image près.
 *
 * Renvoie la part de l'aire opaque conservée. Proche de 1 : il n'y avait qu'un
 * objet, on n'a rien fait. Nettement en dessous : on vient d'écarter du décor.
 */
function garderPlusGrandeTache(img: ImageData): number {
    const { width: w, height: h, data } = img;
    const n = w * h;

    // Étiquetage en largeur, avec une pile explicite : la récursion déborde
    // sur une image de 900 px de côté.
    const tache = new Int32Array(n).fill(-1);
    const pile = new Int32Array(n);
    let courante = 0, meilleure = -1, meilleureAire = 0, aireTotale = 0;

    for (let depart = 0; depart < n; depart++) {
        if (data[depart * 4 + 3] <= 24 || tache[depart] >= 0) continue;
        let sommet = 0, aire = 0;
        pile[sommet++] = depart;
        tache[depart] = courante;
        while (sommet) {
            const p = pile[--sommet];
            aire++;
            const x = p % w, y = (p / w) | 0;
            // Quatre voisins : la connexité diagonale relierait une bouteille
            // au verre qui l'effleure d'un pixel.
            if (x > 0) { const q = p - 1; if (data[q * 4 + 3] > 24 && tache[q] < 0) { tache[q] = courante; pile[sommet++] = q; } }
            if (x < w - 1) { const q = p + 1; if (data[q * 4 + 3] > 24 && tache[q] < 0) { tache[q] = courante; pile[sommet++] = q; } }
            if (y > 0) { const q = p - w; if (data[q * 4 + 3] > 24 && tache[q] < 0) { tache[q] = courante; pile[sommet++] = q; } }
            if (y < h - 1) { const q = p + w; if (data[q * 4 + 3] > 24 && tache[q] < 0) { tache[q] = courante; pile[sommet++] = q; } }
        }
        aireTotale += aire;
        if (aire > meilleureAire) { meilleureAire = aire; meilleure = courante; }
        courante++;
    }

    if (meilleure < 0 || courante <= 1) return 1;

    for (let p = 0; p < n; p++) if (tache[p] !== meilleure) data[p * 4 + 3] = 0;
    return meilleureAire / Math.max(1, aireTotale);
}

/* ── 1 bis. Redressement ──────────────────────────────────────────────────── */

/**
 * De combien la bouteille penche, en radians, par rapport à la verticale.
 *
 * On ne regarde QUE le masque : une fois le fond retiré, la silhouette est un
 * objet long et à peu près symétrique, et son axe principal est l'axe de la
 * bouteille. Les moments d'ordre deux le donnent directement, sans avoir à
 * chercher ni le goulot ni le culot.
 *
 * Renvoie 0 — c'est-à-dire « ne touche à rien » — dans les deux cas où la
 * mesure ne veut rien dire :
 *
 *   • la forme n'est pas assez ALLONGÉE (gros plan d'étiquette, détourage qui a
 *     ramassé le plan de travail) : son axe principal est alors arbitraire ;
 *   • l'écart dépasse 25°, ce qu'aucune bouteille photographiée debout ne fait.
 *     À ce stade c'est la segmentation qui s'est trompée, et redresser
 *     aggraverait.
 */
function inclinaison(img: ImageData): number {
    const { width: w, height: h, data } = img;
    let m00 = 0, m10 = 0, m01 = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 24) { m00++; m10 += x; m01 += y; }
        }
    }
    if (m00 < 400) return 0;
    const cx = m10 / m00, cy = m01 / m00;

    let mu20 = 0, mu02 = 0, mu11 = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 24) {
                const dx = x - cx, dy = y - cy;
                mu20 += dx * dx; mu02 += dy * dy; mu11 += dx * dy;
            }
        }
    }
    mu20 /= m00; mu02 /= m00; mu11 /= m00;

    // Allongement : rapport des deux valeurs propres de la matrice de
    // covariance. Une bouteille dépasse largement 3 ; un carré vaut 1.
    const t = Math.sqrt(4 * mu11 * mu11 + (mu20 - mu02) * (mu20 - mu02));
    const l1 = (mu20 + mu02 + t) / 2, l2 = (mu20 + mu02 - t) / 2;
    if (l2 <= 0 || l1 / l2 < 3) return 0;

    // Angle de l'axe principal par rapport à l'horizontale, puis écart à la
    // verticale ramené dans [-90°, 90°].
    const theta = 0.5 * Math.atan2(2 * mu11, mu20 - mu02);
    const ecart = theta > 0 ? theta - Math.PI / 2 : theta + Math.PI / 2;
    if (Math.abs(ecart) > 25 * Math.PI / 180) return 0;
    // Sous un degré, la rotation ne ferait qu'ajouter du flou de rééchantillonnage.
    return Math.abs(ecart) < 1 * Math.PI / 180 ? 0 : ecart;
}

/** Remet la bouteille d'aplomb. Le canevas grandit pour ne rien rogner. */
function redresser(cv: HTMLCanvasElement, angle: number): HTMLCanvasElement {
    const diag = Math.ceil(Math.hypot(cv.width, cv.height));
    const out = document.createElement('canvas');
    out.width = diag; out.height = diag;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    if (!ctx) return cv;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(diag / 2, diag / 2);
    ctx.rotate(-angle);
    ctx.drawImage(cv, -cv.width / 2, -cv.height / 2);
    return out;
}

/* ── 1 ter. Égalisation de l'exposition ───────────────────────────────────── */

/**
 * Remonte l'exposition d'une photo prise chez soi, SANS toucher aux couleurs.
 *
 * POURQUOI PAS DE BALANCE DES BLANCS
 * ----------------------------------
 * Elle a été écrite, mesurée, puis retirée. Deux références possibles, deux
 * impasses :
 *
 *   • L'ÉTIQUETTE, en pariant qu'elle est blanche. Faux sur un sauternes doré
 *     ou un champagne : on effacerait l'or, c'est-à-dire l'étiquette même qu'on
 *     vient montrer. La parade — renoncer quand ces pixels sont très saturés —
 *     ne marche pas non plus, une lampe chaude AJOUTANT de la saturation : elle
 *     désarme la correction exactement quand elle servirait.
 *
 *   • LE FOND, par gris-monde. Faux sur un plan de travail en bois, qui est ce
 *     qu'il y a derrière la plupart des bouteilles photographiées chez soi : on
 *     en déduit « lumière orange », on corrige vers le bleu, l'étiquette sort
 *     verte. Mesuré, pas supposé. Et vérifier d'abord que le fond est neutre ne
 *     sauve rien : sous une lampe chaude, un mur gris ne paraît plus gris — la
 *     mesure ne sait pas distinguer la lampe de la peinture.
 *
 * C'est le problème de la constance chromatique, mal posé sur une image isolée.
 * Le résoudre demanderait un modèle entraîné pour ça. Entre une bouteille un
 * peu chaude et une étiquette d'une couleur qu'elle n'a jamais eue, on garde la
 * première : la cave sert à reconnaître ses propres bouteilles.
 *
 * Reste l'exposition, qui elle est sans ambiguïté. Le gain s'applique aux trois
 * canaux ensemble : la teinte ne bouge pas, seule la clarté est alignée. C'est
 * ce qui rapproche deux photos prises l'une en plein jour, l'autre le soir.
 *
 * Il est AMORTI de moitié et borné : une correction franche transforme un
 * éclairage tamisé en photo au flash, ce qui est un autre défaut, pas une
 * correction. Mieux vaut une bouteille un peu sombre qu'une bouteille cramée.
 */
function egaliserExposition(img: ImageData): void {
    const { data } = img;
    const n = data.length / 4;

    // Histogramme de luminance sur la bouteille seule : le fond est transparent
    // et n'a rien à dire de l'exposition du sujet.
    const hist = new Uint32Array(256);
    let comptes = 0;
    for (let p = 0; p < n; p++) {
        if (data[p * 4 + 3] <= 24) continue;
        const l = (data[p * 4] * 299 + data[p * 4 + 1] * 587 + data[p * 4 + 2] * 114) / 1000 | 0;
        hist[l]++; comptes++;
    }
    if (comptes < 500) return;

    // Les 4 % de pixels les plus clairs — l'étiquette, presque toujours — sont
    // visés à 236. C'est le repère le plus stable d'une bouteille à l'autre.
    const cible = comptes * 0.04;
    let cumul = 0, seuil = 255;
    for (let l = 255; l >= 0; l--) { cumul += hist[l]; if (cumul >= cible) { seuil = l; break; } }

    let somme = 0, clairs = 0;
    for (let l = seuil; l < 256; l++) { somme += l * hist[l]; clairs += hist[l]; }
    if (clairs < 100) return;

    const moy = somme / clairs;
    const gain = Math.min(1.5, Math.max(0.9, 1 + (236 / (moy || 1) - 1) * 0.5));
    // Un gain d'un pour cent ne se voit pas et coûte un parcours de l'image.
    if (Math.abs(gain - 1) < 0.01) return;

    for (let p = 0; p < n; p++) {
        if (data[p * 4 + 3] <= 24) continue;
        for (let c = 0; c < 3; c++) {
            const v = data[p * 4 + c] * gain;
            data[p * 4 + c] = v > 255 ? 255 : v;
        }
    }
}

/* ── 2. Boîte englobante ──────────────────────────────────────────────────── */

type Boite = { x: number; y: number; w: number; h: number };

/**
 * Boîte de ce qui reste opaque.
 *
 * Le seuil est à 24 et non à 0 : les bords adoucis laissent une frange de
 * pixels presque transparents qui, comptés, gonflent la boîte de plusieurs
 * pixels — et déplacent la bouteille d'autant.
 */
function boiteOpaque(img: ImageData): Boite | null {
    const { width: w, height: h, data } = img;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 24) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
        }
    }
    if (x1 < 0) return null;
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * La silhouette obtenue ressemble-t-elle à une bouteille ?
 *
 * POURQUOI CE CONTRÔLE EXISTE
 * ---------------------------
 * Le modèle de segmentation détecte l'objet SAILLANT, ce qui n'est pas tout à
 * fait « la bouteille ». Photographiez-en une à côté d'un plat, d'un verre ou
 * d'une assiette, et il rapporte les deux dans le même masque. Sans vérification,
 * on prenait ce masque pour argent comptant : la découpe entrait en cave avec le
 * décor, et le repli sur la photo du marchand — prévu exactement pour ce cas —
 * n'était jamais atteint, puisque la confiance avait déjà été affirmée.
 *
 * Deux mesures suffisent à trancher, et aucune ne demande de modèle :
 *
 *   • l'ÉLANCEMENT. Une bouteille debout tient dans une boîte nettement plus
 *     haute que large. Un masque qui a ramassé une assiette est à peu près
 *     carré ;
 *   • le REMPLISSAGE de cette boîte. Une bouteille est une forme pleine et
 *     continue ; deux objets distincts laissent entre eux du vide qui compte
 *     dans la boîte mais pas dans le masque.
 *
 * Les bornes sont larges à dessein : une liqueur trapue descend à 1,8, un
 * magnum élancé monte à 6. Il s'agit d'écarter l'absurde, pas de juger la forme.
 */
function plausibleBouteille(boite: Boite, aireOpaque: number, cv: { width: number; height: number }): boolean {
    // Encore l'image entière : rien n'a été détouré.
    if (boite.w > cv.width * 0.97 && boite.h > cv.height * 0.97) return false;
    const elancement = boite.h / Math.max(1, boite.w);
    if (elancement < 1.8 || elancement > 6) return false;
    const remplissage = aireOpaque / Math.max(1, boite.w * boite.h);
    return remplissage >= 0.38;
}

/** Nombre de pixels opaques — le dénominateur du remplissage. */
function aireOpaque(img: ImageData): number {
    const { data } = img;
    let n = 0;
    for (let p = 0; p < data.length / 4; p++) if (data[p * 4 + 3] > 24) n++;
    return n;
}

/**
 * La silhouette est-elle CONTINUE, ou le détourage a-t-il mordu dedans ?
 *
 * LE CAS QUI L'IMPOSE
 * -------------------
 * Un packshot de marchand, c'est une bouteille sur fond blanc — et une
 * étiquette, très souvent, est blanche elle aussi. Quand elle s'étend sur
 * presque toute la largeur du corps, ses bords touchent l'arête du verre, et
 * les quelques pixels d'anti-crénelage qui les séparent sont, eux aussi, du
 * blanc. Le remplissage depuis les bords y passe comme par une porte et
 * DÉVORE L'ÉTIQUETTE. Il ne reste que les lettres sombres, qui flottent.
 *
 * Le pourtour, lui, a bien été effacé : la confiance annoncée par
 * `detourerFondUni` est excellente, et le modèle de segmentation — qui aurait
 * traité ce cas sans peine — n'est jamais appelé. Vérifié sur une bouteille
 * réelle : couverture tombée à 15,4 % au lieu de 20, trou en plein milieu du
 * corps.
 *
 * On mesure donc la LARGEUR OPAQUE ligne par ligne. Une bouteille, vue de face,
 * a un profil qui varie doucement : goulot, épaule, corps. Une entaille brutale
 * au milieu du corps n'existe pas — sauf quand on vient de la creuser.
 */
function silhouetteContinue(img: ImageData, boite: Boite): boolean {
    const { width: w, data } = img;
    const largeurs: number[] = [];
    for (let y = boite.y; y < boite.y + boite.h; y++) {
        let n = 0;
        for (let x = boite.x; x < boite.x + boite.w; x++) if (data[(y * w + x) * 4 + 3] > 24) n++;
        largeurs.push(n);
    }
    if (largeurs.length < 20) return true;

    // Le corps : la moitié basse, là où la bouteille est pleine largeur et où
    // vivent les étiquettes. Le goulot fausserait la médiane.
    const debutCorps = Math.floor(largeurs.length * 0.45);
    const corps = largeurs.slice(debutCorps);
    const tri = [...corps].sort((a, b) => a - b);
    const mediane = tri[tri.length >> 1];
    if (!mediane) return true;

    // Une entaille = plusieurs lignes d'affilée nettement plus étroites. Une
    // seule ligne peut venir du bruit ; cinq pour cent de la hauteur, non.
    const plancher = mediane * 0.62;
    const minLignes = Math.max(3, Math.round(corps.length * 0.05));
    let suite = 0;
    for (const l of corps) {
        if (l < plancher) { if (++suite >= minLignes) return false; }
        else suite = 0;
    }
    return true;
}

/* ── 3. Pose ──────────────────────────────────────────────────────────────── */

/**
 * Redessine la découpe à taille et position FIXES.
 *
 * C'est l'étape qui standardise réellement. Même un détourage imparfait donne
 * une grille cohérente dès lors que toutes les bouteilles ont la même hauteur
 * et la même ligne de pose.
 */
function poser(source: HTMLCanvasElement, boite: Boite, l = CADRE_L, h = CADRE_H): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = l; out.height = h;
    const ctx = out.getContext('2d');
    if (!ctx) return source;

    const echelle = Math.min(
        (h * HAUTEUR_BOUTEILLE) / boite.h,
        (l * LARGEUR_MAX) / boite.w,
    );
    const dw = boite.w * echelle, dh = boite.h * echelle;
    const dx = (l - dw) / 2;
    const dy = h * LIGNE_DE_POSE - dh;

    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, boite.x, boite.y, boite.w, boite.h, dx, dy, dw, dh);
    return out;
}

/* ── Sortie ───────────────────────────────────────────────────────────────── */

let webpOk: boolean | null = null;
/** Le navigateur sait-il ENCODER du webp ? Safari < 16 ne sait que le lire. */
function supporteWebp(): boolean {
    if (webpOk !== null) return webpOk;
    try {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 1;
        webpOk = cv.toDataURL('image/webp').startsWith('data:image/webp');
    } catch { webpOk = false; }
    return webpOk;
}

/**
 * Sort la découpe en gardant la transparence, au plus léger.
 *
 * La cave vit dans le stockage local, étroit (~5 Mo sur Safari) : le webp avec
 * alpha pèse trois à quatre fois moins que le PNG à qualité égale. Le PNG reste
 * le repli, il n'y a pas d'autre format transparent universel.
 */
function encoder(cv: HTMLCanvasElement, qualite: number): string {
    if (supporteWebp()) {
        const url = cv.toDataURL('image/webp', qualite);
        if (url.startsWith('data:image/webp')) return url;
    }
    return cv.toDataURL('image/png');
}

/** Une photo déjà passée par ici : transparente, donc webp ou png. */
export function estNormalisee(photo?: string): boolean {
    return !!photo && (photo.startsWith('data:image/webp') || photo.startsWith('data:image/png'));
}

/* ── Enchaînement complet ─────────────────────────────────────────────────── */

/**
 * Le modèle de segmentation, branché à part.
 *
 * Il pèse 4,6 Mo : il ne doit pas entrer dans le paquet principal, ni se
 * charger tant qu'une photo à fond uni suffit. `bouteille-modele` fait donc
 * l'objet d'un import dynamique, et son absence n'est pas une erreur.
 */
async function segmenterAuModele(cv: HTMLCanvasElement, ctx: CanvasRenderingContext2D, px: ImageData): Promise<boolean> {
    try {
        const mod = await import('@/lib/bouteille-modele');
        const alpha = await mod.masquerBouteille(cv);
        if (!alpha) return false;
        const { data } = px;
        for (let p = 0; p < alpha.length; p++) data[p * 4 + 3] = alpha[p];
        ctx.putImageData(px, 0, 0);
        return true;
    } catch {
        return false;
    }
}

export type OptionsNormalisation = {
    /** Autoriser le modèle quand le fond n'est pas uni. Défaut : oui. */
    modele?: boolean;
    qualite?: number;
    /**
     * Hauteur du cadre de sortie, la largeur suivant le rapport 3/4. Sert au
     * repli en vignette quand le stockage du navigateur sature.
     */
    hauteur?: number;
};

/**
 * Détoure, recadre et pose une photo de bouteille.
 *
 * Renvoie `null` si l'image est illisible : l'appelant garde alors ce qu'il
 * avait plutôt que de perdre la photo.
 */
export async function normaliserBouteille(
    source: string,
    opts: OptionsNormalisation = {},
): Promise<Normalisation | null> {
    const { modele = true, qualite = 0.86, hauteur = CADRE_H } = opts;
    const img = await charger(source);
    if (!img) return null;

    const travail = canevasDeTravail(img);
    if (!travail) return null;
    const { cv, ctx } = travail;

    let px: ImageData;
    try { px = ctx.getImageData(0, 0, cv.width, cv.height); }
    catch { return null; }                       // canevas teinté : rien à faire ici

    let moteur: Detourage['moteur'] = 'aucun';
    let confiance = detourerFondUni(px);
    // Le pourtour effacé ne suffit pas : encore faut-il que le remplissage
    // n'ait pas traversé une étiquette claire. Voir `silhouetteContinue`.
    const boiteUni = confiance >= 0.9 ? boiteOpaque(px) : null;
    if (boiteUni && silhouetteContinue(px, boiteUni)) {
        ctx.putImageData(px, 0, 0);
        moteur = 'fond-uni';
    } else if (modele) {
        // Fond chargé : le remplissage depuis les bords n'y peut rien. On repart
        // de l'image intacte et on demande un vrai masque.
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        px = ctx.getImageData(0, 0, cv.width, cv.height);
        if (await segmenterAuModele(cv, ctx, px)) {
            px = ctx.getImageData(0, 0, cv.width, cv.height);
            moteur = 'modele';
            confiance = 0.8;
        } else {
            // Ni fond uni ni modèle : on garde tout de même le meilleur
            // remplissage obtenu, qui vaut mieux que le rectangle entier.
            ctx.drawImage(img, 0, 0, cv.width, cv.height);
            px = ctx.getImageData(0, 0, cv.width, cv.height);
            confiance = detourerFondUni(px);
            ctx.putImageData(px, 0, 0);
            moteur = confiance > 0 ? 'fond-uni' : 'aucun';
        }
    } else {
        ctx.putImageData(px, 0, 0);
        moteur = confiance > 0 ? 'fond-uni' : 'aucun';
    }

    /*
     * Le détourage est-il exploitable ? Tant qu'on n'a pas répondu, la confiance
     * annoncée par le moteur ne vaut rien : `segmenterAuModele` renvoie 0,8 dès
     * qu'il obtient UN masque, sans savoir de quoi.
     *
     * Si la silhouette n'est pas celle d'une bouteille, on n'essaie ni de la
     * redresser ni de l'égaliser — on travaillerait sur le décor. L'image sort
     * simplement mise au format, avec une confiance nulle : c'est ce zéro qui
     * fait passer l'appelant à la photo du marchand.
     */
    /*
     * UN SEUL OBJET, quel que soit le moteur qui a produit le masque.
     *
     * C'est délibérément ici, après les deux moteurs et avant tout le reste :
     * la boîte englobante, le redressement, l'exposition et l'extraction de
     * l'étiquette se calculent tous sur la silhouette, et un verre resté à côté
     * les fausse tous les quatre — la boîte s'élargit, l'axe principal penche,
     * l'histogramme compte les pixels du verre, et la bande d'étiquette ramasse
     * son pied.
     */
    garderPlusGrandeTache(px);
    ctx.putImageData(px, 0, 0);

    const premiere = boiteOpaque(px);
    if (!premiere) return null;

    const largeurSortie = Math.round(hauteur * CADRE_L / CADRE_H);

    if (!plausibleBouteille(premiere, aireOpaque(px), cv)) {
        // L'image d'ORIGINE, sans son masque douteux : un plat à moitié effacé
        // est plus laid que le plat entier.
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        const brut = poser(cv, { x: 0, y: 0, w: cv.width, h: cv.height }, largeurSortie, hauteur);
        return { dataUrl: encoder(brut, qualite), confiance: 0, moteur };
    }

    /*
     * La bouteille est isolée : on peut maintenant la rapprocher d'un packshot.
     *
     * L'ORDRE compte. Le redressement d'abord, parce que la boîte englobante
     * d'une bouteille penchée est plus large que la bouteille et la poserait
     * trop petite. L'exposition ensuite, sur les pixels tournés. La pose en
     * dernier, une fois la silhouette définitive.
     */
    let travailCv = cv;
    let travailPx = px;

    const angle = inclinaison(travailPx);
    if (angle) {
        travailCv = redresser(travailCv, angle);
        const rctx = travailCv.getContext('2d', { willReadFrequently: true });
        if (!rctx) return null;
        try { travailPx = rctx.getImageData(0, 0, travailCv.width, travailCv.height); }
        catch { return null; }
    }

    egaliserExposition(travailPx);
    const fctx = travailCv.getContext('2d');
    if (!fctx) return null;
    fctx.putImageData(travailPx, 0, 0);

    // La rotation a déplacé la silhouette : sa boîte doit être reprise.
    const boite = boiteOpaque(travailPx);
    if (!boite) return null;

    const pose = poser(travailCv, boite, largeurSortie, hauteur);
    return { dataUrl: encoder(pose, qualite), confiance, moteur, redresse: Math.round(angle * 180 / Math.PI) };
}

/**
 * Même chose à partir d'une ADRESSE.
 *
 * Le navigateur refuse de lire les pixels d'une image d'un autre domaine : on
 * la rapatrie par `/api/img`, le proxy qui sert déjà « Partager en image ».
 */
export async function normaliserDepuisUrl(
    url: string,
    opts: OptionsNormalisation = {},
): Promise<Normalisation | null> {
    const propre = (url || '').trim();
    if (!propre) return null;
    if (propre.startsWith('data:')) return normaliserBouteille(propre, opts);

    // Un marchand lent NE DOIT PAS bloquer l'ajout de la bouteille.
    const stop = new AbortController();
    const minuteur = setTimeout(() => stop.abort(), 9000);
    try {
        const res = await fetch(`/api/img?url=${encodeURIComponent(propre)}`, { signal: stop.signal });
        if (!res.ok) return null;
        const blob = await res.blob();
        const dataUrl: string = await new Promise((ok, ko) => {
            const fr = new FileReader();
            fr.onload = () => ok(String(fr.result));
            fr.onerror = ko;
            fr.readAsDataURL(blob);
        });
        return await normaliserBouteille(dataUrl, opts);
    } catch {
        return null;
    } finally {
        clearTimeout(minuteur);
    }
}
