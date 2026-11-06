'use client';

import { supabase } from './supabase';
import { CAVE_EVENT, lireCaveComplete, ecrireCaveBrute, updateWine, type CaveWine } from '@/lib/cave';
import { ecrireStock } from '@/lib/stockage';

/**
 * « Ma cave » suit le COMPTE, plus le navigateur.
 *
 * Le stockage local reste la source de lecture — instantanée, et la cave doit
 * s'afficher hors ligne — mais son contenu part dans Supabase (table
 * `cave_state`, une ligne par utilisateur, l'état complet en jsonb) et en
 * revient à la connexion. Sans ça, une bouteille scannée sur le téléphone
 * n'existait pas sur l'ordinateur : `localStorage` est isolé par appareil ET par
 * navigateur.
 *
 * Règle d'arbitrage : le plus RÉCENT gagne. On compare la date du nuage à celle
 * du dernier envoi connu de cet appareil, pour ne pas écraser des bouteilles
 * ajoutées ici pendant qu'on était déconnecté.
 */

const STAMP_KEY = 'ma-cave-sync-v1';   // date du dernier échange réussi ici

/**
 * Écritures faites PAR la synchro elle-même (cave descendue du nuage, photo
 * remplacée par son adresse) : elles ne doivent pas relancer un envoi, sinon
 * chaque lecture déclenchait une écriture, qui faisait relire les autres
 * appareils… Le compteur couvre les événements émis pendant ces écritures.
 */
let muet = 0;
const enSilence = <T,>(f: () => T): T => { muet++; try { return f(); } finally { muet--; } };

/** Empreinte de la dernière cave envoyée : pas d'écriture si rien n'a bougé. */
const EMPREINTE_KEY = 'ma-cave-sync-empreinte';
const empreinteDe = (t: string) => {
    let h = 5381;
    for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
    return `${t.length}-${h >>> 0}`;
};

/*
 * Garde-fous : la cave ne doit JAMAIS pouvoir mettre Supabase à genoux.
 *
 * Quand le quota est dépassé, c'est tout le projet qui est restreint —
 * connexion, planificateur, notes — pas seulement la cave. La synchro de la
 * cave est un confort ; elle doit donc se taire au moindre signe de tension.
 */
const PAUSE_KEY = 'ma-cave-sync-pause';
const PAUSE_MS = 6 * 3600 * 1000;
const enPause = (): boolean => {
    try { return Number(localStorage.getItem(PAUSE_KEY) || 0) > Date.now(); } catch { return false; }
};
/** Un refus qui ressemble à un quota ou à une restriction : on coupe la synchro 6 h. */
function signalerErreur(err: unknown): void {
    const e = err as { status?: number; statusCode?: string | number; message?: string } | null;
    const code = Number(e?.status ?? e?.statusCode ?? 0);
    const msg = String(e?.message || '');
    if (code === 402 || code === 429 || /quota|exceed|restrict|too many/i.test(msg)) {
        ecrireStock(PAUSE_KEY, String(Date.now() + PAUSE_MS));
        console.warn('[cave] synchro en pause 6 h :', msg || code);
    }
}

/** Au plus N photos envoyées par jour et par appareil : filet contre toute boucle. */
const BUDGET_KEY = 'ma-cave-sync-budget';
const PHOTOS_PAR_JOUR = 80;
function budgetRestant(): number {
    try {
        const b = JSON.parse(localStorage.getItem(BUDGET_KEY) || '{}');
        const jour = new Date().toISOString().slice(0, 10);
        return b.jour === jour ? Math.max(0, PHOTOS_PAR_JOUR - (b.n || 0)) : PHOTOS_PAR_JOUR;
    } catch { return PHOTOS_PAR_JOUR; }
}
function depenserBudget(): void {
    try {
        const jour = new Date().toISOString().slice(0, 10);
        const b = JSON.parse(localStorage.getItem(BUDGET_KEY) || '{}');
        ecrireStock(BUDGET_KEY, JSON.stringify({ jour, n: (b.jour === jour ? b.n || 0 : 0) + 1 }));
    } catch { /* noop */ }
}

