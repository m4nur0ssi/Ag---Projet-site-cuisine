'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/mobile/components/Header/Header';
import MagicFilterBar from '@/mobile/components/MagicFilterBar/MagicFilterBar';
import RecipeCard from '@/mobile/components/RecipeCard/RecipeCardiOS26';
import BottomNav from '@/mobile/components/BottomNav/BottomNav';
import { mockRecipes } from '@/mobile/data/mockData';
import { Recipe } from '@/mobile/types';
import { pullFavorites } from '@/mobile/lib/favorites';
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
        // Au montage : tire la vérité depuis Supabase (suit le compte), puis rend.
        const init = async () => { await pullFavorites(); renderFromCache(); };

        init();
        window.addEventListener('storage', renderFromCache);
        window.addEventListener('magic-favorite-change', renderFromCache);
        return () => {
            window.removeEventListener('storage', renderFromCache);
            window.removeEventListener('magic-favorite-change', renderFromCache);
        };
    }, []);

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
