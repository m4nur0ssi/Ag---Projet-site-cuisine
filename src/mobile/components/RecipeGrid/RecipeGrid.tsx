'use client';
import { Recipe } from '@/mobile/types';
import RecipeCardiOS26 from '@/mobile/components/RecipeCard/RecipeCardiOS26';
import styles from './RecipeGrid.module.css';
import { motion } from 'framer-motion';

interface RecipeGridProps {
    recipes: Recipe[];
    onRecipeClick?: (recipe: Recipe) => void;
}

export default function RecipeGrid({ recipes, onRecipeClick }: RecipeGridProps) {
    return (
        <div className={styles.gridContainer}>
            {recipes.map((recipe, index) => (
                <motion.div 
                    key={recipe.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                    <RecipeCardiOS26 
                        recipe={recipe} 
                        isGrid={true} 
                        customOnClick={onRecipeClick ? () => onRecipeClick(recipe) : undefined}
                        allRecipes={recipes}
                        recipeIndex={index}
                    />
                </motion.div>
            ))}
        </div>
    );
}
