'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const RecipeSheet = dynamic(() => import('@/mobile/components/RecipeSheet/RecipeSheet'), { ssr: false });

/**
 * Hôte global de la recette flottante (RecipeSheet) — version mobile.
 * Écoute l'event `openRecipeFromPlanner` → ouvre la fiche en flottant PAR-DESSUS
 * l'écran courant (planificateur, liste de courses…), sans navigation ni fermeture
 * du planificateur. À la fermeture, on retombe exactement là où on était.
 */
export default function GlobalRecipeSheet() {
    const [recipe, setRecipe] = useState<any>(null);

    useEffect(() => {
        const open = (e: any) => { if (e.detail) setRecipe(e.detail); };
        window.addEventListener('openRecipeFromPlanner', open);
        return () => window.removeEventListener('openRecipeFromPlanner', open);
    }, []);

    if (!recipe) return null;
    return <RecipeSheet recipe={recipe} isOpen={true} onClose={() => setRecipe(null)} />;
}
