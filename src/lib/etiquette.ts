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
 * sur une bouteille type, identique pour toutes les bouteilles d'une même
 * couleur. La grille devient parfaitement régulière.
 *
 * LA RÈGLE, EN UNE LIGNE
 * ----------------------
 * Une bouteille type par couleur, toujours ; l'étiquette scannée dessus,
 * toujours. Sauf les LIQUEURS, qui gardent la leur — leur flacon est ce qui les
 * identifie, et le remplacer effacerait le produit (voir
 * `composerSurBouteilleType`).
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
     * Couleur du VERRE : mesurée là où il n'y a JAMAIS d'étiquette.
     *
     * LE PARI QUI NE TIENT PAS
     * ------------------------
     * On prenait la médiane de tout le corps, en pariant que le verre y occupe
     * plus de hauteur que le papier — épaule, bas de bouteille, marges. C'est
     * vrai d'un bordeaux à étiquette basse. C'est FAUX dès qu'une étiquette
     * couvre la moitié du corps, ce qui est courant sur les vins du Nouveau
     * Monde et sur les bouteilles à étiquette pleine hauteur.
     *
     * Et quand c'est faux, ça ne dégrade pas la mesure : ça l'INVERSE. La
     * médiane tombe dans le papier, le papier devient la référence, l'écart le
     * plus fort se trouve dans le verre — et c'est une bande de verre qu'on
     * extrait et qu'on va coller sur le gabarit. Mesuré sur un Trader Joe's
     * Meritage : étiquette crème sur les deux tiers du corps, bande retenue =
     * le verre sombre au-dessus.
     *
     * DEUX ZONES SÛRES
     * ----------------
     * La bouteille arrive ici NORMALISÉE — même cadre, même ligne de pose — et
     * deux zones de son corps sont du verre à coup sûr :
     *
     *   • juste sous l'ÉPAULE : une étiquette n'y monte pas, elle serait posée
     *     sur une surface qui n'est plus cylindrique et se plisserait ;
     *   • le tout BAS : le culot est bombé, aucune étiquette n'y descend.
     *
     * On y prend la médiane. Les deux ensemble, et non l'une ou l'autre : le
     * bas seul est presque noir (l'ombre du culot) et ferait passer tout le
     * corps pour du papier.
     *
     * Si ces bandes sont trop maigres pour conclure — corps très court, photo
     * rognée — on retombe sur l'ancienne médiane, qui reste juste dans le cas
     * ordinaire.
     */
    const medianeSur = (a: Float32Array, lignes: number[]) => {
        const v: number[] = [];
        for (const y of lignes) if (presents[y]) v.push(a[y]);
        if (!v.length) return null;
        v.sort((p, q) => p - q);
        return v[v.length >> 1];
    };

    const hCorps = bas - haut + 1;
    const sures: number[] = [];
    for (let y = haut; y < haut + Math.round(hCorps * 0.12) && y <= bas; y++) sures.push(y);
    for (let y = bas - Math.round(hCorps * 0.06); y <= bas; y++) if (y > haut) sures.push(y);
    const toutes: number[] = [];
    for (let y = haut; y <= bas; y++) toutes.push(y);

    const lignesRef = sures.length >= 8 ? sures : toutes;
    const vr = medianeSur(moyR, lignesRef) ?? 0;
    const vg = medianeSur(moyG, lignesRef) ?? 0;
    const vb = medianeSur(moyB, lignesRef) ?? 0;

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
 * Version des fichiers de `public/gabarits/`. À INCRÉMENTER quand on en retouche un.
 *
 * Le service worker sert les images « en cache d'abord, rafraîchies après » :
 * sans changer l'adresse, un iPhone qui a déjà vu `rouge.webp` continue d'en
 * afficher l'ancienne version pendant toute une session — c'est ainsi que le
 * relief « Châteauneuf-du-Pape » est resté sur les bouteilles après son
 * effacement. Une adresse différente = une entrée de cache différente.
 */
const GABARIT_V = 2;

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
    rose: ['rose', 'blanc'],
    /*
     * Une liqueur n'est JAMAIS composée — voir `composerSurBouteilleType`.
     *
     * L'entrée reste pour que le type soit complet ; elle n'est pas lue. Il n'y
     * a pas de gabarit de liqueur parce qu'il n'y a pas de bouteille de liqueur :
     * chaque maison a la sienne, et c'est précisément sa forme qu'on vient
     * montrer.
     */
    liqueur: ['liqueur'],
    /*
     * Champagne et cidres ont LEUR gabarit, et n'en empruntent aucun.
     *
     * Une bordelaise déguisée en champagne se voit au premier coup d'œil :
     * l'épaule d'un champagne est tombante, son goulot plus court, son verre
     * bien plus épais, et la capsule cache un muselet.
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
            const meta = await fetch(`/gabarits/${nom}.json?v=${GABARIT_V}`);
            if (!meta.ok) continue;
            const j = await meta.json();
            const image = await charger(`/gabarits/${nom}.webp?v=${GABARIT_V}`);
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

/* ── Quand la détection ne trouve rien ────────────────────────────────────── */

/** Boîte de ce qui reste opaque — la bouteille, une fois détourée. */
function boiteOpaque(px: ImageData): { x: number; y: number; w: number; h: number } | null {
    const { width: w, height: h, data } = px;
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
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * L'étiquette trouvée tient-elle debout ?
 *
 * Deux façons de se tromper, et elles se mesurent : un FRAGMENT (un bandeau
 * coloré pris pour toute l'étiquette) est trop court, et un débordement sur le
 * verre est trop long. Une étiquette qui ne couvre pas la moitié de la largeur
 * du corps n'est pas une étiquette vue de face non plus.
 */
function etiquettePlausible(zone: Rect, hauteurImage: number): boolean {
    const partHauteur = zone.h / Math.max(1, hauteurImage);
    const partLargeur = zone.verre
        ? zone.w / Math.max(1, zone.verre.x1 - zone.verre.x0 + 1)
        : 1;
    return partHauteur >= 0.12 && partHauteur <= 0.52 && partLargeur >= 0.45;
}

/**
 * La bande où une étiquette SE POSE, faute de l'avoir repérée.
 *
 * POURQUOI ON NE RENONCE PLUS
 * ---------------------------
 * Avant, une détection ratée faisait garder la photo réelle. Résultat : sur
 * une étagère de vingt fiches, dix-sept bouteilles types et trois photos —
 * silhouettes différentes, verre différent, lumière différente. Les trois qui
 * restaient brutes étaient exactement celles qu'on remarquait.
 *
 * Or on n'a pas besoin de SAVOIR où est l'étiquette pour la copier : on sait où
 * une étiquette se pose. Le gabarit le dit — c'est la bande qu'on y a effacée.
 * On découpe donc le corps de la photo à cette même hauteur relative et on le
 * pose. Quand la détection a échoué parce que l'étiquette est bicolore ou
 * diagonale, la bande contient quand même le papier : simplement, on l'a prise
 * au compas plutôt qu'à la mesure.
 *
 * Les fractions sont celles du GABARIT parce que c'est là que le papier
 * retombera. Sans gabarit, 0,58 → 0,90 : le corps d'une bouteille debout.
 */
function zoneParDefaut(px: ImageData, gab: Gabarit | null): Rect | null {
    const b = boiteOpaque(px);
    if (!b) return null;

    const haut = gab && isFinite(gab.haut) ? gab.haut : 0.58;
    const bas = gab && isFinite(gab.bas) ? gab.bas : 0.90;
    const y0 = Math.max(b.y, Math.round(b.y + b.h * Math.min(haut, bas)));
    const y1 = Math.min(b.y + b.h - 1, Math.round(b.y + b.h * Math.max(haut, bas)));
    if (y1 - y0 < 8) return null;

    // Étendue du VERRE sur ces lignes : c'est elle qui donne le rayon du
    // cylindre, donc les angles de `derouler`.
    const { width: w, data } = px;
    let v0 = w, v1 = -1;
    for (let y = y0; y <= y1; y++) {
        for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 24) { if (x < v0) v0 = x; if (x > v1) v1 = x; }
        }
    }
    if (v1 <= v0) return null;

    /*
     * Une étiquette ne va pas tout à fait d'arête à arête : les derniers pour
     * cent de la largeur sont du verre nu, et les reprendre collerait un liseré
     * de verre sur le bord du papier réenroulé. On garde les 92 % centraux.
     */
    const marge = Math.round((v1 - v0) * 0.04);
    return {
        x: v0 + marge,
        y: y0,
        w: Math.max(1, v1 - v0 + 1 - marge * 2),
        h: y1 - y0 + 1,
        verre: { x0: v0, x1: v1 },
    };
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
 * l'étiquette dans le corps sans avoir à redeviner où il est.
 *
 * Renvoie `null` dans deux cas seulement : une LIQUEUR, dont on garde la
 * bouteille propre, et une image où il ne reste rien d'opaque à lire. Partout
 * ailleurs la composition aboutit — au besoin par la bande du gabarit plutôt
 * que par la détection.
 */
export async function composerSurBouteilleType(
    source: string,
    couleur: CouleurVerre,
    opts: { hauteur?: number; qualite?: number } = {},
): Promise<string | null> {
    const { hauteur = CADRE_H, qualite = 0.88 } = opts;

    /*
     * LA LIQUEUR EST LA SEULE EXCEPTION, et c'est une exception de fond.
     *
     * Toutes les autres lignes se vendent dans une bouteille NORMALISÉE : une
     * bordelaise est une bordelaise, un champagne est un champagne, et les
     * distinguer l'une de l'autre sur une étagère ne sert à rien. On peut donc
     * n'en garder qu'une par couleur et n'y changer que le papier.
     *
     * Une liqueur, non. Chartreuse, Cointreau, Grand Marnier, une crème de
     * cassis d'un producteur du coin : le flacon est dessiné, souvent breveté,
     * et c'est LUI qu'on reconnaît avant même de lire l'étiquette. Le poser sur
     * une bordelaise reviendrait à effacer ce qui l'identifie.
     *
     * On renvoie donc `null` : l'appelant garde la bouteille normalisée —
     * détourée, d'aplomb, au cadre et à la ligne de pose communs. Même
     * environnement que les autres, forme propre conservée.
     */
    if (couleur === 'liqueur') return null;

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

    /*
     * Le gabarit est chargé AVANT de chercher l'étiquette, parce qu'il sert dans
     * les deux cas : à la poser si on l'a trouvée, à la DÉCOUPER si on ne l'a
     * pas trouvée — c'est lui qui sait à quelle hauteur du corps une étiquette
     * se pose (voir `zoneParDefaut`).
     */
    const gab = await chargerGabarit(couleur);

    /*
     * Détection d'abord, compas ensuite. On ne renonce plus.
     *
     * `trouverEtiquette` lit le papier là où il tranche avec le verre, et c'est
     * la bonne mesure quand elle marche : elle suit le vrai contour, haut comme
     * large. Elle échoue sur trois familles connues — étiquette bicolore dont
     * une moitié a la clarté du verre, bandeau diagonal d'un champagne,
     * contre-étiquette plus contrastée que l'étiquette. Dans ces cas elle ne
     * rend qu'une TRANCHE, et poser une tranche donne un bout de papier qui
     * flotte au milieu du verre.
     *
     * Avant, ces cas-là faisaient garder la photo réelle. L'étagère mélangeait
     * alors bouteilles types et photos brutes, ce qui est précisément ce que la
     * manœuvre voulait supprimer. On retombe donc sur la bande du gabarit :
     * moins fine que la détection, mais toujours du papier, et toujours la même
     * silhouette.
     */
    const trouvee = trouverEtiquette(px);
    const zone = trouvee && etiquettePlausible(trouvee, img.height)
        ? trouvee
        : zoneParDefaut(px, gab);
    // Rien d'opaque du tout : l'image n'est pas une bouteille détourée.
    if (!zone) return null;

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

/* ── La voie du SCAN : l'étiquette visée, posée telle quelle ──────────────── */

/**
 * Pose l'image du CADRE DE VISÉE sur la bouteille type de la couleur.
 *
 * POURQUOI UNE SECONDE VOIE
 * -------------------------
 * `composerSurBouteilleType` cherche l'étiquette sur une bouteille détourée.
 * Au scan, c'est le mauvais problème : on part d'une photo large (plan de
 * travail, étagère) ou d'un packshot de marchand qui n'est pas toujours le bon
 * vin, et la « détection » tombait sur le verre noir, le bandeau du bas, ou
 * rien du tout. Trois résultats sur le téléphone : bouteille sans étiquette,
 * photo brute sans bouteille, étiquette d'un autre vin.
 *
 * Or au scan, l'étiquette, on L'A : c'est exactement ce qui était dans le cadre
 * quand la photo est partie (le cadrage serré envoyé au modèle de lecture). On
 * ne cherche donc plus rien. On la pose, pleine largeur du verre, centrée dans
 * la bande d'étiquette du gabarit, réenroulée sur le cylindre et ombrée.
 *
 * Ne renvoie `null` que pour une liqueur (son flacon reste le sien) ou une
 * image illisible.
 */
/**
 * Où est le PAPIER de l'étiquette dans le cadre de visée ?
 *
 * Le cadre contient bien plus que l'étiquette : du verre noir au-dessus et en
 * dessous, parfois une bande de décor sur un bord. Posé tel quel sur la
 * bouteille, ce rectangle laissait voir ces bords, et le papier ne remplissait
 * jamais la largeur du verre.
 *
 * Le papier est la zone CLAIRE qui tranche avec le verre. On la trouve par ses
 * proportions de pixels clairs, ligne par ligne puis colonne par colonne, ce qui
 * résiste à l'encre (les lettres sombres trouent le papier mais ne changent pas
 * la proportion d'ensemble) et aux reflets (trop étroits pour tenir une ligne).
 *
 * Renvoie `null` si rien de franc ne ressort (étiquette noire sur verre noir) :
 * l'appelant retombe alors sur le centre du cadre.
 */
export function trouverPapier(img: HTMLImageElement | HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
    const r = Math.min(1, 320 / Math.max(img.width, img.height));
    const w = Math.max(8, Math.round(img.width * r)), h = Math.max(8, Math.round(img.height * r));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    let d: Uint8ClampedArray;
    try { d = ctx.getImageData(0, 0, w, h).data; } catch { return null; }

    const L = new Uint8Array(w * h);
    const hist = new Uint32Array(256);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) { const v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0; L[p] = v; hist[v]++; }

    // Seuil d'Otsu : sépare « papier » et « verre/ombre ».
    let total = w * h, somme = 0;
    for (let v = 0; v < 256; v++) somme += v * hist[v];
    let sB = 0, wB = 0, best = 0, seuil = 110;
    for (let v = 0; v < 256; v++) {
        wB += hist[v]; if (!wB) continue;
        const wF = total - wB; if (!wF) break;
        sB += v * hist[v];
        const mB = sB / wB, mF = (somme - sB) / wF;
        const ec = wB * wF * (mB - mF) * (mB - mF);
        if (ec > best) { best = ec; seuil = v; }
    }
    seuil = Math.min(170, Math.max(70, seuil));
    const clair = (x: number, y: number) => L[y * w + x] > seuil;

    // Plus longue plage de valeurs ≥ `min`, en tolérant de petits trous (l'encre).
    const plage = (f: Float32Array, min: number, trou: number, centre: number) => {
        let meilleure: [number, number] | null = null, score = -1;
        let debut = -1, fin = -1, vides = 0;
        const clore = () => {
            if (debut < 0) return;
            const longueur = fin - debut + 1;
            // À longueur proche, celle qui contient le centre l'emporte : c'est
            // là que l'utilisateur a visé l'étiquette.
            const s = longueur + (centre >= debut && centre <= fin ? f.length * 0.08 : 0);
            if (s > score) { score = s; meilleure = [debut, fin]; }
            debut = -1; fin = -1; vides = 0;
        };
        for (let i = 0; i < f.length; i++) {
            if (f[i] >= min) { if (debut < 0) debut = i; fin = i; vides = 0; }
            else if (debut >= 0 && ++vides > trou) clore();
        }
        clore();
        return meilleure as [number, number] | null;
    };

    const profilLignes = (x0: number, x1: number) => {
        const f = new Float32Array(h);
        for (let y = 0; y < h; y++) { let n = 0; for (let x = x0; x < x1; x++) if (clair(x, y)) n++; f[y] = n / Math.max(1, x1 - x0); }
        return f;
    };
    const profilColonnes = (y0: number, y1: number) => {
        const f = new Float32Array(w);
        for (let x = 0; x < w; x++) { let n = 0; for (let y = y0; y <= y1; y++) if (clair(x, y)) n++; f[x] = n / Math.max(1, y1 - y0 + 1); }
        return f;
    };

    // 1. Les lignes : sur la partie centrale, là où le papier se trouve.
    let lignes = plage(profilLignes(Math.floor(w * 0.25), Math.ceil(w * 0.75)), 0.5, Math.round(h * 0.03), Math.floor(h / 2));
    if (!lignes) return null;
    // 2. Les colonnes, sur ces lignes seulement.
    let cols = plage(profilColonnes(lignes[0], lignes[1]), 0.45, Math.max(1, Math.round(w * 0.012)), Math.floor(w / 2));
    if (!cols) return null;
    // 3. On revient sur les lignes, cette fois sur la largeur trouvée : le bord
    //    haut et bas se resserre sur le papier.
    const lignes2 = plage(profilLignes(cols[0], cols[1] + 1), 0.55, Math.round(h * 0.03), Math.floor((lignes[0] + lignes[1]) / 2));
    if (lignes2) lignes = lignes2;

    /*
     * Le papier n'est pas tout clair : un bandeau doré ou coloré (nom du
     * domaine) est plus SOMBRE que le fond de l'étiquette sans être du verre.
     * On étend donc le haut et le bas tant que la ligne reste ENTIÈREMENT
     * « pas du verre » (plus claire que la moitié du seuil sur ≥ 85 % de la
     * largeur). Le verre, même avec ses reflets, garde toujours des zones noires.
     */
    /*
     * Le papier n'est pas tout clair : une rangée de grosses lettres noires, un
     * bandeau bordeaux ou violet (« BRUT », « cidre rosé ») sont plus SOMBRES
     * que le fond de l'étiquette sans être du verre. Juger à la seule clarté
     * coupait l'étiquette en deux à la première rangée de texte gras.
     *
     * Une ligne est donc de l'étiquette si elle est, au choix :
     *   • claire et d'une autre couleur que le verre (le papier) ;
     *   • TEXTURÉE — le texte fait des sauts de clarté d'un pixel à l'autre,
     *     le verre est lisse ;
     *   • d'une couleur nettement différente du verre (un bandeau).
     * Le verre de référence se lit sur les bords haut et bas du cadre de visée.
     */
    const ref: number[][] = [];
    const bordH = Math.max(2, Math.round(h * 0.05));
    for (const y0 of [0, h - bordH]) for (let y = y0; y < y0 + bordH; y++) for (let x = cols[0]; x <= cols[1]; x += 2) {
        const i = (y * w + x) * 4; ref.push([d[i], d[i + 1], d[i + 2]]);
    }
    // Le verre est la moitié SOMBRE des bords (l'autre peut être du papier si
    // l'étiquette touche le cadre).
    ref.sort((p, q) => (p[0] + p[1] + p[2]) - (q[0] + q[1] + q[2]));
    const sombre = ref.slice(0, Math.max(1, Math.floor(ref.length / 2)));
    const verre = [0, 1, 2].map((c) => sombre[Math.floor(sombre.length / 2)][c]);
    const distVerre = (i: number) => Math.hypot(d[i] - verre[0], d[i + 1] - verre[1], d[i + 2] - verre[2]);
    const texture = (y: number) => {
        let t = 0;
        for (let x = cols![0] + 1; x <= cols![1]; x++) t += Math.abs(L[y * w + x] - L[y * w + x - 1]);
        return t / Math.max(1, cols![1] - cols![0]);
    };
    const texVerre: number[] = [];
    for (let y = 0; y < bordH; y++) { texVerre.push(texture(y)); texVerre.push(texture(h - 1 - y)); }
    texVerre.sort((p, q) => p - q);
    const seuilTex = Math.max(9, texVerre[Math.floor(texVerre.length / 2)] * 2.2);
    const ligneNonVerre = (y: number) => {
        let loin = 0; const total = cols![1] - cols![0] + 1;
        for (let x = cols![0]; x <= cols![1]; x++) {
            const i = (y * w + x) * 4;
            // Loin du verre, OU d'une couleur franche (bandeau bordeaux, violet,
            // doré) que le verre, sombre et terne, n'a jamais.
            const chroma = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
            if (distVerre(i) > 60 || (chroma > 34 && distVerre(i) > 35)) loin++;
        }
        return loin / total >= 0.6 || texture(y) > seuilTex;
    };
    // On peut aller loin : sur un cadre de visée, l'étiquette en est l'essentiel.
    const limite = h;
    // Un liseré noir ou doré sépare souvent le bandeau du papier : on le franchit.
    const trouE = Math.max(2, Math.round(h * 0.05));
    {
        let y = lignes[0], vides = 0, ext = 0;
        while (y > 0 && ext < limite) { y--; ext++; if (ligneNonVerre(y)) { lignes[0] = y; vides = 0; } else if (++vides > trouE) break; }
        y = lignes[1]; vides = 0; ext = 0;
        while (y < h - 1 && ext < limite) { y++; ext++; if (ligneNonVerre(y)) { lignes[1] = y; vides = 0; } else if (++vides > trouE) break; }
    }

    /*
     * Resserrer les côtés sur le VRAI bord du papier.
     *
     * Une bande de décor claire, collée au papier, passait pour du papier. Le
     * vrai bord se reconnaît à un saut net de clarté moyenne d'une colonne à la
     * suivante (le papier est uniforme, le décor non) : on le cherche dans les
     * 14 % extérieurs de chaque côté et on s'y cale s'il est franc.
     */
    {
        const moy = new Float32Array(w);
        for (let x = 0; x < w; x++) { let t = 0; for (let y = lignes[0]; y <= lignes[1]; y++) t += L[y * w + x]; moy[x] = t / (lignes[1] - lignes[0] + 1); }
        const fen = Math.round((cols[1] - cols[0] + 1) * 0.14);
        const saut = (i: number) => Math.abs(moy[Math.min(w - 1, i + 2)] - moy[Math.max(0, i - 2)]);
        /*
         * Couper SEULEMENT une bande unie. Le bord d'une grosse lettre noire est
         * lui aussi un saut franc, et c'est lui qu'on prenait pour le bord du
         * papier : le « N » d'ÉCUSSON, le « 1919 » disparaissaient. Un décor (mur,
         * table, reflet) est lisse de haut en bas ; une colonne de texte, non.
         */
        const relief = (x0: number, x1: number) => {
            let t = 0, n = 0;
            for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) for (let y = lignes[0] + 1; y <= lignes[1]; y++) { t += Math.abs(L[y * w + x] - L[(y - 1) * w + x]); n++; }
            return n ? t / n : 0;
        };
        const reliefPapier = relief(Math.round((cols[0] + cols[1]) / 2) - 3, Math.round((cols[0] + cols[1]) / 2) + 3);
        const unie = (x0: number, x1: number) => x1 - x0 >= 1 && relief(x0, x1) < Math.max(4, reliefPapier * 0.45);
        let mg = 0, ig = -1;
        for (let i = cols[0] + 2; i < cols[0] + fen; i++) { const v = saut(i); if (v > mg) { mg = v; ig = i; } }
        if (ig > 0 && mg >= 16 && unie(cols[0], ig)) cols[0] = ig + 2;
        let md = 0, id = -1;
        for (let i = cols[1] - 2; i > cols[1] - fen; i--) { const v = saut(i); if (v > md) { md = v; id = i; } }
        if (id > 0 && md >= 16 && unie(id, cols[1])) cols[1] = id - 2;
    }

    const bw = cols[1] - cols[0] + 1, bh = lignes[1] - lignes[0] + 1;
    const part = (bw * bh) / (w * h);
    // Trop petit : un reflet. Presque tout : rien n'a été séparé.
    if (part < 0.18 || part > 0.97 || bw < w * 0.35 || bh < h * 0.2) return null;
    return { x: cols[0] / r, y: lignes[0] / r, w: bw / r, h: bh / r };
}

/**
 * Remet l'étiquette « à la lumière du jour ».
 *
 * Une photo prise dans une cuisine ou une cave est sombre et terne : l'étiquette
 * posée telle quelle se lit grise, noyée dans le verre. On étire donc les
 * niveaux (le 2ᵉ au 98ᵉ centile deviennent noir et blanc), puis on relève les
 * tons moyens jusqu'à ce que le papier soit franchement clair (cible : 0,68 de clarté moyenne). Même coefficient
 * sur les trois canaux : les teintes (le rouge d'un blason, l'or d'un titre)
 * restent celles de l'étiquette, on ne fait que l'éclairer.
 */
function eclaircir(img: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement | null {
    const cote = 1100;
    const r = Math.min(1, cote / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.width * r)); cv.height = Math.max(1, Math.round(img.height * r));
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    let px: ImageData;
    try { px = ctx.getImageData(0, 0, cv.width, cv.height); } catch { return null; }
    const d = px.data;

    /*
     * Balance des blancs, seulement si c'est du papier.
     *
     * Une lampe jaune ou un néon bleuté teinte toute la photo. Le papier clair
     * d'une étiquette est censé être presque neutre : si les hautes lumières des
     * trois canaux sont proches, l'écart vient de l'éclairage et on le résorbe.
     * Si elles sont très différentes (étiquette rouge, noire à lettres d'or),
     * la teinte est celle de l'étiquette : on n'y touche pas.
     */
    const hc = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    let np = 0;
    for (let i = 0; i < d.length; i += 40) { hc[0][d[i]]++; hc[1][d[i + 1]]++; hc[2][d[i + 2]]++; np++; }
    const p95 = (h: Uint32Array) => { let c = 0; for (let v = 0; v < 256; v++) { c += h[v]; if (c >= np * 0.95) return Math.max(1, v); } return 255; };
    const hautes = [p95(hc[0]), p95(hc[1]), p95(hc[2])];
    const plus = Math.max(...hautes), moins = Math.min(...hautes);
    if (plus / moins < 1.6) {
        const gain = hautes.map((h) => 1 + (plus / h - 1) * 0.8);
        for (let i = 0; i < d.length; i += 4) {
            d[i] = Math.min(255, d[i] * gain[0]); d[i + 1] = Math.min(255, d[i + 1] * gain[1]); d[i + 2] = Math.min(255, d[i + 2] * gain[2]);
        }
    }

    const hist = new Uint32Array(256);
    let n = 0;
    // Le centre seulement : les bords sont du verre, de la table, du décor.
    const x0 = Math.floor(cv.width * 0.1), x1 = Math.ceil(cv.width * 0.9);
    const y0 = Math.floor(cv.height * 0.1), y1 = Math.ceil(cv.height * 0.9);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * cv.width + x) * 4;
        hist[(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0]++; n++;
    }
    const centile = (q: number) => { let c = 0; for (let v = 0; v < 256; v++) { c += hist[v]; if (c >= n * q) return v; } return 255; };
    const lo = centile(0.02);
    const hi = Math.max(centile(0.98), lo + 40);
    const etendue = hi - lo;
    // Clarté moyenne après étirement → gamma qui la ramène vers 0,60.
    let somme = 0;
    for (let v = 0; v < 256; v++) somme += hist[v] * Math.min(1, Math.max(0, (v - lo) / etendue));
    const moy = Math.min(0.9, Math.max(0.05, somme / Math.max(1, n)));
    const gamma = Math.min(1, Math.max(0.42, Math.log(0.68) / Math.log(moy)));
    const table = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) table[v] = Math.round(255 * Math.pow(Math.min(1, Math.max(0, (v - lo) / etendue)), gamma));
    /*
     * On applique la courbe à la CLARTÉ, pas à chaque canal : une courbe par
     * canal sature d'abord le canal dominant et pousse une étiquette crème vers
     * l'orange. En multipliant les trois canaux du même facteur, la teinte du
     * papier reste la sienne.
     */
    for (let i = 0; i < d.length; i += 4) {
        const y = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        const g = table[y | 0] / Math.max(6, y);
        d[i] = Math.min(255, d[i] * g); d[i + 1] = Math.min(255, d[i + 1] * g); d[i + 2] = Math.min(255, d[i + 2] * g);
    }
    ctx.putImageData(px, 0, 0);
    return cv;
}

