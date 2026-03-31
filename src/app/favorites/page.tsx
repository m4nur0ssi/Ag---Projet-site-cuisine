'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header/Header';
import MagicFilterBar from '@/components/MagicFilterBar/MagicFilterBar';
import RecipeCard from '@/components/RecipeCard/RecipeCardV2';
import BottomNav from '@/components/BottomNav/BottomNav';
import { mockRecipes } from '@/data/mockData';
import { Recipe } from '@/types';
import styles from './favorites.module.css';

export default function FavoritesPage() {
    const router = useRouter();
    const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Charger les favoris au montage (client-side uniquement)
        const loadFavorites = () => {
            const storedIds = JSON.parse(localStorage.getItem('favorites') || '[]');
            const filtered = mockRecipes.filter(r => storedIds.includes(r.id));
            setFavoriteRecipes(filtered);
            setLoading(false);
        };

        loadFavorites();

        // Écouter les changements dans localStorage (au cas où)
        window.addEventListener('storage', loadFavorites);
        return () => window.removeEventListener('storage', loadFavorites);
    }, []);

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
                ) : favoriteRecipes.length > 0 ? (
                    <div className={styles.grid}>
                        {favoriteRecipes.map((recipe: Recipe) => (
                            <RecipeCard key={recipe.id} recipe={recipe} />
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
            
        </div>
    );
}
