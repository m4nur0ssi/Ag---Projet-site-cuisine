'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header/Header';
import MagicFilterBar from '@/components/MagicFilterBar/MagicFilterBar';
import RecipeGrid from '@/components/RecipeGrid/RecipeGrid';
import BottomNav from '@/components/BottomNav/BottomNav';
import { mockRecipes } from '@/data/mockData';
import { Recipe } from '@/types';
import { supabase } from '@/lib/supabase';
import { pullFavorites, pruneOrphanFavorites } from '@/lib/favorites';
import { precacheFavorites } from '@/lib/pwa';
import styles from './favorites.module.css';

export default function FavoritesPage() {
    const router = useRouter();
    const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [authed, setAuthed] = useState<boolean | null>(null);

    useEffect(() => {
        // Rendu depuis le cache local (rapide, et pour les events) — sans requête réseau.
        const renderFromCache = () => {
            let ids: string[] = [];
            try { ids = JSON.parse(localStorage.getItem('favorites') || '[]'); } catch {}
            setFavoriteRecipes(mockRecipes.filter(r => ids.includes(r.id)));
        };

        // Au montage / login : on tire la vérité depuis Supabase (favoris suivent le compte),
        // puis on rend depuis le cache hydraté.
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setAuthed(!!session);
            if (!session) { setFavoriteRecipes([]); setLoading(false); return; }
            await pullFavorites();      // hydrate localStorage depuis le cloud
            // Purge les favoris orphelins (recettes disparues) → badge == fiches affichées.
            const ids = JSON.parse(localStorage.getItem('favorites') || '[]');
            const resolved = mockRecipes.filter(r => ids.includes(r.id)).map(r => r.id);
            await pruneOrphanFavorites(resolved);
            renderFromCache();
            setLoading(false);
        };

        init();

        // Les events ne font QUE re-render depuis le cache (pas de pull → pas de boucle).
        window.addEventListener('storage', renderFromCache);
        window.addEventListener('magic-favorite-change', renderFromCache);
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => init());
        return () => {
            window.removeEventListener('storage', renderFromCache);
            window.removeEventListener('magic-favorite-change', renderFromCache);
            subscription.unsubscribe();
        };
    }, []);

    // Offline : précache les pages + images des favoris dès qu'ils changent.
    useEffect(() => {
        if (favoriteRecipes.length) precacheFavorites(favoriteRecipes);
    }, [favoriteRecipes]);

    return (
        <div className={styles.page}>
            <div className={styles.stickyHeaderMenu}>
                <Header title="Mes Favoris" showBack={false} />
                <MagicFilterBar 
                    activeTags={[]} 
                    showBack={false}
                    isHome={true}
                    onSelect={(tag) => {
                        if (tag === '') router.push('/');
                        else router.push(`/?tag=${tag}`);
                    }} 
                />
            </div>

            <main className={styles.main}>
                <h1 className={styles.title}>Mes Recettes Favorites</h1>

                {loading ? (
                    <div className={styles.empty}>
                        <p>Chargement...</p>
                    </div>
                ) : !authed ? (
                    <div className={styles.empty}>
                        <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1.5rem' }}>🔒</span>
                        <h2>Connecte-toi pour voir tes favoris</h2>
                        <p>Tes recettes favorites sont liées à ton compte.</p>
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('magic-open-auth'))}
                            style={{ marginTop: 18, padding: '10px 22px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}
                        >Se connecter</button>
                    </div>
                ) : favoriteRecipes.length > 0 ? (
                    <RecipeGrid recipes={favoriteRecipes} />
                ) : (
                    <div className={styles.empty}>
                        <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1.5rem' }}>❤️</span>
                        <h2>Votre liste est vide</h2>
                        <p>Parcourez les recettes et cliquez sur le cœur pour les enregistrer ici.</p>
                    </div>
                )}
            </main>
            
        </div>
    );
}
