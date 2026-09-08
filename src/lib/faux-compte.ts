/**
 * Un compte de FAÇADE, pour essayer l'application en local.
 * ========================================================
 *
 * Le planificateur, les favoris et la liste de courses sont réservés aux
 * membres connectés — et la connexion passe par Google, dont le retour est
 * cloué au domaine de production. Depuis un téléphone branché sur le serveur de
 * développement (http://192.168.x.x:3008), on ne peut donc PAS se connecter :
 * l'écran demande un compte, et le retour de Google n'arrive jamais.
 *
 * Ce module fait croire à l'application qu'une session existe. Il ne crée aucun
 * compte et ne touche pas à Supabase : les écritures vers la base échouent
 * silencieusement, et le planificateur garde tout dans le téléphone.
 *
 * DEUX VERROUS pour qu'il ne parte jamais en production :
 *   • il ne s'active que si `NEXT_PUBLIC_FAUX_COMPTE=1` — variable qui vit dans
 *     `.env.local`, un fichier jamais versionné ni déployé ;
 *   • et jamais quand la construction est celle de production.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const fauxCompteActif =
    process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_FAUX_COMPTE === '1';

const UTILISATEUR = {
    id: '00000000-0000-4000-8000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'local@essai.test',
    created_at: new Date(0).toISOString(),
    app_metadata: { provider: 'local' },
    user_metadata: { full_name: 'Essai local', avatar_url: '' },
};

const SESSION = {
    access_token: 'faux-jeton-local',
    refresh_token: 'faux-jeton-local',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: UTILISATEUR,
};

/** Habille le client Supabase d'une session de façade (développement seul). */
export function poserFauxCompte(client: SupabaseClient) {
    if (!fauxCompteActif) return client;

    const auth = client.auth as unknown as Record<string, unknown>;
    auth.getSession = async () => ({ data: { session: SESSION }, error: null });
    auth.getUser = async () => ({ data: { user: UTILISATEUR }, error: null });
    auth.onAuthStateChange = (rappel: (evenement: string, session: unknown) => void) => {
        // Les écrans attendent d'être prévenus : on répond tout de suite.
        setTimeout(() => rappel('SIGNED_IN', SESSION), 0);
        return { data: { subscription: { id: 'faux', callback: rappel, unsubscribe() {} } } };
    };
    if (typeof console !== 'undefined') {
        console.info('[local] Compte de façade actif — aucune donnée ne part vers Supabase.');
    }
    return client;
}
