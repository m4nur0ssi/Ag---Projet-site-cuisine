'use client';
import { useMemo } from 'react';
import RecipeCarousel from '@/components/RecipeCarousel/RecipeCarousel';
import { useRatingStats } from '@/lib/ratings';

interface TopRatedCarouselProps {
    recipes: any[];
    limit?: number;
    /** Clic sur la carte-titre : reçoit le titre et le classement calculé. */
    onTitleClick?: (title: string, recipes: any[]) => void;
}

/**
 * Carrousel « Les Mieux Notées » — les mieux notées, toutes catégories confondues.
 * Réutilise RecipeCarousel : carte-titre et cartes identiques aux autres sections,
 * avec la pastille de rang (#1, #2…) en plus. Masqué sans avis.
 */
export default function TopRatedCarousel({ recipes, limit = 10, onTitleClick }: TopRatedCarouselProps) {
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
        <RecipeCarousel
            recipes={top}
            title="Les Mieux Notées"
            size="small"
            ranked
            onTitleClick={onTitleClick ? (title) => onTitleClick(title, top) : undefined}
        />
    );
}