/**
 * Poids visé par photo. Safari n'encode pas le WebP : ses détourages sortent en
 * PNG, parfois plusieurs centaines de Ko. Chaque appareil télécharge chaque
 * photo une fois ; à 30 bouteilles, mieux vaut 30 × ~150 Ko que 30 × 600 Ko.
 */
const POIDS_CIBLE = 160_000;
const POIDS_MAX = 450_000;

/** Réduit la photo (même format, transparence gardée) jusqu'à tenir dans le poids visé. */
async function alleger(blob: Blob): Promise<Blob | null> {
    if (blob.size <= POIDS_CIBLE) return blob;
    try {
        const bmp = await createImageBitmap(blob);
        let echelle = 1;
        let meilleur: Blob = blob;
        for (let i = 0; i < 4; i++) {
            echelle *= 0.8;
            const cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(bmp.width * echelle));
            cv.height = Math.max(1, Math.round(bmp.height * echelle));
            cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height);
            const b = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/webp', 0.85));
            const r = b && b.size < meilleur.size ? b : meilleur;
            meilleur = r;
            if (meilleur.size <= POIDS_CIBLE) break;
        }
        bmp.close?.();
        return meilleur.size <= POIDS_MAX ? meilleur : null;   // trop lourde : reste sur l'appareil
    } catch { return blob.size <= POIDS_MAX ? blob : null; }
}

/** Dossier de stockage du compte (le même que les photos « J'ai cuisiné »). */
const BUCKET = 'cooking-photos';
/** Photos envoyées par passage : une cave ancienne en a des dizaines à rattraper. */
const PHOTOS_PAR_ENVOI = 12;

/**
 * A-t-on déjà LU le nuage sur cet appareil ?
 *
 * Rien ne doit monter avant d'être descendu. Sans ce verrou, ouvrir « Ma cave »
 * sur un appareil neuf écrivait les six bouteilles d'exemple, l'événement de
 * changement partait, et la cave d'exemple écrasait dans le nuage la vraie cave
 * remplie sur le téléphone.
 */
let pulled = false;

/**
 * Deux verrous, et non un seul — ils ne protègent pas la même chose.
 *
 * `pulled` garde l'ENVOI : tant qu'on n'a pas lu le nuage, rien ne monte. Il ne
 * doit jamais s'ouvrir tout seul, sans quoi une cave d'exemple écraserait la
 * vraie le jour où le réseau tombe au mauvais moment.
 *
 * `ready` garde l'AFFICHAGE : il dit à l'écran qu'il peut semer ses bouteilles
 * d'exemple et rattraper les photos non détourées. Ces deux gestes restent
 * LOCAUX. Les faire attendre un nuage qui ne répondra jamais — pas de compte,
 * réseau coupé — laissait la cave vide et les photos d'origine en place sans
 * que rien ne l'explique. Il s'ouvre donc aussi sur minuterie.
 */
let resolveReady: () => void;
const ready = new Promise<void>((res) => { resolveReady = res; });

/** Attend la lecture du nuage, ou son abandon, avant de toucher à l'affichage. */
export function whenCaveReady(): Promise<void> { return ready; }

/** Ouvre le verrou d'AFFICHAGE seul. L'envoi reste fermé. */
function laisserAfficher() { resolveReady(); }

function markPulled() {
    if (pulled) return;
    pulled = true;
    laisserAfficher();
}

/** La cave locale avec ses photos EN CLAIR : le nuage n'a que faire d'un repère IndexedDB. */
const readLocal = (): Promise<CaveWine[]> => lireCaveComplete();

