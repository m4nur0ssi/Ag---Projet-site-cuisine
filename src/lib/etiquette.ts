'use client';

/**
 * L'étiquette réelle, posée sur une bouteille type.
 *
 * CE QUE ÇA FABRIQUE, ET CE QUE ÇA N'EST PAS
 * ------------------------------------------
 * `bouteille.ts` normalise LA bouteille photographiée : même hauteur, même
 * ligne de pose, même fond. Les silhouettes restent pourtant celles des vraies
 * bouteilles — bordelaise épaulée, bourguignonne pentue, flûte élancée — et une
 * étagère de vingt fiches garde donc vingt profils différents.
 *
 * Ici on va plus loin : on ne garde de la photo que l'ÉTIQUETTE, et on la pose
 * sur un verre dessiné, identique pour toutes les bouteilles d'une même
 * couleur. La grille devient parfaitement régulière.
 *
 * Il faut en être conscient : l'image produite ne montre plus la bouteille
 * qu'on possède. Le verre, la capsule et le format sont une convention ; seule
 * l'étiquette est vraie. C'est un choix assumé — on reconnaît un vin à son
 * étiquette, pas à son verre — mais ce n'est pas une photographie.
 *
 * COMMENT
 * -------
 *   1. TROUVER l'étiquette sur la bouteille détourée : c'est la bande
 *      horizontale du corps qui tranche avec le verre ;
 *   2. DÉROULER : une étiquette collée sur un cylindre est comprimée vers les
 *      bords. On l'aplatit par la projection inverse ;
 *   3. RÉENROULER sur le cylindre du gabarit, puis MULTIPLIER par son ombrage
 *      pour qu'elle épouse le verre au lieu d'y être collée à plat.
 */

import { CADRE_L, CADRE_H } from '@/lib/bouteille';
import type { WineColor } from '@/lib/cave';

/**
 * Les couleurs sont celles de la cave — c'est le même vocabulaire, et il ne
 * doit pas diverger : ajouter un type de bouteille dans `cave.ts` sans lui
 * donner de gabarit ici casserait la compilation, ce qui est exactement le
 * rappel qu'on veut.
 */
export type CouleurVerre = WineColor;

/* ── Géométrie du gabarit ─────────────────────────────────────────────────── */

/**
 * Une bordelaise, en proportions relatives au cadre.
 *
 * Une seule silhouette pour toutes les couleurs : c'est le but même de la
 * manœuvre. Seul le VERRE change de teinte — vert très sombre pour un rouge,
 * vert pâle pour un blanc, presque incolore pour un rosé, ambré pour une
 * liqueur.
 */
const G = {
    /** Hauteur totale, part du cadre — la même que dans `bouteille.ts`. */
    hauteur: 0.85,
    /** Bas de la bouteille, part du cadre — la même ligne de pose. */
    pose: 0.93,
    /** Largeur du corps, part du cadre. */
    corps: 0.315,
    /** Largeur du goulot, part de la largeur du corps. */
    goulot: 0.255,
    /** Hauteur du goulot, part de la hauteur totale. */
    hGoulot: 0.315,
    /** Hauteur de l'épaule (la transition), part de la hauteur totale. */
    hEpaule: 0.085,
    /** Capsule, part de la hauteur totale. */
    hCapsule: 0.145,
    /** Étiquette : haut et bas, en part de la hauteur totale depuis le BAS. */
    etiquetteBas: 0.10,
    etiquetteHaut: 0.44,
};

/** Teinte du verre par couleur de vin. */
const VERRE: Record<CouleurVerre, { sombre: string; clair: string; reflet: string }> = {
    // Un rouge est en verre vert très foncé, presque noir, et le vin l'assombrit.
    rouge: { sombre: '#0b0f0a', clair: '#2a3a24', reflet: 'rgba(190,225,180,.30)' },
    // Un blanc sec : verre vert clair, contenu pâle qui laisse passer la lumière.
    blanc: { sombre: '#2f3a1c', clair: '#8a9a4e', reflet: 'rgba(240,250,210,.42)' },
    // Un rosé se vend en verre incolore : on voit la robe.
    rose: { sombre: '#7a4a4a', clair: '#e5a9a4', reflet: 'rgba(255,240,238,.50)' },
    // Liquoreux : verre clair, robe ambrée.
    liqueur: { sombre: '#5a3a10', clair: '#c98a2b', reflet: 'rgba(255,235,190,.45)' },
    // Champagne : verre vert très sombre et épais, robe dorée.
    champagne: { sombre: '#1a2312', clair: '#4a5a28', reflet: 'rgba(240,240,200,.38)' },
    // Cidre : verre brun-vert, robe ambrée.
    cidre: { sombre: '#2a2010', clair: '#8a6a28', reflet: 'rgba(255,230,180,.40)' },
    'cidre-rose': { sombre: '#4a2a22', clair: '#c98a78', reflet: 'rgba(255,230,220,.44)' },
};

type Profil = { hautY: number; basY: number; demiLargeur: (y: number) => number };

