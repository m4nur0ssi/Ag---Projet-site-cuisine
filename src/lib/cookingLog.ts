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

/** Réduit la photo (max 1600px) et la convertit en JPEG : les photos HEIC / lourdes
 *  du téléphone passent ainsi l'upload. Retombe sur le fichier d'origine si le
 *  navigateur ne sait pas la décoder. */
async function preparerPhoto(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
    const brut = { blob: file as Blob, ext: (file.name.split('.').pop() || 'jpg').toLowerCase(), type: file.type || 'image/jpeg' };
    try {
        const url = URL.createObjectURL(file);
        const img = await new Promise<HTMLImageElement>((ok, ko) => {
            const i = new Image();
            i.onload = () => ok(i);
            i.onerror = () => ko(new Error('decode'));
            i.src = url;
        });
        URL.revokeObjectURL(url);
        const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.85));
        if (blob) return { blob, ext: 'jpg', type: 'image/jpeg' };
    } catch { /* on garde l'original */ }
    return brut;
}

/** Renvoie l'URL publique, ou le motif de l'échec (affiché à l'utilisateur). */
async function uploadPhoto(userId: string, recipeId: string, file: File): Promise<{ url: string | null; motif?: string }> {
    let blob: Blob, ext: string, type: string;
    try {
        ({ blob, ext, type } = await preparerPhoto(file));
    } catch (e) {
        return { url: null, motif: 'lecture de la photo' };
    }
    const path = `${userId}/${recipeId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('cooking-photos').upload(path, blob, { upsert: true, contentType: type });
    if (upErr) {
        const m = (upErr as any).statusCode ? `${(upErr as any).statusCode} ${upErr.message}` : upErr.message;
        console.error('[carnet] upload photo', upErr);
        return { url: null, motif: m };
    }
    return { url: supabase.storage.from('cooking-photos').getPublicUrl(path).data.publicUrl };
}

export async function addCookEntry(recipeId: string, note?: string, file?: File | null): Promise<AddCookResult> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { entry: null, error: 'auth' };
    let photo_url: string | null = null;
    if (file) {
        const r = await uploadPhoto(session.user.id, recipeId, file);
        if (!r.url) return { entry: null, error: `Photo non envoyée : ${r.motif || 'erreur inconnue'}` };
        photo_url = r.url;
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

/**
 * Édite une entrée existante (RLS : seul l'auteur y a droit). `file` ajoute ou
 * remplace la photo SUR CETTE ENTRÉE : aucune nouvelle entrée n'est créée.
 * `note` à undefined laisse le commentaire tel quel.
 */
export async function updateCookEntry(id: string, note?: string, file?: File | null, recipeId?: string): Promise<CookEntry | null> {
    const patch: { note?: string; photo_url?: string } = {};
    if (note !== undefined) patch.note = note;
    if (file) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;
        const r = await uploadPhoto(session.user.id, recipeId || 'recette', file);
        if (!r.url) throw new Error(`Photo non envoyée : ${r.motif || 'erreur inconnue'}`);
        patch.photo_url = r.url;
    }
    if (!Object.keys(patch).length) return null;
    const { data, error } = await supabase
        .from('cooking_log')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
    if (error) return null;
    return data as CookEntry;
}
