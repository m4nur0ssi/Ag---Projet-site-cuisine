'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/mobile/components/Header/Header';
import MagicFilterBar from '@/mobile/components/MagicFilterBar/MagicFilterBar';
import RecipeCard from '@/mobile/components/RecipeCard/RecipeCardiOS26';
import BottomNav from '@/mobile/components/BottomNav/BottomNav';
import { mockRecipes } from '@/mobile/data/mockData';
import { Recipe } from '@/mobile/types';
import { pullFavorites, pruneOrphanFavorites } from '@/mobile/lib/favorites';
import { precacheFavorites } from '@/lib/pwa';
import styles from './favorites.module.css';

export default function FavoritesPage() {
    const router = useRouter();
    const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Rendu depuis le cache local (rapide, et pour les events)
        const renderFromCache = () => {
            const storedIds = JSON.parse(localStorage.getItem('favorites') || '[]');
            setFavoriteRecipes(mockRecipes.filter(r => storedIds.includes(r.id)));
            setLoading(false);
        };
        // Au montage : tire la vérité depuis Supabase (suit le compte), purge les
        // favoris orphelins (recettes disparues) pour que le badge colle aux fiches, puis rend.
        const init = async () => {
            await pullFavorites();
            const ids = JSON.parse(localStorage.getItem('favorites') || '[]');
            const resolved = mockRecipes.filter(r => ids.includes(r.id)).map(r => r.id);
            await pruneOrphanFavorites(resolved);
            renderFromCache();
        };

        init();
        window.addEventListener('storage', renderFromCache);
        window.addEventListener('magic-favorite-change', renderFromCache);
        return () => {
            window.removeEventListener('storage', renderFromCache);
            window.removeEventListener('magic-favorite-change', renderFromCache);
        };
    }, []);

    // Offline : précache pages + images des favoris.
    useEffect(() => {
        if (favoriteRecipes.length) precacheFavorites(favoriteRecipes);
    }, [favoriteRecipes]);

    return (
        <div className={styles.page}>
            <div className={styles.stickyHeaderMenu}>
                <Header title="Mes favoris" showBack={false} />
                <MagicFilterBar 
                    activeTags={[]} 
                    showBack={true}
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
                ) : favoriteRecipes.length > 0 ? (
                    <div className={styles.grid}>
                        {favoriteRecipes.map((recipe: Recipe) => (
                            <RecipeCard
                                key={recipe.id}
                                recipe={recipe}
                                size="small"
                                isGrid={true}
                                isFavoritesPage={true}
                            />
                        ))}
                    </div>
                ) : (
                    <div className={styles.empty}>
                        <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1.5rem' }}>❤️</span>
                        <h2>Votre liste est vide</h2>
                        <p>Parcourez les recettes et cliquez sur le cœur pour les enregistrer ici.</p>
                    </div>
                )}
            </main>
            
            <BottomNav />
        </div>
    );
}