/**
 * Le profil de la bouteille : sa demi-largeur à chaque hauteur.
 *
 * Tout le reste s'en déduit — le tracé de la silhouette, l'ombrage cylindrique,
 * et l'enroulement de l'étiquette. Une seule source de vérité pour la forme,
 * sinon l'étiquette déborde du verre d'un pixel ou deux, ce qui se voit.
 */
function profil(l: number, h: number): Profil {
    const hautTotal = h * G.hauteur;
    const basY = h * G.pose;
    const hautY = basY - hautTotal;
    const demiCorps = (l * G.corps) / 2;
    const demiGoulot = demiCorps * G.goulot;
    const yGoulot = hautY + hautTotal * G.hGoulot;          // fin du goulot
    const yEpaule = yGoulot + hautTotal * G.hEpaule;        // début du corps

    return {
        hautY,
        basY,
        demiLargeur: (y: number) => {
            if (y < hautY || y > basY) return 0;
            if (y <= yGoulot) return demiGoulot;
            if (y >= yEpaule) return demiCorps;
            // Épaule : un quart de cosinus, qui donne la courbe pleine d'une
            // bordelaise plutôt que la diagonale d'un cône.
            const t = (y - yGoulot) / (yEpaule - yGoulot);
            return demiGoulot + (demiCorps - demiGoulot) * Math.sin((t * Math.PI) / 2);
        },
    };
}

/* ── Le verre ─────────────────────────────────────────────────────────────── */

/** Le contour, tracé à partir du profil. */
function cheminBouteille(ctx: CanvasRenderingContext2D, l: number, p: Profil): void {
    const cx = l / 2;
    ctx.beginPath();
    const pas = 2;
    // Côté droit, de haut en bas.
    for (let y = p.hautY; y <= p.basY; y += pas) ctx.lineTo(cx + p.demiLargeur(y), y);
    ctx.lineTo(cx + p.demiLargeur(p.basY), p.basY);
    // Côté gauche, de bas en haut.
    for (let y = p.basY; y >= p.hautY; y -= pas) ctx.lineTo(cx - p.demiLargeur(y), y);
    ctx.closePath();
}

/**
 * Dessine la bouteille nue.
 *
 * Trois couches, et l'ordre compte : la teinte de fond, l'ombrage cylindrique
 * qui creuse les bords, puis le reflet vertical qui donne le verre. Sans le
 * deuxième, on obtient une silhouette plate ; sans le troisième, du plastique.
 */
function dessinerVerre(ctx: CanvasRenderingContext2D, l: number, h: number, couleur: CouleurVerre): Profil {
    const p = profil(l, h);
    const teinte = VERRE[couleur];
    const cx = l / 2;
    const demiCorps = (l * G.corps) / 2;
    const hautTotal = p.basY - p.hautY;

    ctx.save();
    cheminBouteille(ctx, l, p);
    ctx.clip();

    // 1. Teinte de base. Le verre est plus clair là où la lumière l'atteint —
    //    haut d'épaule et bas de culot — et sombre au milieu, où l'épaisseur
    //    traversée est la plus grande.
    const vertical = ctx.createLinearGradient(0, p.hautY, 0, p.basY);
    vertical.addColorStop(0, teinte.sombre);
    vertical.addColorStop(0.26, teinte.clair);
    vertical.addColorStop(0.46, teinte.sombre);
    vertical.addColorStop(0.88, teinte.sombre);
    vertical.addColorStop(1, teinte.clair);
    ctx.fillStyle = vertical;
    ctx.fillRect(0, p.hautY, l, hautTotal);

    /*
     * 2. Ombrage cylindrique, en DEUX passes.
     *
     * Une seule rampe donne un dégradé lisse qui se lit comme du plastique. Le
     * verre, lui, a une arête : sur les deux ou trois derniers pour cent de la
     * largeur, la lumière rase la paroi et la densité monte d'un coup. C'est
     * cette marche, plus que le dégradé, qui fait lire « bouteille ».
     */
    const cyl = ctx.createLinearGradient(cx - demiCorps, 0, cx + demiCorps, 0);
    cyl.addColorStop(0, 'rgba(0,0,0,.92)');
    cyl.addColorStop(0.06, 'rgba(0,0,0,.52)');
    cyl.addColorStop(0.22, 'rgba(0,0,0,.14)');
    cyl.addColorStop(0.44, 'rgba(0,0,0,0)');
    cyl.addColorStop(0.70, 'rgba(0,0,0,.16)');
    cyl.addColorStop(0.92, 'rgba(0,0,0,.62)');
    cyl.addColorStop(1, 'rgba(0,0,0,.95)');
    ctx.fillStyle = cyl;
    ctx.fillRect(0, p.hautY, l, hautTotal);

    // 3. Reflet principal : bande étroite à gauche du centre, plus un liseré
    //    plus fin à droite — c'est l'éclairage à deux sources d'un studio.
    const poserReflet = (xc: number, larg: number, force: number) => {
        const g = ctx.createLinearGradient(xc - larg, 0, xc + larg, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, teinte.reflet.replace(/[\d.]+\)$/, String(force) + ')'));
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, p.hautY, l, hautTotal);
    };
    poserReflet(cx - demiCorps * 0.46, demiCorps * 0.17, 0.55);
    poserReflet(cx + demiCorps * 0.62, demiCorps * 0.09, 0.22);

    // 4. Culot : l'ombre portée du fond de bouteille, une ellipse sombre.
    const culot = ctx.createRadialGradient(cx, p.basY, 1, cx, p.basY, demiCorps * 1.5);
    culot.addColorStop(0, 'rgba(0,0,0,.75)');
    culot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = culot;
    ctx.fillRect(cx - demiCorps, p.basY - demiCorps, demiCorps * 2, demiCorps);

    ctx.restore();

    /*
     * 5. La capsule, par-dessus le verre et non dedans : elle DÉBORDE du
     *    goulot, comme l'étain sur une vraie bouteille.
     */
    const hCapsule = hautTotal * G.hCapsule;
    const demiGoulot = demiCorps * G.goulot;
    const debordement = demiGoulot * 1.1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - debordement, p.hautY, debordement * 2, hCapsule);
    ctx.clip();
    const etain = ctx.createLinearGradient(cx - debordement, 0, cx + debordement, 0);
    etain.addColorStop(0, '#3a0d14');
    etain.addColorStop(0.3, '#8e1f2c');
    etain.addColorStop(0.46, '#c4515c');
    etain.addColorStop(0.62, '#8e1f2c');
    etain.addColorStop(1, '#2a0a10');
    ctx.fillStyle = etain;
    ctx.fillRect(cx - debordement, p.hautY, debordement * 2, hCapsule);
    // La bague sertie, en bas de capsule.
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(cx - debordement, p.hautY + hCapsule * 0.80, debordement * 2, hCapsule * 0.08);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(cx - debordement, p.hautY + hCapsule * 0.16, debordement * 2, hCapsule * 0.05);
    ctx.restore();

    // 6. Liseré d'arête : détache la bouteille du fond sombre de la carte.
    ctx.save();
    cheminBouteille(ctx, l, p);
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    return p;
}

