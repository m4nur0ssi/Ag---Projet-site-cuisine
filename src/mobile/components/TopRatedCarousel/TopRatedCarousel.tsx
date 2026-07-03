'use client';
import { useMemo } from 'react';
import { Recipe } from '@/mobile/types';
import RecipeCarousel from '@/mobile/components/RecipeCarousel/RecipeCarousel';
import { useRatingStats } from '@/mobile/lib/ratings';

interface TopRatedCarouselProps {
    recipes: Recipe[];
    limit?: number;
}

/**
 * Carrousel « Les Mieux Notées » — recettes les mieux notées (moyenne des membres),
 * toutes catégories confondues. Réutilise RecipeCarousel : carte-titre et cartes
 * identiques aux autres sections, avec la pastille de rang (#1, #2…) en plus.
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
        <RecipeCarousel
            recipes={top}
            title="Les Mieux Notées"
            size="small"
            ranked
        />
    );
}
