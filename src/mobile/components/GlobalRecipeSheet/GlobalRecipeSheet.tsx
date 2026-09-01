'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { mockRecipes } from '@/mobile/data/mockData';

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
        const open = (e: any) => {
            const d = e.detail;
            if (!d) return;
            // La recette rangée dans le planificateur est parfois MINIMALE (id, titre,
            // image, ingrédients) : sans `steps`, la fiche plantait (recipe.steps.length).
            // On récupère la recette COMPLÈTE depuis le catalogue par son id, et on
            // garantit des tableaux pour steps/ingredients/tags.
            const full = mockRecipes.find((r: any) => String(r.id) === String(d.id));
            const base = full ? { ...d, ...full } : d;
            setRecipe({ category: 'plats', steps: [], ingredients: [], tags: [], ...base });
        };
        window.addEventListener('openRecipeFromPlanner', open);
        // Signale qu'un hôte écoute : un lien entrant (`/?fiche=…`) attend ce
        // drapeau avant d'émettre. Sur mobile cet hôte arrive en import
        // dynamique, souvent APRÈS le lien — l'event partait dans le vide.
        (window as unknown as { __recipeSheetReady?: boolean }).__recipeSheetReady = true;
        return () => {
            window.removeEventListener('openRecipeFromPlanner', open);
            (window as unknown as { __recipeSheetReady?: boolean }).__recipeSheetReady = false;
        };
    }, []);

    if (!recipe) return null;
    return <RecipeSheet recipe={recipe} isOpen={true} onClose={() => setRecipe(null)} />;
}
