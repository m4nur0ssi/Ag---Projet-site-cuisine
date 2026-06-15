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

/**
 * Supprime les favoris ORPHELINS : ids enregistrés (cache + cloud) qui ne
 * correspondent à aucune recette connue (recette retirée du catalogue après un
 * sync WP). Sans ça, le compteur (badge) affiche plus de favoris que de fiches
 * réellement affichées. validIds = ids des recettes effectivement résolues.
 */
export async function pruneOrphanFavorites(validIds: string[]): Promise<void> {
    let stored: string[] = [];
    try { stored = JSON.parse(localStorage.getItem('favorites') || '[]'); } catch {}
    const valid = new Set(validIds.map(String));
    const orphans = stored.filter(id => !valid.has(String(id)));
    if (!orphans.length) return;
    localStorage.setItem('favorites', JSON.stringify(stored.filter(id => valid.has(String(id)))));
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        await supabase.from('favorites').delete().eq('user_id', session.user.id).in('recipe_id', orphans);
    }
    window.dispatchEvent(new Event('magic-favorite-change'));
}
