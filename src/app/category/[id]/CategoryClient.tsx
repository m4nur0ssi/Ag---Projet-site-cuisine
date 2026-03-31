'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header/Header';
import RecipeCard from '@/components/RecipeCard/RecipeCardV2';
import MagicFilterBar from '@/components/MagicFilterBar/MagicFilterBar';
import SplitTitle from '@/components/SplitTitle/SplitTitle';
import styles from './category.module.css';

interface CategoryClientProps {
    id: string;
    category: { name: string; icon: string };
    recipes: any[];
    categories: any;
}

export default function CategoryClient({ id, category, recipes, categories }: CategoryClientProps) {
    const router = useRouter();

    return (
        <div className={styles.page}>
            <div className={styles.stickyHeaderMenu}>
                <Header showBack={true} />
                <MagicFilterBar 
                    activeTags={[id]} 
                    showBack={false}
                    isHome={true} 
                    onSelect={(tag) => {
                        const mainCategories = ['aperitifs', 'entrees', 'plats', 'desserts', 'patisserie', 'restaurant', 'vegetarien'];
                        if (tag === '') {
                            router.push('/');
                        } else if (mainCategories.includes(tag.toLowerCase())) {
                            router.push(`/category/${tag.toLowerCase()}`);
                        } else {
                            // Filtres spécifiques (pays, tendances) -> Retour Home filtré
                            router.push(`/?tag=${tag}`);
                        }
                    }}
                />
            </div>

            <div className={styles.header}>
                <h1 className={styles.title}>
                    <SplitTitle text={`Recettes\u00A0: ${category.name}\u00A0`} large={true} noAnimation={true} />
                </h1>
                <span className={styles.count}>{recipes.length} recette{recipes.length > 1 ? 's' : ''}</span>
            </div>
            <main className={styles.main}>
                <div className={styles.grid}>
                    {recipes.map((recipe) => (
                        <RecipeCard key={recipe.id} recipe={recipe} />
                    ))}
                </div>

                {recipes.length === 0 && (
                    <div className={styles.empty}>
                        <p>Aucune recette trouvée dans cette catégorie.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
