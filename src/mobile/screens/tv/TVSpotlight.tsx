'use client';

/**
 * Recherche « façon Apple TV+ » — route /tv, TEST DE DESIGN (local uniquement).
 * Reprend À L'IDENTIQUE les fonctionnalités de SpotlightSearch (prod) :
 *   • Par recette   : texte + groupes Catégorie / Pays / Tendances (chips).
 *   • Par ingrédients : on ajoute des ingrédients, tri par nombre de correspondances.
 *   • Assistant IA  : demande en langage naturel (texte ou voix) → recettes du site.
 * Seul le HABILLAGE change : verre profond, chips pilules, typo — langage iOS 26/27.
 * Aucune modification de la prod (SpotlightSearch reste tel quel).
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Recipe } from '@/mobile/types';
import { mockRecipes } from '@/mobile/data/mockData';
import { decodeHtml } from '@/mobile/lib/utils';
import { smartLocalSearch } from '@/lib/recipeSmartSearch';
import { buildFinderCatalog } from '@/lib/recipe-search-payload';
import { FILTER_GROUPS, type FilterGroup } from '@/lib/searchFilters';
import styles from './tv.module.css';

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Retire emojis/drapeaux/symboles décoratifs des libellés (langage sobre TV). */
/** Retour haptique (ignoré si non supporté). */
const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* noop */ } };

const stripEmoji = (s: string) =>
    s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️‍]/gu, '').trim();

type Mode = 'recipe' | 'ingredients' | 'assistant';

interface TVSpotlightProps {
    open: boolean;
    onClose: () => void;
    onRecipeSelect: (recipe: Recipe) => void;
}

