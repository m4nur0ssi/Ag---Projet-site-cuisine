/**
 * Détourage d'une bouteille — segmentation réelle.
 *
 * POURQUOI UNE ROUTE ET PAS DU CODE NAVIGATEUR
 * -------------------------------------------
 * Le détourage par remplissage depuis les bords (`detourerFondUni`) suffit aux
 * visuels de marchand, posés sur fond uni. Il ne peut RIEN sur une photo prise
 * chez soi : plan de travail, carrelage, fenêtre. Or c'est de là que viennent
 * la plupart des bouteilles.
 *
 * Il faut donc un modèle. Les deux autres voies ont été écartées :
 *
 *   • `onnxruntime-node` : 301 Mo décompressés, au-dessus des 250 Mo qu'une
 *     fonction Vercel accepte ;
 *   • le même modèle dans le navigateur : 11 Mo de WASM + 4,4 Mo de poids à
 *     télécharger sur le téléphone au premier scan.
 *
 * Reste le runtime WASM exécuté ICI, côté serveur : 11 Mo qui vivent dans le
 * paquet de la fonction, rien à télécharger chez le client, et le téléphone
 * n'envoie qu'une photo déjà réduite.
 *
 * Modèle : U²-Net « p » (la variante légère), 4,4 Mo, Apache 2.0. Il détecte
 * l'objet SAILLANT de l'image — ce qu'est précisément une bouteille qu'on
 * photographie. On renvoie son masque, pas l'image découpée : le client sait
 * déjà composer, et un masque en niveaux de gris pèse trois fois moins.
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Côté de l'entrée du réseau. U²-Net est entraîné en 320 × 320. */
const COTE = 320;

/**
 * La session, gardée entre deux appels.
 *
 * Charger 4,4 Mo de poids et démarrer le runtime prend une à deux secondes.
 * Une fonction Vercel « chaude » enchaîne les requêtes dans le même processus :
 * sans ce cache, chaque bouteille repayait le démarrage.
 */
let sessionEnCours: Promise<import('onnxruntime-web').InferenceSession> | null = null;

function session() {
    if (sessionEnCours) return sessionEnCours;
    sessionEnCours = (async () => {
        const ort = await import('onnxruntime-web');
        // Le runtime cherche ses binaires à côté du script ; en fonction
        // serverless il faut lui dire où ils ont atterri.
        ort.env.wasm.wasmPaths = path.join(process.cwd(), 'node_modules/onnxruntime-web/dist/');
        // Un seul fil : les fils WASM réclament l'isolation d'origine, que la
        // fonction n'a pas, et le modèle est assez petit pour s'en passer.
        ort.env.wasm.numThreads = 1;
        ort.env.logLevel = 'error';
        const modele = path.join(process.cwd(), 'public/modeles/u2netp.onnx');
        return ort.InferenceSession.create(modele, { executionProviders: ['wasm'] });
    })();
    // Un démarrage raté ne doit pas condamner la route à vie.
    sessionEnCours.catch(() => { sessionEnCours = null; });
    return sessionEnCours;
}

/** Normalisation d'entrée d'U²-Net : canal par canal, moyenne puis écart-type. */
const MOYENNE = [0.485, 0.456, 0.406];
const ECART = [0.229, 0.224, 0.225];

export async function POST(req: NextRequest) {
    let image: string;
    try {
        const corps = await req.json();
        image = String(corps?.image || '');
    } catch {
        return NextResponse.json({ error: 'corps illisible' }, { status: 400 });
    }
    if (!image.startsWith('data:image/')) {
        return NextResponse.json({ error: 'image attendue en data-url' }, { status: 400 });
    }

    const brut = Buffer.from(image.slice(image.indexOf(',') + 1), 'base64');
    // Deux mégaoctets : une photo de téléphone déjà réduite par le client tient
    // largement dedans, et ce plafond ferme la porte à l'envoi d'un fichier
    // arbitraire pour occuper la fonction.
    if (brut.length > 2 * 1024 * 1024) {
        return NextResponse.json({ error: 'image trop lourde' }, { status: 413 });
    }

    try {
        const source = sharp(brut, { failOn: 'none' });
        const meta = await source.metadata();
        const largeur = meta.width || 0, hauteur = meta.height || 0;
        if (!largeur || !hauteur) {
            return NextResponse.json({ error: 'image illisible' }, { status: 400 });
        }

        // Entrée du réseau : 320 × 320 EXACTEMENT, déformation comprise. U²-Net
        // est entraîné ainsi ; préserver le rapport en ajoutant des bandes
        // apprendrait au modèle qu'il y a un objet rectangulaire sur les côtés.
        const pixels = await source
            .clone()
            .resize(COTE, COTE, { fit: 'fill' })
            .removeAlpha()
            .raw()
            .toBuffer();

        const ort = await import('onnxruntime-web');
        const entree = new Float32Array(3 * COTE * COTE);
        const plan = COTE * COTE;
        for (let p = 0; p < plan; p++) {
            for (let c = 0; c < 3; c++) {
                entree[c * plan + p] = (pixels[p * 3 + c] / 255 - MOYENNE[c]) / ECART[c];
            }
        }

        const sess = await session();
        const sortie = await sess.run({
            [sess.inputNames[0]]: new ort.Tensor('float32', entree, [1, 3, COTE, COTE]),
        });
        // U²-Net publie sept cartes ; la première (`d0`) est la fusion des six
        // autres, c'est celle qu'on veut.
        const carte = sortie[sess.outputNames[0]].data as Float32Array;

        // Le réseau sort des valeurs non bornées : on les ramène sur 0-255 en
        // s'appuyant sur ses propres extrêmes, comme le fait rembg.
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < plan; i++) {
            if (carte[i] < min) min = carte[i];
            if (carte[i] > max) max = carte[i];
        }
        const etendue = max - min || 1;
        const gris = Buffer.allocUnsafe(plan);
        for (let i = 0; i < plan; i++) {
            gris[i] = Math.round(((carte[i] - min) / etendue) * 255);
        }

        // Le masque repart à la taille de la photo d'origine : c'est au client
        // de le poser en couche alpha sur ses propres pixels.
        const masque = await sharp(gris, { raw: { width: COTE, height: COTE, channels: 1 } })
            .resize(largeur, hauteur, { fit: 'fill' })
            .png({ compressionLevel: 9 })
            .toBuffer();

        return NextResponse.json({
            masque: `data:image/png;base64,${masque.toString('base64')}`,
            largeur,
            hauteur,
        });
    } catch (e) {
        return NextResponse.json(
            { error: 'segmentation impossible', detail: String((e as Error)?.message || e).slice(0, 200) },
            { status: 500 },
        );
    }
}
