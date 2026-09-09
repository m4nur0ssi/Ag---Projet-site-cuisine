// Fonction de sync partagée — appelle /api/sync
import { supabase } from '@/lib/supabase';

export async function triggerSync(source = 'button'): Promise<{ ok: boolean; message: string }> {
    /*
     * La route ne lance plus la chaîne pour n'importe qui : elle déclenche un
     * workflow GitHub avec le jeton du dépôt, c'est un geste d'administration.
     * On lui présente donc la session en cours.
     */
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, message: 'Connecte-toi pour lancer la synchronisation.' };

    const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ trigger_source: source })
    });
    const data = await res.json();
    if (res.ok) {
        return { ok: true, message: data.message || 'Synchronisation lancée !' };
    }
    return { ok: false, message: data.error || `Erreur ${res.status}` };
}