/**
 * Ce qui monte dans le nuage : la cave SANS ses photos prises à l'appareil.
 *
 * Une photo scannée voyage en clair (`data:…`, des centaines de Ko). Deux
 * comptes portaient ainsi 8 et 5 Mo par ligne : chaque appareil qui
 * redescendait la cave tirait ces Mo, et le quota mensuel de Supabase (5 Go
 * sortants) a été épuisé — site entier coupé : connexion, notes, favoris.
 * Les photos de marchand (URL) restent, elles ne pèsent rien. Les photos
 * scannées vivent sur l'appareil qui les a prises (IndexedDB).
 */
const sansPhotosLourdes = (cave: CaveWine[]): CaveWine[] =>
    cave.map((w) => (w.photo && w.photo.startsWith('data:') ? { ...w, photo: undefined } : w));

/** Le nuage n'a plus les photos scannées : on garde celles de l'appareil. */
function garderPhotosLocales(cloud: CaveWine[], local: CaveWine[]): CaveWine[] {
    const parId = new Map(local.map((w) => [String(w.id), w.photo]));
    return cloud.map((w) => (w.photo ? w : { ...w, photo: parId.get(String(w.id)) }));
}

/** À la connexion : le nuage hydrate la cave locale s'il est plus récent. */
export async function pullCave(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { markPulled(); return; }           // hors compte : rien à descendre
    if (enPause()) return;                            // quota en vue : on ne touche plus au nuage

    /*
     * D'abord la seule date : la cave porte des photos en clair (plusieurs Mo)
     * et la redescendre à CHAQUE ouverture de l'app épuisait la bande passante
     * Supabase. Si la copie locale est déjà aussi récente que le nuage, rien à
     * télécharger.
     */
    const { data: tete, error: erreurTete } = await supabase
        .from('cave_state')
        .select('updated_at')
        .eq('user_id', session.user.id)
        .maybeSingle();
    if (erreurTete) { signalerErreur(erreurTete); return; }                           // réseau/quota KO : même règle que ci-dessous
    if (!tete) { markPulled(); return; }              // compte neuf : le local fera foi
    const miennePre = Number(localStorage.getItem(STAMP_KEY) || 0);
    if (miennePre >= new Date(tete.updated_at).getTime() && (await readLocal()).length) { markPulled(); return; }

    const { data, error } = await supabase
        .from('cave_state')
        .select('data, updated_at')
        .eq('user_id', session.user.id)
        .maybeSingle();
    // Réseau KO : on garde le local, mais on NE DÉVERROUILLE PAS l'envoi — on
    // ignore ce que contient le nuage, ce serait le moment de tout écraser.
    if (error) { signalerErreur(error); return; }
    if (!data) { markPulled(); return; }              // compte neuf : le local fera foi

    const cloud = Array.isArray(data.data) ? data.data : [];
    const local = await readLocal();
    const mine = Number(localStorage.getItem(STAMP_KEY) || 0);
    const theirs = new Date(data.updated_at).getTime();

    // Cave locale non vide et plus fraîche que le nuage : c'est elle qui gagne,
    // et c'est à elle de monter (le push s'en charge juste après).
    if (local.length && mine > theirs) { markPulled(); return; }
    /*
     * Fusion, plutôt que remplacement pur.
     *
     * Le nuage fait foi sur ce qu'il connaît (stock, notes, bouteilles retirées
     * ailleurs). Mais une bouteille ajoutée ICI depuis le dernier échange — hors
     * ligne, ou dans la seconde et demie avant l'envoi — n'y est pas encore :
     * le remplacement l'effaçait. On la garde, et elle montera au prochain envoi.
     */
    const idsNuage = new Set((cloud as CaveWine[]).map((w) => String(w.id)));
    const ajoutsLocaux = local.filter((w) => !idsNuage.has(String(w.id)) && (w.addedAt || 0) > mine);
    const fusion = [...ajoutsLocaux, ...garderPhotosLocales(cloud as CaveWine[], local)];
    /*
     * Identique : on NOTE la date quand même. Sans ça, l'appareil restait « en
     * retard » sur le nuage et retéléchargeait la cave entière à CHAQUE
     * ouverture, pour constater à chaque fois qu'elle n'avait pas changé.
     */
    // Ce qu'on vient de lire EST le nuage : rien à renvoyer tant qu'on n'y touche pas.
    const empreinteLue = empreinteDe(JSON.stringify(sansPhotosLourdes(fusion)));
    if (JSON.stringify(fusion) === JSON.stringify(local)) {
        ecrireStock(STAMP_KEY, String(theirs));
        if (!ajoutsLocaux.length) ecrireStock(EMPREINTE_KEY, empreinteLue);
        markPulled();
        return;
    }

    // Rien d'ajouté ici : écriture silencieuse (pas d'envoi en retour).
    // Des ajouts locaux à faire monter : l'événement normal déclenche l'envoi.
    if (ajoutsLocaux.length) ecrireCaveBrute(fusion);
    else enSilence(() => ecrireCaveBrute(fusion));
    ecrireStock(STAMP_KEY, String(theirs));
    if (!ajoutsLocaux.length) ecrireStock(EMPREINTE_KEY, empreinteLue);
    markPulled();
    enSilence(() => window.dispatchEvent(new Event(CAVE_EVENT)));
}

