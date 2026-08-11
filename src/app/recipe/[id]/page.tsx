import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { mockRecipes } from '@/data/mockData';
import type { Recipe } from '@/types';
import RecipeClient from './RecipeRouter';
import { getIngredientVisual } from '@/lib/ingredient-utils';

const BASE = 'https://lesrecettesmagiques.fr';

// Transforme une image (souvent /api/image-proxy?...) en URL absolue crawlable.
function absoluteImage(src?: string): string | undefined {
    if (!src) return undefined;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    return `${BASE}${src.startsWith('/') ? '' : '/'}${src}`;
}

// Nettoie un libellé d'ingrédient (emoji + retours ligne + espaces multiples).
function cleanText(s: string): string {
    return (s || '').replace(/\s+/g, ' ').trim();
}

// minutes -> durée ISO 8601 (PT#M), attendue par le schéma Recipe.
function isoDuration(min?: number): string | undefined {
    if (!min || min <= 0) return undefined;
    return `PT${min}M`;
}

// Construit le JSON-LD Recipe. Renvoie null pour un restaurant ou une fiche vide.
function buildRecipeJsonLd(recipe: Recipe) {
    if (recipe.category === 'restaurant' || recipe.address) return null;
    if (!recipe.ingredients?.length || !recipe.steps?.length) return null;

    const jsonLd: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: recipe.title,
        description: recipe.description,
        recipeCategory: recipe.category,
        url: `${BASE}/recipe/${recipe.id}`,
        recipeIngredient: recipe.ingredients.map(i => cleanText(i.name)).filter(Boolean),
        recipeInstructions: recipe.steps.map((step, idx) => ({
            '@type': 'HowToStep',
            position: idx + 1,
            text: cleanText(step),
        })),
    };

    const image = absoluteImage(recipe.image);
    if (image) jsonLd.image = [image];
    if (recipe.servings) jsonLd.recipeYield = `${recipe.servings} portions`;

    const prep = isoDuration(recipe.prepTime);
    const cook = isoDuration(recipe.cookTime);
    if (prep) jsonLd.prepTime = prep;
    if (cook) jsonLd.cookTime = cook;
    const total = (recipe.prepTime || 0) + (recipe.cookTime || 0);
    if (total > 0) jsonLd.totalTime = `PT${total}M`;

    return jsonLd;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
    const recipe = mockRecipes.find(r => String(r.id) === String(params.id));
    if (!recipe) return { title: 'Recette introuvable' };

    const image = absoluteImage(recipe.image);
    const description = (recipe.description || '').slice(0, 160);

    return {
        title: recipe.title,
        description,
        keywords: [recipe.title, 'recette', recipe.category, ...(recipe.tags || [])],
        alternates: { canonical: `/recipe/${recipe.id}` },
        openGraph: {
            type: 'article',
            url: `${BASE}/recipe/${recipe.id}`,
            title: recipe.title,
            description,
            images: image ? [image] : undefined,
        },
    };
}

export default async function RecipePage({ params }: { params: { id: string } }) {
    const recipeIndex = mockRecipes.findIndex(r => String(r.id) === String(params.id));
    const recipe = mockRecipes[recipeIndex];

    if (!recipe) {
        notFound();
    }

    const prevId = recipeIndex > 0 ? mockRecipes[recipeIndex - 1].id : null;
    const nextId = recipeIndex < mockRecipes.length - 1 ? mockRecipes[recipeIndex + 1].id : null;

    // Enrichir les ingrédients avec les visuels (Dépôt LOCAL public/ingredients/)
    // On ignore TOUTE image externe capricieuse.
    const enrichedRecipe = {
        ...recipe,
        ingredients: recipe.ingredients.map(ing => {
            const visual = getIngredientVisual(ing.name);
            return {
                ...ing,
                image: visual || undefined // undefined forcera l'usage de l'émoji d'origine (fallback stable)
            };
        })
    };

    const jsonLd = buildRecipeJsonLd(recipe);

    return (
        <>
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}
            <RecipeClient recipe={enrichedRecipe} prevId={prevId} nextId={nextId} />
        </>
    );
}

export async function generateStaticParams() {
    return mockRecipes.map((recipe) => ({
        id: recipe.id,
    }));
}
