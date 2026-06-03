'use client';
/**
 * useSync — localStorage + Supabase sync automatique
 *
 * Si user connecté → lit/écrit Supabase (sync multi-appareils)
 * Si non connecté → localStorage seulement (fallback)
 *
 * À la connexion → migre automatiquement localStorage → Supabase
 */
import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ── Favoris ──────────────────────────────────────────────
export function useSyncFavorites() {
    const { user } = useAuth();

    const getFavorites = useCallback(async (): Promise<string[]> => {
        if (!user) {
            try { return JSON.parse(localStorage.getItem('favorites') || '[]'); } catch { return []; }
        }
        const { data } = await supabase.from('favorites').select('recipe_id').eq('user_id', user.id);
        return (data || []).map(r => r.recipe_id);
    }, [user]);

    const setFavorites = useCallback(async (ids: string[]) => {
        localStorage.setItem('favorites', JSON.stringify(ids));
        window.dispatchEvent(new Event('magic-favorite-change'));
        if (!user) return;
        // Sync complet : supprime tout, reinsère
        await supabase.from('favorites').delete().eq('user_id', user.id);
        if (ids.length > 0) {
            await supabase.from('favorites').insert(ids.map(id => ({ user_id: user.id, recipe_id: id })));
        }
    }, [user]);

    const toggleFavorite = useCallback(async (recipeId: string) => {
        const current = await getFavorites();
        const next = current.includes(recipeId)
            ? current.filter(id => id !== recipeId)
            : [...current, recipeId];
        await setFavorites(next);
        return next;
    }, [getFavorites, setFavorites]);

    // À la connexion, migre localStorage → Supabase
    useEffect(() => {
        if (!user) return;
        const migrate = async () => {
            const local: string[] = JSON.parse(localStorage.getItem('favorites') || '[]');
            if (local.length === 0) {
                // Charge depuis Supabase
                const remote = await getFavorites();
                localStorage.setItem('favorites', JSON.stringify(remote));
                window.dispatchEvent(new Event('magic-favorite-change'));
                return;
            }
            // Local a des données → merge avec remote
            const { data } = await supabase.from('favorites').select('recipe_id').eq('user_id', user.id);
            const remote = (data || []).map(r => r.recipe_id);
            const merged = Array.from(new Set([...local, ...remote]));
            await setFavorites(merged);
        };
        migrate();
    }, [user]);

    return { getFavorites, setFavorites, toggleFavorite };
}

// ── Meal Plan ─────────────────────────────────────────────
export function useSyncMealPlan() {
    const { user } = useAuth();

    const getMealPlan = useCallback(async (): Promise<Record<string, any>> => {
        if (!user) {
            try { return JSON.parse(localStorage.getItem('meal-planner-week') || '{}'); } catch { return {}; }
        }
        const { data } = await supabase.from('meal_plans').select('week_data').eq('user_id', user.id).single();
        return data?.week_data || {};
    }, [user]);

    const setMealPlan = useCallback(async (plan: Record<string, any>) => {
        localStorage.setItem('meal-planner-week', JSON.stringify(plan));
        if (!user) return;
        await supabase.from('meal_plans').upsert(
            { user_id: user.id, week_data: plan, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
        );
    }, [user]);

    useEffect(() => {
        if (!user) return;
        getMealPlan().then(remote => {
            const local = JSON.parse(localStorage.getItem('meal-planner-week') || '{}');
            const hasLocal = Object.keys(local).length > 0;
            const hasRemote = Object.keys(remote).length > 0;
            if (hasLocal && !hasRemote) {
                setMealPlan(local); // push local → remote
            } else if (hasRemote) {
                localStorage.setItem('meal-planner-week', JSON.stringify(remote)); // pull remote → local
            }
        });
    }, [user]);

    // Realtime sync
    useEffect(() => {
        if (!user) return;
        const channel = supabase
            .channel('meal_plans')
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'meal_plans',
                filter: `user_id=eq.${user.id}`
            }, payload => {
                if (payload.new && (payload.new as any).week_data) {
                    localStorage.setItem('meal-planner-week', JSON.stringify((payload.new as any).week_data));
                    window.dispatchEvent(new CustomEvent('meal-plan-updated'));
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user]);

    return { getMealPlan, setMealPlan };
}

// ── Note personnelle ──────────────────────────────────────
export function useSyncNote(recipeId: string) {
    const { user } = useAuth();

    const getNote = useCallback(async (): Promise<string> => {
        if (!user) return localStorage.getItem(`recipe-note-${recipeId}`) || '';
        const { data } = await supabase.from('personal_notes')
            .select('note').eq('user_id', user.id).eq('recipe_id', recipeId).single();
        return data?.note || '';
    }, [user, recipeId]);

    const setNote = useCallback(async (note: string) => {
        localStorage.setItem(`recipe-note-${recipeId}`, note);
        if (!user) return;
        await supabase.from('personal_notes').upsert(
            { user_id: user.id, recipe_id: recipeId, note, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,recipe_id' }
        );
    }, [user, recipeId]);

    return { getNote, setNote };
}

// ── Rating ────────────────────────────────────────────────
export function useSyncRating(recipeId: string) {
    const { user } = useAuth();

    const getRating = useCallback(async (): Promise<number> => {
        if (!user) return parseInt(localStorage.getItem(`recipe-rating-${recipeId}`) || '0');
        const { data } = await supabase.from('ratings')
            .select('rating').eq('user_id', user.id).eq('recipe_id', recipeId).single();
        return data?.rating || 0;
    }, [user, recipeId]);

    const setRating = useCallback(async (rating: number) => {
        localStorage.setItem(`recipe-rating-${recipeId}`, String(rating));
        if (!user) return;
        await supabase.from('ratings').upsert(
            { user_id: user.id, recipe_id: recipeId, rating, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,recipe_id' }
        );
    }, [user, recipeId]);

    return { getRating, setRating };
}