/**
 * L'angle dont l'étiquette penche dans la photo, en degrés.
 *
 * Les lignes de texte d'une étiquette sont horizontales. On cherche donc la
 * rotation qui rend le profil d'« encre » ligne par ligne le plus contrasté :
 * texte droit = des rangées pleines et des rangées vides ; texte penché = un
 * profil délavé. Marche aussi sur une étiquette sombre à lettres claires
 * (l'encre est ce qui s'écarte de la teinte dominante, dans un sens ou l'autre).
 */
function angleEtiquette(img: HTMLImageElement | HTMLCanvasElement, zoneDetectee: { x: number; y: number; w: number; h: number }): number {
    // Un peu de marge : les bords du papier sont justement ce qu'on veut voir.
    const mx = zoneDetectee.w * 0.1, my = zoneDetectee.h * 0.1;
    const zx = Math.max(0, zoneDetectee.x - mx), zy = Math.max(0, zoneDetectee.y - my);
    const zone = { x: zx, y: zy, w: Math.min(img.width - zx, zoneDetectee.w + 2 * mx), h: Math.min(img.height - zy, zoneDetectee.h + 2 * my) };
    const r = Math.min(1, 280 / Math.max(zone.w, zone.h));
    const w = Math.max(8, Math.round(zone.w * r)), h = Math.max(8, Math.round(zone.h * r));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 0;
    ctx.drawImage(img, zone.x, zone.y, zone.w, zone.h, 0, 0, w, h);
    let d: Uint8ClampedArray;
    try { d = ctx.getImageData(0, 0, w, h).data; } catch { return 0; }
    const L = new Float32Array(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) L[p] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    /*
     * On mesure sur les BORDS DROITS, pas sur le texte : sur une bouteille, le
     * texte est courbé (il suit le cylindre) et faussait l'angle de deux degrés.
     * Les bords GAUCHE et DROIT du papier, eux, restent des droites quelle que
     * soit la hauteur de prise de vue ; le haut et le bas aussi, au centre.
     * Deux familles de points : arêtes horizontales (fort saut vertical) et
     * arêtes verticales (fort saut horizontal).
     */
    const hx: number[] = [], hy: number[] = [], vx: number[] = [], vy: number[] = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const gy = L[(y + 1) * w + x] - L[(y - 1) * w + x];
        const gx = L[y * w + x + 1] - L[y * w + x - 1];
        if (Math.abs(gy) > 40 && Math.abs(gy) > 2.5 * Math.abs(gx) && x > w * 0.2 && x < w * 0.8) { hx.push(x - w / 2); hy.push(y - h / 2); }
        else if (Math.abs(gx) > 40 && Math.abs(gx) > 2.5 * Math.abs(gy)) { vx.push(x - w / 2); vy.push(y - h / 2); }
    }
    if (hx.length + vx.length < 60) return 0;
    const diag = Math.ceil(Math.hypot(w, h)) + 2;
    const pic = (xs: number[], ys: number[], deg: number, vertical: boolean) => {
        if (!xs.length) return 0;
        const a = (deg * Math.PI) / 180, sn = Math.sin(a), cs = Math.cos(a);
        const bins = new Float32Array(diag);
        for (let i = 0; i < xs.length; i++) {
            // Ligne horizontale : on projette sur l'axe vertical tourné ; verticale : sur l'horizontal.
            const v = vertical ? xs[i] * cs + ys[i] * sn : -xs[i] * sn + ys[i] * cs;
            const k = Math.round(v + diag / 2);
            if (k >= 0 && k < diag) bins[k]++;
        }
        let s = 0; for (let i = 0; i < diag; i++) s += bins[i] * bins[i];
        return s / (xs.length * xs.length);
    };
    const score = (deg: number) => pic(hx, hy, deg, false) + pic(vx, vy, deg, true) * 1.5;
    let best = 0, bestS = score(0);
    const s0 = bestS;
    for (let a = -12; a <= 12; a += 0.5) { const s = score(a); if (s > bestS) { bestS = s; best = a; } }
    for (let a = best - 0.5; a <= best + 0.5; a += 0.1) { const s = score(a); if (s > bestS) { bestS = s; best = a; } }
    // Gain trop faible : pas d'arête franche, on ne touche à rien.
    if (Math.abs(best) < 0.4 || bestS < s0 * 1.05) return 0;
    return best;
}

