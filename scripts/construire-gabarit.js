/**
 * Fabrique un GABARIT de bouteille : un packshot dont on a effacé l'étiquette.
 *
 * POURQUOI UN SCRIPT ET PAS DU CODE D'APPLICATION
 * -----------------------------------------------
 * Un gabarit se fabrique UNE FOIS puis vit dans `public/gabarits/`. Le faire à
 * l'exécution reviendrait à refaire le même calcul à chaque scan, pour un
 * résultat qui ne change jamais.
 *
 *   node scripts/construire-gabarit.js rouge <url-ou-fichier> [bandes]
 *
 * `bandes` est une liste de zones à effacer, en fractions de la HAUTEUR de la
 * bouteille, séparées par des virgules : « 0.10-0.28,0.45-0.92 ». Sans elle, la
 * bande est détectée automatiquement.
 *
 * Les donner à la main n'est pas un aveu d'échec, c'est le bon outil : pour un
 * GABARIT on ne cherche pas à lire l'étiquette, seulement à la faire
 * disparaître. Effacer large ne coûte rien — le verre reconstitué est lisse —
 * alors qu'une détection ratée laisse la marque d'origine sur toutes les
 * bouteilles de cette couleur. La détection automatique se trompe justement sur
 * les étiquettes bicolores (un bandeau rouge ou violet sur fond crème) posées
 * sur un verre clair : les moyennes par ligne n'y séparent plus rien.
 *
 * Le détourage passe par `/api/decoupe-bouteille` — le serveur de développement
 * doit tourner. On pourrait remplir depuis les bords comme le fait le
 * navigateur, mais ce remplissage traverse les étiquettes claires et les
 * dévore : c'est le bug qui a coûté le plus de temps sur ce chantier, inutile
 * de le réintroduire ici.
 *
 * L'étiquette est ensuite EFFACÉE par interpolation verticale du verre, colonne
 * par colonne. Le verre varie doucement du haut vers le bas ; reconstituer la
 * bande manquante par les deux bords suffit, et ne laisse pas de couture.
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const API = process.env.API_DECOUPE || 'http://127.0.0.1:3007/api/decoupe-bouteille';
const SORTIE = path.join(__dirname, '..', 'public', 'gabarits');

/** Cadre du gabarit, identique à celui de `src/lib/bouteille.ts`. */
const CADRE_L = 460, CADRE_H = 614;
const HAUTEUR_BOUTEILLE = 0.85, LARGEUR_MAX = 0.82, LIGNE_DE_POSE = 0.93;

async function lireSource(ref) {
    if (/^https?:/.test(ref)) {
        const r = await fetch(ref);
        if (!r.ok) throw new Error(`source injoignable : HTTP ${r.status}`);
        return Buffer.from(await r.arrayBuffer());
    }
    return fs.readFileSync(ref);
}

/** Masque de segmentation, via la route de l'application. */
async function detourer(jpg) {
    const r = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: 'data:image/jpeg;base64,' + jpg.toString('base64') }),
    });
    const j = await r.json();
    if (!j.masque) throw new Error('segmentation : ' + JSON.stringify(j).slice(0, 160));
    return j;
}

