'use client';
// Notes recettes (étoiles /5) — version mobile (client Supabase mobile).
// Moyenne PUBLIQUE (lecture ouverte), vote réservé aux connectés.
import { useEffect, useState } from 'react';
import { supabase } from '@/mobile/lib/supabase';

export interface RatingStat {
    avg: number;
    count: number;
    /** Date (ms) de la note la plus récente — sert au tri « Notées récemment ». */
    last?: number;
}

let cache: Map<string, RatingStat> | null = null;
let inflight: Promise<Map<string, RatingStat>> | null = null;

export async function loadAllRatingStats(force = false): Promise<Map<string, RatingStat>> {
    if (cache && !force) return cache;
    if (inflight && !force) return inflight;
    inflight = (async () => {
        /*
         * La date de la note sert à trier le Top par « Notées récemment ». Si
         * la colonne venait à manquer, la requête échouerait en entier et le
         * Top se viderait : on redemande alors sans elle — le tri par date se
         * rabat sur l'ordre des notes, le reste ne bouge pas.
         */
        let { data, error } = await supabase.from('ratings').select('recipe_id, stars, updated_at');
        if (error) ({ data } = await supabase.from('ratings').select('recipe_id, stars'));
        const acc = new Map<string, { sum: number; count: number; last: number }>();
        (data || []).forEach((r: any) => {
            const id = String(r.recipe_id);
            const e = acc.get(id) || { sum: 0, count: 0, last: 0 };
            e.sum += Number(r.stars) || 0;
            e.count += 1;
            const quand = r.updated_at ? Date.parse(r.updated_at) : 0;
            if (quand > e.last) e.last = quand;
            acc.set(id, e);
        });
        const out = new Map<string, RatingStat>();
        acc.forEach((v, k) => out.set(k, { avg: v.count ? v.sum / v.count : 0, count: v.count, last: v.last || undefined }));
        cache = out;
        inflight = null;
        return out;
    })();
    return inflight;
}

export function getCachedStat(recipeId: string): RatingStat | null {
    return cache?.get(String(recipeId)) || null;
}

export async function fetchMyRating(recipeId: string): Promise<number> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 0;
    const { data } = await supabase
        .from('ratings').select('stars')
        .eq('user_id', session.user.id).eq('recipe_id', recipeId).maybeSingle();
    return data?.stars ?? 0;
}

/**
 * Enregistre / retire la note. Renvoie ce qui s'est passé, et surtout ce qui
 * n'a PAS marché : l'ancienne version renvoyait `true` sans jamais lire la
 * réponse de Supabase, si bien qu'une note refusée par la base repartait à
 * l'écran comme si elle était enregistrée — et disparaissait au rechargement.
 */
export async function submitRating(recipeId: string, stars: number): Promise<{ ok: boolean; raison?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, raison: 'Connectez-vous pour noter.' };
    const { error } = stars === 0
        ? await supabase.from('ratings').delete()
            .eq('user_id', session.user.id).eq('recipe_id', recipeId)
        : await supabase.from('ratings').upsert({
            user_id: session.user.id, recipe_id: recipeId, stars,
            updated_at: new Date().toISOString(),
        });
    if (error) {
        console.error('[note] enregistrement refusé', error);
        return { ok: false, raison: "La note n'a pas pu être enregistrée." };
    }
    cache = null;
    return { ok: true };
}

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