/* ── Trouver l'étiquette ──────────────────────────────────────────────────── */

export type Rect = {
    x: number; y: number; w: number; h: number;
    /** Étendue du VERRE à ces mêmes lignes : elle donne le rayon du cylindre. */
    verre?: { x0: number; x1: number };
};

/**
 * Repère l'étiquette sur une bouteille DÉTOURÉE.
 *
 * L'étiquette est la bande du corps qui TRANCHE avec le verre. On raisonne donc
 * en écart, pas en clarté absolue : une étiquette crème sur un bordeaux est
 * claire, une étiquette noire sur un chablis est sombre, et les deux se
 * repèrent de la même façon.
 *
 * Ligne par ligne : la clarté moyenne des pixels opaques. Le verre donne une
 * courbe lisse ; l'étiquette, un plateau franc. On prend la plus longue bande
 * de lignes dont l'écart à la médiane dépasse un seuil.
 *
 * Renvoie `null` si rien ne ressort — bouteille sans étiquette visible, photo
 * trop sombre. L'appelant garde alors la bouteille normalisée, sans composer.
 */
export function trouverEtiquette(px: ImageData): Rect | null {
    const { width: w, height: h, data } = px;

    /*
     * On mesure un ÉCART DE COULEUR au verre, pas une clarté.
     *
     * Séparer sur la seule luminance suppose que l'étiquette est plus claire ou
     * plus sombre que le verre. C'est vrai d'une étiquette blanche sur un
     * bordeaux ; c'est faux d'une étiquette crème sur un cidre en verre vert
     * clair, où les deux ont la même clarté et ne diffèrent que par la teinte.
     * Mesuré sur un Écusson : seul le bandeau rouge ressortait, toute la partie
     * crème de l'étiquette passait pour du verre.
     *
     * La distance au verre, elle, voit les deux : une différence de clarté est
     * une distance, une différence de teinte aussi.
     */
    const moyR = new Float32Array(h), moyG = new Float32Array(h), moyB = new Float32Array(h);
    const presents = new Int32Array(h);
    for (let y = 0; y < h; y++) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let x = 0; x < w; x++) {
            const p = (y * w + x) * 4;
            if (data[p + 3] <= 24) continue;
            r += data[p]; g += data[p + 1]; b += data[p + 2]; n++;
        }
        presents[y] = n;
        if (n) { moyR[y] = r / n; moyG[y] = g / n; moyB[y] = b / n; }
    }

    let large = 0;
    for (let y = 0; y < h; y++) if (presents[y] > large) large = presents[y];
    if (!large) return null;

    // Le corps : une plage CONTINUE, du premier au dernier rang assez large.
    // Filtrer ligne à ligne donnait une liste trouée, dans laquelle chercher une
    // bande contiguë n'a pas de sens.
    let haut = -1, bas = -1;
    for (let y = 0; y < h; y++) {
        if (presents[y] > large * 0.72) { if (haut < 0) haut = y; bas = y; }
    }
    if (haut < 0 || bas - haut < 24) return null;

    /*
     * Couleur du VERRE : la médiane des lignes du corps.
     *
     * Le verre occupe toujours plus de hauteur que l'étiquette — épaule, bas de
     * bouteille, marges — donc la médiane tombe dedans. Un pari plus sûr que de
     * désigner une zone d'avance, qui dépendrait du format de la bouteille.
     */
    const med = (a: Float32Array) => {
        const v: number[] = [];
        for (let y = haut; y <= bas; y++) if (presents[y]) v.push(a[y]);
        if (!v.length) return 0;
        v.sort((p, q) => p - q);
        return v[v.length >> 1];
    };
    const vr = med(moyR), vg = med(moyG), vb = med(moyB);

    const ecart = new Float32Array(h);
    let maxEcart = 0;
    for (let y = haut; y <= bas; y++) {
        if (!presents[y]) { ecart[y] = -1; continue; }
        const e = Math.abs(moyR[y] - vr) + Math.abs(moyG[y] - vg) + Math.abs(moyB[y] - vb);
        ecart[y] = e;
        if (e > maxEcart) maxEcart = e;
    }
    if (maxEcart < 24) return null;          // bouteille sans étiquette visible

    /*
     * Otsu sur ces écarts : il cherche la coupure qui minimise la variance à
     * l'intérieur des deux groupes. C'est la méthode faite pour un histogramme à
     * deux bosses — ici « verre » et « étiquette » — et elle ne suppose ni
     * laquelle est laquelle, ni de combien elles s'écartent.
     */
    const hist = new Uint32Array(256);
    let total = 0;
    for (let y = haut; y <= bas; y++) {
        if (ecart[y] < 0) continue;
        hist[Math.min(255, Math.round((ecart[y] / maxEcart) * 255))]++;
        total++;
    }
    if (total < 20) return null;
    let sommeTotale = 0;
    for (let v = 0; v < 256; v++) sommeTotale += v * hist[v];
    let sommeBasse = 0, poidsBas = 0, meilleureVariance = -1, coupure = 128;
    for (let v = 0; v < 256; v++) {
        poidsBas += hist[v];
        if (!poidsBas) continue;
        const poidsHaut = total - poidsBas;
        if (!poidsHaut) break;
        sommeBasse += v * hist[v];
        const moyBas = sommeBasse / poidsBas;
        const moyHaut = (sommeTotale - sommeBasse) / poidsHaut;
        const variance = poidsBas * poidsHaut * (moyBas - moyHaut) * (moyBas - moyHaut);
        if (variance > meilleureVariance) { meilleureVariance = variance; coupure = v; }
    }
    const seuil = (coupure / 255) * maxEcart;

    /*
     * La meilleure bande, pas la plus longue.
     *
     * Une bouteille porte souvent deux papiers — l'étiquette et la
     * contre-étiquette ou la collerette. La plus longue n'est pas toujours la
     * bonne ; celle qui tranche le plus, si. On note donc chaque bande par sa
     * hauteur multipliée par son écart moyen.
     */
    let meilleur = { debut: -1, fin: -1, score: 0 };
    let debut = -1, somme = 0, n = 0;
    const fermer = (fin: number) => {
        if (debut < 0) return;
        const hauteurBande = fin - debut + 1;
        const score = hauteurBande * (somme / Math.max(1, n));
        if (hauteurBande >= (bas - haut) * 0.08 && score > meilleur.score) {
            meilleur = { debut, fin, score };
        }
        debut = -1; somme = 0; n = 0;
    };
    for (let y = haut; y <= bas; y++) {
        if (ecart[y] >= 0 && ecart[y] > seuil) {
            if (debut < 0) debut = y;
            somme += ecart[y]; n++;
        } else fermer(y - 1);
    }
    fermer(bas);
    if (meilleur.debut < 0) return null;

    /*
     * HYSTÉRÉSIS : seuil fort pour amorcer, seuil faible pour étendre.
     *
     * Une étiquette n'est pas d'un seul tenant. Celle d'un cidre porte un logo
     * sombre en haut, un fond crème au milieu, un bandeau rouge en bas : entre
     * les trois, l'écart au verre redescend et le seuil unique découpe le papier
     * en morceaux. On ne gardait alors que le plus contrasté — le bandeau rouge
     * seul, ou le logo seul.
     *
     * On part donc du morceau le plus franc, et on ÉTEND tant que l'écart reste
     * au-dessus de la moitié du seuil. C'est le principe du seuillage par
     * hystérésis : décider où commencer est difficile, décider où continuer
     * l'est beaucoup moins.
     */
    const faible = seuil * 0.45;
    while (meilleur.debut > haut && ecart[meilleur.debut - 1] > faible) meilleur.debut--;
    while (meilleur.fin < bas && ecart[meilleur.fin + 1] > faible) meilleur.fin++;

    /*
     * Bords gauche et droit : les colonnes DE L'ÉTIQUETTE, pas celles de la
     * bouteille. Une étiquette ne fait jamais toute la largeur du verre ;
     * prendre toute l'étendue opaque revenait à dérouler du verre avec, puis à
     * l'étaler sur le gabarit — l'étiquette débordait jusqu'aux arêtes.
     */
    let x0 = w, x1 = -1;
    for (let x = 0; x < w; x++) {
        let papier = 0, compte = 0;
        for (let y = meilleur.debut; y <= meilleur.fin; y++) {
            const p = (y * w + x) * 4;
            if (data[p + 3] <= 24) continue;
            compte++;
            const e = Math.abs(data[p] - vr) + Math.abs(data[p + 1] - vg) + Math.abs(data[p + 2] - vb);
            if (e > seuil) papier++;
        }
        if (compte > 0 && papier > compte * 0.5) { if (x < x0) x0 = x; x1 = x; }
    }
    if (x1 <= x0) {
        x0 = w; x1 = -1;
        for (let y = meilleur.debut; y <= meilleur.fin; y++) {
            for (let x = 0; x < w; x++) {
                if (data[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
            }
        }
    }
    if (x1 <= x0) return null;

    // Étendue du VERRE sur ces lignes : c'est elle, et non l'étiquette, qui
    // donne le rayon du cylindre — donc les angles. Voir `derouler`.
    let v0 = w, v1 = -1;
    for (let y = meilleur.debut; y <= meilleur.fin; y++) {
        for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 24) { if (x < v0) v0 = x; if (x > v1) v1 = x; }
        }
    }

    return {
        x: x0, y: meilleur.debut, w: x1 - x0 + 1, h: meilleur.fin - meilleur.debut + 1,
        verre: v1 > v0 ? { x0: v0, x1: v1 } : undefined,
    };
}

