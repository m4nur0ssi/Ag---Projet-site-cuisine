'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { mockRecipes } from '@/mobile/data/mockData';
import { decodeHtml } from '@/mobile/lib/utils';
import { smartLocalSearch } from '@/lib/recipeSmartSearch';
import styles from './SpotlightSearch.module.css';

// Groupes de filtres — listes complètes, identiques à la barre d'accueil (MagicFilterBar).
const FILTER_GROUPS = {
    categorie: [
        { label: '🥘 Accompagnements', tag: 'accompagnements' },
        { label: '🍹 Apéritifs', tag: 'aperitifs' },
        { label: '🍰 Desserts', tag: 'desserts' },
        { label: '🥗 Entrées', tag: 'entrees' },
        { label: '🍝 Pâtes', tag: 'pates' },
        { label: '🥐 Pâtisserie', tag: 'patisserie' },
        { label: '🍽 Plats', tag: 'plats' },
    ],
    pays: [
        { label: '🌍 Afrique', tag: 'Afrique' },
        { label: '🥢 Asie', tag: 'Asie' },
        { label: '🇪🇸 Espagne', tag: 'Espagne' },
        { label: '🇫🇷 France', tag: 'France' },
        { label: '🇬🇷 Grèce', tag: 'Grece' },
        { label: '🇮🇹 Italie', tag: 'Italie' },
        { label: '🇱🇧 Liban', tag: 'Liban' },
        { label: '🇲🇽 Mexique', tag: 'Mexique' },
        { label: '🕌 Orient', tag: 'Orient' },
        { label: '🇵🇹 Portugal', tag: 'Portugal' },
        { label: '🇺🇸 USA', tag: 'USA' },
    ],
    // Source alignée sur thematicThemes (accueil) → toutes les tendances. Tri alpha fait au rendu.
    tendances: [
        { label: '🔥 Airfryer', tag: 'Airfryer' },
        { label: '💡 Astuces', tag: 'Astuces' },
        { label: '🥩 Barbecue', tag: 'Barbecue' },
        { label: '❄️ C\'est l\'hiver', tag: 'cest-lhiver' },
        { label: '🍝 Dolce Vita', tag: 'dolce-vita' },
        { label: '🌶️ Épicé', tag: 'epice' },
        { label: '⚡ Express', tag: 'Express' },
        { label: '👨‍👩‍👧 Famille', tag: 'famille' },
        { label: '🍦 Les Glaces', tag: 'glaces' },
        { label: '🧀 Gratins', tag: 'gratins' },
        { label: '🌿 Healthy', tag: 'Healthy' },
        { label: '🪶 Minceur', tag: 'minceur' },
        { label: '🎄 Noël', tag: 'Noël' },
        { label: '🐰 Pâques', tag: 'pâques' },
        { label: '💰 Pas Cher', tag: 'Pas cher' },
        { label: '🍝 Pâtes', tag: 'pates' },
        { label: '🐟 Poissons', tag: 'poissons' },
        { label: '🥤 Rafraîchissements', tag: 'boissons' },
        { label: '🥗 Salades', tag: 'salades' },
        { label: '🥪 Sandwichs', tag: 'sandwich' },
        { label: '🌾 Sans gluten', tag: 'sans-gluten' },
        { label: '🥛 Sans lactose', tag: 'sans-lactose' },
        { label: '🧂 Sans sel', tag: 'sans-sel' },
        { label: '🍬 Sans sucre', tag: 'sans-sucre' },
        { label: '🥫 Sauces', tag: 'sauces' },
        { label: '✨ Simplissime', tag: 'simplissime' },
        { label: '🍲 Soupes', tag: 'soupes' },
        { label: '🥧 Tarte', tag: 'tarte' },
        { label: '🥬 Végé', tag: 'vegetarien' },
        { label: '☀️ Voilà l\'été', tag: 'voila-lete' },
    ],
} as const;
type FilterGroup = keyof typeof FILTER_GROUPS;

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function SpotlightSearch({ isOpen, onClose, onRecipeSelect }: { isOpen: boolean; onClose: () => void; onRecipeSelect?: (recipe: any) => void }) {
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState<'recipe' | 'ingredients' | 'assistant'>('recipe');
    const [ingTags, setIngTags] = useState<string[]>([]);
    const [ingInput, setIngInput] = useState('');
    const [activeGroup, setActiveGroup] = useState<FilterGroup | null>(null);
    const [activeFilter, setActiveFilter] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Assistant IA : demande en langage naturel (texte/voix) → recettes EXISTANTES du site
    const [aiQuery, setAiQuery] = useState('');
    const [aiResults, setAiResults] = useState<any[]>([]);
    const [aiMessage, setAiMessage] = useState('');
    const [aiBusy, setAiBusy] = useState(false);
    const [aiError, setAiError] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    // Recherche locale intelligente (secours si l'IA échoue / pas de clé) — type de plat, pays, régime
    const localSearch = (q: string) => smartLocalSearch(mockRecipes as any, q, 5);

    const askAssistant = async (raw?: string) => {
        const q = (raw ?? aiQuery).trim();
        if (!q || aiBusy) return;
        setAiBusy(true);
        setAiError('');
        setAiResults([]);
        setAiMessage('');
        try {
            const compact = mockRecipes
                .filter(r => r.category !== 'restaurant')
                .map(r => ({ id: String(r.id), t: r.title, cat: r.category, tags: (r.tags || []).slice(0, 6) }));
            const res = await fetch('/api/recipe-finder', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ query: q, recipes: compact }),
            });
            if (!res.ok) throw new Error('api');
            const data = await res.json();
            const byId = new Map(mockRecipes.map(r => [String(r.id), r]));
            const found = (data.ids || []).map((id: string) => byId.get(String(id))).filter(Boolean);
            if (found.length) {
                setAiResults(found);
                setAiMessage(data.message || '');
            } else {
                throw new Error('empty');
            }
        } catch {
            // Secours : recherche texte locale
            const local = localSearch(q);
            if (local.length) {
                setAiResults(local);
                setAiMessage('Voici ce que j\'ai trouvé sur le site 👇');
            } else {
                setAiError('Aucune recette du site ne correspond. Reformule ta demande ✨');
            }
        } finally {
            setAiBusy(false);
        }
    };

    const toggleVoice = () => {
        if (typeof window === 'undefined') return;
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) { setAiError('La dictée vocale n\'est pas supportée sur ce navigateur.'); return; }
        if (isListening) { try { recognitionRef.current?.stop(); } catch {} return; }
        const rec = new SR();
        rec.lang = 'fr-FR';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.onstart = () => setIsListening(true);
        rec.onend = () => { setIsListening(false); recognitionRef.current = null; };
        rec.onerror = () => { setIsListening(false); recognitionRef.current = null; };
        rec.onresult = (e: any) => {
            const transcript = e.results?.[0]?.[0]?.transcript || '';
            if (transcript) setAiQuery(transcript); // le débounce (1s) lance la recherche
        };
        recognitionRef.current = rec;
        try { rec.start(); } catch {}
    };

    // Lancement automatique : 1s d'inactivité après la frappe ou la dictée → recherche.
    useEffect(() => {
        if (mode !== 'assistant') return;
        const q = aiQuery.trim();
        if (q.length < 3) return;
        const t = setTimeout(() => askAssistant(q), 1000);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aiQuery, mode]);

    const countryFlags: Record<string, string> = {
        'france': '🇫🇷', 'italie': '🇮🇹', 'espagne': '🇪🇸', 'mexique': '🇲🇽',
        'afrique': '🌍', 'orient': '🕌', 'asie': '🥢', 'usa': '🇺🇸',
        'liban': '🇱🇧', 'grece': '🇬🇷'
    };

    // Mode recette
    const filteredRecipes = useMemo(() => {
        if (mode !== 'recipe') return [];
        let pool = mockRecipes.filter(r => r.category !== 'restaurant');
        if (activeFilter) {
            const af = normalize(activeFilter);
            pool = pool.filter(r =>
                normalize(r.category || '') === af ||
                (r.tags || []).some((t: string) => normalize(t).includes(af)));
        }
        if (query.trim().length > 1) {
            const q = normalize(query.trim());
            pool = pool.filter(r =>
                normalize(r.title).includes(q) ||
                (r.tags || []).some((t: string) => normalize(t).includes(q)));
        }
        if (!activeFilter && query.trim().length <= 1) {
            return [...pool].sort((a, b) => parseInt(b.id) - parseInt(a.id)).slice(0, 10);
        }
        return pool;
    }, [query, mode, activeFilter]);

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
            setActiveGroup(null);
            setActiveFilter('');
            setAiQuery('');
            setAiResults([]);
            setAiMessage('');
            setAiError('');
            try { recognitionRef.current?.stop(); } catch {}
            setIsListening(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.searchContainer}>
                    {mode === 'assistant' ? (
                        <>
                            <input
                                ref={inputRef}
                                type="text"
                                className={styles.input}
                                placeholder="Dis-moi ton envie… ex : un plat rapide au poulet"
                                value={aiQuery}
                                onChange={e => setAiQuery(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); askAssistant(); } }}
                            />
                            <button
                                className={`${styles.micBtn} ${isListening ? styles.micBtnActive : ''}`}
                                onClick={toggleVoice}
                                title="Dicter ma demande"
                                aria-label="Dicter ma demande"
                            >{isListening ? '🔴' : '🎤'}</button>
                            <button className={styles.aiSendBtn} onClick={() => askAssistant()} disabled={aiBusy} aria-label="Demander">
                                {aiBusy ? '…' : '➜'}
                            </button>
                        </>
                    ) : mode === 'recipe' ? (
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
                    >Par recette</button>
                    <button
                        className={`${styles.modeBtn} ${mode === 'ingredients' ? styles.modeBtnActive : ''}`}
                        onClick={() => { setMode('ingredients'); setActiveGroup(null); setActiveFilter(''); setTimeout(() => inputRef.current?.focus(), 50); }}
                    >Par ingrédients</button>
                    <button
                        className={`${styles.modeBtn} ${mode === 'assistant' ? styles.modeBtnActive : ''}`}
                        onClick={() => { setMode('assistant'); setActiveGroup(null); setActiveFilter(''); setTimeout(() => inputRef.current?.focus(), 50); }}
                    >✨ Assistant IA</button>
                </div>

                {/* Groupes Catégorie / Pays / Tendances (mode recette) */}
                {mode === 'recipe' && (
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

                {/* Chips du groupe sélectionné */}
                {mode === 'recipe' && activeGroup && (
                    <div className={styles.filterChips}>
                        {(activeGroup === 'tendances'
                            ? [...FILTER_GROUPS[activeGroup]].sort((a, b) =>
                                a.label.replace(/^[^\p{L}]+/u, '').localeCompare(b.label.replace(/^[^\p{L}]+/u, ''), 'fr'))
                            : FILTER_GROUPS[activeGroup]
                        ).map(f => (
                            <button
                                key={f.tag}
                                className={`${styles.chip} ${activeFilter === f.tag ? styles.chipActive : ''}`}
                                onClick={() => setActiveFilter(activeFilter === f.tag ? '' : f.tag)}
                            >{f.label}</button>
                        ))}
                    </div>
                )}

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
                    {mode === 'assistant' && (
                        <>
                            {aiBusy && <div className={styles.recentTitle}>✨ L’assistant cherche…</div>}
                            {!aiBusy && aiMessage && <div className={styles.aiMessage}>✨ {aiMessage}</div>}
                            {!aiBusy && aiError && <div className={styles.noResult}>{aiError}</div>}
                            {!aiBusy && !aiResults.length && !aiError && (
                                <div className={styles.noResult}>Décris ton envie (ou dicte 🎤) : « un dessert au chocolat sans gluten », « plat italien rapide »…</div>
                            )}
                            {aiResults.map(recipe => {
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
                            })}
                        </>
                    )}

                    {mode === 'recipe' && (
                        <>
                            {query.trim().length <= 1 && !activeFilter && (
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