export default function TVSpotlight({ open, onClose, onRecipeSelect }: TVSpotlightProps) {
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState<Mode>('recipe');
    const [ingTags, setIngTags] = useState<string[]>([]);
    const [ingInput, setIngInput] = useState('');
    const [activeGroup, setActiveGroup] = useState<FilterGroup | null>(null);
    const [activeFilter, setActiveFilter] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Assistant IA
    const [aiQuery, setAiQuery] = useState('');
    const [aiResults, setAiResults] = useState<Recipe[]>([]);
    const [aiMessage, setAiMessage] = useState('');
    const [aiBusy, setAiBusy] = useState(false);
    const [aiError, setAiError] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    const localSearch = (q: string) => smartLocalSearch(mockRecipes as any, q, 5) as Recipe[];

    const askAssistant = async (raw?: string) => {
        const q = (raw ?? aiQuery).trim();
        if (!q || aiBusy) return;
        setAiBusy(true); setAiError(''); setAiResults([]); setAiMessage('');
        try {
            const compact = buildFinderCatalog(mockRecipes as any);
            const res = await fetch('/api/recipe-finder', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ query: q, recipes: compact }),
            });
            if (!res.ok) throw new Error('api');
            const data = await res.json();
            const byId = new Map(mockRecipes.map((r) => [String(r.id), r]));
            const found = (data.ids || []).map((id: string) => byId.get(String(id))).filter(Boolean) as Recipe[];
            if (found.length) { setAiResults(found); setAiMessage(data.message || ''); }
            else throw new Error('empty');
        } catch {
            const local = localSearch(q);
            if (local.length) { setAiResults(local); setAiMessage('Voici ce que j\'ai trouvé sur le site'); }
            else setAiError('Aucune recette du site ne correspond. Reformule ta demande.');
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
        rec.lang = 'fr-FR'; rec.interimResults = false; rec.maxAlternatives = 1;
        rec.onstart = () => setIsListening(true);
        rec.onend = () => { setIsListening(false); recognitionRef.current = null; };
        rec.onerror = () => { setIsListening(false); recognitionRef.current = null; };
        rec.onresult = (e: any) => {
            const transcript = e.results?.[0]?.[0]?.transcript || '';
            if (transcript) setAiQuery(transcript);
        };
        recognitionRef.current = rec;
        try { rec.start(); } catch {}
    };

    // Lancement auto : 1s d'inactivité après frappe/dictée → recherche IA.
    useEffect(() => {
        if (mode !== 'assistant') return;
        const q = aiQuery.trim();
        if (q.length < 3) return;
        const t = setTimeout(() => askAssistant(q), 1000);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aiQuery, mode]);

    // Mode recette
    const filteredRecipes = useMemo(() => {
        if (mode !== 'recipe') return [];
        let pool = mockRecipes.filter((r) => r.category !== 'restaurant');
        if (activeFilter) {
            const af = normalize(activeFilter);
            pool = pool.filter((r) =>
                normalize(r.category || '') === af ||
                (r.tags || []).some((t: string) => normalize(t).includes(af)));
        }
        if (query.trim().length > 1) {
            const q = normalize(query.trim());
            pool = pool.filter((r) =>
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
        const tags = ingTags.map((t) => t.toLowerCase());
        return mockRecipes
            .filter((r) => r.category !== 'restaurant')
            .map((r) => {
                const ingNames = r.ingredients.map((i) => i.name.toLowerCase());
                const matched = tags.filter((tag) => ingNames.some((n) => n.includes(tag)));
                return { recipe: r, matched: matched.length };
            })
            .filter(({ matched }) => matched > 0)
            .sort((a, b) => b.matched - a.matched)
            .slice(0, 12);
    }, [ingTags, mode]);

    const addIngTag = () => {
        const val = ingInput.trim().toLowerCase();
        if (val && !ingTags.includes(val)) setIngTags((prev) => [...prev, val]);
        setIngInput('');
    };

    const pick = (recipe: Recipe) => { haptic(8); onRecipeSelect(recipe); onClose(); };

    // Ouverture : focus + page figée. Fermeture : on réinitialise tout.
    useEffect(() => {
        if (open) {
            const t = setTimeout(() => inputRef.current?.focus(), 320);
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; clearTimeout(t); };
        }
        setQuery(''); setIngTags([]); setIngInput(''); setMode('recipe');
        setActiveGroup(null); setActiveFilter('');
        setAiQuery(''); setAiResults([]); setAiMessage(''); setAiError('');
        try { recognitionRef.current?.stop(); } catch {}
        setIsListening(false);
    }, [open]);

    // Une ligne de résultat (image + drapeau + titre + méta).
    const ResultItem = ({ recipe, meta }: { recipe: Recipe; meta: string }) => {
        return (
            <button className={styles.spItem} onClick={() => pick(recipe)}>
                <div className={styles.spThumbWrap}>
                    <img src={recipe.image} alt="" className={styles.spThumb} loading="lazy" decoding="async" draggable={false} />
                </div>
                <div className={styles.spInfo}>
                    <div className={styles.spTitle}>{decodeHtml(recipe.title)}</div>
                    <div className={styles.spMeta}>{meta}</div>
                </div>
            </button>
        );
    };

    const recipeMeta = (r: Recipe) =>
        r.category === 'restaurant'
            ? (r.restaurant?.subType ? `restaurant • ${r.restaurant.subType}` : 'restaurant')
            : `${r.category} • ${r.difficulty}`;

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className={styles.spRoot}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
                >
                    {/* Champ + Terminé */}
                    <div className={styles.spHead}>
                        <div className={styles.spField}>
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" className={styles.spFieldIcon} aria-hidden>
                                <path d="M21 21l-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {mode === 'assistant' ? (
                                <input
                                    ref={inputRef} type="text" className={styles.spInput}
                                    placeholder="Dis-moi ton envie… ex : un plat rapide au poulet"
                                    value={aiQuery} onChange={(e) => setAiQuery(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); askAssistant(); } }}
                                    enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false}
                                />
                            ) : mode === 'recipe' ? (
                                <input
                                    ref={inputRef} type="text" className={styles.spInput}
                                    placeholder="Rechercher une recette"
                                    value={query} onChange={(e) => setQuery(e.target.value)}
                                    enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false}
                                />
                            ) : (
                                <input
                                    ref={inputRef} type="text" className={styles.spInput}
                                    placeholder="Ajouter un ingrédient (Entrée)"
                                    value={ingInput} onChange={(e) => setIngInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addIngTag(); } }}
                                    enterKeyHint="done" autoComplete="off" autoCorrect="off" spellCheck={false}
                                />
                            )}
                            {mode === 'assistant' && (
                                <button
                                    className={`${styles.spMic} ${isListening ? styles.spMicOn : ''}`}
                                    onClick={toggleVoice} aria-label="Dicter"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <button className={styles.spCancel} onClick={onClose}>Terminé</button>
                    </div>

                    {/* Segmented control : mode */}
                    <div className={styles.spSegment}>
                        {([['recipe', 'Recette'], ['ingredients', 'Ingrédients'], ['assistant', 'Assistant']] as [Mode, string][]).map(([m, lbl]) => (
                            <button
                                key={m}
                                className={`${styles.spSeg} ${mode === m ? styles.spSegOn : ''}`}
                                onClick={() => {
                                    haptic(8);
                                    setMode(m); setActiveGroup(null); setActiveFilter('');
                                    setTimeout(() => inputRef.current?.focus(), 50);
                                }}
                            >{lbl}</button>
                        ))}
                    </div>

                    {/* Groupes + chips (mode recette) */}
                    {mode === 'recipe' && (
                        <div className={styles.spGroups}>
                            {(['categorie', 'pays', 'tendances'] as FilterGroup[]).map((g) => (
                                <button
                                    key={g}
                                    className={`${styles.spGroup} ${activeGroup === g ? styles.spGroupOn : ''}`}
                                    onClick={() => {
                                        haptic(8);
                                        if (activeGroup === g) { setActiveGroup(null); setActiveFilter(''); }
                                        else { setActiveGroup(g); setActiveFilter(''); setQuery(''); }
                                    }}
                                >{g === 'categorie' ? 'Catégorie' : g === 'pays' ? 'Pays' : 'Tendances'}</button>
                            ))}
                        </div>
                    )}

                    {mode === 'recipe' && activeGroup && (
                        <div className={styles.spChips}>
                            {(activeGroup === 'tendances'
                                ? [...FILTER_GROUPS[activeGroup]].sort((a, b) =>
                                    a.label.replace(/^[^\p{L}]+/u, '').localeCompare(b.label.replace(/^[^\p{L}]+/u, ''), 'fr'))
                                : FILTER_GROUPS[activeGroup]
                            ).map((f) => (
                                <button
                                    key={f.tag}
                                    className={`${styles.spChip} ${activeFilter === f.tag ? styles.spChipOn : ''}`}
                                    onClick={() => { haptic(8); setActiveFilter(activeFilter === f.tag ? '' : f.tag); }}
                                >{stripEmoji(f.label)}</button>
                            ))}
                        </div>
                    )}

                    {mode === 'ingredients' && ingTags.length > 0 && (
                        <div className={styles.spChips}>
                            {ingTags.map((tag) => (
                                <span key={tag} className={`${styles.spChip} ${styles.spChipOn}`}>
                                    {tag}
                                    <button className={styles.spTagX} onClick={() => setIngTags((p) => p.filter((t) => t !== tag))} aria-label="Retirer">✕</button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Résultats */}
                    <div className={styles.spResults}>
                        {mode === 'assistant' && (
                            <>
                                {aiBusy && <div className={styles.spHint}>L'assistant cherche…</div>}
                                {!aiBusy && aiMessage && <div className={styles.spAiMsg}>{aiMessage}</div>}
                                {!aiBusy && aiError && <div className={styles.spEmpty}>{aiError}</div>}
                                {!aiBusy && !aiResults.length && !aiError && (
                                    <div className={styles.spEmpty}>Décris ton envie (ou dicte) : « un dessert au chocolat sans gluten », « plat italien rapide »…</div>
                                )}
                                {aiResults.map((r) => <ResultItem key={r.id} recipe={r} meta={recipeMeta(r)} />)}
                            </>
                        )}

                        {mode === 'recipe' && (
                            <>
                                {query.trim().length <= 1 && !activeFilter && (
                                    <div className={styles.spHint}>Dernières recettes publiées</div>
                                )}
                                {filteredRecipes.length > 0
                                    ? filteredRecipes.map((r) => <ResultItem key={r.id} recipe={r} meta={recipeMeta(r)} />)
                                    : <div className={styles.spEmpty}>Aucune recette ne correspond…</div>}
                            </>
                        )}

                        {mode === 'ingredients' && (
                            <>
                                {ingTags.length === 0 ? (
                                    <div className={styles.spEmpty}>Tape un ingrédient et valide (Entrée)</div>
                                ) : ingredientResults.length > 0
                                    ? ingredientResults.map(({ recipe, matched }) => (
                                        <ResultItem key={recipe.id} recipe={recipe} meta={`${recipe.category} • ${matched}/${ingTags.length} ingrédient${ingTags.length > 1 ? 's' : ''}`} />
                                    ))
                                    : <div className={styles.spEmpty}>Aucune recette avec ces ingrédients</div>}
                            </>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
