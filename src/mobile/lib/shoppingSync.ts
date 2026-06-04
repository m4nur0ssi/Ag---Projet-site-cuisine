'use client';

import { supabase } from './supabase';

// Clés localStorage de l'état "courses" synchronisées dans Supabase (table shopping_state).
// NB: meal-planner-week est déjà synchronisé via la table meal_plans → pas ici.
const KEYS = ['magic-shopping-list', 'shop-done', 'meal-week-checked', 'jourj-in-fused'];

/**
 * Au login : récupère l'état courses du compte depuis Supabase et hydrate le localStorage.
 * Le cloud fait foi à la connexion (last-write-wins). Dégradation douce si réseau KO.
 */
export async function pullShoppingState(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await supabase
        .from('shopping_state')
        .select('data')
        .eq('user_id', session.user.id)
        .maybeSingle();
    if (error || !data?.data) return;
    const cloud = data.data as Record<string, unknown>;
    let changed = false;
    KEYS.forEach(k => {
        if (!(k in cloud)) return;
        const v = typeof cloud[k] === 'string' ? (cloud[k] as string) : JSON.stringify(cloud[k]);
        if (localStorage.getItem(k) !== v) { localStorage.setItem(k, v); changed = true; }
    });
    if (changed) window.dispatchEvent(new Event('shoppingListUpdated'));
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

async function pushNow(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const payload: Record<string, unknown> = {};
    KEYS.forEach(k => {
        const raw = localStorage.getItem(k);
        if (raw == null) return;
        try { payload[k] = JSON.parse(raw); } catch { payload[k] = raw; }
    });
    await supabase.from('shopping_state').upsert({
        user_id: session.user.id,
        data: payload,
        updated_at: new Date().toISOString(),
    });
}

/**
 * Démarre la sync montante : à chaque changement (event 'shoppingListUpdated'/'storage'),
 * pousse l'état vers Supabase, débouncé (1,5 s) pour ne pas spammer. Idempotent.
 */
export function startShoppingSync(): void {
    if (started || typeof window === 'undefined') return;
    started = true;
    const schedule = () => {
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(() => { pushNow().catch(() => {}); }, 1500);
    };
    window.addEventListener('shoppingListUpdated', schedule);
    window.addEventListener('storage', schedule);
}
