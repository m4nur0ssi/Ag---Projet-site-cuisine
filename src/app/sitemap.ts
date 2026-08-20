import { MetadataRoute } from 'next';
import { mockRecipes } from '@/data/mockData';

const BASE = 'https://lesrecettesmagiques.fr';

// Mêmes clés que src/app/category/[id]/page.tsx
const CATEGORY_SLUGS = [
    'aperitifs', 'entrees', 'plats', 'vegetarien', 'desserts', 'patisserie',
    'restaurant', 'voila-lete', 'cest-lhiver', 'glaces', 'rafraichissements',
    'noel', 'paques', 'simplissime',
];

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    const staticPages: MetadataRoute.Sitemap = [
        { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
        { url: `${BASE}/search`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
        // Pages légales : peu consultées mais Google aime les trouver déclarées.
        { url: `${BASE}/mentions-legales`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
        { url: `${BASE}/confidentialite`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
        { url: `${BASE}/cgu`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
        { url: `${BASE}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    ];

    const categoryPages: MetadataRoute.Sitemap = CATEGORY_SLUGS.map((slug) => ({
        url: `${BASE}/category/${slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
    }));

    const recipePages: MetadataRoute.Sitemap = mockRecipes.map((r) => ({
        url: `${BASE}/recipe/${r.id}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.8,
    }));

    return [...staticPages, ...categoryPages, ...recipePages];
}
