'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header/Header';
import BottomNav from '@/components/BottomNav/BottomNav';
import MagicFilterBar from '@/components/MagicFilterBar/MagicFilterBar';
import RecipeCardiOS26 from '@/components/RecipeCard/RecipeCardiOS26';
import { mockRecipes } from '@/data/mockData';
import { rankByIngredients } from '@/lib/search-rank';
import styles from './search.module.css';

export default function SearchPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    // Mode « italien » (lien depuis Pasta Lya) : on ne montre QUE les recettes
    // taguées Italie / Dolce Vita — jamais de chorizo espagnol sur une épicerie
    // italienne.
    const [italienOnly, setItalienOnly] = useState(false);

    // Pré-remplissage depuis l'URL (?q=… , &italien=1) — ex: lien "recette" depuis Pasta Lya.
    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        const q = sp.get('q');
        if (q) setSearchQuery(q);
        if (sp.get('italien') === '1') setItalienOnly(true);
    }, []);

    // Pool de départ : tout, ou seulement Italie / Dolce Vita (« dolce vita » = tag Italie).
    const basePool = useMemo(
        () => italienOnly
            ? mockRecipes.filter(r => r.tags?.some((t: string) => /italie|dolce/i.test(t)))
            : mockRecipes,
        [italienOnly]
    );

    // Mode multi-ingrédient (≥ 2 mots) : recettes classées par nb d'ingrédients trouvés.
    const ranked = useMemo(() => rankByIngredients(basePool, searchQuery), [basePool, searchQuery]);

    // Repli : recherche texte classique (titre / description / tags).
    const filteredRecipes = useMemo(() => {
        if (!searchQuery.trim() || ranked) return [];

        const query = searchQuery.toLowerCase().trim();
        return basePool.filter(recipe =>
            recipe.title.toLowerCase().includes(query) ||
            recipe.description.toLowerCase().includes(query) ||
            recipe.tags?.some((tag: string) => tag.toLowerCase().includes(query))
        );
    }, [searchQuery, ranked, basePool]);

    // #7 — résultats stricts (tous les ingrédients) vs suggestions (il manque 1).
    const fullResults = useMemo(() => (ranked || []).filter(r => r.matched === r.total), [ranked]);
    const partialResults = useMemo(() => (ranked || []).filter(r => r.matched < r.total), [ranked]);
    // Suggestions affichées seulement s'il y a peu de résultats stricts.
    const showSuggestions = partialResults.length > 0 && fullResults.length < 6;

    const hasResults = ranked ? ranked.length > 0 : filteredRecipes.length > 0;

    // Résultats classés par pertinence, mais affichés en cartes propres (comme la grille d'accueil).
    const renderRanked = ({ recipe }: NonNullable<typeof ranked>[number]) => (
        <RecipeCardiOS26 key={recipe.id} recipe={recipe} isGrid inCardTitle />
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
                            <RecipeCardiOS26 key={recipe.id} recipe={recipe} isGrid inCardTitle />
                        ))}
                    </div>
                ) : italienOnly ? (
                    // Mode italien : jamais de page vide — on montre toute la
                    // collection Italie / Dolce Vita.
                    <>
                        <div className={styles.suggestDivider}>🇮🇹 Nos recettes italiennes</div>
                        <div className={styles.grid}>
                            {basePool.map(recipe => (
                                <RecipeCardiOS26 key={recipe.id} recipe={recipe} isGrid inCardTitle />
                            ))}
                        </div>
                    </>
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
