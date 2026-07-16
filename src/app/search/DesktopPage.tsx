'use client';

import { useState, useMemo, useEffect } from 'react';
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

    // Pré-remplissage depuis l'URL (?q=…) — ex: lien "recette" depuis Pasta Lya.
    useEffect(() => {
        const q = new URLSearchParams(window.location.search).get('q');
        if (q) setSearchQuery(q);
    }, []);

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

    // #7 — résultats stricts (tous les ingrédients) vs suggestions (il manque 1).
    const fullResults = useMemo(() => (ranked || []).filter(r => r.matched === r.total), [ranked]);
    const partialResults = useMemo(() => (ranked || []).filter(r => r.matched < r.total), [ranked]);
    // Suggestions affichées seulement s'il y a peu de résultats stricts.
    const showSuggestions = partialResults.length > 0 && fullResults.length < 6;

    const hasResults = ranked ? ranked.length > 0 : filteredRecipes.length > 0;

    const renderRanked = ({ recipe, matched, total, matchedTokens, missingTokens }: NonNullable<typeof ranked>[number]) => (
        <div key={recipe.id} className={styles.rankWrapper}>
            <span
                className={`${styles.matchBadge} ${matched === total ? styles.matchFull : ''}`}
                title={`${matched} ingrédient(s) sur ${total} trouvés`}
            >
                {matched}/{total}
            </span>
            <RecipeCard recipe={recipe} />
            {missingTokens.length > 0 && (
                <div className={styles.matchDetail}>
                    <span className={styles.matchOk}>✓ {matchedTokens.join(', ')}</span>
                    <span className={styles.matchMissing}>Manque : {missingTokens.join(', ')}</span>
                </div>
            )}
        </div>
    );

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
                ) : ranked ? (
                    <>
                        {fullResults.length > 0 ? (
                            <div className={styles.grid}>
                                {fullResults.map(renderRanked)}
                            </div>
                        ) : (
                            <div className={styles.empty}>
                                <p>Aucune recette avec <strong>tous</strong> ces ingrédients.</p>
                                {partialResults.length > 0 && (
                                    <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.7 }}>
                                        Voici des recettes auxquelles il manque 1 ingrédient :
                                    </p>
                                )}
                            </div>
                        )}
                        {showSuggestions && (
                            <>
                                <div className={styles.suggestDivider}>
                                    Suggestions — il manque 1 ingrédient
                                </div>
                                <div className={styles.grid}>
                                    {partialResults.map(renderRanked)}
                                </div>
                            </>
                        )}
                    </>
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
