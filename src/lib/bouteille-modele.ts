'use client';

/**
 * Le détourage par modèle, vu du navigateur.
 *
 * Tout le poids (11 Mo de runtime, 4,4 Mo de poids) reste sur le serveur : ici
 * on envoie une photo réduite et on reçoit un masque en niveaux de gris, qu'on
 * transforme en couche alpha. Ce module est chargé par import dynamique depuis
 * `bouteille.ts` — il ne doit jamais entrer dans le paquet principal.
 */

/** Côté maximal envoyé au serveur : au-delà, on paie du transfert pour rien. */
const COTE_ENVOI = 720;

/**
 * Seuil sous lequel un pixel devient franchement transparent.
 *
 * U²-Net laisse un halo de valeurs basses autour de l'objet. Sans plancher, la
 * boîte englobante calculée ensuite enflerait de plusieurs dizaines de pixels
 * et la bouteille serait posée trop petite.
 */
const PLANCHER = 28;

function versDataUrl(cv: HTMLCanvasElement): string {
    try { return cv.toDataURL('image/jpeg', 0.86); }
    catch { return ''; }
}

function reduire(source: HTMLCanvasElement): HTMLCanvasElement {
    const r = Math.min(1, COTE_ENVOI / Math.max(source.width, source.height));
    if (r >= 1) return source;
    const cv = document.createElement('canvas');
    cv.width = Math.round(source.width * r);
    cv.height = Math.round(source.height * r);
    cv.getContext('2d')?.drawImage(source, 0, 0, cv.width, cv.height);
    return cv;
}

/**
 * Renvoie la couche alpha de la bouteille, un octet par pixel de `source`.
 *
 * `null` si le serveur n'a pas pu segmenter : l'appelant retombe alors sur le
 * détourage par fond uni plutôt que d'échouer.
 */
export async function masquerBouteille(source: HTMLCanvasElement): Promise<Uint8ClampedArray | null> {
    const envoi = versDataUrl(reduire(source));
    if (!envoi) return null;

    // La segmentation ne doit pas retenir l'ajout de la bouteille : passé ce
    // délai, on rend la main et le fond uni reprend la main.
    const stop = new AbortController();
    const minuteur = setTimeout(() => stop.abort(), 20000);
    try {
        const res = await fetch('/api/decoupe-bouteille', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ image: envoi }),
            signal: stop.signal,
        });
        if (!res.ok) return null;
        const data = await res.json();
        const masque: string = data?.masque || '';
        if (!masque) return null;

        const img = await new Promise<HTMLImageElement | null>((ok) => {
            const el = new Image();
            el.onload = () => ok(el);
            el.onerror = () => ok(null);
            el.src = masque;
        });
        if (!img) return null;

        // Le masque revient à la taille de ce qu'on a ENVOYÉ ; on le redessine
        // à celle du canevas de travail, qui peut être plus grand.
        const cv = document.createElement('canvas');
        cv.width = source.width; cv.height = source.height;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        const px = ctx.getImageData(0, 0, cv.width, cv.height).data;

        const alpha = new Uint8ClampedArray(cv.width * cv.height);
        let couverts = 0;
        for (let p = 0; p < alpha.length; p++) {
            const v = px[p * 4];                       // gris : les trois canaux sont égaux
            const a = v < PLANCHER ? 0 : v;
            alpha[p] = a;
            if (a > 24) couverts++;
        }

        // Un masque qui ne retient presque rien, ou presque tout, n'a rien
        // segmenté : ce sont les deux façons dont U²-Net échoue, et dans les
        // deux cas le résultat serait pire que l'image d'origine.
        const part = couverts / alpha.length;
        if (part < 0.02 || part > 0.96) return null;

        return alpha;
    } catch {
        return null;
    } finally {
        clearTimeout(minuteur);
    }
}