/** Sépare verre et papier par la méthode d'Otsu, sur la clarté ligne par ligne. */
function bandeEtiquette(d, W, H) {
    const clarte = new Float32Array(H), presents = new Int32Array(H);
    for (let y = 0; y < H; y++) {
        let s = 0, n = 0;
        for (let x = 0; x < W; x++) {
            const p = (y * W + x) * 4;
            if (d[p + 3] <= 24) continue;
            s += (d[p] * 299 + d[p + 1] * 587 + d[p + 2] * 114) / 1000;
            n++;
        }
        presents[y] = n; clarte[y] = n ? s / n : -1;
    }
    let large = 0;
    for (let y = 0; y < H; y++) if (presents[y] > large) large = presents[y];
    let haut = -1, bas = -1;
    for (let y = 0; y < H; y++) if (presents[y] > large * 0.72) { if (haut < 0) haut = y; bas = y; }

    const hist = new Uint32Array(256);
    let total = 0;
    for (let y = haut; y <= bas; y++) { if (clarte[y] < 0) continue; hist[Math.round(clarte[y])]++; total++; }
    let sommeTotale = 0;
    for (let v = 0; v < 256; v++) sommeTotale += v * hist[v];
    let sommeBasse = 0, poidsBas = 0, meilleure = -1, coupure = 128;
    for (let v = 0; v < 256; v++) {
        poidsBas += hist[v];
        if (!poidsBas) continue;
        const poidsHaut = total - poidsBas;
        if (!poidsHaut) break;
        sommeBasse += v * hist[v];
        const variance = poidsBas * poidsHaut * ((sommeBasse / poidsBas) - ((sommeTotale - sommeBasse) / poidsHaut)) ** 2;
        if (variance > meilleure) { meilleure = variance; coupure = v; }
    }

    const meilleureBande = (auDessus) => {
        let best = { debut: -1, fin: -1, score: 0 };
        let debut = -1, somme = 0, n = 0;
        const fermer = (fin) => {
            if (debut < 0) return;
            const h = fin - debut + 1, score = h * (somme / Math.max(1, n));
            if (h >= (bas - haut) * 0.08 && score > best.score) best = { debut, fin, score };
            debut = -1; somme = 0; n = 0;
        };
        for (let y = haut; y <= bas; y++) {
            const c = clarte[y];
            const dedans = c >= 0 && (auDessus ? c > coupure : c < coupure);
            if (dedans) { if (debut < 0) debut = y; somme += Math.abs(c - coupure); n++; }
            else fermer(y - 1);
        }
        fermer(bas);
        return best;
    };
    const clair = meilleureBande(true), sombre = meilleureBande(false);
    const m = clair.score >= sombre.score ? clair : sombre;
    if (m.debut < 0) throw new Error('aucune étiquette détectée');
    return { debut: m.debut, fin: m.fin, coupure };
}

/**
 * Efface une bande : le verre qui l'entoure est prolongé par-dessus.
 *
 * DEUX PIÈGES, DEUX PARADES
 * -------------------------
 * 1. Interpoler entre le haut et le bas d'une bande TRÈS HAUTE ne reconstitue
 *    pas du verre, ça fabrique un dégradé. Sur un champagne dont la coiffe est
 *    dorée, prolonger l'or vers le fond sombre repeint toute la bouteille en
 *    dégradé or-vert. Au-delà d'un tiers de la hauteur, on ne prend donc QUE la
 *    référence du bas : le verre du corps remonte, ce qui est exactement ce
 *    qu'on veut voir.
 *
 * 2. Une colonne dont la ligne de référence tombe hors de la silhouette était
 *    simplement sautée — d'où les éclats d'étiquette restés sur les arêtes, là
 *    où la bouteille se rétrécit. On cherche maintenant la ligne opaque la plus
 *    proche, vers l'intérieur.
 *
 * 3. Le bas d'une bouteille est presque NOIR : l'ombre du culot. Prendre cette
 *    ligne pour référence et la prolonger vers le haut peint tout le corps en
 *    noir — on obtient une silhouette, pas du verre. La référence est donc la
 *    MÉDIANE de plusieurs lignes prises au-dessus du culot.
 */
function effacer(d, W, H, debut, fin, hauteurBouteille) {
    const marge = 4;
    const yA = Math.max(0, debut - marge), yB = Math.min(H - 1, fin + marge);
    if (yB <= yA) return 0;

    // Bande haute : le bas seul fait référence (voir le piège 1).
    const basSeul = (yB - yA) > hauteurBouteille * 0.33;

    /** Première ligne opaque à partir de `depart`, dans la direction donnée. */
    const opaqueProche = (x, depart, pas) => {
        for (let y = depart, n = 0; y >= 0 && y < H && n < 60; y += pas, n++) {
            if (d[(y * W + x) * 4 + 3] > 24) return y;
        }
        return -1;
    };

    /** Couleur de référence : médiane de 9 lignes à partir de `depart`. */
    const reference = (x, depart, pas) => {
        const r = [], g = [], b = [];
        for (let y = depart, n = 0; y >= 0 && y < H && r.length < 9 && n < 80; y += pas, n++) {
            const p = (y * W + x) * 4;
            if (d[p + 3] <= 24) continue;
            r.push(d[p]); g.push(d[p + 1]); b.push(d[p + 2]);
        }
        if (!r.length) return null;
        const med = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
        return [med(r), med(g), med(b)];
    };

    let colonnes = 0;
    for (let x = 0; x < W; x++) {
        // On s'éloigne de la bande avant d'échantillonner : juste au bord, on
        // ramasse encore l'ombre portée de l'étiquette.
        const bas = reference(x, Math.min(H - 1, yB + 6), 1);
        if (!bas) continue;
        const haut = basSeul ? bas : reference(x, Math.max(0, yA - 6), -1);
        if (!haut) continue;

        colonnes++;
        for (let y = yA; y <= yB; y++) {
            const p = (y * W + x) * 4;
            if (d[p + 3] <= 24) continue;
            const t = basSeul ? 1 : Math.max(0, Math.min(1, (y - yA) / (yB - yA)));
            for (let c = 0; c < 3; c++) d[p + c] = Math.round(haut[c] * (1 - t) + bas[c] * t);
        }
    }
    return colonnes;
}

