'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header/Header';
import styles from './shopping-list.module.css';

interface ListData {
    [key: string]: {
        title: string;
        image?: string;
        ingredients: { name: string; checked: boolean }[];
    }
}

export default function ShoppingListPage() {
    const [shoppingList, setShoppingList] = useState<ListData>({});
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
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
            
            if (typeof ing === 'string') {
                recipe.ingredients[ingIdx] = { name: ing, checked: true };
            } else {
                ing.checked = !ing.checked;
            }
            
            saveAndSync(newData);
            
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(10);
            }
        }
    };

    if (!mounted) return null;

    const recipesCount = Object.keys(shoppingList).length;

    return (
        <div className={styles.page}>
            <Header title="Ma liste" showBack={true} />

            <main className={styles.main}>
                <div className={styles.headerRow}>
                    <div>
                        <h1 className={styles.mainTitle}>Courses</h1>
                        <p className={styles.count}>{recipesCount} recette{recipesCount > 1 ? 's' : ''}</p>
                    </div>
                    {recipesCount > 0 && (
                        <button onClick={clearList} className={styles.clearBtn}>
                            Tout vider
                        </button>
                    )}
                </div>

                {recipesCount === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyIcon}>🛒</div>
                        <h2 className={styles.emptyTitle}>Panier vide</h2>
                        <p className={styles.emptySubtitle}>
                            Ajoutez des ingrédients depuis une recette en cliquant sur le bouton d&apos;ajout au panier.
                        </p>
                    </div>
                ) : (
                    <div className={styles.list}>
                        {Object.entries(shoppingList).map(([id, data]) => (
                            <div key={id} className={styles.recipeGroup}>
                                {data.image && (
                                    <div className={styles.recipeImageWrapper}>
                                        <img src={data.image} alt={data.title} className={styles.recipeImage} />
                                    </div>
                                )}
                                <div className={styles.recipeHeader}>
                                    <h3 className={styles.recipeTitle}>{data.title}</h3>
                                    <button onClick={() => removeRecipe(id)} className={styles.removeBtn} title="Retirer la recette" aria-label="Retirer">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>
                                <div className={styles.ingredients}>
                                    {data.ingredients.map((ing, idx) => {
                                        const isObject = typeof ing === 'object' && ing !== null;
                                        const name = isObject ? ing.name : (ing as string);
                                        const checked = isObject ? ing.checked : false;

                                        return (
                                            <div 
                                                key={idx} 
                                                className={`${styles.ingItem} ${checked ? styles.checked : ''}`}
                                                onClick={() => toggleCheck(id, idx)}
                                            >
                                                <div className={styles.checkboxContainer}>
                                                    <svg className={styles.checkIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                </div>
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
