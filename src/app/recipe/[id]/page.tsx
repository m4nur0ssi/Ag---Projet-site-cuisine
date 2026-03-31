import { notFound } from 'next/navigation';
import { mockRecipes } from '@/data/mockData';
import RecipeClient from './RecipeClient';
import { getIngredientVisual } from '@/lib/ingredient-utils';

export default async function RecipePage({ params }: { params: { id: string } }) {
    const recipeIndex = mockRecipes.findIndex(r => r.id === params.id);
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

    return <RecipeClient recipe={enrichedRecipe} prevId={prevId} nextId={nextId} />;
}

export async function generateStaticParams() {
    return mockRecipes.map((recipe) => ({
        id: recipe.id,
    }));
}
