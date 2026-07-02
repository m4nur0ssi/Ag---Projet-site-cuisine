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
 * Carrousel « Top noté » — recettes les mieux notées (moyenne des membres),
 * toutes catégories confondues. Carte-titre en tête (comme Nouveautés/Entrées…).
 * Masqué tant qu'aucune recette n'a d'avis.
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
                        <span className={styles.titleText}>TOP<br />NOTÉ</span>
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