/** Boîte opaque de l'image. */
function boite(d, W, H) {
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (d[(y * W + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

async function main() {
    const [couleur, source, bandesArg] = process.argv.slice(2);
    if (!couleur || !source) {
        console.error('usage : node scripts/construire-gabarit.js <rouge|blanc|rose|liqueur> <url-ou-fichier>');
        process.exit(1);
    }

    const brut = await lireSource(source);
    const jpg = await sharp(brut).flatten({ background: '#fff' }).resize({ width: 720, withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
    const { masque, largeur: W, hauteur: H } = await detourer(jpg);

    const rgb = await sharp(jpg).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer();
    const msk = await sharp(Buffer.from(masque.split(',')[1], 'base64')).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer();
    const d = Buffer.alloc(W * H * 4);
    for (let p = 0; p < W * H; p++) {
        d[p * 4] = rgb[p * 3]; d[p * 4 + 1] = rgb[p * 3 + 1]; d[p * 4 + 2] = rgb[p * 3 + 2];
        d[p * 4 + 3] = msk[p] < 28 ? 0 : msk[p];
    }

    // La boîte AVANT effacement : les fractions demandées s'y rapportent.
    const b0 = boite(d, W, H);

    let bande, colonnes = 0;
    if (bandesArg) {
        const zones = bandesArg.split(',').map((z) => z.split('-').map(Number));
        for (const [haut, bas] of zones) {
            colonnes += effacer(d, W, H, Math.round(b0.y0 + b0.h * haut), Math.round(b0.y0 + b0.h * bas), b0.h);
        }
        // La zone la PLUS BASSE fait foi : c'est l'étiquette principale, celle
        // dont la position servira à poser celle des bouteilles scannées.
        const principale = zones[zones.length - 1];
        bande = { debut: Math.round(b0.y0 + b0.h * principale[0]), fin: Math.round(b0.y0 + b0.h * principale[1]) };
    } else {
        bande = bandeEtiquette(d, W, H);
        colonnes = effacer(d, W, H, bande.debut, bande.fin, b0.h);
    }

    // Mise au format et à la ligne de pose de l'application.
    const { x0, y0 } = b0;
    const bw = b0.w, bh = b0.h;
    const echelle = Math.min((CADRE_H * HAUTEUR_BOUTEILLE) / bh, (CADRE_L * LARGEUR_MAX) / bw);
    const dw = Math.round(bw * echelle), dh = Math.round(bh * echelle);
    const dx = Math.round((CADRE_L - dw) / 2), dy = Math.round(CADRE_H * LIGNE_DE_POSE - dh);

    const decoupe = await sharp(d, { raw: { width: W, height: H, channels: 4 } })
        .extract({ left: x0, top: y0, width: bw, height: bh }).resize(dw, dh).png().toBuffer();
    const vide = await sharp({ create: { width: CADRE_L, height: CADRE_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();

    fs.mkdirSync(SORTIE, { recursive: true });
    await sharp(vide).composite([{ input: decoupe, left: dx, top: dy }]).webp({ quality: 92 }).toFile(path.join(SORTIE, `${couleur}.webp`));
    fs.writeFileSync(path.join(SORTIE, `${couleur}.json`), JSON.stringify({
        cadre: [CADRE_L, CADRE_H],
        bouteille: { x: dx, y: dy, w: dw, h: dh },
        etiquette: { haut: +((bande.debut - y0) / bh).toFixed(4), bas: +((bande.fin - y0) / bh).toFixed(4) },
        source,
    }, null, 1));

    const poids = fs.statSync(path.join(SORTIE, `${couleur}.webp`)).size;
    console.log(`${couleur} : ${dw}x${dh}, étiquette ${bande.debut}-${bande.fin} effacée sur ${colonnes} colonnes, ${(poids / 1024) | 0} Ko`);
}

main().catch((e) => { console.error('échec :', e.message); process.exit(1); });
