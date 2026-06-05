'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header/Header';
import BottomNav from '@/components/BottomNav/BottomNav';
import MagicFilterBar from '@/components/MagicFilterBar/MagicFilterBar';
import RecipeCard from '@/components/RecipeCard/RecipeCardV2';
import { mockRecipes } from '@/data/mockData';
import { rankByIngredients } from '@/lib/search-rank';
import styles from './search.module.css';

export default function SearchPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    // Mode multi-ingrédient (≥ 2 mots) : recettes classées par nb d'ingrédients trouvés.
    const ranked = useMemo(() => rankByIngredients(mockRecipes, searchQuery), [searchQuery]);

    // Repli : recherche texte classique (titre / description / tags).
    const filteredRecipes = useMemo(() => {
        if (!searchQuery.trim() || ranked) return [];

        const query = searchQuery.toLowerCase().trim();
        return mockRecipes.filter(recipe =>
            recipe.title.toLowerCase().includes(query) ||
            recipe.description.toLowerCase().includes(query) ||
            recipe.tags?.some((tag: string) => tag.toLowerCase().includes(query))
        );
    }, [searchQuery, ranked]);

    const hasResults = ranked ? ranked.length > 0 : filteredRecipes.length > 0;

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
                        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.7 }}>
                            Astuce : tape plusieurs ingrédients (ex. « oeuf farine chocolat ») pour voir les recettes qui collent le mieux.
                        </p>
                    </div>
                ) : hasResults && ranked ? (
                    <div className={styles.grid}>
                        {ranked.map(({ recipe, matched, total }) => (
                            <div key={recipe.id} className={styles.rankWrapper}>
                                <span
                                    className={`${styles.matchBadge} ${matched === total ? styles.matchFull : ''}`}
                                    title={`${matched} ingrédient(s) sur ${total} trouvés`}
                                >
                                    {matched}/{total}
                                </span>
                                <RecipeCard recipe={recipe} />
                            </div>
                        ))}
                    </div>
                ) : hasResults ? (
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
