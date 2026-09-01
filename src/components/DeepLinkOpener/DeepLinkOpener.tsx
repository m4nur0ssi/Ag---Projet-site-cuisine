'use client';
import { useEffect } from 'react';

/**
 * Ouvre la fiche IDENTIQUE à l'app quand on arrive via un lien partagé
 * (`/?fiche=<id>`, ex. lien envoyé sur WhatsApp puis ouvert dans Safari).
 * La home se charge normalement, puis on ouvre le MÊME RecipeSheet flottant que
 * dans la PWA via l'event global `openRecipeFromPlanner` (écouté par
 * GlobalRecipeSheet, monté mobile ET desktop) → affichage parfaitement identique,
 * au lieu de l'ancienne route `/recipe/[id]` au rendu très différent.
 */
export default function DeepLinkOpener() {
    useEffect(() => {
        let id: string | null = null;
        try { id = new URLSearchParams(window.location.search).get('fiche'); } catch { return; }
        if (!id) return;
        let annule = false;
        let minuteur: ReturnType<typeof setInterval> | null = null;

        // On arrive par un lien recette (ex. Pasta Lya) → pas d'intro d'accueil.
        // Posé tout de suite : les splash (dont le mobile, en import dynamique)
        // montent parfois après le nettoyage de l'URL ci-dessous.
        try {
            sessionStorage.setItem('hasSeenMagicSplash-v5', 'true');
            sessionStorage.setItem('hasSeenMagicSplash-v8', 'true');
        } catch { /* */ }

        /*
         * Le catalogue n'est chargé QU'ICI, une fois qu'on sait qu'il y a un
         * lien à ouvrir.
         *
         * Ce composant est monté à chaque page, et son import en tête tirait
         * 1,5 Mo de JavaScript au démarrage — pour une fonction qui ne sert
         * qu'aux visiteurs arrivant par un lien partagé, c'est-à-dire presque
         * jamais. On paie donc le catalogue seulement quand il faut vraiment.
         */
        import('@/data/mockData').then(({ mockRecipes }) => {
            if (annule) return;
            const recipe = mockRecipes.find((r) => String(r.id) === String(id));
            if (!recipe) return;
            ouvrir(recipe);
        });

        /*
         * On attend que l'hôte de la fiche écoute VRAIMENT avant d'émettre.
         * Un délai fixe ne suffisait pas : sur mobile l'hôte arrive en import
         * dynamique, et sur un téléphone en 4G son morceau de code met souvent
         * plus d'une demi-seconde — l'event partait dans le vide et le lien
         * retombait sur l'accueil. Ici on sonde jusqu'à 10 s, puis on émet
         * quand même (sur desktop l'hôte est chargé d'emblée : premier tour).
         */
        function ouvrir(recipe: any) {
            let tries = 0;
            const fire = () => {
                window.dispatchEvent(new CustomEvent('openRecipeFromPlanner', { detail: recipe }));
                // Nettoie l'URL → un refresh ou un partage de la home ne rouvre pas la fiche.
                try {
                    const u = new URL(window.location.href);
                    u.searchParams.delete('fiche');
                    window.history.replaceState({}, '', u.pathname + u.search + u.hash);
                } catch { /* */ }
            };
            minuteur = setInterval(() => {
                const ready = (window as unknown as { __recipeSheetReady?: boolean }).__recipeSheetReady;
                if (ready || ++tries > 100) {
                    if (minuteur) clearInterval(minuteur);
                    fire();
                }
            }, 100);
        }

        return () => {
            annule = true;
            if (minuteur) clearInterval(minuteur);
        };
    }, []);
    return null;
}