/* ── Dérouler, réenrouler ─────────────────────────────────────────────────── */

/**
 * Aplatit l'étiquette : la photo d'un cylindre est comprimée vers les bords.
 *
 * Un point de la surface à l'angle θ se projette en x = R·sin θ. L'inverse
 * rend donc θ = asin(x/R), et c'est cet angle qui est réparti régulièrement sur
 * l'étiquette déroulée. Sans cette étape, le texte des bords reste écrasé et se
 * voit d'autant plus qu'on l'agrandit ensuite.
 *
 * Seuls les 75 % centraux sont repris : au-delà, la surface fuit trop vite et
 * n'apporte que du flou étiré.
 */
/**
 * Jusqu'où l'on peut lire la surface d'un cylindre photographié de face.
 *
 * Au-delà, la surface fuit si vite qu'un pixel de l'image couvre plusieurs
 * centimètres de papier : on n'y récupère que du flou étiré. On plafonne donc
 * les angles, sans jamais RÉDUIRE l'arc réellement occupé par l'étiquette.
 */
const ANGLE_MAX = 78 * Math.PI / 180;

/** L'angle, sur le cylindre, d'un point projeté en `x`. */
function angleDe(x: number, centre: number, rayon: number): number {
    const t = Math.max(-1, Math.min(1, (x - centre) / Math.max(1, rayon)));
    return Math.asin(t);
}

