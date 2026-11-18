'use client';
import { useEffect } from 'react';

/**
 * Ouvre la fiche par-dessus la page `/recipe/<id>`, sans rediriger.
 *
 * Le contenu est déjà dans le HTML (rendu serveur, pour Google). Pour une
 * personne qui arrive sur cette adresse, on ouvre la même fiche flottante que
 * dans l'application, via l'événement `openRecipeFromPlanner` que monte
 * `GlobalRecipeSheet`. L'URL ne change pas : elle reste `/recipe/<id>`.
 */
export default function FicheOuverte({ id }: { id: string }) {
    useEffect(() => {
        let annule = false;
        let minuteur: ReturnType<typeof setInterval> | null = null;
        import('@/data/mockData').then(({ mockRecipes }) => {
            if (annule) return;
            const recipe = mockRecipes.find((r) => String(r.id) === String(id));
            if (!recipe) return;
            let tries = 0;
            minuteur = setInterval(() => {
                const pret = (window as unknown as { __recipeSheetReady?: boolean }).__recipeSheetReady;
                if (pret || ++tries > 100) {
                    if (minuteur) clearInterval(minuteur);
                    window.dispatchEvent(new CustomEvent('openRecipeFromPlanner', { detail: recipe }));
                }
            }, 100);
        });
        return () => {
            annule = true;
            if (minuteur) clearInterval(minuteur);
        };
    }, [id]);
    return null;
}
