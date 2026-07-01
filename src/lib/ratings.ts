'use client';
// Notes recettes (étoiles /5). Moyenne PUBLIQUE (lecture ouverte), vote réservé
// aux connectés. Table Supabase `ratings` (user_id, recipe_id, stars, updated_at).
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface RatingStat { avg: number; count: number; }

// Cache mémoire partagé (toutes les stats en une requête → pas de N+1 sur les cartes).
let cache: Map<string, RatingStat> | null = null;
let inflight: Promise<Map<string, RatingStat>> | null = null;

export async function loadAllRatingStats(force = false): Promise<Map<string, RatingStat>> {
    if (cache && !force) return cache;
    if (inflight && !force) return inflight;
    inflight = (async () => {
        const { data } = await supabase.from('ratings').select('recipe_id, stars');
        const acc = new Map<string, { sum: number; count: number }>();
        (data || []).forEach((r: any) => {
            const id = String(r.recipe_id);
            const e = acc.get(id) || { sum: 0, count: 0 };
            e.sum += Number(r.stars) || 0;
            e.count += 1;
            acc.set(id, e);
        });
        const out = new Map<string, RatingStat>();
        acc.forEach((v, k) => out.set(k, { avg: v.count ? v.sum / v.count : 0, count: v.count }));
        cache = out;
        inflight = null;
        return out;
    })();
    return inflight;
}

export function getCachedStat(recipeId: string): RatingStat | null {
    return cache?.get(String(recipeId)) || null;
}

// Note personnelle de l'utilisateur connecté (0 si non noté / non connecté).
export async function fetchMyRating(recipeId: string): Promise<number> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 0;
    const { data } = await supabase
        .from('ratings').select('stars')
        .eq('user_id', session.user.id).eq('recipe_id', recipeId).maybeSingle();
    return data?.stars ?? 0;
}

// Enregistre / retire la note (connectés uniquement). Renvoie false si non connecté.
export async function submitRating(recipeId: string, stars: number): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    if (stars === 0) {
        await supabase.from('ratings').delete()
            .eq('user_id', session.user.id).eq('recipe_id', recipeId);
    } else {
        await supabase.from('ratings').upsert({
            user_id: session.user.id, recipe_id: recipeId, stars,
            updated_at: new Date().toISOString(),
        });
    }
    cache = null; // invalide le cache → prochaine lecture rafraîchie
    return true;
}

// Hook : Map des stats (chargée une fois, rafraîchie sur l'évènement `recipeRated`).
export function useRatingStats(): Map<string, RatingStat> | null {
    const [stats, setStats] = useState<Map<string, RatingStat> | null>(cache);
    useEffect(() => {
        let alive = true;
        loadAllRatingStats().then(m => { if (alive) setStats(new Map(m)); });
        const onRated = () => loadAllRatingStats(true).then(m => { if (alive) setStats(new Map(m)); });
        window.addEventListener('recipeRated', onRated);
        return () => { alive = false; window.removeEventListener('recipeRated', onRated); };
    }, []);
    return stats;
}