/** Tourne l'image autour de son centre (angle en degrés), sur une toile assez grande. */
function tourner(img: HTMLImageElement | HTMLCanvasElement, deg: number): HTMLCanvasElement {
    const a = (deg * Math.PI) / 180;
    const cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(img.width * cs + img.height * sn);
    cv.height = Math.ceil(img.width * sn + img.height * cs);
    const ctx = cv.getContext('2d');
    if (!ctx) return cv;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(cv.width / 2, cv.height / 2);
    ctx.rotate(a);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    return cv;
}

/**
 * Rend les lignes de texte DROITES, même quand elles sont courbées.
 *
 * Une étiquette photographiée sur une bouteille ronde n'a pas des lignes de
 * texte horizontales : elles forment des arcs (la photo est prise d'un peu
 * au-dessus, d'un peu en dessous, ou de côté). Le redressement par un simple
 * angle n'y peut rien : un arc symétrique a une pente moyenne nulle.
 *
 * On cherche donc le décalage vertical d(x) = a·u + b·u² + c·u³ (u de -1 à 1
 * d'un bord à l'autre) qui rend les rangées d'encre les plus NETTES — c'est le
 * critère des scanners de livres : des lignes droites donnent un profil de
 * rangées tranché (rangées pleines / rangées vides), des lignes courbes le
 * délavent. Puis on décale chaque colonne de l'image de d(x).
 *
 * Sans lignes de texte nettes (étiquette toute en logo), le gain est faible et
 * on ne touche à rien.
 */
