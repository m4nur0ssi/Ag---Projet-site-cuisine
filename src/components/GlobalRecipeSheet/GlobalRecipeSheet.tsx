'use client';
import { useEffect, useState } from 'react';
import RecipeSheet from '@/components/RecipeSheet/RecipeSheet';

/**
 * Hôte global de la recette flottante (RecipeSheet).
 * Écoute l'event `openRecipeFromPlanner` → ouvre la fiche en flottant,
 * partout dans l'app (recherche, planificateur, etc.). Pas de navigation
 * vers /recipe/:id (qui afficherait la barre catégorie/pays).
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
