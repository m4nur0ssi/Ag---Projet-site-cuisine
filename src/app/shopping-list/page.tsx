'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header/Header';
import styles from './shopping-list.module.css';

interface ListData {
    [key: string]: {
        title: string;
        ingredients: { name: string; checked: boolean }[];
    }
}

export default function ShoppingListPage() {
    const [shoppingList, setShoppingList] = useState<ListData>({});

    useEffect(() => {
        const data = JSON.parse(window.localStorage.getItem('magic-shopping-list') || '{}');
        setShoppingList(data);
    }, []);

    const saveAndSync = (newData: ListData) => {
        window.localStorage.setItem('magic-shopping-list', JSON.stringify(newData));
        setShoppingList(newData);
        window.dispatchEvent(new Event('shoppingListUpdated'));
    };

    const clearList = () => {
        if (confirm('Voulez-vous vider toute la liste de courses ?')) {
            window.localStorage.removeItem('magic-shopping-list');
            setShoppingList({});
            window.dispatchEvent(new Event('shoppingListUpdated'));
        }
    };

    const removeRecipe = (id: string) => {
        const newData = { ...shoppingList };
        delete newData[id];
        saveAndSync(newData);
    };

    const toggleCheck = (recipeId: string, ingIdx: number) => {
        const newData = { ...shoppingList };
        const recipe = newData[recipeId];
        if (recipe && recipe.ingredients[ingIdx]) {
            let ing = recipe.ingredients[ingIdx];
            
            // Conversion à la volée si format legacy
            if (typeof ing === 'string') {
                recipe.ingredients[ingIdx] = { name: ing, checked: true };
            } else {
                ing.checked = !ing.checked;
            }
            
            saveAndSync(newData);
        }
    };

    const recipesCount = Object.keys(shoppingList).length;

    return (
        <div className={styles.page}>
            <Header title="Ma Liste" showBack={true} hideShoppingList={true} />

            <main className={styles.main}>
                <div className={styles.headerRow}>
                    <p className={styles.count}>{recipesCount} recette{recipesCount > 1 ? 's' : ''} dans la liste</p>
                    {recipesCount > 0 && (
                        <button onClick={clearList} className={styles.clearBtn}>Tout effacer</button>
                    )}
                </div>

                {recipesCount === 0 ? (
                    <div className={styles.empty}>
                        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🛒</span>
                        <p>Votre liste de courses est vide.</p>
                        <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '10px' }}>
                            Ajoutez des ingrédients depuis une fiche recette en cliquant sur le bouton 📋.
                        </p>
                    </div>
                ) : (
                    <div className={styles.list}>
                        {Object.entries(shoppingList).map(([id, data]) => (
                            <div key={id} className={styles.recipeGroup}>
                                <div className={styles.recipeHeader}>
                                    <h3 className={styles.recipeTitle}>{data.title}</h3>
                                    <button onClick={() => removeRecipe(id)} className={styles.removeBtn} title="Retirer la recette">✕</button>
                                </div>
                                <div className={styles.ingredients}>
                                    {data.ingredients.map((ing, idx) => {
                                        // Support legacy string format
                                        const isObject = typeof ing === 'object' && ing !== null;
                                        const name = isObject ? ing.name : (ing as string);
                                        const checked = isObject ? ing.checked : false;

                                        return (
                                            <div 
                                                key={idx} 
                                                className={`${styles.ingItem} ${checked ? styles.checked : ''}`}
                                                onClick={() => toggleCheck(id, idx)}
                                            >
                                                <input 
                                                    type="checkbox" 
                                                    className={styles.checkbox} 
                                                    checked={checked}
                                                    readOnly
                                                />
                                                <label className={styles.label}>{name.replace('- ', '')}</label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
