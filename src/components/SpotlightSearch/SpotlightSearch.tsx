'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { mockRecipes } from '@/data/mockData';
import { decodeHtml } from '@/lib/utils';
import { rankByIngredients } from '@/lib/search-rank';
import styles from './SpotlightSearch.module.css';

export default function SpotlightSearch({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState<'recipe' | 'ingredients'>('recipe');
    const [ingTags, setIngTags] = useState<string[]>([]);
    const [ingInput, setIngInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const countryFlags: Record<string, string> = {
        'france': '🇫🇷', 'italie': '🇮🇹', 'espagne': '🇪🇸', 'mexique': '🇲🇽',
        'afrique': '🌍', 'orient': '🕌', 'asie': '🥢', 'usa': '🇺🇸',
        'liban': '🇱🇧', 'grece': '🇬🇷'
    };

    // Ouvre la recette en flottant (RecipeSheet global), pas de navigation /recipe/:id
    const openRecipe = (recipe: any) => {
        onClose();
        setTimeout(() => window.dispatchEvent(new CustomEvent('openRecipeFromPlanner', { detail: recipe })), 50);
    };

    // Mode recette
    const normalize = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    const filteredRecipes = useMemo(() => {
        if (mode !== 'recipe') return [];
        if (query.trim().length <= 1) {
            return [...mockRecipes]
                .filter(r => r.category !== 'restaurant')
                .sort((a, b) => parseInt(b.id) - parseInt(a.id))
                .slice(0, 10);
        }
        const q = normalize(query.trim());
        return mockRecipes.filter(r =>
            r.category !== 'restaurant' &&
            (normalize(r.title).includes(q) ||
             r.tags?.some((t: string) => normalize(t).includes(q)))
        );
    }, [query, mode]);

    // Mode ingrédients — recherche STRICTE (#7) : full d'abord, suggestions (manque 1) ensuite.
    const ingredientResults = useMemo(() => {
        if (mode !== 'ingredients' || ingTags.length === 0) return [];
        const pool = mockRecipes.filter(r => r.category !== 'restaurant');
        return rankByIngredients(pool, ingTags.join(' ')) || [];
    }, [ingTags, mode]);
    const ingFull = useMemo(() => ingredientResults.filter(r => r.matched === r.total), [ingredientResults]);
    const ingPartial = useMemo(() => ingredientResults.filter(r => r.matched < r.total), [ingredientResults]);
    const ingShowSuggestions = ingPartial.length > 0 && ingFull.length < 6;

    const addIngTag = () => {
        const val = ingInput.trim().toLowerCase();
        if (val && !ingTags.includes(val)) setIngTags(prev => [...prev, val]);
        setIngInput('');
    };

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
            setQuery('');
            setIngTags([]);
            setIngInput('');
            setMode('recipe');
        }
    }, [isOpen]);

    const quickFilters = [
        { label: '🍹 Apéritifs', tag: 'aperitifs' },
        { label: '🥗 Entrées', tag: 'entrees' },
        { label: '🍽 Plats', tag: 'plats' },
        { label: '🍰 Desserts', tag: 'desserts' },
        { label: '🥐 Pâtisserie', tag: 'patisserie' },
        { label: '🇫🇷 France', tag: 'france' },
        { label: '🇮🇹 Italie', tag: 'italie' },
        { label: '🇬🇷 Grèce', tag: 'grece' },
        { label: '🇱🇧 Liban', tag: 'liban' },
        { label: '🥢 Asie', tag: 'asie' },
        { label: '⚡ Express', tag: 'express' },
        { label: '🌿 Healthy', tag: 'healthy' },
        { label: '👨‍👩‍👧 Famille', tag: 'famille' },
        { label: '💰 Pas cher', tag: 'pas cher' },
    ];

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.searchContainer}>
                    <span className={styles.searchIcon}>🔍</span>
                    {mode === 'recipe' ? (
                        <input
                            ref={inputRef}
                            type="text"
                            className={styles.input}
                            placeholder="Chercher une recette magique..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                    ) : (
                        <input
                            ref={inputRef}
                            type="text"
                            className={styles.input}
                            placeholder="Ajouter un ingrédient (Entrée pour valider)..."
                            value={ingInput}
                            onChange={e => setIngInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addIngTag(); } }}
                        />
                    )}
                    <button className={styles.closeBtn} onClick={onClose}>Esc</button>
                </div>

                {/* Mode toggle */}
                <div className={styles.modeToggle}>
                    <button
                        className={`${styles.modeBtn} ${mode === 'recipe' ? styles.modeBtnActive : ''}`}
                        onClick={() => setMode('recipe')}
                    >🔍 Par recette</button>
                    <button
                        className={`${styles.modeBtn} ${mode === 'ingredients' ? styles.modeBtnActive : ''}`}
                        onClick={() => { setMode('ingredients'); setTimeout(() => inputRef.current?.focus(), 50); }}
                    >🥕 Par ingrédients</button>
                </div>

                {mode === 'ingredients' && ingTags.length > 0 && (
                    <div className={styles.ingTags}>
                        {ingTags.map(tag => (
                            <span key={tag} className={styles.ingTag}>
                                {tag}
                                <button onClick={() => setIngTags(p => p.filter(t => t !== tag))} className={styles.ingTagRemove}>✕</button>
                            </span>
                        ))}
                    </div>
                )}

                <div className={styles.results}>
                    {mode === 'recipe' && (
                        <>
                            {query.trim().length <= 1 && (
                                <div className={styles.recentTitle}>✨ Dernières Recettes Publiées</div>
                            )}
                            {filteredRecipes.length > 0 ? filteredRecipes.map(recipe => {
                                const countryTag = recipe.tags?.find((t: string) => countryFlags[t.toLowerCase()]);
                                const flag = countryTag ? countryFlags[countryTag.toLowerCase()] : '🪄';
                                return (
                                    <button type="button" key={recipe.id} className={styles.resultItem} onClick={() => openRecipe(recipe)} style={{ textAlign: 'left', background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}>
                                        <div className={styles.thumbWrapper}>
                                            <span className={styles.miniFlag}>{flag}</span>
                                            <img src={recipe.image} alt="" className={styles.thumb} />
                                        </div>
                                        <div className={styles.resultInfo}>
                                            <div className={styles.resultTitle}>{decodeHtml(recipe.title)}</div>
                                            <div className={styles.resultMeta}>{recipe.category} • {recipe.difficulty}</div>
                                        </div>
                                    </button>
                                );
                            }) : (
                                <div className={styles.noResult}>Aucun sort ne correspond à cette recherche... ✨</div>
                            )}
                        </>
                    )}

                    {mode === 'ingredients' && (
                        <>
                            {ingTags.length === 0 ? (
                                <div className={styles.noResult}>Tapez un ingrédient et appuyez sur Entrée 🥕</div>
                            ) : (() => {
                                const Row = ({ recipe, matched, total, missingTokens }: typeof ingredientResults[number]) => {
                                    const countryTag = recipe.tags?.find((t: string) => countryFlags[t.toLowerCase()]);
                                    const flag = countryTag ? countryFlags[countryTag.toLowerCase()] : '🪄';
                                    return (
                                        <button type="button" key={recipe.id} className={styles.resultItem} onClick={() => openRecipe(recipe)} style={{ textAlign: 'left', background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}>
                                            <div className={styles.thumbWrapper}>
                                                <span className={styles.miniFlag}>{flag}</span>
                                                <img src={recipe.image} alt="" className={styles.thumb} />
                                            </div>
                                            <div className={styles.resultInfo}>
                                                <div className={styles.resultTitle}>{decodeHtml(recipe.title)}</div>
                                                <div className={styles.resultMeta}>
                                                    {recipe.category} • {matched}/{total} ingrédient{total > 1 ? 's' : ''}
                                                    {missingTokens.length > 0 && <span style={{ color: '#f59e0b' }}> · manque : {missingTokens.join(', ')}</span>}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                };
                                if (ingFull.length === 0 && ingPartial.length === 0) {
                                    return <div className={styles.noResult}>Aucune recette avec ces ingrédients</div>;
                                }
                                return (
                                    <>
                                        {ingFull.length > 0
                                            ? ingFull.map(r => <Row key={r.recipe.id} {...r} />)
                                            : <div className={styles.noResult}>Aucune recette avec <b>tous</b> ces ingrédients</div>}
                                        {ingShowSuggestions && (
                                            <>
                                                <div className={styles.noResult} style={{ opacity: 0.7, fontSize: '0.8rem', padding: '10px 0 4px' }}>
                                                    Suggestions — il manque 1 ingrédient
                                                </div>
                                                {ingPartial.map(r => <Row key={r.recipe.id} {...r} />)}
                                            </>
                                        )}
                                    </>
                                );
                            })()}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
