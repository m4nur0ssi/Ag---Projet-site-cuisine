import { MetadataRoute } from 'next';
import { mockRecipes } from '@/data/mockData';

const BASE = 'https://lesrecettesmagiques.fr';

// /search et /category/… ne sont plus que des redirections vers l'accueil :
// ils ne figurent plus ici. /recipe/… reste : la page garde ses balises et
// son JSON-LD, puis ouvre la fiche actuelle.

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    const staticPages: MetadataRoute.Sitemap = [
        { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
        // Pages légales : peu consultées mais Google aime les trouver déclarées.
        { url: `${BASE}/mentions-legales`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
        { url: `${BASE}/confidentialite`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
        { url: `${BASE}/cgu`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
        { url: `${BASE}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    ];

    const recipePages: MetadataRoute.Sitemap = mockRecipes.map((r) => ({
        url: `${BASE}/recipe/${r.id}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.8,
    }));

    return [...staticPages, ...recipePages];
}