/**
 * Les photos prises À L'APPAREIL montent dans le stockage du compte.
 *
 * Jusqu'ici elles restaient sur le téléphone qui les avait prises : l'iPad et
 * l'ordinateur recevaient la bouteille… sans image. Une fois envoyée, la fiche
 * ne garde plus que l'ADRESSE de la photo (quelques octets dans le nuage), et
 * chaque appareil la télécharge une fois puis la garde en cache (un an).
 *
 * Bornée à quelques photos par passage, et arrêtée à la première erreur : si le
 * stockage refuse (droits, quota), la photo reste sur l'appareil, comme avant.
 */
async function televerserPhotos(uid: string): Promise<boolean> {
    const cave = await readLocal();
    let faites = 0;
    for (const w of cave) {
        if (budgetRestant() <= 0) return false;       // assez pour aujourd'hui
        if (faites >= PHOTOS_PAR_ENVOI) return true;   // il en reste : un autre passage suivra
        const p = w.photo || '';
        if (!p.startsWith('data:')) continue;
        try {
            const brut = await (await fetch(p)).blob();
            const blob = await alleger(brut);
            if (!blob) continue;                      // trop lourde : elle reste sur cet appareil
            const type = blob.type || 'image/jpeg';
            const ext = type.includes('webp') ? 'webp' : type.includes('png') ? 'png' : 'jpg';
            const chemin = `${uid}/cave-${w.id}-${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from(BUCKET).upload(chemin, blob, { upsert: false, contentType: type, cacheControl: '31536000' });
            // Chemin unique (horodaté) : pas besoin d'`upsert`, qui exige en plus
            // les droits de lecture et de mise à jour sur le dossier.
            if (error) { signalerErreur(error); console.warn('[cave] photo non envoyée :', error.message); return false; }
            depenserBudget();
            const url = supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
            if (!url) return false;
            enSilence(() => updateWine(w.id, { photo: url }));
            faites++;
        } catch { return false; }
    }
    return false;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

async function pushNow(): Promise<void> {
    if (!pulled) return;                              // jamais avant d'avoir lu
    if (enPause()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    /*
     * Un autre appareil a-t-il écrit depuis notre dernier échange ? Si oui, on
     * relit et on fusionne AVANT d'écrire : sinon notre copie, plus ancienne,
     * écrasait ce qu'il venait d'ajouter. Une requête de quelques octets.
     */
    const { data: tete } = await supabase.from('cave_state').select('updated_at').eq('user_id', session.user.id).maybeSingle();
    const mine = Number(localStorage.getItem(STAMP_KEY) || 0);
    if (tete && new Date(tete.updated_at).getTime() > mine) await pullCave();

    const reste = await televerserPhotos(session.user.id);
    // Une vieille cave a plus de photos qu'un passage n'en envoie : on enchaîne.
    if (reste) { if (pushTimer) clearTimeout(pushTimer); pushTimer = setTimeout(() => { pushNow().catch(() => {}); }, 3000); }
    const contenu = sansPhotosLourdes(await readLocal());
    /*
     * Rien n'a changé depuis le dernier envoi (cas de chaque ouverture de
     * l'appli, qui émet un événement de cave) : on n'écrit pas. Chaque écriture
     * inutile coûtait une ligne complète dans le nuage ET faisait retélécharger
     * la cave par les autres appareils.
     */
    const empreinte = empreinteDe(JSON.stringify(contenu));
    const nuageAJour = !tete || new Date(tete.updated_at).getTime() <= Number(localStorage.getItem(STAMP_KEY) || 0);
    if (nuageAJour && localStorage.getItem(EMPREINTE_KEY) === empreinte) return;
    const now = new Date();
    const { error } = await supabase.from('cave_state').upsert({
        user_id: session.user.id,
        data: contenu,
        updated_at: now.toISOString(),
    });
    if (error) signalerErreur(error);
    else { ecrireStock(STAMP_KEY, String(now.getTime())); ecrireStock(EMPREINTE_KEY, empreinte); }
}

/**
 * Sync montante : à chaque changement de cave, on pousse — débouncé à 1,5 s,
 * parce qu'ajuster un stock avec le « + » émet un événement par clic.
 */
export function startCaveSync(): void {
    if (started || typeof window === 'undefined') return;
    started = true;

    /*
     * Filet de sécurité sur le verrou de lecture.
     *
     * `pullCave` n'est appelé que depuis `onAuthStateChange`, et seulement quand
     * une session existe. Sans compte connecté — ou avec le compte de façade du
     * développement — l'événement n'apporte jamais de session : `markPulled`
     * n'était donc jamais atteint et `whenCaveReady()` restait en attente POUR
     * TOUJOURS.
     *
     * Ce qui attend derrière ce verrou, dans « Ma cave » : les bouteilles
     * d'exemple d'un appareil neuf, et le rattrapage des photos non détourées.
     * Les deux ne partaient tout simplement jamais hors connexion.
     *
     * Huit secondes : de quoi laisser une vraie session descendre du nuage et
     * gagner la course.
     *
     * On ouvre le verrou d'AFFICHAGE, pas celui de l'envoi : le semis et le
     * détourage sont des gestes locaux, alors qu'un envoi anticipé écraserait
     * la cave du nuage. C'est `markPulled`, et lui seul, qui autorise à monter.
     */
    setTimeout(laisserAfficher, 8000);

    const schedule = () => {
        if (muet) return;                             // écriture de la synchro elle-même
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(() => { pushNow().catch(() => {}); }, 1500);
    };
    window.addEventListener(CAVE_EVENT, schedule);
    window.addEventListener('storage', (e) => { if (!e.key || e.key === 'ma-cave-v1') schedule(); });

    /*
     * Rester à jour SANS se reconnecter.
     *
     * La cave ne se relisait qu'à la connexion : une bouteille scannée sur
     * l'iPhone n'arrivait sur l'iPad qu'après avoir fermé et rouvert l'appli.
     * On relit donc quand l'appli revient au premier plan, au retour du réseau,
     * et toutes les dix minutes tant qu'elle est affichée.
     *
     * Ça ne coûte presque rien : `pullCave` ne demande d'abord que la DATE de
     * la cave du nuage (quelques octets) et ne télécharge le reste que si elle a
     * changé. Au plus une relecture par minute (et toutes les 10 min en veille active), même si les événements
     * s'enchaînent.
     */
    let dernier = 0;
    const relire = () => {
        if (document.visibilityState !== 'visible') return;
        if (Date.now() - dernier < 60000) return;
        dernier = Date.now();
        pullCave().catch(() => {});
    };
    document.addEventListener('visibilitychange', relire);
    window.addEventListener('focus', relire);
    window.addEventListener('online', relire);
    setInterval(relire, 600000);
}
