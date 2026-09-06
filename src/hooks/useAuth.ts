'use client';
import { useEffect, useState } from 'react';
import { supabase, SupabaseUser } from '@/lib/supabase';
import { pullFavorites } from '@/lib/favorites';
import { tirerDejaCuisine } from '@/lib/dejaCuisine';
import { pullShoppingState, startShoppingSync, startShoppingRealtime } from '@/lib/shoppingSync';
import { pullCave, startCaveSync } from '@/mobile/lib/caveSync';

/**
 * Où l'OAuth doit revenir. En PROD on force le domaine canonique
 * lesrecettesmagiques.fr : sinon, parti depuis une adresse *.vercel.app (ou si
 * Supabase retombe sur son Site URL), la session se pose sur le mauvais domaine
 * et l'app paraît déconnectée sur .fr. En local on garde l'origine (localhost).
 * NB : lesrecettesmagiques.fr DOIT figurer dans les « Redirect URLs » Supabase.
 */
function authRedirect(): string {
    if (typeof window === 'undefined') return 'https://lesrecettesmagiques.fr';
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return window.location.origin;
    return 'https://lesrecettesmagiques.fr';
}

export function useAuth() {
    const [user, setUser] = useState<SupabaseUser>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // onAuthStateChange est la source de vérité — fire immédiatement avec session courante
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
            // Au login / 1re session : hydrate favoris + état courses depuis Supabase (suit le compte).
            if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
                pullFavorites().catch(() => {});
                // Les recettes déjà cuisinées : la marque sur les vignettes.
                tirerDejaCuisine().catch(() => {});
                pullShoppingState().catch(() => {});
                pullCave().catch(() => {});
                // Sync temps réel descendante (courses + planning) entre appareils.
                startShoppingRealtime(session.user.id);
            }
        });

        // Sync montante de l'état courses (débouncée). Idempotent.
        startShoppingSync();
        startCaveSync();

        // Fallback: lit aussi la session directement
        supabase.auth.getSession().then(({ data, error }) => {
            console.log('[useAuth] getSession:', data.session?.user?.email, error?.message);
            if (data.session?.user) {
                setUser(data.session.user);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signInWithGoogle = () =>
        supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: authRedirect(),
                // Force Google à afficher le sélecteur de compte à chaque fois.
                // Sinon, après un signOut (qui n'efface QUE la session Supabase, pas le
                // cookie SSO Google), Google ré-authentifie silencieusement le compte actif.
                queryParams: { prompt: 'select_account' },
            },
        });

    const signInWithApple = () =>
        supabase.auth.signInWithOAuth({
            provider: 'apple',
            options: { redirectTo: authRedirect() },
        });

    const signOut = async () => {
        localStorage.removeItem('meal-planner-week');
        await supabase.auth.signOut();
        window.location.reload();
    };

    return { user, loading, signInWithGoogle, signInWithApple, signOut };
}
