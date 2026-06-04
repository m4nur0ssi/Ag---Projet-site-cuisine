'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/mobile/components/Header/Header';
import RecipeGrid from '@/mobile/components/RecipeGrid/RecipeGrid';
import styles from './category.module.css';

interface CategoryClientProps {
    id: string;
    category: { name: string; icon: string };
    recipes: any[];
    categories: any;
}

export default function CategoryClient({ id, category, recipes }: CategoryClientProps) {
    return (
        <div className={styles.page}>
            <div className={styles.stickyHeaderMenu}>
                <Header 
                    title={category.name.toUpperCase()} 
                    showBack={true} 
                />
            </div>

            <main className={styles.main}>
                <div className={styles.categoryInfo}>
                    <span className={styles.count}>{recipes.length} RECETTE{recipes.length > 1 ? 'S' : ''} DISPONIBLE{recipes.length > 1 ? 'S' : ''}</span>
                </div>
                
                <RecipeGrid recipes={recipes} />

                {recipes.length === 0 && (
                    <div className={styles.empty}>
                        <p>Aucune recette trouvée dans cette catégorie 🥣</p>
                    </div>
                )}
            </main>
        </div>
    );
}
