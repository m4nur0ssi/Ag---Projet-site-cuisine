'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { mockRecipes } from '@/data/mockData';
import { decodeHtml } from '@/lib/utils';
import styles from './WeekPlanner.module.css';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MEALS = ['Midi', 'Soir'] as const;

const FILTER_GROUPS = {
    categorie: [
        { label: '🍹 Apéritifs', tag: 'aperitifs' },
        { label: '🥗 Entrées', tag: 'entrees' },
        { label: '🍽 Plats', tag: 'plats' },
        { label: '🍰 Desserts', tag: 'desserts' },
        { label: '🥐 Pâtisserie', tag: 'patisserie' },
    ],
    pays: [
        { label: '🇫🇷 France', tag: 'france' },
        { label: '🇮🇹 Italie', tag: 'italie' },
        { label: '🇬🇷 Grèce', tag: 'grece' },
        { label: '🇱🇧 Liban', tag: 'liban' },
        { label: '🥢 Asie', tag: 'asie' },
        { label: '🇪🇸 Espagne', tag: 'espagne' },
        { label: '🇲🇽 Mexique', tag: 'mexique' },
    ],
    tendances: [
        { label: '⚡ Express', tag: 'express' },
        { label: '🌿 Healthy', tag: 'healthy' },
        { label: '👨‍👩‍👧 Famille', tag: 'famille' },
        { label: '💰 Pas cher', tag: 'pas cher' },
        { label: '🔥 Airfryer', tag: 'airfryer' },
        { label: '🥩 Barbecue', tag: 'barbecue' },
    ],
} as const;
type FilterGroup = keyof typeof FILTER_GROUPS;
type Plan = Record<string, Record<string, any>>;