function redresserTexte(src: HTMLCanvasElement): HTMLCanvasElement {
    const r = Math.min(1, 360 / Math.max(src.width, src.height));
    const w = Math.max(16, Math.round(src.width * r)), h = Math.max(16, Math.round(src.height * r));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return src;
    ctx.drawImage(src, 0, 0, w, h);
    let d: Uint8ClampedArray;
    try { d = ctx.getImageData(0, 0, w, h).data; } catch { return src; }
    const L = new Float32Array(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) L[p] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;

    /*
     * Ce qu'on regarde : les ARÊTES HORIZONTALES nettes — le haut et le bas des
     * lettres, les filets, les bords de bandeau. Pas l'encre elle-même : une
     * grande zone sombre (le verre sur le côté, un bandeau doré) comptait comme
     * des milliers de points d'« encre » et noyait les lignes de texte. Une
     * zone unie n'a pas d'arête ; seul son bord en a une, et c'est bien une
     * ligne qu'il faut redresser.
     */
    const us: number[] = [], ys: number[] = [], ws: number[] = [];
    const demi = w / 2;
    const candidats: Array<[number, number, number]> = [];
    for (let y = Math.max(2, Math.floor(h * 0.04)); y < h * 0.96; y++) for (let x = Math.floor(w * 0.04); x < w * 0.96; x++) {
        const gy = Math.abs(L[(y + 1) * w + x] - L[(y - 1) * w + x]);
        const gx = Math.abs(L[y * w + x + 1] - L[y * w + x - 1]);
        // Arête plutôt horizontale (le saut est vertical) et franche.
        if (gy > 34 && gy > 0.8 * gx) candidats.push([(x + 0.5 - demi) / demi, y - h / 2, Math.min(gy, 110) / 110]);
    }
    const saut = Math.max(1, Math.ceil(candidats.length / 28000));
    for (let i = 0; i < candidats.length; i += saut) { us.push(candidats[i][0]); ys.push(candidats[i][1]); ws.push(candidats[i][2]); }
    if (us.length < 150) return src;

    const marge = Math.ceil(demi * 1.1) + 4;
    const taille = h + 2 * marge;
    const bins = new Float32Array(taille);
    const demiH = h / 2;
    /*
     * Le décalage vertical d(u, v) de la colonne u (-1…1), à la hauteur v
     * (-1 en haut … 1 en bas) :  d = (a·u + b·u² + c·u³) · (1 + k·v).
     * Le facteur k dit que la courbure n'est pas la même en haut et en bas de
     * l'étiquette — c'est la perspective : les lignes proches de l'axe de la
     * caméra sont presque droites, les autres de plus en plus courbes.
     */
    const score = (a: number, b: number, c3: number, k: number) => {
        bins.fill(0);
        for (let i = 0; i < us.length; i++) {
            const u = us[i];
            const dy = demi * (a * u + b * u * u + c3 * u * u * u) * (1 + k * (ys[i] / demiH));
            const idx = Math.round(ys[i] - dy + taille / 2);
            if (idx >= 0 && idx < taille) bins[idx] += ws[i];
        }
        let s = 0; for (let i = 0; i < taille; i++) s += bins[i] * bins[i];
        // Un léger penchant pour « pas de correction » : le bruit ne doit pas tordre une étiquette.
        return s * (1 - 0.15 * (a * a + b * b + c3 * c3 + 0.3 * k * k));
    };
    const s0 = score(0, 0, 0, 0);
    let A = 0, B = 0, C = 0, K = 0, best = s0;
    for (let a = -0.45; a <= 0.45; a += 0.03) for (let b = -0.28; b <= 0.28; b += 0.04) {
        const s = score(a, b, 0, 0); if (s > best) { best = s; A = a; B = b; }
    }
    for (let tour = 0; tour < 4; tour++) {
        const f = 1 / (tour + 1);
        for (let k = -4; k <= 4; k++) { const s = score(A + k * 0.015 * f, B, C, K); if (s > best) { best = s; A = A + k * 0.015 * f; } }
        for (let k = -4; k <= 4; k++) { const s = score(A, B + k * 0.02 * f, C, K); if (s > best) { best = s; B = B + k * 0.02 * f; } }
        for (let k = -6; k <= 6; k++) { const s = score(A, B, C + k * 0.025 * f, K); if (s > best) { best = s; C = C + k * 0.025 * f; } }
        for (let k = -6; k <= 6; k++) { const s = score(A, B, C, K + k * 0.1 * f); if (s > best) { best = s; K = K + k * 0.1 * f; } }
    }
    K = Math.max(-0.8, Math.min(0.8, K));
    // Gain trop faible, ou correction ridicule : pas assez de lignes nettes pour se fier au résultat.
    if (best < s0 * 1.06 || (Math.abs(A) < 0.012 && Math.abs(B) < 0.012 && Math.abs(C) < 0.012 && Math.abs(K) < 0.1)) return src;

    /*
     * Application, pixel par pixel : chaque point de sortie va chercher son
     * point d'origine, plus haut ou plus bas selon sa colonne et sa hauteur.
     * Le décalage dépend de la hauteur ; on le cherche donc en deux passes
     * (point fixe), puis on lisse (interpolation bilinéaire). Les bords du haut
     * et du bas sont répétés : aucun trou.
     */
    const W = src.width, H = src.height;
    const sctx = src.getContext('2d', { willReadFrequently: true });
    if (!sctx) return src;
    let sd: ImageData;
    try { sd = sctx.getImageData(0, 0, W, H); } catch { return src; }
    const dsrc = sd.data;
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const octx = out.getContext('2d');
    if (!octx) return src;
    const od = octx.createImageData(W, H);
    const dst = od.data;
    const demiW = W / 2, demiHF = H / 2;
    for (let i = 0; i < W; i++) {
        const u = (i + 0.5 - demiW) / demiW;
        const poly = demiW * (A * u + B * u * u + C * u * u * u);
        for (let j = 0; j < H; j++) {
            let y = j;
            for (let it = 0; it < 3; it++) y = j + poly * (1 + K * ((y - demiHF) / demiHF));
            const yc = Math.max(0, Math.min(H - 1.001, y));
            const y0 = Math.floor(yc), fy = yc - y0;
            const p0 = (y0 * W + i) * 4, p1 = p0 + W * 4, q = (j * W + i) * 4;
            for (let c = 0; c < 4; c++) dst[q + c] = dsrc[p0 + c] * (1 - fy) + dsrc[p1 + c] * fy;
        }
    }
    octx.putImageData(od, 0, 0);
    return out;
}

