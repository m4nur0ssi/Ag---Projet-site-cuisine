import { notFound } from 'next/navigation';
import { fetchRecipeById, fetchRecipes } from '@/mobile/lib/wordpress';
import RecipeClient from './RecipeClient';
import { getIngredientVisual } from '@/mobile/lib/ingredient-utils';

export default async function RecipePage({ params }: { params: { id: string } }) {
    const recipe = await fetchRecipeById(params.id);

    if (!recipe) {
        notFound();
    }

    const allRecipes = await fetchRecipes();
    const recipeIndex = allRecipes.findIndex(r => r.id === recipe.id);
    const prevId = recipeIndex > 0 ? allRecipes[recipeIndex - 1].id : null;
    const nextId = recipeIndex < allRecipes.length - 1 ? allRecipes[recipeIndex + 1].id : null;

    // Enrichir les ingrédients avec les visuels (Banque MARMITON)
    const enrichedRecipe = {
        ...recipe,
        ingredients: recipe.ingredients.map(ing => {
            const visual = ing.image || getIngredientVisual(ing.name);
            return {
                ...ing,
                image: visual || undefined // Fallback stable
            };
        })
    };

    return <RecipeClient recipe={enrichedRecipe} prevId={prevId} nextId={nextId} />;
}

export async function generateStaticParams() {
    const recipes = await fetchRecipes();
    return recipes.map((recipe) => ({
        id: recipe.id,
    }));
}
