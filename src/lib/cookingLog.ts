'use client';
// #11 — Carnet de cuisine perso : "j'ai cuisiné" + note + photo, par recette.
// Stocké dans Supabase (table cooking_log + bucket cooking-photos), synchro multi-appareils.
import { supabase } from './supabase';

export interface CookEntry {
    id: string;
    recipe_id: string;
    cooked_at: string;
    note: string | null;
    photo_url: string | null;
}

export async function getCookEntries(recipeId: string): Promise<CookEntry[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const { data, error } = await supabase
        .from('cooking_log')
        .select('id,recipe_id,cooked_at,note,photo_url')
        .eq('user_id', session.user.id)
        .eq('recipe_id', String(recipeId))
        .order('cooked_at', { ascending: false });
    if (error) return [];
    return (data || []) as CookEntry[];
}

// Résultat d'ajout : on remonte l'erreur (au lieu d'avaler) pour donner un feedback.
// error === 'auth' → pas de session valide (token expiré) → proposer la reconnexion.
export interface AddCookResult { entry: CookEntry | null; error: string | null }

export async function addCookEntry(recipeId: string, note?: string, file?: File | null): Promise<AddCookResult> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { entry: null, error: 'auth' };
    let photo_url: string | null = null;
    if (file) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${session.user.id}/${recipeId}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('cooking-photos').upload(path, file, { upsert: true, contentType: file.type });
        if (!upErr) {
            photo_url = supabase.storage.from('cooking-photos').getPublicUrl(path).data.publicUrl;
        }
    }
    const { data, error } = await supabase
        .from('cooking_log')
        .insert({ user_id: session.user.id, recipe_id: String(recipeId), note: note?.trim() || null, photo_url })
        .select('id,recipe_id,cooked_at,note,photo_url')
        .single();
    // 401 / token invalide → PostgREST renvoie un code auth → on demande la reconnexion.
    if (error) {
        const isAuth = (error as any)?.code === 'PGRST301' || (error as any)?.code === '401' || /jwt|token|expired/i.test(error.message || '');
        return { entry: null, error: isAuth ? 'auth' : (error.message || 'Erreur') };
    }
    return { entry: data as CookEntry, error: null };
}

export async function deleteCookEntry(id: string): Promise<void> {
    await supabase.from('cooking_log').delete().eq('id', id);
}
