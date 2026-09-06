'use client';

/**
 * Les gestes du menu d'appui long.
 * ================================
 *
 * Ils vivaient dans l'accueil TV, où le menu était né. Mais le même menu doit
 * s'ouvrir partout où l'on croise une recette — les favoris, une grille de
 * catégorie, demain une autre liste. Deux copies auraient fini par diverger :
 * on aurait ajouté « Ajouter au planificateur » d'un côté et pas de l'autre,
 * exactement ce qui vient d'arriver aux favoris.
 */

import { Recipe } from '@/mobile/types';
import { decodeHtml } from '@/mobile/lib/utils';
import { supabase } from '@/mobile/lib/supabase';
import { ecrireStock } from '@/lib/stockage';

/** Nom d'une catégorie pour UNE recette (« Rafraîchissement · 5 min »). */
export const CATEGORY_LABEL: Record<string, string> = {
    aperitifs: 'Apéritif',
    entrees: 'Entrée',
    plats: 'Plat',
    accompagnements: 'Accompagnement',
    desserts: 'Dessert',
    patisserie: 'Pâtisserie',
    restaurant: 'Comme au resto',
    vegetarien: 'Végétarien',
    glaces: 'Glace',
    boissons: 'Boisson',
    sauces: 'Sauce',
    rafraichissements: 'Rafraîchissement',
};

/**
 * Nom d'une catégorie prise comme COLLECTION — au pluriel.
 *
 * `CATEGORY_LABEL` nomme UNE recette ; une affiche de partage nomme les
 * vingt-cinq.
 */
export const COLLECTION_LABEL: Record<string, string> = {
    aperitifs: 'Apéritifs', entrees: 'Entrées', plats: 'Plats',
    accompagnements: 'Accompagnements', desserts: 'Desserts', patisserie: 'Pâtisseries',
    restaurant: 'Comme au resto', vegetarien: 'Végétarien', glaces: 'Glaces',
    boissons: 'Boissons', sauces: 'Sauces', rafraichissements: 'Rafraîchissements',
};

export const titreDe = (r: Recipe) => decodeHtml(r.title || '');
export const catLabel = (r: Recipe) => CATEGORY_LABEL[(r.category || '').toLowerCase()] || 'Recette';

/** Une collection nommée : le contexte d'où l'on partage. */
export type Coll = { label: string; tag: string; count: number; photos?: string[] };

/**
 * Trois photos de la collection pour les cartes du fond de l'affiche de
 * partage. Trois et pas deux : la carte de devant peut être l'une d'elles, et
 * le dédoublonnage en aval mangerait sinon une carte du fond.
 */
export const photosDe = (list: Recipe[], sauf?: string): string[] =>
    list.filter((r) => r.image && r.image !== sauf).slice(0, 3).map((r) => r.image as string);

/** Liste locale « à faire plus tard ». */
export const LATER_KEY = 'tv-later-v1';

export const readIds = (key: string): string[] => {
    try { return JSON.parse(localStorage.getItem(key) || '[]').map(String); } catch { return []; }
};

export function toggleLater(id: string): boolean {
    const list = readIds(LATER_KEY);
    const has = list.includes(id);
    ecrireStock(LATER_KEY, JSON.stringify(has ? list.filter((x) => x !== id) : [id, ...list]));
    window.dispatchEvent(new Event('tv-later-change'));
    return !has;
}

/**
 * Bascule le favori — même chemin que FavoriteButton : cache local + table
 * Supabase, pour que la recette apparaisse dans l'onglet Favoris. Déconnecté :
 * ouvre le panneau de connexion.
 */
export async function toggleFavorite(id: string): Promise<'added' | 'removed' | 'auth'> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.dispatchEvent(new CustomEvent('magic-toast-notify', { detail: 'Connecte-toi pour enregistrer tes favoris ❤️' }));
        window.dispatchEvent(new Event('magic-open-auth'));
        return 'auth';
    }
    const favs = readIds('favorites');
    const has = favs.includes(id);
    ecrireStock('favorites', JSON.stringify(has ? favs.filter((f) => f !== id) : [...favs, id]));
    if (has) await supabase.from('favorites').delete().eq('user_id', session.user.id).eq('recipe_id', id);
    else await supabase.from('favorites').upsert({ user_id: session.user.id, recipe_id: id });
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('magic-favorite-change'));
    return has ? 'removed' : 'added';
}