interface WeekPlannerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function WeekPlanner({ isOpen, onClose }: WeekPlannerProps) {
    const [plan, setPlan] = useState<Plan>({});
    const [picker, setPicker] = useState<{ day: string; meal: string } | null>(null);
    const [query, setQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('');
    const [activeGroup, setActiveGroup] = useState<FilterGroup | null>(null);
    const [ingMode, setIngMode] = useState(false);
    const [ingTags, setIngTags] = useState<string[]>([]);
    const [ingInput, setIngInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            try { setPlan(JSON.parse(localStorage.getItem('meal-planner-week') || '{}')); } catch {}
        }
    }, [isOpen]);

    useEffect(() => {
        if (picker) setTimeout(() => inputRef.current?.focus(), 100);
    }, [picker]);

    const save = (newPlan: Plan) => {
        setPlan(newPlan);
        localStorage.setItem('meal-planner-week', JSON.stringify(newPlan));
    };

    const removeSlot = (day: string, meal: string) => {
        const np = { ...plan };
        if (np[day]) { delete np[day][meal]; if (!Object.keys(np[day]).length) delete np[day]; }
        save(np);
    };

    const assignRecipe = (recipe: any) => {
        if (!picker) return;
        const np = { ...plan };
        if (!np[picker.day]) np[picker.day] = {};
        np[picker.day][picker.meal] = recipe;
        save(np);
        closePicker();
    };

    const closePicker = () => {
        setPicker(null);
        setQuery(''); setActiveFilter(''); setActiveGroup(null);
        setIngTags([]); setIngInput(''); setIngMode(false);
    };

    const openRecipe = (recipe: any) => {
        window.dispatchEvent(new CustomEvent('openRecipe', { detail: recipe }));
        // If no RecipeSheet is open, navigate directly
    };

    const normalize = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    const searchResults = useMemo(() => {
        const base = mockRecipes.filter(r => r.category !== 'restaurant');
        if (ingMode && ingTags.length > 0) {
            const tags = ingTags.map(t => normalize(t));
            return base.map(r => {
                const names = r.ingredients.map(i => normalize(i.name));
                const matched = tags.filter(t => names.some(n => n.includes(t))).length;
                return { r, score: matched };
            }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.r).slice(0, 15);
        }
        let pool = base;
        if (activeFilter) {
            const af = normalize(activeFilter);
            pool = base.filter(r => {
                const rTags = (r.tags || []).map((t: string) => normalize(t));
                const cat = normalize(r.category || '');
                return cat === af || rTags.some((t: string) => t.includes(af));
            });
        }
        if (query.trim().length > 1) {
            const q = normalize(query.trim());
            pool = pool.filter(r =>
                normalize(r.title).includes(q) ||
                (r.tags || []).some((t: string) => normalize(t).includes(q))
            );
        }
        if (!activeFilter && query.trim().length <= 1 && !ingMode) {
            return [...base].sort((a, b) => parseInt(b.id) - parseInt(a.id)).slice(0, 20);
        }
        return pool.slice(0, 20);
    }, [query, activeFilter, ingMode, ingTags]);

    if (!isOpen) return null;

    return (
        <>
            {/* Panneau inline semaine */}
            <div className={styles.weekPanel}>
                <div className={styles.weekPanelInner}>
                    <div className={styles.weekHeader}>
                        <span className={styles.weekTitle}>📅 Les Recettes de la Semaine</span>
                        <button className={styles.weekCloseBtn} onClick={onClose}>✕</button>
                    </div>
                    <div className={styles.daysRow}>
                        {DAYS.map(day => (
                            <div key={day} className={styles.dayCard}>
                                <div className={styles.dayName}>{day}</div>
                                {MEALS.map(meal => {
                                    const recipe = plan[day]?.[meal];
                                    return (
                                        <div key={meal} className={styles.mealSlot}>
                                            <div className={styles.mealTag}>{meal}</div>
                                            {recipe ? (
                                                <div
                                                    className={styles.recipeVignette}
                                                    onClick={() => openRecipe(recipe)}
                                                >
                                                    <img src={recipe.image} alt={recipe.title} className={styles.vignetteImg} />
                                                    <div className={styles.vignetteTitle}>{decodeHtml(recipe.title)}</div>
                                                    <button
                                                        className={styles.removeVignette}
                                                        onClick={e => { e.stopPropagation(); removeSlot(day, meal); }}
                                                    >✕</button>
                                                </div>
                                            ) : (
                                                <button
                                                    className={styles.emptySlot}
                                                    onClick={() => setPicker({ day, meal })}
                                                >
                                                    <span className={styles.emptyPlus}>+</span>
                                                    <span className={styles.emptyText}>Pas de recette</span>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Picker — clone SpotlightSearch */}
            {picker && (
                <div className={styles.pickerOverlay} onClick={closePicker}>
                    <div className={styles.pickerModal} onClick={e => e.stopPropagation()}>
                        {/* Barre recherche style SpotlightSearch */}
                        <div className={styles.searchBar}>
                            <span className={styles.searchIcon}>🔍</span>
                            {!ingMode ? (
                                <input
                                    ref={inputRef}
                                    className={styles.searchInput}
                                    placeholder="Chercher une recette magique..."
                                    value={query}
                                    onChange={e => { setQuery(e.target.value); setActiveFilter(''); setActiveGroup(null); }}
                                />
                            ) : (
                                <input
                                    ref={inputRef}
                                    className={styles.searchInput}
                                    placeholder="Ajouter un ingrédient (Entrée)..."
                                    value={ingInput}
                                    onChange={e => setIngInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === ',') {
                                            e.preventDefault();
                                            const v = ingInput.trim().toLowerCase();
                                            if (v && !ingTags.includes(v)) setIngTags(p => [...p, v]);
                                            setIngInput('');
                                        }
                                    }}
                                />
                            )}
                            <button className={styles.escBtn} onClick={closePicker}>Esc</button>
                        </div>

                        {/* Mode toggle */}
                        <div className={styles.modeToggle}>
                            <button
                                className={`${styles.modeBtn} ${!ingMode ? styles.modeBtnActive : ''}`}
                                onClick={() => { setIngMode(false); setTimeout(() => inputRef.current?.focus(), 50); }}
                            >🔍 Par recette</button>
                            <button
                                className={`${styles.modeBtn} ${ingMode ? styles.modeBtnActive : ''}`}
                                onClick={() => { setIngMode(true); setActiveGroup(null); setActiveFilter(''); setTimeout(() => inputRef.current?.focus(), 50); }}
                            >🥕 Par ingrédients</button>
                        </div>

                        {/* Groupes Catégorie / Pays / Tendances */}
                        {!ingMode && (
                            <div className={styles.groupBtns}>
                                {(['categorie', 'pays', 'tendances'] as FilterGroup[]).map(g => (
                                    <button
                                        key={g}
                                        className={`${styles.groupBtn} ${activeGroup === g ? styles.groupBtnActive : ''}`}
                                        onClick={() => {
                                            if (activeGroup === g) { setActiveGroup(null); setActiveFilter(''); }
                                            else { setActiveGroup(g); setActiveFilter(''); setQuery(''); }
                                        }}
                                    >
                                        {g === 'categorie' ? '🍽 Catégorie' : g === 'pays' ? '🌍 Pays' : '✨ Tendances'}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Filtres du groupe */}
                        {activeGroup && !ingMode && (
                            <div className={styles.filterChips}>
                                {FILTER_GROUPS[activeGroup].map(f => (
                                    <button
                                        key={f.tag}
                                        className={`${styles.chip} ${activeFilter === f.tag ? styles.chipActive : ''}`}
                                        onClick={() => setActiveFilter(activeFilter === f.tag ? '' : f.tag)}
                                    >{f.label}</button>
                                ))}
                            </div>
                        )}

                        {/* Tags ingrédients */}
                        {ingMode && ingTags.length > 0 && (
                            <div className={styles.ingTags}>
                                {ingTags.map(t => (
                                    <span key={t} className={styles.ingTag}>
                                        {t}
                                        <button onClick={() => setIngTags(p => p.filter(x => x !== t))}>✕</button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Résultats */}
                        <div className={styles.results}>
                            {!activeFilter && query.trim().length <= 1 && !ingMode && (
                                <div className={styles.resultsLabel}>✨ Dernières Recettes Publiées</div>
                            )}
                            {ingMode && ingTags.length === 0 ? (
                                <div className={styles.noResult}>Tapez un ingrédient et appuyez sur Entrée 🥕</div>
                            ) : searchResults.length === 0 ? (
                                <div className={styles.noResult}>Aucun sort ne correspond... ✨</div>
                            ) : searchResults.map(r => (
                                <button key={r.id} className={styles.resultRow} onClick={() => assignRecipe(r)}>
                                    <img src={r.image} alt={r.title} className={styles.resultImg} />
                                    <div className={styles.resultInfo}>
                                        <div className={styles.resultTitle}>{decodeHtml(r.title)}</div>
                                        <div className={styles.resultMeta}>{r.category} • {r.difficulty}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
