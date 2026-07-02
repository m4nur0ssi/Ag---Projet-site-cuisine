'use client';
import { useMemo } from 'react';
import RecipeCardiOS26 from '@/components/RecipeCard/RecipeCardiOS26';
import { useRatingStats } from '@/lib/ratings';
import styles from './TopRatedCarousel.module.css';

interface TopRatedCarouselProps {
    recipes: any[];
    limit?: number;
}

/**
 * Carrousel « Top des recettes » — les mieux notées (moyenne des membres),
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
            <h2 className={styles.title}>Top des recettes</h2>
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