/**
 * Retire les bandes de FOND qui bordent le papier à gauche et à droite.
 *
 * Une fenêtre ou un mur claire, collée au papier, passait pour du papier : un
 * liséré bleuté sur le côté d'une étiquette jaune. On compare la couleur
 * médiane de chaque colonne de bord à celle du centre ; tant qu'elle s'en
 * écarte nettement, la colonne part. Jamais plus de 10 % de chaque côté.
 */
function rognerBords(src: HTMLCanvasElement): HTMLCanvasElement {
    const W = src.width, H = src.height;
    const ctx = src.getContext('2d', { willReadFrequently: true });
    if (!ctx || W < 40 || H < 40) return src;
    let d: Uint8ClampedArray;
    try { d = ctx.getImageData(0, 0, W, H).data; } catch { return src; }
    const y0 = Math.floor(H * 0.15), y1 = Math.ceil(H * 0.85);
    const mediane = (x0: number, x1: number): [number, number, number] => {
        const r: number[] = [], g: number[] = [], b: number[] = [];
        for (let y = y0; y < y1; y += 2) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; r.push(d[i]); g.push(d[i + 1]); b.push(d[i + 2]); }
        const m = (t: number[]) => { t.sort((p, q) => p - q); return t[t.length >> 1]; };
        return [m(r), m(g), m(b)];
    };
    const centre = mediane(Math.floor(W * 0.3), Math.ceil(W * 0.7));
    const etranger = (x: number) => {
        const m = mediane(x, x);
        return Math.hypot(m[0] - centre[0], m[1] - centre[1], m[2] - centre[2]) > 70;
    };
    const max = Math.floor(W * 0.1);
    let g = 0, dr = 0;
    while (g < max && etranger(g)) g++;
    while (dr < max && etranger(W - 1 - dr)) dr++;
    // Un ou deux pixels de plus : la frontière est floue.
    if (g) g = Math.min(max, g + 2);
    if (dr) dr = Math.min(max, dr + 2);
    if (!g && !dr) return src;
    const out = document.createElement('canvas');
    out.width = W - g - dr; out.height = H;
    out.getContext('2d')?.drawImage(src, g, 0, W - g - dr, H, 0, 0, W - g - dr, H);
    return out;
}

