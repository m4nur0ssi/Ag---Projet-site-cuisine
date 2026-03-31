'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header/Header';
import BottomNav from '@/components/BottomNav/BottomNav';
import MagicFilterBar from '@/components/MagicFilterBar/MagicFilterBar';
import RecipeCard from '@/components/RecipeCard/RecipeCardV2';
import { mockRecipes } from '@/data/mockData';
import styles from './search.module.css';

export default function SearchPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredRecipes = useMemo(() => {
        if (!searchQuery.trim()) return [];

        const query = searchQuery.toLowerCase().trim();
        return mockRecipes.filter(recipe =>
            recipe.title.toLowerCase().includes(query) ||
            recipe.description.toLowerCase().includes(query) ||
            recipe.tags?.some((tag: string) => tag.toLowerCase().includes(query))
        );
    }, [searchQuery]);

    return (
        <div className={styles.page}>
            <div className={styles.stickyHeaderMenu}>
                <Header title="Recherche" showBack={false} />
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
                <div className={styles.searchBar}>
                    <input
                        type="text"
                        placeholder="Rechercher une recette ou un ingrédient..."
                        className={styles.input}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </div>

                {searchQuery.trim() === '' ? (
                    <div className={styles.empty}>
                        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔍</span>
                        <p>Commencez à taper pour chercher une recette magique !</p>
                    </div>
                ) : filteredRecipes.length > 0 ? (
                    <div className={styles.grid}>
                        {filteredRecipes.map(recipe => (
                            <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                    </div>
                ) : (
                    <div className={styles.empty}>
                        <p>Aucune recette trouvée pour &quot;{searchQuery}&quot;.</p>
                        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Essayez un autre ingrédient ou plat !</p>
                    </div>
                )}
            </main>

        </div>
    );
}
