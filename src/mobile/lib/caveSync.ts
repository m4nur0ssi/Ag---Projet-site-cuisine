'use client';

import { supabase } from './supabase';
import { CAVE_KEY, CAVE_EVENT } from '@/lib/cave';
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

const readLocal = (): unknown[] => {
    try { const v = JSON.parse(localStorage.getItem(CAVE_KEY) || '[]'); return Array.isArray(v) ? v : []; }
    catch { return []; }
};

/** À la connexion : le nuage hydrate la cave locale s'il est plus récent. */
export async function pullCave(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { markPulled(); return; }           // hors compte : rien à descendre

    const { data, error } = await supabase
        .from('cave_state')
        .select('data, updated_at')
        .eq('user_id', session.user.id)
        .maybeSingle();
    // Réseau KO : on garde le local, mais on NE DÉVERROUILLE PAS l'envoi — on
    // ignore ce que contient le nuage, ce serait le moment de tout écraser.
    if (error) return;
    if (!data) { markPulled(); return; }              // compte neuf : le local fera foi

    const cloud = Array.isArray(data.data) ? data.data : [];
    const local = readLocal();
    const mine = Number(localStorage.getItem(STAMP_KEY) || 0);
    const theirs = new Date(data.updated_at).getTime();

    // Cave locale non vide et plus fraîche que le nuage : c'est elle qui gagne,
    // et c'est à elle de monter (le push s'en charge juste après).
    if (local.length && mine > theirs) { markPulled(); return; }
    if (JSON.stringify(cloud) === JSON.stringify(local)) { markPulled(); return; }

    ecrireStock(CAVE_KEY, JSON.stringify(cloud));
    ecrireStock(STAMP_KEY, String(theirs));
    markPulled();
    window.dispatchEvent(new Event(CAVE_EVENT));
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

async function pushNow(): Promise<void> {
    if (!pulled) return;                              // jamais avant d'avoir lu
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const now = new Date();
    const { error } = await supabase.from('cave_state').upsert({
        user_id: session.user.id,
        data: readLocal(),
        updated_at: now.toISOString(),
    });
    if (!error) ecrireStock(STAMP_KEY, String(now.getTime()));
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
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(() => { pushNow().catch(() => {}); }, 1500);
    };
    window.addEventListener(CAVE_EVENT, schedule);
    window.addEventListener('storage', schedule);
}
