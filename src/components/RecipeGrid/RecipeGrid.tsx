'use client';

import React from 'react';
import styles from './RecipeGrid.module.css';
import RecipeCardiOS26 from '../RecipeCard/RecipeCardiOS26';

interface RecipeGridProps {
    recipes: any[];
    onRecipeClick?: (recipe: any) => void;
}

export default function RecipeGrid({ recipes, onRecipeClick }: RecipeGridProps) {
    if (!recipes || recipes.length === 0) return null;

    return (
        <div className={styles.grid}>
            {recipes.map(recipe => (
                <div 
                    key={recipe.id} 
                    className={styles.gridItem}
                >
                    <RecipeCardiOS26 
                        recipe={recipe} 
                        isGrid={true}
                        customOnClick={onRecipeClick ? () => onRecipeClick(recipe) : undefined}
                    />
                </div>
            ))}
        </div>
    );
}
