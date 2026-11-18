import { MetadataRoute } from 'next';
import { mockRecipes } from '@/data/mockData';
import { categoriesIndexables } from '@/lib/categories-seo';

const BASE = 'https://www.lesrecettesmagiques.fr';

// /search ne figure plus ici ; /category/… redirige en 301 vers /recettes/…. /recipe/… reste : la page garde ses balises et
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

    const categoryPages: MetadataRoute.Sitemap = categoriesIndexables().map((c) => ({
        url: `${BASE}/recettes/${c.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.9,
    }));

    return [...staticPages, ...categoryPages, ...recipePages];
}
