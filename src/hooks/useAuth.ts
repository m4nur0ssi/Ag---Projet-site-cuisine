'use client';
import { useEffect, useState } from 'react';
import { supabase, SupabaseUser } from '@/lib/supabase';
import { pullFavorites } from '@/lib/favorites';

export function useAuth() {
    const [user, setUser] = useState<SupabaseUser>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // onAuthStateChange est la source de vérité — fire immédiatement avec session courante
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
            // Au login / 1re session : hydrate le cache favoris depuis Supabase (suit le compte).
            if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
                pullFavorites().catch(() => {});
            }
        });

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
            options: { redirectTo: window.location.origin },
        });

    const signInWithApple = () =>
        supabase.auth.signInWithOAuth({
            provider: 'apple',
            options: { redirectTo: window.location.origin },
        });

    const signOut = async () => {
        localStorage.removeItem('meal-planner-week');
        await supabase.auth.signOut();
        window.location.reload();
    };

    return { user, loading, signInWithGoogle, signInWithApple, signOut };
}
