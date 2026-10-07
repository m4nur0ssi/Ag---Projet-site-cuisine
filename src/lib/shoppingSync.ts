'use client';

import { supabase } from './supabase';
import { ecrireStock } from '@/lib/stockage';

// Clés localStorage de l'état "courses" synchronisées dans Supabase (table shopping_state).
// NB: meal-planner-week est déjà synchronisé via la table meal_plans → pas ici.
const KEYS = ['magic-shopping-list', 'shop-done', 'meal-week-checked', 'jourj-in-fused'];

/**
 * Quand ce téléphone a-t-il modifié la liste pour la dernière fois ?
 *
 * Sans cette date, le cloud écrasait toujours : on cochait un article, et
 * l'arrivée (différée d'une à deux secondes) de l'état enregistré AVANT le
 * geste le décochait tout seul. On garde donc la main sur ce qui est plus
 * récent que la dernière version connue du serveur.
 */
let dernierGesteLocal = 0;
/** Vrai pendant qu'on recopie le cloud : ces écritures-là ne sont pas des gestes. */
let hydratationEnCours = false;

/** À appeler à chaque modification VENUE de cet appareil. */
function noterGesteLocal(): void {
    if (!hydratationEnCours) dernierGesteLocal = Date.now();
}

/**
 * Recopie l'état du cloud dans le localStorage — sauf si notre version est plus
 * fraîche. `quand` est la date d'écriture côté serveur ; sans elle, on applique
 * (vieux enregistrements d'avant cette colonne).
 */
function appliquerCloud(cloud: Record<string, unknown>, quand?: string | null): boolean {
    const dateCloud = quand ? Date.parse(quand) : NaN;
    if (Number.isFinite(dateCloud) && dateCloud <= dernierGesteLocal) return false;
    hydratationEnCours = true;
    let changed = false;
    KEYS.forEach(k => {
        if (!(k in cloud)) return;
        const v = typeof cloud[k] === 'string' ? (cloud[k] as string) : JSON.stringify(cloud[k]);
        if (localStorage.getItem(k) !== v) { ecrireStock(k, v); changed = true; }
    });
    hydratationEnCours = false;
    if (changed) window.dispatchEvent(new Event('shoppingListUpdated'));
    return changed;
}

/**
 * Au login : récupère l'état courses du compte depuis Supabase et hydrate le localStorage.
 * Le plus RÉCENT fait foi — pas le cloud par principe : le temps que la session
 * s'ouvre, on a souvent déjà coché deux articles, et les perdre passait pour un bug.
 * Dégradation douce si réseau KO.
 */
export async function pullShoppingState(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await supabase
        .from('shopping_state')
        .select('data, updated_at')
        .eq('user_id', session.user.id)
        .maybeSingle();
    if (error || !data?.data) return;
    appliquerCloud(data.data as Record<string, unknown>, (data as { updated_at?: string }).updated_at);
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
// Dernière charge poussée par CET appareil : sert à ignorer l'écho de nos propres
// écritures quand le realtime nous les renvoie (sinon boucle push↔pull).
let lastPushJson = '';

async function pushNow(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const payload: Record<string, unknown> = {};
    KEYS.forEach(k => {
        const raw = localStorage.getItem(k);
        if (raw == null) return;
        try { payload[k] = JSON.parse(raw); } catch { payload[k] = raw; }
    });
    lastPushJson = JSON.stringify(payload);
    await supabase.from('shopping_state').upsert({
        user_id: session.user.id,
        data: payload,
        updated_at: new Date().toISOString(),
    });
}

/** Même objet, même chaîne : clés triées, pour comparer un JSONB relu à ce qu'on a écrit. */
function canonique(v: unknown): string {
    if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
    if (Array.isArray(v)) return '[' + v.map(canonique).join(',') + ']';
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + canonique(o[k])).join(',') + '}';
}

let realtimeStarted = false;

/**
 * Sync DESCENDANTE en temps réel : dès qu'un autre appareil (connecté au même
 * compte) modifie l'état courses (table `shopping_state`) ou le planning
 * (`meal_plans`), on hydrate le localStorage et on émet les mêmes événements que
 * les modifications locales → l'écran se met à jour aussitôt, sans reconnexion.
 * Nécessite que la réplication Realtime soit activée sur ces tables côté Supabase.
 */
export function startShoppingRealtime(userId: string): void {
    if (realtimeStarted || typeof window === 'undefined' || !userId) return;
    realtimeStarted = true;

    supabase
        .channel(`rt-shopping-${userId}`)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'shopping_state', filter: `user_id=eq.${userId}` },
            payload => {
                const ligne = payload.new as { data?: Record<string, unknown>; updated_at?: string };
                const cloud = ligne?.data;
                if (!cloud) return;
                // Notre propre écriture nous revient → rien à faire. La comparaison
                // se fait sur une forme CANONIQUE : Postgres réordonne les clés d'un
                // JSONB, si bien que la chaîne brute ne correspondait jamais et que
                // notre propre écho repassait par l'hydratation.
                if (canonique(cloud) === canonique(lastPushJson ? JSON.parse(lastPushJson) : null)) return;
                appliquerCloud(cloud, ligne.updated_at);
            })
        .subscribe();

    supabase
        .channel(`rt-meal-${userId}`)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'meal_plans', filter: `user_id=eq.${userId}` },
            payload => {
                const plan = (payload.new as { plan?: unknown })?.plan;
                if (plan == null) return;
                const v = JSON.stringify(plan);
                if (localStorage.getItem('meal-planner-week') === v) return; // notre propre écho
                ecrireStock('meal-planner-week', v);
                window.dispatchEvent(new Event('meal-plan-updated'));
                window.dispatchEvent(new Event('shoppingListUpdated'));
            })
        .subscribe();
}

/**
 * Démarre la sync montante : à chaque changement (event 'shoppingListUpdated'/'storage'),
 * pousse l'état vers Supabase, débouncé (1,5 s) pour ne pas spammer. Idempotent.
 */
export function startShoppingSync(): void {
    if (started || typeof window === 'undefined') return;
    started = true;
    const schedule = () => {
        noterGesteLocal();
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(() => { pushNow().catch(() => {}); }, 1500);
    };
    window.addEventListener('shoppingListUpdated', schedule);
    window.addEventListener('storage', schedule);
}
