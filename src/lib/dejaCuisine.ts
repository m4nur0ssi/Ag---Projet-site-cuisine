'use client';

/**
 * « Je l'ai déjà faite. »
 * ======================
 *
 * Le carnet de cuisine (table `cooking_log`) sait depuis toujours combien de
 * fois on a cuisiné une recette — mais seulement une fois la fiche ouverte. En
 * parcourant l'accueil ou ses favoris, rien ne distinguait un plat qu'on a déjà
 * réussi d'un plat qu'on n'a jamais tenté.
 *
 * On garde donc, à côté du carnet, la simple LISTE des recettes déjà
 * cuisinées : de quoi poser une marque sur une vignette sans interroger le
 * réseau pour chacune des cinq cents cartes d'une page.
 *
 * Le cache local répond tout de suite, le compte fait foi ensuite.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { ecrireStock } from '@/lib/stockage';

export const CUISINE_KEY = 'deja-cuisine-v1';

/** Émis quand la liste change : les vignettes affichées se remettent à jour. */
export const CUISINE_EVENT = 'magic-deja-cuisine';

/** Les recettes déjà cuisinées, telles que l'appareil les connaît. */
export function lireDejaCuisine(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const brut = JSON.parse(localStorage.getItem(CUISINE_KEY) || '[]');
        return Array.isArray(brut) ? brut.map(String) : [];
    } catch { return []; }
}

function ecrire(ids: string[]) {
    ecrireStock(CUISINE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event(CUISINE_EVENT));
}

/*
 * L'événement ci-dessus ne suffit pas à lui seul : il prévient les abonnés,
 * mais c'est `relire()` — défini plus bas — qui rafraîchit l'instantané qu'ils
 * lisent. Les deux sont branchés dès le premier abonnement.
 */

/**
 * Va chercher la liste sur le compte. Déconnecté, la marque n'a pas lieu
 * d'être : le carnet appartient à un compte, pas à un appareil.
 */
export async function tirerDejaCuisine(): Promise<string[]> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { ecrire([]); return []; }
        const { data, error } = await supabase
            .from('cooking_log')
            .select('recipe_id')
            .eq('user_id', session.user.id);
        if (error) return lireDejaCuisine();
        const ids = [...new Set((data || []).map((l: { recipe_id: string }) => String(l.recipe_id)))];
        ecrire(ids);
        return ids;
    } catch { return lireDejaCuisine(); }
}

/**
 * Note une recette comme cuisinée sans attendre le réseau : le carnet vient
 * d'enregistrer l'entrée, la marque doit apparaître dans la seconde.
 */
export function marquerCuisinee(recipeId: string): void {
    const ids = lireDejaCuisine();
    if (ids.includes(String(recipeId))) return;
    ecrire([String(recipeId), ...ids]);
}

/** Retire la marque quand la dernière entrée du carnet disparaît. */
export function oublierCuisinee(recipeId: string): void {
    const ids = lireDejaCuisine();
    const restant = ids.filter((id) => id !== String(recipeId));
    if (restant.length !== ids.length) ecrire(restant);
}

/**
 * Les recettes déjà cuisinées, tenues à jour.
 *
 * Un écran affiche parfois plusieurs centaines de vignettes. Un abonnement par
 * carte, c'est autant d'écouteurs sur la fenêtre : on n'en tient donc qu'UN,
 * ici, et toutes les cartes lisent le même instantané.
 */
let cache: string[] | null = null;
const abonnes = new Set<() => void>();
let branche = false;

function relire() {
    const avant = cache;
    cache = lireDejaCuisine();
    // Même contenu = même référence : sans quoi chaque événement `storage`
    // ferait re-rendre toutes les cartes de la page pour rien.
    if (avant && avant.length === cache.length && avant.every((v, i) => v === cache![i])) {
        cache = avant;
        return;
    }
    abonnes.forEach((f) => f());
}

function abonner(f: () => void): () => void {
    abonnes.add(f);
    if (!branche) {
        branche = true;
        window.addEventListener(CUISINE_EVENT, relire);
        window.addEventListener('storage', relire);
    }
    return () => { abonnes.delete(f); };
}

const VIDE: string[] = [];

/** Un test « cette recette, je l'ai déjà faite ? », partagé par tout l'écran. */
export function useDejaCuisine(): (id: string | number) => boolean {
    const ids = useSyncExternalStore(
        abonner,
        () => (cache ??= lireDejaCuisine()),
        () => VIDE,
    );

    // La liste du compte fait foi : on la redemande une fois par écran monté.
    useEffect(() => { void tirerDejaCuisine(); }, []);

    return useCallback((id: string | number) => ids.includes(String(id)), [ids]);
}
