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
 * Carrousel « Top noté » — les mieux notées, toutes catégories confondues.
 * Carte-titre en tête (même logique que Nouveautés/Entrées…). Masqué sans avis.
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
            <div className={styles.rail}>
                <div className={styles.titleItem}>
                    <div className={styles.titleCard}>
                        <span className={styles.titleStar}>⭐</span>
                        <span className={styles.titleText}>TOP NOTÉ</span>
                    </div>
                </div>
                {top.map((recipe, i) => (
                    <div key={recipe.id} className={styles.item}>
                        <RecipeCardiOS26 recipe={recipe} size="small" rank={i + 1} />
                    </div>
                ))}
            </div>
        </section>
    );
}