type Deroule = { plat: HTMLCanvasElement; theta0: number; theta1: number };

/**
 * Aplatit l'étiquette, en ANGLES et non en pixels.
 *
 * Un point de la surface à l'angle θ se projette en x = R·sin θ ; l'inverse
 * rend θ = asin(x/R), et c'est cet angle qui est réparti régulièrement sur
 * l'étiquette déroulée. Le rayon R vient de la largeur du VERRE, pas de celle
 * de l'étiquette : c'est le verre qui est le cylindre.
 *
 * On renvoie l'arc occupé (θ0 → θ1). Le reposer tel quel sur le gabarit est ce
 * qui garantit qu'une étiquette large reste large et qu'une étroite reste
 * étroite. Une version antérieure supposait un arc fixe pour toutes : les
 * étiquettes qui font presque le tour du verre — un pavillon-rouge, par
 * exemple — se retrouvaient poussées hors du champ visible et rognées aux deux
 * bouts.
 */
function derouler(src: HTMLCanvasElement, zone: Rect): Deroule {
    const verre = zone.verre ?? { x0: zone.x, x1: zone.x + zone.w - 1 };
    const R = Math.max(1, (verre.x1 - verre.x0) / 2);
    const centre = verre.x0 + R;

    const theta0 = Math.max(-ANGLE_MAX, angleDe(zone.x, centre, R));
    const theta1 = Math.min(ANGLE_MAX, angleDe(zone.x + zone.w - 1, centre, R));

    const out = document.createElement('canvas');
    // Assez de colonnes pour ne pas perdre de texte là où la surface fuit.
    const l = Math.max(8, Math.round(zone.w * 1.6));
    out.width = l; out.height = zone.h;
    const ctx = out.getContext('2d');
    if (!ctx) return { plat: src, theta0, theta1 };

    for (let i = 0; i < l; i++) {
        const theta = theta0 + (theta1 - theta0) * (i / (l - 1));
        const xSrc = centre + R * Math.sin(theta);
        ctx.drawImage(src, xSrc, zone.y, 1, zone.h, i, 0, 1, zone.h);
    }
    return { plat: out, theta0, theta1 };
}

