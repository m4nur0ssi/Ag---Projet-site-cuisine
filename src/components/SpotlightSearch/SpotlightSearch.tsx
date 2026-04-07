'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mockRecipes } from '@/data/mockData';
import styles from './SpotlightSearch.module.css';

// ─── Données des groupes — alignées avec MagicFilterBar ──────────────────────

const GROUPS = [
    {
        id: 'pays',
        label: '🌍 Pays',
        items: [
            { name: 'France',   tag: 'france',   icon: '🇫🇷' },
            { name: 'Italie',   tag: 'italie',   icon: '🇮🇹' },
            { name: 'Espagne',  tag: 'espagne',  icon: '🇪🇸' },
            { name: 'Grèce',    tag: 'grece',    icon: '🇬🇷' },
            { name: 'Liban',    tag: 'liban',    icon: '🇱🇧' },
            { name: 'USA',      tag: 'usa',      icon: '🇺🇸' },
            { name: 'Mexique',  tag: 'mexique',  icon: '🇲🇽' },
            { name: 'Orient',   tag: 'orient',   icon: '🕌' },
            { name: 'Asie',     tag: 'asie',     icon: '🥢' },
            { name: 'Afrique',  tag: 'afrique',  icon: '🌍' },
        ],
    },
    {
        id: 'tendances',
        label: '🏷️ Tendances',
        items: [
            { name: 'Healthy',   tag: 'Healthy',  icon: '🥗' },
            { name: 'Airfryer',  tag: 'airfryer', icon: '💨' },
            { name: 'Barbecue',  tag: 'Barbecue', icon: '🍖' },
            { name: 'Pas Cher',  tag: 'Pas cher', icon: '🪙' },
            { name: 'Express',   tag: 'Express',  icon: '⚡' },
            { name: 'Epicé',     tag: 'épicé',    icon: '🌶️' },
        ],
    },
    {
        id: 'thematiques',
        label: '🎭 Thématiques',
        items: [
            { name: 'Pâques',       tag: 'Pâques',      icon: '🐣' },
            { name: "C'est Noël",   tag: 'Noël',        icon: '🎄' },
            { name: 'Astuces',      tag: 'Astuces',     icon: '💡' },
            { name: 'Simplissime',  tag: 'Simplissime', icon: '✨' },
            { name: 'La Dolce Vita',tag: 'Italie',      icon: '🇮🇹' },
        ],
    },
];

// ─── Composant ────────────────────────────────────────────────────────────────

export default function SpotlightSearch({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // ── Recherche dans les recettes (mode actif quand query > 1 char) ──
    const filteredRecipes = query.trim().length > 1
        ? mockRecipes.filter(r =>
            (r.title.toLowerCase().includes(query.toLowerCase()) ||
            r.tags?.some((t: string) => t.toLowerCase().includes(query.toLowerCase()))) &&
            r.category !== 'restaurant'
        ).slice(0, 12)
        : [];

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
            setQuery('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleTagClick = (tag: string) => {
        onClose();
        router.push(`/?tags=${encodeURIComponent(tag)}`);
    };

    const isSearching = query.trim().length > 1;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>

                {/* Barre de recherche */}
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

                    {/* ── MODE RECHERCHE : résultats de recettes ── */}
                    {isSearching && (
                        <>
                            {filteredRecipes.length > 0 ? (
                                filteredRecipes.map(recipe => (
                                    <Link
                                        key={recipe.id}
                                        href={`/recipe/${recipe.id}`}
                                        className={styles.resultItem}
                                        onClick={onClose}
                                    >
                                        <div className={styles.thumbWrapper}>
                                            <img src={recipe.image} alt="" className={styles.thumb} />
                                        </div>
                                        <div className={styles.resultInfo}>
                                            <div className={styles.resultTitle}>{recipe.title}</div>
                                            <div className={styles.resultMeta}>
                                                {recipe.tags?.slice(0, 3).join(' · ') || recipe.category}
                                            </div>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className={styles.noResult}>Aucun sort ne correspond à cette recherche... ✨</div>
                            )}
                        </>
                    )}

                    {/* ── MODE NAVIGATION : Pays / Tendances / Thématiques ── */}
                    {!isSearching && (
                        <div className={styles.navGroups}>
                            {GROUPS.map(group => (
                                <div key={group.id} className={styles.navGroup}>
                                    <div className={styles.navGroupLabel}>{group.label}</div>
                                    <div className={styles.navGroupItems}>
                                        {group.items.map(item => (
                                            <button
                                                key={item.tag}
                                                className={styles.navChip}
                                                onClick={() => handleTagClick(item.tag)}
                                            >
                                                <span className={styles.chipIcon}>{item.icon}</span>
                                                <span className={styles.chipName}>{item.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
