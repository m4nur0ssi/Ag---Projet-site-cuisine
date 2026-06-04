'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { mockRecipes } from '@/mobile/data/mockData';
import { decodeHtml } from '@/mobile/lib/utils';
import styles from './SpotlightSearch.module.css';

export default function SpotlightSearch({ isOpen, onClose, onRecipeSelect }: { isOpen: boolean; onClose: () => void; onRecipeSelect?: (recipe: any) => void }) {
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

    // Mode recette
    const filteredRecipes = useMemo(() => {
        if (mode !== 'recipe') return [];
        if (query.trim().length <= 1) {
            return [...mockRecipes]
                .filter(r => r.category !== 'restaurant')
                .sort((a, b) => parseInt(b.id) - parseInt(a.id))
                .slice(0, 10);
        }
        return mockRecipes.filter(r =>
            r.category !== 'restaurant' &&
            (r.title.toLowerCase().includes(query.toLowerCase()) ||
             r.tags?.some((t: string) => t.toLowerCase().includes(query.toLowerCase())))
        );
    }, [query, mode]);

    // Mode ingrédients
    const ingredientResults = useMemo(() => {
        if (mode !== 'ingredients' || ingTags.length === 0) return [];
        const tags = ingTags.map(t => t.toLowerCase());
        return mockRecipes
            .filter(r => r.category !== 'restaurant')
            .map(r => {
                const ingNames = r.ingredients.map(i => i.name.toLowerCase());
                const matched = tags.filter(tag => ingNames.some(n => n.includes(tag)));
                return { recipe: r, matched: matched.length };
            })
            .filter(({ matched }) => matched > 0)
            .sort((a, b) => b.matched - a.matched)
            .slice(0, 12);
    }, [ingTags, mode]);

    const addIngTag = () => {
        const val = ingInput.trim().toLowerCase();
        if (val && !ingTags.includes(val)) setIngTags(prev => [...prev, val]);
        setIngInput('');
    };

    const handleRecipeClick = (recipe: any) => {
        if (onRecipeSelect) {
            onRecipeSelect(recipe);
            onClose();
        }
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
                                const itemContent = (
                                    <>
                                        <div className={styles.thumbWrapper}>
                                            <span className={styles.miniFlag}>{flag}</span>
                                            <img src={recipe.image} alt="" className={styles.thumb} />
                                        </div>
                                        <div className={styles.resultInfo}>
                                            <div className={styles.resultTitle}>{decodeHtml(recipe.title)}</div>
                                            <div className={styles.resultMeta}>{recipe.category} • {recipe.difficulty}</div>
                                        </div>
                                    </>
                                );
                                return onRecipeSelect ? (
                                    <button key={recipe.id} className={styles.resultItem} onClick={() => handleRecipeClick(recipe)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        {itemContent}
                                    </button>
                                ) : (
                                    <Link key={recipe.id} href={`/recipe/${recipe.id}`} className={styles.resultItem} onClick={onClose}>
                                        {itemContent}
                                    </Link>
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
                            ) : ingredientResults.length > 0 ? ingredientResults.map(({ recipe, matched }) => {
                                const countryTag = recipe.tags?.find((t: string) => countryFlags[t.toLowerCase()]);
                                const flag = countryTag ? countryFlags[countryTag.toLowerCase()] : '🪄';
                                const itemContent = (
                                    <>
                                        <div className={styles.thumbWrapper}>
                                            <span className={styles.miniFlag}>{flag}</span>
                                            <img src={recipe.image} alt="" className={styles.thumb} />
                                        </div>
                                        <div className={styles.resultInfo}>
                                            <div className={styles.resultTitle}>{decodeHtml(recipe.title)}</div>
                                            <div className={styles.resultMeta}>{recipe.category} • {matched}/{ingTags.length} ingrédient{ingTags.length > 1 ? 's' : ''}</div>
                                        </div>
                                    </>
                                );
                                return onRecipeSelect ? (
                                    <button key={recipe.id} className={styles.resultItem} onClick={() => handleRecipeClick(recipe)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        {itemContent}
                                    </button>
                                ) : (
                                    <Link key={recipe.id} href={`/recipe/${recipe.id}`} className={styles.resultItem} onClick={onClose}>
                                        {itemContent}
                                    </Link>
                                );
                            }) : (
                                <div className={styles.noResult}>Aucune recette avec ces ingrédients</div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