/**
 * Réenroule l'étiquette sur le cylindre du gabarit, et l'ombre.
 *
 * Même arc, même projection, nouveau rayon. L'ombrage vient ensuite : sans lui
 * l'étiquette paraît collée à plat sur une image de bouteille, ce qui est
 * exactement l'effet qu'on cherche à éviter.
 */
function enrouler(
    ctx: CanvasRenderingContext2D,
    d: Deroule,
    verre: { gauche: number; droite: number },
    y: number,
    h: number,
): void {
    const R = Math.max(1, (verre.droite - verre.gauche) / 2);
    const centre = verre.gauche + R;

    const xDebut = Math.round(centre + R * Math.sin(d.theta0));
    const xFin = Math.round(centre + R * Math.sin(d.theta1));
    if (xFin <= xDebut) return;

    for (let x = xDebut; x <= xFin; x++) {
        const theta = angleDe(x, centre, R);
        const u = (theta - d.theta0) / (d.theta1 - d.theta0 || 1);
        if (u < 0 || u > 1) continue;
        const xSrc = u * (d.plat.width - 1);
        ctx.drawImage(d.plat, xSrc, 0, 1, d.plat.height, x, y, 1, h);
    }

    // Ombrage : la même courbe que le verre, pour que l'étiquette tourne avec.
    const ombre = ctx.createLinearGradient(verre.gauche, 0, verre.droite, 0);
    ombre.addColorStop(0, 'rgba(0,0,0,.70)');
    ombre.addColorStop(0.18, 'rgba(0,0,0,.26)');
    ombre.addColorStop(0.44, 'rgba(0,0,0,0)');
    ombre.addColorStop(0.74, 'rgba(0,0,0,.18)');
    ombre.addColorStop(1, 'rgba(0,0,0,.74)');
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = ombre;
    ctx.fillRect(xDebut, y, xFin - xDebut + 1, h);
    ctx.restore();

    // Un rien du reflet du verre repasse PAR-DESSUS le papier : c'est ce qui
    // rattache l'étiquette à la bouteille au lieu de la laisser flotter.
    const spec = ctx.createLinearGradient(centre - R * 0.72, 0, centre - R * 0.12, 0);
    spec.addColorStop(0, 'rgba(255,255,255,0)');
    spec.addColorStop(0.5, 'rgba(255,255,255,.09)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.fillRect(xDebut, y, xFin - xDebut + 1, h);
}

/* ── Gabarit photographique ───────────────────────────────────────────────── */

/**
 * Une VRAIE bouteille, dont on a effacé l'étiquette.
 *
 * Le verre dessiné (`dessinerVerre`) tient la route à la taille d'une vignette,
 * mais en grand il se lit comme une illustration : pas de texture, pas de vrai
 * reflet, une épaule trop nette. Un packshot dont on a gommé l'étiquette donne
 * au contraire un verre photographique — c'est le même objet, simplement nu.
 *
 * Les gabarits vivent dans `public/gabarits/`, un par couleur, accompagnés d'un
 * petit fichier qui dit où retombait l'étiquette d'origine. Couleur sans
 * gabarit : on retombe sur le verre dessiné, qui reste correct.
 */
type Gabarit = {
    image: HTMLImageElement;
    /** Bande d'étiquette, en part de la HAUTEUR DE LA BOUTEILLE (pas du cadre). */
    haut: number;
    bas: number;
    /** Boîte de la bouteille dans le cadre du gabarit. */
    boite: { x: number; y: number; w: number; h: number };
    cadre: [number, number];
};

const gabarits = new Map<CouleurVerre, Promise<Gabarit | null>>();

/**
 * Quel gabarit sert à quelle couleur.
 *
 * Un rosé et un liquoreux se vendent en verre CLAIR, comme un blanc : le
 * gabarit du blanc leur va, et vaut bien mieux que le verre dessiné. Le jour où
 * l'on photographie une bouteille propre pour chacun, il suffira de poser le
 * fichier dans `public/gabarits/` — il passe devant.
 */
const REPLI: Record<CouleurVerre, CouleurVerre[]> = {
    rouge: ['rouge'],
    blanc: ['blanc'],
    // Le rosé est le gabarit du blanc, teinte décalée vers le saumon : même
    // verre clair, robe différente. Un rosé posé tel quel sur le gabarit du
    // blanc aurait l'air d'un vin blanc, ce qui est la seule chose qu'on
    // demande à une vignette de ne pas faire.
    rose: ['rose', 'blanc'],
    // Un liquoreux se vend en verre clair, comme un blanc. Le gabarit dédié a
    // été tenté puis abandonné : verre ambré et étiquette blanche se ressemblent
    // trop pour qu'Otsu sépare les deux, et l'étiquette survivait à l'effacement.
    liqueur: ['liqueur', 'blanc'],
    /*
     * Champagne et cidres attendent LEUR gabarit, et n'en empruntent aucun.
     *
     * Une bordelaise déguisée en champagne se voit au premier coup d'œil :
     * l'épaule d'un champagne est tombante, son goulot plus court, son verre
     * bien plus épais, et la capsule cache un muselet. Tant qu'on n'a pas la
     * photo, mieux vaut le verre dessiné — approximatif mais honnête — qu'un
     * gabarit qui ment sur le format.
     */
    champagne: ['champagne'],
    cidre: ['cidre'],
    'cidre-rose': ['cidre-rose', 'cidre'],
};

function chargerGabarit(couleur: CouleurVerre): Promise<Gabarit | null> {
    const dejaLa = gabarits.get(couleur);
    if (dejaLa) return dejaLa;
    const promesse = (async (): Promise<Gabarit | null> => {
      for (const nom of REPLI[couleur] ?? [couleur]) {
        try {
            // Pas de `force-cache` : un gabarit se retouche, et le cache rendait la
            // retouche invisible jusqu'à vider le navigateur.
            const meta = await fetch(`/gabarits/${nom}.json`);
            if (!meta.ok) continue;
            const j = await meta.json();
            const image = await charger(`/gabarits/${nom}.webp`);
            if (!image) continue;
            return {
                image,
                haut: Number(j?.etiquette?.haut),
                bas: Number(j?.etiquette?.bas),
                boite: j?.bouteille,
                cadre: j?.cadre,
            };
        } catch { /* couleur suivante */ }
      }
      return null;
    })();
    gabarits.set(couleur, promesse);
    return promesse;
}

/**
 * Largeur opaque du gabarit à une hauteur donnée.
 *
 * Lue dans l'image plutôt que stockée : c'est elle qui donne le rayon du
 * cylindre sur lequel réenrouler l'étiquette, et une valeur approchée se voit
 * aussitôt — l'étiquette dépasse du verre ou flotte au milieu.
 */
function largeurA(px: ImageData, y: number): { gauche: number; droite: number } | null {
    const { width: w, data } = px;
    const ligne = Math.max(0, Math.min(px.height - 1, Math.round(y)));
    let g = -1, d = -1;
    for (let x = 0; x < w; x++) {
        if (data[(ligne * w + x) * 4 + 3] > 24) { if (g < 0) g = x; d = x; }
    }
    return d > g ? { gauche: g, droite: d } : null;
}

/* ── Composition ──────────────────────────────────────────────────────────── */

function charger(src: string): Promise<HTMLImageElement | null> {
    return new Promise((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = src;
    });
}

/**
 * Compose : l'étiquette de `source` sur une bouteille type de la bonne couleur.
 *
 * `source` doit être une bouteille DÉJÀ NORMALISÉE par `bouteille.ts` — donc
 * détourée, d'aplomb, au cadre fixe. C'est ce qui permet de chercher
 * l'étiquette dans le corps sans avoir à redevine où il est.
 *
 * Renvoie `null` si l'étiquette n'a pas été trouvée : l'appelant garde alors la
 * bouteille normalisée telle quelle, qui reste correcte.
 */
export async function composerSurBouteilleType(
    source: string,
    couleur: CouleurVerre,
    opts: { hauteur?: number; qualite?: number } = {},
): Promise<string | null> {
    const { hauteur = CADRE_H, qualite = 0.88 } = opts;

    /*
     * Les formats à étiquette ATYPIQUE ne sont pas composés.
     *
     * L'extraction suppose une étiquette rectangulaire, d'un seul tenant, posée
     * sur le corps. Un champagne porte souvent un bandeau DIAGONAL qui monte sur
     * l'épaule ; un cidre, une étiquette en deux couleurs dont la moitié a la
     * clarté du verre. Mesuré sur les deux : le morceau retenu n'était qu'une
     * tranche, et le composite montrait un bout d'étiquette flottant.
     *
     * Ils gardent donc leur bouteille RÉELLE, détourée et mise au cadre commun.
     * On y perd la silhouette unique, on y gagne de ne rien inventer — et le
     * résultat est bon, parce que la normalisation seule est déjà juste.
     *
     * Leurs gabarits existent dans `public/gabarits/` : le jour où l'extraction
     * saura lire ces étiquettes, il suffira de retirer cette porte.
     */
    if (couleur === 'champagne' || couleur === 'cidre' || couleur === 'cidre-rose') return null;

    const img = await charger(source);
    if (!img) return null;

    // On lit l'étiquette à la taille d'origine : la chercher sur une vignette
    // réduite coûtait des pixels au texte, qu'on agrandit ensuite.
    const lecture = document.createElement('canvas');
    lecture.width = img.width; lecture.height = img.height;
    const lctx = lecture.getContext('2d', { willReadFrequently: true });
    if (!lctx) return null;
    lctx.drawImage(img, 0, 0);
    let px: ImageData;
    try { px = lctx.getImageData(0, 0, lecture.width, lecture.height); }
    catch { return null; }

    const zone = trouverEtiquette(px);
    if (!zone) return null;

    /*
     * L'étiquette trouvée est-elle PLAUSIBLE ? Sinon, on ne compose pas.
     *
     * La détection se trompe sur les étiquettes en plusieurs morceaux — un logo
     * sombre, un fond crème, un bandeau coloré — où elle ne retient parfois
     * qu'une tranche. Composer ce fragment sur un gabarit donne une bouteille
     * qui n'existe pas, avec un bout d'étiquette flottant au milieu : bien pire
     * que la photo normalisée, qui est au moins vraie.
     *
     * On refuse donc de composer hors de ces bornes, et l'appelant garde la
     * bouteille détourée. Perdre la silhouette commune sur quelques bouteilles
     * est un moindre mal comparé à afficher une étiquette tronquée.
     */
    const partHauteur = zone.h / img.height;
    const partLargeur = zone.verre ? zone.w / Math.max(1, zone.verre.x1 - zone.verre.x0 + 1) : 1;
    if (partHauteur < 0.12 || partHauteur > 0.52 || partLargeur < 0.45) return null;

    const l = Math.round(hauteur * CADRE_L / CADRE_H);
    const out = document.createElement('canvas');
    out.width = l; out.height = hauteur;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    /*
     * Deux gabarits possibles, et le photographique gagne.
     *
     * S'il existe un packshot nu pour cette couleur, on le pose et on lit dans
     * son ALPHA la largeur du verre à chaque hauteur : c'est ce qui donne le
     * rayon du cylindre sur lequel réenrouler l'étiquette. Sinon on retombe sur
     * le verre dessiné, qui reste juste mais se voit en grand.
     */
    const gab = await chargerGabarit(couleur);
    let cible: Rect;

    if (gab && gab.boite && isFinite(gab.haut) && isFinite(gab.bas)) {
        ctx.drawImage(gab.image, 0, 0, l, hauteur);
        let gpx: ImageData;
        try { gpx = ctx.getImageData(0, 0, l, hauteur); }
        catch { return null; }

        // La boîte du gabarit, ramenée à l'échelle demandée.
        const k = l / gab.cadre[0];
        const bY = gab.boite.y * k, bH = gab.boite.h * k;

        /*
         * Où poser l'étiquette : à la place qu'elle occupait DANS LE GABARIT.
         *
         * C'est le seul ancrage qui garantisse qu'elle tombe sur la partie
         * cylindrique du verre. Reporter la position qu'elle avait sur la photo
         * scannée la ferait grimper sur l'épaule dès que les deux bouteilles
         * n'ont pas le même format — et une étiquette sur l'épaule se voit
         * immédiatement.
         */
        const yHaut = bY + bH * gab.haut;
        const bords = largeurA(gpx, yHaut + bH * (gab.bas - gab.haut) / 2);
        if (!bords) return null;

        /*
         * La LARGEUR vient du gabarit, la HAUTEUR de l'étiquette elle-même.
         *
         * La largeur est imposée : c'est celle du verre, une étiquette en fait
         * le tour. La hauteur, non — une étiquette de bourgogne est courte et
         * large, une contre-étiquette haute et étroite. L'imposer d'après le
         * gabarit étirait ou écrasait le papier, ce qui se voit immédiatement
         * sur le texte.
         *
         * On garde donc le rapport hauteur/largeur mesuré sur la photo, appliqué
         * à la largeur du verre, et on l'ancre au haut de la bande du gabarit.
         */
        /*
         * La cible décrit LE VERRE, pas l'étiquette.
         *
         * C'est `enrouler` qui place l'étiquette dessus, à l'arc qu'elle
         * occupait sur sa bouteille d'origine. Lui passer une largeur déjà
         * rétrécie reviendrait à rétrécir le cylindre, donc à changer les
         * angles — et l'étiquette ne retomberait plus où il faut.
         */
        const larg = bords.droite - bords.gauche;
        const rapport = zone.h / Math.max(1, zone.w);
        // Bornes de bon sens : ni un timbre, ni une étiquette qui couvre le corps.
        const haut = Math.min(bH * 0.42, Math.max(bH * 0.12, larg * rapport));
        cible = { x: bords.gauche, y: yHaut, w: larg, h: haut };
    } else {
        const p = dessinerVerre(ctx, l, hauteur, couleur);
        const hautTotal = p.basY - p.hautY;
        const hautPhoto = img.height * (1 - G.hauteur) / 2;
        const relHaut = (zone.y - hautPhoto) / (img.height * G.hauteur);
        const relHauteur = zone.h / (img.height * G.hauteur);
        const partHaute = Math.min(0.46, Math.max(0.14, relHauteur));
        let yHaut = p.hautY + hautTotal * Math.min(0.78, Math.max(0.36, relHaut));
        let yBas = yHaut + hautTotal * partHaute;
        if (yBas > p.basY - hautTotal * 0.06) {
            yBas = p.basY - hautTotal * 0.06;
            yHaut = yBas - hautTotal * partHaute;
        }
        const demi = p.demiLargeur((yHaut + yBas) / 2) * 0.94;
        cible = { x: l / 2 - demi, y: yHaut, w: demi * 2, h: yBas - yHaut };
    }

    const deroule = derouler(lecture, zone);
    enrouler(ctx, deroule, { gauche: cible.x, droite: cible.x + cible.w }, cible.y, cible.h);

    const webp = out.toDataURL('image/webp', qualite);
    return webp.startsWith('data:image/webp') ? webp : out.toDataURL('image/png');
}
