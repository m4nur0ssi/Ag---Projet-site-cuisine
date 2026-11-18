import { mockRecipes } from '@/data/mockData';
import { NOMS_CATEGORIES } from './categories-noms';

/*
 * Pages « catégorie » indexables : /recettes/<slug>.
 *
 * Le slug est la catégorie telle qu'elle est déjà stockée (minuscules, sans
 * accents) : rien à renommer côté données. Les noms affichés reprennent ceux de
 * l'accueil (`COLLECTION_LABEL`). Les restaurants ne sont pas des recettes et
 * n'ont donc pas de page.
 */

export { NOMS_CATEGORIES } from './categories-noms';

const EXCLUES = new Set(['restaurant', '']);

/** Recettes de la catégorie, avec une photo, dans l'ordre du catalogue. */
export const recettesDe = (slug: string) =>
    mockRecipes.filter((r) => (r.category || '').toLowerCase() === slug && r.image);

/** Catégories qui ont au moins une recette avec photo. */
export const categoriesIndexables = (): { slug: string; nom: string; nombre: number }[] => {
    const comptes = new Map<string, number>();
    for (const r of mockRecipes) {
        const c = (r.category || '').toLowerCase();
        if (EXCLUES.has(c) || !r.image) continue;
        comptes.set(c, (comptes.get(c) || 0) + 1);
    }
    return [...comptes.entries()]
        .filter(([slug]) => NOMS_CATEGORIES[slug])
        .map(([slug, nombre]) => ({ slug, nom: NOMS_CATEGORIES[slug], nombre }))
        .sort((a, b) => b.nombre - a.nombre);
};

export const nomCategorie = (slug: string): string | undefined => NOMS_CATEGORIES[slug];
