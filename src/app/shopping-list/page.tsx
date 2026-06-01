'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
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
        const onUpdate = () => {
            const fresh = JSON.parse(window.localStorage.getItem('magic-shopping-list') || '{}');
            setShoppingList(fresh);
        };
        window.addEventListener('shoppingListUpdated', onUpdate);
        return () => window.removeEventListener('shoppingListUpdated', onUpdate);
    }, []);

    const saveAndSync = (newData: ListData) => {
        window.localStorage.setItem('magic-shopping-list', JSON.stringify(newData));
        setShoppingList(newData);
        window.dispatchEvent(new Event('shoppingListUpdated'));
    };

    const clearList = () => {
        if (confirm('Vider toute la liste ?')) {
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
        if (recipe?.ingredients[ingIdx]) {
            const ing = recipe.ingredients[ingIdx];
            if (typeof ing === 'string') {
                recipe.ingredients[ingIdx] = { name: ing as string, checked: true };
            } else {
                ing.checked = !ing.checked;
            }
            saveAndSync(newData);
            if (navigator.vibrate) navigator.vibrate(10);
        }
    };

    const selectAll = (recipeId: string) => {
        const newData = { ...shoppingList };
        const recipe = newData[recipeId];
        if (!recipe) return;
        const allChecked = recipe.ingredients.every(i => (typeof i === 'object' ? i.checked : false));
        recipe.ingredients = recipe.ingredients.map(i => ({
            name: typeof i === 'string' ? i : i.name,
            checked: !allChecked
        }));
        saveAndSync(newData);
    };

    // Tous les ingrédients cochés (toutes recettes)
    const checkedItems = useMemo(() => {
        const items: { recipeTitle: string; name: string }[] = [];
        Object.values(shoppingList).forEach(data => {
            data.ingredients.forEach(ing => {
                const isObj = typeof ing === 'object';
                if (isObj && ing.checked) items.push({ recipeTitle: data.title, name: ing.name.replace('- ', '') });
            });
        });
        return items;
    }, [shoppingList]);

    const buildShareText = () => {
        if (checkedItems.length === 0) return '';
        const byRecipe: Record<string, string[]> = {};
        checkedItems.forEach(({ recipeTitle, name }) => {
            if (!byRecipe[recipeTitle]) byRecipe[recipeTitle] = [];
            byRecipe[recipeTitle].push(name);
        });
        return Object.entries(byRecipe)
            .map(([title, items]) => `🍽 ${title}\n${items.map(i => `• ${i}`).join('\n')}`)
            .join('\n\n');
    };

    const shareWhatsApp = () => {
        const text = buildShareText();
        window.open(`https://wa.me/?text=${encodeURIComponent('🛒 Ma liste de courses\n\n' + text)}`, '_blank');
    };

    const shareSMS = () => {
        const text = buildShareText();
        window.open(`sms:?body=${encodeURIComponent('🛒 Ma liste de courses\n\n' + text)}`, '_blank');
    };

    const shareEmail = () => {
        const text = buildShareText();
        window.open(`mailto:?subject=${encodeURIComponent('Ma liste de courses')}&body=${encodeURIComponent('🛒 Ma liste de courses\n\n' + text)}`, '_blank');
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
                            Cliquez sur un ingrédient dans une recette pour l&apos;ajouter ici.
                        </p>
                    </div>
                ) : (
                    <div className={styles.list} style={{ paddingBottom: checkedItems.length > 0 ? 100 : 20 }}>
                        {Object.entries(shoppingList).map(([id, data]) => {
                            const allChecked = data.ingredients.every(i => (typeof i === 'object' ? i.checked : false));
                            return (
                                <div key={id} className={styles.recipeGroup}>
                                    {/* Photo recette + titre */}
                                    <div className={styles.recipeHeader} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        {data.image && (
                                            <Link href={`/recipe/${id}`}>
                                                <img src={data.image} alt={data.title} className={styles.recipeImage}
                                                    style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                                            </Link>
                                        )}
                                        <div style={{ flex: 1 }}>
                                            <h3 className={styles.recipeTitle}>{data.title}</h3>
                                            <button
                                                onClick={() => selectAll(id)}
                                                style={{ fontSize: '0.72rem', opacity: 0.6, background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px 0' }}
                                            >
                                                {allChecked ? '☑ Tout décocher' : '☐ Tout sélectionner'}
                                            </button>
                                        </div>
                                        <button onClick={() => removeRecipe(id)} className={styles.removeBtn} title="Retirer" aria-label="Retirer">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
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
                            );
                        })}
                    </div>
                )}

                {/* Barre de partage flottante */}
                {checkedItems.length > 0 && (
                    <div style={{
                        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', gap: 10, background: 'rgba(20,20,20,0.95)',
                        backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 40, padding: '10px 16px', zIndex: 100,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                    }}>
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', alignSelf: 'center', marginRight: 4 }}>
                            {checkedItems.length} sélectionné{checkedItems.length > 1 ? 's' : ''}
                        </span>
                        <button onClick={shareWhatsApp} style={btnStyle('#25D366')}>
                            <WhatsAppIcon /> WhatsApp
                        </button>
                        <button onClick={shareSMS} style={btnStyle('#007AFF')}>
                            💬 SMS
                        </button>
                        <button onClick={shareEmail} style={btnStyle('#FF9500')}>
                            ✉️ Email
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

const btnStyle = (color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    background: color, border: 'none', borderRadius: 24,
    padding: '8px 14px', color: 'white', fontSize: '0.8rem',
    fontWeight: 600, cursor: 'pointer'
});

function WhatsAppIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
    );
}
