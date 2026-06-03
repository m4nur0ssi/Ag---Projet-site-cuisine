'use client';

import { supabase } from './supabase';

/**
 * Source de vérité des favoris = Supabase (table `favorites`, par user_id).
 * Le localStorage `favorites` n'est qu'un CACHE rapide.
 *
 * pullFavorites() lit le cloud et hydrate le cache. Indispensable pour que les
 * favoris suivent le compte sur une autre adresse / un nouvel appareil
 * (localStorage est isolé par domaine).
 *
 * Anti-boucle : on ne ré-émet `magic-favorite-change` QUE si le cache a changé.
 */
export async function pullFavorites(): Promise<string[]> {
    const cached = (): string[] => {
        try { return JSON.parse(localStorage.getItem('favorites') || '[]'); } catch { return []; }
    };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return cached();

    const { data, error } = await supabase
        .from('favorites')
        .select('recipe_id')
        .eq('user_id', session.user.id);

    // En cas d'erreur réseau : on garde le cache local (dégradation douce).
    if (error || !data) return cached();

    const ids = data.map((r: { recipe_id: string | number }) => String(r.recipe_id));
    const next = JSON.stringify(ids);
    if (localStorage.getItem('favorites') !== next) {
        localStorage.setItem('favorites', next);
        window.dispatchEvent(new Event('magic-favorite-change'));
    }
    return ids;
}
