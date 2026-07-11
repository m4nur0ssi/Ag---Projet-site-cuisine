'use client';
import { useEffect } from 'react';
import { mockRecipes } from '@/data/mockData';

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
        const recipe = mockRecipes.find(r => String(r.id) === String(id));
        if (!recipe) return;
        // Laisse la home (et le splash) se monter, puis ouvre la fiche flottante.
        const t = setTimeout(() => {
            window.dispatchEvent(new CustomEvent('openRecipeFromPlanner', { detail: recipe }));
            // Nettoie l'URL → un refresh ou un partage de la home ne rouvre pas la fiche.
            try {
                const u = new URL(window.location.href);
                u.searchParams.delete('fiche');
                window.history.replaceState({}, '', u.pathname + u.search + u.hash);
            } catch { /* */ }
        }, 550);
        return () => clearTimeout(t);
    }, []);
    return null;
}