export async function poserEtiquetteScannee(
    etiquette: string,
    couleur: CouleurVerre,
    opts: { hauteur?: number; qualite?: number } = {},
): Promise<string | null> {
    if (couleur === 'liqueur') return null;
    /*
     * Rendu en ×3 (1380 × 1842) : c'est ce qui permet de LIRE l'étiquette au
     * zoom. À 460 px de haut, le papier ne faisait que 130 px de large et le
     * texte n'était plus que des taches. Les mises en page du gabarit sont en
     * proportions : seule la définition change.
     */
    const { hauteur = CADRE_H * 3, qualite = 0.9 } = opts;
    const brut = await charger(etiquette);
    if (!brut || brut.width < 20 || brut.height < 20) return null;

    /*
     * 1. Le PAPIER, rien que lui.
     *
     * On repère l'étiquette dans le cadre, puis on rentre de 2,5 % : la
     * détection est juste à quelques pixels près, et un liséré de verre ou de
     * décor sur le bord se voit tout de suite. Rien trouvé → le centre du cadre.
     */
    const parDefaut = (im: { width: number; height: number }) => ({ x: im.width * 0.08, y: im.height * 0.14, w: im.width * 0.84, h: im.height * 0.72 });
    let source: HTMLImageElement | HTMLCanvasElement = brut;
    let zone = trouverPapier(source) ?? parDefaut(source);
    /*
     * Redresser AVANT de recadrer. Une étiquette prise de travers, découpée
     * dans un rectangle droit, laissait des coins de verre ou de fond (les
     * « petits bords blancs ») et des lignes de texte qui montent.
     */
    const angle = angleEtiquette(source, zone);
    if (angle) {
        source = tourner(source, -angle);
        zone = trouverPapier(source) ?? parDefaut(source);
    }
    /*
     * On rentre d'à peine 1 % : la détection est juste à quelques pixels près,
     * et rentrer davantage mangeait les lettres posées au ras du papier.
     */
    const ix = zone.w * 0.01, iy = zone.h * 0.01;
    const cx = Math.max(0, zone.x + ix), cy = Math.max(0, zone.y + iy);
    const cw = Math.min(source.width - cx, zone.w - 2 * ix), ch = Math.min(source.height - cy, zone.h - 2 * iy);
    const rogne = document.createElement('canvas');
    const k = Math.min(1, 1400 / Math.max(cw, ch));
    rogne.width = Math.max(1, Math.round(cw * k)); rogne.height = Math.max(1, Math.round(ch * k));
    const rctx = rogne.getContext('2d');
    if (rctx) { rctx.imageSmoothingQuality = 'high'; rctx.drawImage(source, cx, cy, cw, ch, 0, 0, rogne.width, rogne.height); }

    // 2. Éclairci APRÈS le recadrage : les niveaux se calculent sur le papier,
    //    pas sur le verre noir qui l'entourait.
    let img = (eclaircir(rogne) ?? rogne) as HTMLCanvasElement;
    // 3. Les lignes de texte, DROITES ; les bandes de fond sur les côtés, retirées.
    img = rognerBords(img);
    img = redresserTexte(img);

    const l = Math.round(hauteur * CADRE_L / CADRE_H);
    const out = document.createElement('canvas');
    out.width = l; out.height = hauteur;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // 1. La bouteille type, et la bande où une étiquette se pose.
    const gab = await chargerGabarit(couleur);
    let bandeHaut: number, bandeBas: number, gauche: number, droite: number;
    if (gab && gab.boite && isFinite(gab.haut) && isFinite(gab.bas)) {
        ctx.drawImage(gab.image, 0, 0, l, hauteur);
        let gpx: ImageData;
        try { gpx = ctx.getImageData(0, 0, l, hauteur); } catch { return null; }
        const k = l / gab.cadre[0];
        const bY = gab.boite.y * k, bH = gab.boite.h * k;
        bandeHaut = bY + bH * Math.min(gab.haut, gab.bas);
        bandeBas = bY + bH * Math.max(gab.haut, gab.bas);
        const bords = largeurA(gpx, (bandeHaut + bandeBas) / 2);
        if (!bords) return null;
        gauche = bords.gauche; droite = bords.droite;
    } else {
        const p = dessinerVerre(ctx, l, hauteur, couleur);
        const haut = p.basY - p.hautY;
        bandeHaut = p.hautY + haut * 0.52;
        bandeBas = p.hautY + haut * 0.88;
        const demi = p.demiLargeur((bandeHaut + bandeBas) / 2);
        gauche = l / 2 - demi; droite = l / 2 + demi;
    }

    /*
     * 2. La PLAQUE : l'étiquette ENTIÈRE, à ses proportions.
     *
     * Avant, une étiquette plus haute que la plaque était rognée en haut et en
     * bas (« BRUT », « cidre » coupés), et une étiquette très large étirée en
     * hauteur. Désormais on ne coupe ni ne déforme jamais : la plaque prend la
     * largeur du verre, et si l'étiquette est trop haute pour la bande, c'est
     * la plaque qui rétrécit — une étiquette un peu plus étroite que le verre,
     * c'est ce qu'on voit sur une vraie bouteille.
     */
    const largVerre = droite - gauche;
    const bande = bandeBas - bandeHaut;
    const rapportSource = img.height / img.width;
    let W = largVerre * 0.92;
    let H = W * rapportSource;
    // Jamais plus haute que la bande : une grande étiquette descendait sur le
    // culot. On rétrécit plutôt, et elle reste centrée sur la bande.
    const hMax = bande * 1.0;
    if (H > hMax) { H = hMax; W = H / rapportSource; }
    W = Math.round(W); H = Math.round(H);
    const x0 = Math.round(gauche + (largVerre - W) / 2);
    // Calée sur le bas de la bande (une étiquette se colle à hauteur fixe du culot).
    const y0 = Math.round(Math.min(bandeBas - H, (bandeHaut + bandeBas) / 2 - H / 2 + bande * 0.02));

    /*
     * 3. Pose SANS ré-enroulement.
     *
     * La photo montre déjà l'étiquette vue de face sur un cylindre : ses bords
     * sont déjà tassés. La ré-enrouler les tassait une seconde fois, et les
     * lettres du bord (le « É » et le « N » d'ÉCUSSON) disparaissaient. Une
     * mise à l'échelle suffit. On la prépare à part pour en adoucir les bords
     * (un papier découpé net au pixel près fait autocollant).
     */
    const plaque = document.createElement('canvas');
    plaque.width = W; plaque.height = H;
    const pctx = plaque.getContext('2d');
    if (!pctx) return null;
    pctx.imageSmoothingQuality = 'high';
    pctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, W, H);

    // Ombrage du cylindre : les bords tournent dans l'ombre, un reflet doux à gauche.
    const ombre = pctx.createLinearGradient(0, 0, W, 0);
    ombre.addColorStop(0, 'rgba(0,0,0,.30)');
    ombre.addColorStop(0.06, 'rgba(0,0,0,.10)');
    ombre.addColorStop(0.18, 'rgba(0,0,0,0)');
    ombre.addColorStop(0.82, 'rgba(0,0,0,0)');
    ombre.addColorStop(0.94, 'rgba(0,0,0,.12)');
    ombre.addColorStop(1, 'rgba(0,0,0,.34)');
    pctx.fillStyle = ombre;
    pctx.fillRect(0, 0, W, H);
    // Reflet du verre PAR-DESSUS le papier : c'est lui qui fait « vrai ».
    const reflet = pctx.createLinearGradient(0, 0, W, 0);
    reflet.addColorStop(0.22, 'rgba(255,255,255,0)');
    reflet.addColorStop(0.29, 'rgba(255,255,255,.16)');
    reflet.addColorStop(0.33, 'rgba(255,255,255,.05)');
    reflet.addColorStop(0.40, 'rgba(255,255,255,0)');
    pctx.fillStyle = reflet;
    pctx.fillRect(0, 0, W, H);

    // Bords adoucis sur ~1,5 px (à la définition ×3) : collé, pas découpé.
    const f = Math.max(2, Math.round(hauteur / 900));
    const net = document.createElement('canvas');
    net.width = W; net.height = H;
    const masque = document.createElement('canvas');
    masque.width = W; masque.height = H;
    const nctx = net.getContext('2d'), mctx = masque.getContext('2d');
    if (nctx && mctx) {
        nctx.fillStyle = '#000'; nctx.fillRect(f, f, W - 2 * f, H - 2 * f);
        mctx.filter = `blur(${f / 2}px)`;
        mctx.drawImage(net, 0, 0);
        pctx.globalCompositeOperation = 'destination-in';
        pctx.drawImage(masque, 0, 0);
        pctx.globalCompositeOperation = 'source-over';
    }

    // Ombre portée très légère sous le papier : il est collé SUR le verre.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = f * 2;
    ctx.drawImage(plaque, x0, y0);
    ctx.restore();

    const webp = out.toDataURL('image/webp', qualite);
    return webp.startsWith('data:image/webp') ? webp : out.toDataURL('image/png');
}
