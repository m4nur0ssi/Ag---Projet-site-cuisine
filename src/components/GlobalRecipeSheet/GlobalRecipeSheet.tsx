'use client';
import { useEffect, useState } from 'react';
import RecipeSheet from '@/components/RecipeSheet/RecipeSheet';
import { mockRecipes } from '@/mobile/data/mockData';
import { FERMER_FICHE } from '@/lib/ficheEvents';

/**
 * Hôte global de la recette flottante (RecipeSheet).
 * Écoute l'event `openRecipeFromPlanner` → ouvre la fiche en flottant,
 * partout dans l'app (recherche, planificateur, etc.). Pas de navigation
 * vers /recipe/:id (qui afficherait la barre catégorie/pays).
 */
export default function GlobalRecipeSheet() {
    const [recipe, setRecipe] = useState<any>(null);

    useEffect(() => {
        const open = (e: any) => {
            const d = e.detail;
            if (!d) return;
            const full = mockRecipes.find((r: any) => String(r.id) === String(d.id));
            const base = full ? { ...d, ...full } : d;
            setRecipe({ category: 'plats', steps: [], ingredients: [], tags: [], ...base });
        };
        /* Fermeture demandée par un écran qui prend la main : « Ouvrir le
           planificateur » depuis le volet de planification, par exemple. La
           fiche flotte au-dessus de tout et suivrait sinon. */
        const close = () => setRecipe(null);
        window.addEventListener('openRecipeFromPlanner', open);
        window.addEventListener(FERMER_FICHE, close);
        // Signale qu'un hôte écoute : un lien entrant (`/?fiche=…`) attend ce
        // drapeau avant d'émettre. Sur mobile cet hôte arrive en import
        // dynamique, souvent APRÈS le lien — l'event partait dans le vide.
        (window as unknown as { __recipeSheetReady?: boolean }).__recipeSheetReady = true;
        return () => {
            window.removeEventListener('openRecipeFromPlanner', open);
            window.removeEventListener(FERMER_FICHE, close);
            (window as unknown as { __recipeSheetReady?: boolean }).__recipeSheetReady = false;
        };
    }, []);

    if (!recipe) return null;
    return <RecipeSheet recipe={recipe} isOpen={true} onClose={() => setRecipe(null)} />;
}
