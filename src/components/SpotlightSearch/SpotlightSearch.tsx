'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { mockRecipes } from '@/data/mockData';
import styles from './SpotlightSearch.module.css';

export default function SpotlightSearch({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Si pas de recherche, on montre les 10 dernières recettes publiées (on exclut systématiquement les restaurants)
    const filteredRecipes = query.trim().length > 1
        ? mockRecipes.filter(r =>
            (r.title.toLowerCase().includes(query.toLowerCase()) ||
            r.tags?.some((t: string) => t.toLowerCase().includes(query.toLowerCase()))) &&
            r.category !== 'restaurant' // On exclut les restaurants de la recherche globale par défaut
        )
        : [...mockRecipes]
            .filter(r => r.category !== 'restaurant')
            .sort((a, b) => parseInt(b.id) - parseInt(a.id))
            .slice(0, 10);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
            setQuery(''); // Reset query on close
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const countryFlags: Record<string, string> = {
        'france': '🇫🇷',
        'italie': '🇮🇹',
        'espagne': '🇪🇸',
        'mexique': '🇲🇽',
        'afrique': '🌍',
        'orient': '🕌',
        'asie': '🥢',
        'usa': '🇺🇸',
        'liban': '🇱🇧',
        'grece': '🇬🇷'
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.searchContainer}>
                    <span className={styles.searchIcon}>🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className={styles.input}
                        placeholder="Chercher une recette magique..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <button className={styles.closeBtn} onClick={onClose}>Esc</button>
                </div>

                <div className={styles.results}>
                    {query.trim().length <= 1 && (
                        <div className={styles.recentTitle}>✨ Dernières Recettes Publiées</div>
                    )}
                    
                    {filteredRecipes.length > 0 ? (
                        filteredRecipes.map(recipe => {
                            const countryTag = recipe.tags?.find(t => countryFlags[t.toLowerCase()]);
                            const flag = countryTag ? countryFlags[countryTag.toLowerCase()] : '🪄';
                            
                            return (
                                <Link
                                    key={recipe.id}
                                    href={`/recipe/${recipe.id}`}
                                    className={styles.resultItem}
                                    onClick={onClose}
                                >
                                    <div className={styles.thumbWrapper}>
                                        <span className={styles.miniFlag}>{flag}</span>
                                        <img src={recipe.image} alt="" className={styles.thumb} />
                                    </div>
                                    <div className={styles.resultInfo}>
                                        <div className={styles.resultTitle}>{recipe.title}</div>
                                        <div className={styles.resultMeta}>{recipe.category} • {recipe.difficulty}</div>
                                    </div>
                                </Link>
                            );
                        })
                    ) : (
                        <div className={styles.noResult}>Aucun sort ne correspond à cette recherche... ✨</div>
                    )}
                </div>
            </div>
        </div>
    );
}
