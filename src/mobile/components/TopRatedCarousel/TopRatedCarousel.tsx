'use client';
import { useMemo } from 'react';
import { Recipe } from '@/mobile/types';
import RecipeCardiOS26 from '@/mobile/components/RecipeCard/RecipeCardiOS26';
import { useRatingStats } from '@/mobile/lib/ratings';
import styles from './TopRatedCarousel.module.css';

interface TopRatedCarouselProps {
    recipes: Recipe[];
    limit?: number;
}

/**
 * Carrousel « Top ⭐ » — les recettes les mieux notées (moyenne des notes des membres),
 * toutes catégories confondues. Masqué tant qu'aucune recette n'a d'avis.
 */
export default function TopRatedCarousel({ recipes, limit = 10 }: TopRatedCarouselProps) {
    const stats = useRatingStats();

    const top = useMemo(() => {
        if (!stats) return [];
        return recipes
            .map(r => ({ r, s: stats.get(String(r.id)) }))
            .filter(x => x.s && x.s.count > 0)
            .sort((a, b) => (b.s!.avg - a.s!.avg) || (b.s!.count - a.s!.count))
            .slice(0, limit)
            .map(x => x.r);
    }, [recipes, stats, limit]);

    if (top.length === 0) return null;

    return (
        <section className={styles.section}>
            <div className={styles.header}>
                <h2 className={styles.title}><span className={styles.star}>⭐</span> Top des recettes</h2>
            </div>
            <div className={styles.rail}>
                {top.map((recipe, i) => (
                    <div key={recipe.id} className={styles.item}>
                        <RecipeCardiOS26 recipe={recipe} size="small" rank={i + 1} />
                    </div>
                ))}
            </div>
        </section>
    );
}
