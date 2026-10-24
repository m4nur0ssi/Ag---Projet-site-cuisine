'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Recipe } from '@/mobile/types';
import { FERMER_FICHE } from '@/lib/ficheEvents';

// La fiche et le catalogue complet (2 Mo) n'arrivent qu'à la première ouverture :
// l'accueil n'a pas à les payer au démarrage.
const RecipeSheet = dynamic(() => import('@/components/RecipeSheet/RecipeSheet'), { ssr: false });
let catalogue: Recipe[] | null = null;
const chargerCatalogue = () => import('@/mobile/data/mockData').then((m) => { catalogue = m.mockRecipes; });

/**
 * Hôte global de la recette flottante (RecipeSheet).
 * Écoute l'event `openRecipeFromPlanner` → ouvre la fiche en flottant,
 * partout dans l'app (recherche, planificateur, etc.). Pas de navigation
 * vers /recipe/:id (qui afficherait la barre catégorie/pays).
 */
export default function GlobalRecipeSheet() {
    const [recipe, setRecipe] = useState<any>(null);
    /** Sélection de la recherche : la fiche la parcourt avec ‹ › et le clavier. */
    const [liste, setListe] = useState<{ recettes: any[]; index: number } | null>(null);
    const completer = (d: any) => {
        const full = catalogue?.find((r: any) => String(r.id) === String(d.id));
        const base = full ? { ...d, ...full } : d;
        return { category: 'plats', steps: [], ingredients: [], tags: [], ...base };
    };

    useEffect(() => {
        const open = (e: any) => {
            const brut = e.detail;
            if (!brut) return;
            const { __liste, __index, ...d } = brut;
            if (Array.isArray(__liste) && __liste.length > 1 && typeof __index === 'number') {
                setListe({ recettes: __liste, index: __index });
            } else setListe(null);
            if (catalogue) setRecipe(completer(d));
            else void chargerCatalogue().then(() => setRecipe(completer(d)), () => setRecipe(completer(d)));
        };
        /* Fermeture demandée par un écran qui prend la main : « Ouvrir le
           planificateur » depuis le volet de planification, par exemple. La
           fiche flotte au-dessus de tout et suivrait sinon. */
        const close = () => { setRecipe(null); setListe(null); };
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
    const aller = (i: number) => {
        if (!liste || i < 0 || i >= liste.recettes.length) return;
        setListe({ ...liste, index: i });
        setRecipe(completer(liste.recettes[i]));
    };
    return (
        <RecipeSheet
            recipe={recipe}
            isOpen={true}
            onClose={() => { setRecipe(null); setListe(null); }}
            navigation={liste ? {
                position: liste.index + 1,
                total: liste.recettes.length,
                precedent: liste.index > 0 ? () => aller(liste.index - 1) : undefined,
                suivant: liste.index < liste.recettes.length - 1 ? () => aller(liste.index + 1) : undefined,
            } : undefined}
        />
    );
}
