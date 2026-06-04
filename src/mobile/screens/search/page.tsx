'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/mobile/components/Header/Header';
import BottomNav from '@/mobile/components/BottomNav/BottomNav';
import RecipeCardiOS26 from '@/mobile/components/RecipeCard/RecipeCardiOS26';
import { mockRecipes } from '@/mobile/data/mockData';
import styles from './search.module.css';

export default function SearchPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredRecipes = useMemo(() => {
        if (!searchQuery.trim()) return [];

        const normalizeText = (text: string) => 
            text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        const query = normalizeText(searchQuery.trim());
        return mockRecipes.filter(recipe =>
            normalizeText(recipe.title).includes(query) ||
            normalizeText(recipe.description).includes(query) ||
            recipe.tags?.some((tag: string) => normalizeText(tag).includes(query))
        );
    }, [searchQuery]);

    return (
        <div className={styles.page}>
            <Header title="Ma recherche" showBack={true} backUrl="/" />

            <main className={styles.main}>
                <motion.div 
                    className={styles.searchBar}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                >
                    <input
                        type="text"
                        placeholder="Cherche une recette"
                        className={styles.input}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </motion.div>

                <AnimatePresence mode="wait">
                    {searchQuery.trim() === '' ? (
                        <motion.div 
                            key="empty"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={styles.empty}
                        >
                            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔍</span>
                            <p>Commencez à taper pour chercher une recette magique !</p>
                        </motion.div>
                    ) : filteredRecipes.length > 0 ? (
                        <motion.div 
                            key="grid"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={styles.grid}
                        >
                            <div className={styles.gridInner}>
                                {filteredRecipes.map(recipe => (
                                    <div key={recipe.id} className={styles.cardWrapper}>
                                        <RecipeCardiOS26 recipe={recipe} />
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="no-result"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={styles.empty}
                        >
                            <p>Aucune recette trouvée pour &quot;{searchQuery}&quot;.</p>
                            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Essayez un autre ingrédient ou plat !</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <BottomNav />
        </div>
    );
}
