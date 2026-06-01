'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header/Header';
import { mockRecipes } from '@/data/mockData';
import { Recipe } from '@/types';
import styles from './meal-planner.module.css';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MEALS = ['midi', 'soir'] as const;
type MealSlot = typeof MEALS[number];

interface PlannerData {
    [dayIndex: number]: {
        [meal in MealSlot]?: string; // recipe id
    };
}

const STORAGE_KEY = 'meal-planner-week';

export default function MealPlannerPage() {
    const router = useRouter();
    const [planner, setPlanner] = useState<PlannerData>({});
    const [mounted, setMounted] = useState(false);
    const [picker, setPicker] = useState<{ day: number; meal: MealSlot } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setMounted(true);
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        setPlanner(saved);
    }, []);

    const save = (newPlan: PlannerData) => {
        setPlanner(newPlan);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPlan));
    };

    const setRecipe = (day: number, meal: MealSlot, recipeId: string) => {
        const newPlan = { ...planner };
        if (!newPlan[day]) newPlan[day] = {};
        newPlan[day][meal] = recipeId;
        save(newPlan);
        setPicker(null);
        setSearchQuery('');
    };

    const removeSlot = (day: number, meal: MealSlot) => {
        const newPlan = { ...planner };
        if (newPlan[day]) {
            delete newPlan[day][meal];
            if (Object.keys(newPlan[day]).length === 0) delete newPlan[day];
        }
        save(newPlan);
    };

    const clearAll = () => {
        if (confirm('Vider tout le planning ?')) {
            save({});
        }
    };

    // Générer la liste de courses depuis le planning
    const generateShoppingList = () => {
        const existing = JSON.parse(localStorage.getItem('magic-shopping-list') || '{}');
        for (const [dayStr, meals] of Object.entries(planner)) {
            for (const [, recipeId] of Object.entries(meals as Record<string, string>)) {
                if (!recipeId) continue;
                const recipe = mockRecipes.find(r => r.id === recipeId);
                if (!recipe) continue;
                existing[recipe.id] = {
                    title: recipe.title,
                    image: recipe.image,
                    ingredients: recipe.ingredients.map(ing => ({
                        name: ing.quantity ? `${ing.quantity} ${ing.name}` : ing.name,
                        checked: false,
                        selected: false,
                    })),
                };
            }
        }
        localStorage.setItem('magic-shopping-list', JSON.stringify(existing));
        window.dispatchEvent(new Event('shoppingListUpdated'));
        router.push('/shopping-list');
    };

    const recipeMap = useMemo(() => {
        const m: Record<string, Recipe> = {};
        mockRecipes.forEach(r => { m[r.id] = r; });
        return m;
    }, []);

    const plannedCount = useMemo(() =>
        Object.values(planner).reduce((acc, day) => acc + Object.values(day).filter(Boolean).length, 0),
    [planner]);

    const filteredRecipes = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return mockRecipes.slice(0, 20);
        return mockRecipes.filter(r =>
            r.title.toLowerCase().includes(q) ||
            r.category.includes(q) ||
            r.tags?.some(t => t.toLowerCase().includes(q))
        ).slice(0, 30);
    }, [searchQuery]);

    if (!mounted) return null;

    return (
        <div className={styles.page}>
            <Header title="Planning repas" showBack={true} />

            <main className={styles.main}>
                <div className={styles.topBar}>
                    <p className={styles.subtitle}>{plannedCount} repas planifié{plannedCount > 1 ? 's' : ''}</p>
                    <div className={styles.topActions}>
                        {plannedCount > 0 && (
                            <button className={styles.shoppingBtn} onClick={generateShoppingList}>
                                🛒 Liste de courses
                            </button>
                        )}
                        {plannedCount > 0 && (
                            <button className={styles.clearBtn} onClick={clearAll}>Vider</button>
                        )}
                    </div>
                </div>

                {/* Grille semaine */}
                <div className={styles.grid}>
                    {DAYS.map((day, dayIdx) => (
                        <div key={dayIdx} className={styles.dayColumn}>
                            <div className={styles.dayHeader}>{day}</div>
                            {MEALS.map(meal => {
                                const recipeId = planner[dayIdx]?.[meal];
                                const recipe = recipeId ? recipeMap[recipeId] : null;
                                return (
                                    <div key={meal} className={styles.mealSlot}>
                                        <div className={styles.mealLabel}>{meal}</div>
                                        {recipe ? (
                                            <div className={styles.slotFilled}>
                                                <Link href={`/recipe/${recipe.id}`} className={styles.slotRecipeName}>
                                                    {recipe.image && (
                                                        <img src={recipe.image} alt={recipe.title} className={styles.slotImg} />
                                                    )}
                                                    <span className={styles.slotTitle}>{recipe.title}</span>
                                                </Link>
                                                <button
                                                    className={styles.slotRemove}
                                                    onClick={() => removeSlot(dayIdx, meal)}
                                                    title="Retirer"
                                                >✕</button>
                                            </div>
                                        ) : (
                                            <button
                                                className={styles.slotEmpty}
                                                onClick={() => { setPicker({ day: dayIdx, meal }); setSearchQuery(''); }}
                                            >
                                                + Ajouter
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </main>

            {/* Picker modal */}
            {picker && (
                <div className={styles.pickerOverlay} onClick={() => setPicker(null)}>
                    <div className={styles.pickerModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.pickerHeader}>
                            <h3 className={styles.pickerTitle}>
                                {DAYS[picker.day]} — {picker.meal}
                            </h3>
                            <button className={styles.pickerClose} onClick={() => setPicker(null)}>✕</button>
                        </div>
                        <input
                            className={styles.pickerSearch}
                            type="text"
                            placeholder="Chercher une recette..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        <div className={styles.pickerList}>
                            {filteredRecipes.map(r => (
                                <button
                                    key={r.id}
                                    className={styles.pickerItem}
                                    onClick={() => setRecipe(picker.day, picker.meal, r.id)}
                                >
                                    {r.image && <img src={r.image} alt={r.title} className={styles.pickerItemImg} />}
                                    <div className={styles.pickerItemInfo}>
                                        <span className={styles.pickerItemName}>{r.title}</span>
                                        <span className={styles.pickerItemMeta}>{r.category} · {r.prepTime + r.cookTime} min</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
