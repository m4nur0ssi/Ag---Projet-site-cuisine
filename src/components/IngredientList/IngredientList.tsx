'use client';

import { useState, useMemo } from 'react';
import { Ingredient } from '@/types';
import styles from './IngredientList.module.css';


interface IngredientListProps {
    recipeTitle: string;
    recipeUrl: string;
    ingredients: Ingredient[];
}

export default function IngredientList({ recipeTitle, recipeUrl, ingredients }: IngredientListProps) {
    const [checkedItems, setCheckedItems] = useState<boolean[]>(
        new Array(ingredients.length).fill(false)
    );

    const toggleIngredient = (index: number) => {
        const newChecked = [...checkedItems];
        newChecked[index] = !newChecked[index];
        setCheckedItems(newChecked);
    };

    const selectAll = () => setCheckedItems(new Array(ingredients.length).fill(true));
    const selectNone = () => setCheckedItems(new Array(ingredients.length).fill(false));

    // Calculer les ingrédients sélectionnés
    const selectedIngredients = useMemo(() => {
        const selected = ingredients.filter((_, index) => checkedItems[index]);
        // Si aucun n'est coché, on considère "Tout" pour le bouton Bring par défaut
        return selected.length > 0 ? selected : ingredients;
    }, [ingredients, checkedItems]);

    const isAllSelected = selectedIngredients.length === ingredients.length;
    const hasSelection = checkedItems.some(item => item);

    return (
        <div className={styles.sectionContainer}>
            <div className={styles.controls}>
                <div className={styles.checkButtons}>
                    <button onClick={selectAll} className={styles.textBtn}>Tout cocher</button>
                    <button onClick={selectNone} className={styles.textBtn}>Tout décocher</button>
                </div>


            </div>

            <div className={styles.list}>
                {ingredients.map((ingredient, index) => (
                    <label key={index} className={`${styles.ingredient} ${checkedItems[index] ? styles.checked : ''}`}>
                        <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={checkedItems[index]}
                            onChange={() => toggleIngredient(index)}
                        />
                        <span className={styles.ingredientText}>
                            {ingredient.quantity && <strong>{ingredient.quantity}</strong>} {ingredient.name}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    );
}
