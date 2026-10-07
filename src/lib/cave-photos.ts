/**
 * Les photos de bouteilles ne vivent plus dans le stockage local.
 * ==============================================================
 *
 * `localStorage` ne tient qu'environ cinq mégaoctets sur Safari, et une photo
 * détourée pèse plusieurs centaines de ko (Safari ne sait pas encoder en WebP :
 * le repli est un PNG). Quelques bouteilles, et le navigateur refusait d'en
 * ranger une de plus — « cave pleine » — ou, pire, la bouteille entrait avec
 * une photo écrasée par le dernier recours.
 *
 * IndexedDB, lui, se compte en centaines de mégaoctets. Les fiches gardent donc
 * un simple REPÈRE (`idb:<id>`) à la place de l'image ; l'image est lue ici, en
 * mémoire, et rendue à l'écran. Tout ce qui est petit ou distant (adresse
 * d'un marchand) reste tel quel dans la fiche.
 *
 * Règles de sécurité, parce qu'une photo perdue ne se refabrique pas :
 *   • une photo n'est remplacée par son repère QU'EN SACHANT qu'IndexedDB marche ;
 *   • si l'écriture échoue, on remet la photo dans la fiche (voir `cave.ts`) ;
 *   • à la lecture, un repère sans image est traité comme « pas de photo » mais
 *     JAMAIS réécrit ainsi : les écritures partent de la fiche brute.
 */

const BASE = 'ma-cave-photos';
const MAGASIN = 'photos';
export const REPERE = 'idb:';

/** En dessous, la photo reste dans la fiche : inutile de déplacer une miniature. */
export const SEUIL_OCTETS = 20_000;

/** Les images déjà lues, par identifiant de bouteille. */
const memoire = new Map<string, string>();
/** Ce qui est CONFIRMÉ dans IndexedDB (donc sans risque de perte). */
const confirmees = new Set<string>();

let base: Promise<IDBDatabase | null> | null = null;
let disponible: boolean | null = null;   // inconnu tant qu'on n'a pas essayé d'ouvrir

function ouvrir(): Promise<IDBDatabase | null> {
    if (base) return base;
    base = new Promise((resolve) => {
        try {
            if (typeof indexedDB === 'undefined') { disponible = false; resolve(null); return; }
            const req = indexedDB.open(BASE, 1);
            req.onupgradeneeded = () => { req.result.createObjectStore(MAGASIN); };
            req.onsuccess = () => { disponible = true; resolve(req.result); };
            req.onerror = () => { disponible = false; resolve(null); };
            req.onblocked = () => { disponible = false; resolve(null); };
        } catch { disponible = false; resolve(null); }
    });
    return base;
}

/** Vrai dès qu'on SAIT qu'IndexedDB répond ; faux tant qu'on n'a pas essayé. */
export const idbDisponible = () => disponible === true;

export const estRepere = (photo?: string) => !!photo && photo.startsWith(REPERE);
export const repereDe = (id: string) => `${REPERE}${id}`;
export const idDuRepere = (photo: string) => photo.slice(REPERE.length);

/** L'image d'un repère, si elle est déjà en mémoire. */
export const photoEnMemoire = (id: string) => memoire.get(id);

let hydratation: Promise<void> | null = null;

/** Charge toutes les photos en mémoire (une fois). Prévenu par `onPret` quand c'est fait. */
export function hydraterPhotos(onPret?: () => void): Promise<void> {
    if (!hydratation) {
        hydratation = (async () => {
            const db = await ouvrir();
            if (!db) return;
            await new Promise<void>((resolve) => {
                try {
                    const tx = db.transaction(MAGASIN, 'readonly');
                    const curseur = tx.objectStore(MAGASIN).openCursor();
                    curseur.onsuccess = () => {
                        const c = curseur.result;
                        if (!c) return;
                        if (typeof c.value === 'string') { memoire.set(String(c.key), c.value); confirmees.add(String(c.key)); }
                        c.continue();
                    };
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => resolve();
                    tx.onabort = () => resolve();
                } catch { resolve(); }
            });
        })();
    }
    if (onPret) void hydratation.then(onPret);
    return hydratation;
}

/**
 * Range une photo. Elle est visible tout de suite (mémoire) ; `true` quand
 * IndexedDB l'a CONFIRMÉE. Sur `false`, l'appelant doit remettre la photo dans la fiche.
 */
export async function rangerPhoto(id: string, dataUrl: string): Promise<boolean> {
    memoire.set(id, dataUrl);
    const db = await ouvrir();
    if (!db) return false;
    return new Promise<boolean>((resolve) => {
        try {
            const tx = db.transaction(MAGASIN, 'readwrite');
            tx.objectStore(MAGASIN).put(dataUrl, id);
            tx.oncomplete = () => { confirmees.add(id); resolve(true); };
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
        } catch { resolve(false); }
    });
}

export const photoConfirmee = (id: string) => confirmees.has(id);

/** Oublie la photo d'une bouteille retirée de la cave. */
export async function oublierPhoto(id: string): Promise<void> {
    memoire.delete(id);
    confirmees.delete(id);
    const db = await ouvrir();
    if (!db) return;
    try {
        const tx = db.transaction(MAGASIN, 'readwrite');
        tx.objectStore(MAGASIN).delete(id);
    } catch { /* tant pis : une photo orpheline ne gêne personne */ }
}
