'use client';
import RecipeDetails from '@/mobile/components/RecipeDetails/RecipeDetails';
import { Recipe } from '@/mobile/types';

interface RecipeClientProps {
    recipe: Recipe;
    prevId?: string | null;
    nextId?: string | null;
}

export default function RecipeClient({ recipe, prevId, nextId }: RecipeClientProps) {
    return <RecipeDetails recipe={recipe} prevId={prevId} nextId={nextId} />;
}
