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
    /**
     * Restreint le vivier de recettes proposées. Le planificateur s'en sert pour
     * n'offrir que des PLATS dans un créneau, ou que des ACCOMPAGNEMENTS quand on
     * complète une viande servie nue.
     */
    filter?: (recipe: Recipe) => boolean;
    /** Intitulé affiché à la place de « Terminé » (ex. « Choisir un plat »). */
    hint?: string;
    /** Mode d'ouverture (défaut « recipe »). « assistant » = recherche IA. */
    initialMode?: Mode;
    /** Démarre la dictée vocale automatiquement à l'ouverture (raccourci loupe). */
    autoVoice?: boolean;
    /**
     * `embedded` : rendu DANS le shell desktop TV+ (panneau, menu à gauche) au
     * lieu du calque plein écran. Plus de bouton « Terminé », plus de fond
     * verre, un en-tête titre + sous-titre — le moule des autres panneaux.
     */
    embedded?: boolean;
}

export default function TVSpotlight({ open, onClose, onRecipeSelect, filter, hint, initialMode, autoVoice, embedded = false }: TVSpotlightProps) {
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState<Mode>('recipe');
    const [ingTags, setIngTags] = useState<string[]>([]);
    const [ingInput, setIngInput] = useState('');
    const [activeGroup, setActiveGroup] = useState<FilterGroup | null>(null);
    // Multi-filtres cumulatifs (catégorie + pays + tendance combinés en ET).
    const [activeFilters, setActiveFilters] = useState<string[]>([]);
    const toggleFilter = (tag: string) =>
        setActiveFilters((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    const inputRef = useRef<HTMLInputElement>(null);

    // Assistant IA
    const [aiQuery, setAiQuery] = useState('');
    const [aiResults, setAiResults] = useState<Recipe[]>([]);
    const [aiMessage, setAiMessage] = useState('');
    const [aiBusy, setAiBusy] = useState(false);
    const [aiError, setAiError] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    /** Vivier de base : tout le catalogue, ou le sous-ensemble imposé par l'appelant. */
    const pool = useMemo(() => (filter ? mockRecipes.filter(filter) : mockRecipes), [filter]);
    const localSearch = (q: string) => smartLocalSearch(pool as any, q, 5) as Recipe[];

    const askAssistant = async (raw?: string) => {
        const q = (raw ?? aiQuery).trim();
        if (!q || aiBusy) return;
        setAiBusy(true); setAiError(''); setAiResults([]); setAiMessage('');
        try {
            const compact = buildFinderCatalog(pool as any);
            const res = await fetch('/api/recipe-finder', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ query: q, recipes: compact }),
            });
            if (!res.ok) throw new Error('api');
            const data = await res.json();
            const byId = new Map(pool.map((r) => [String(r.id), r]));
            let found = (data.ids || []).map((id: string) => byId.get(String(id))).filter(Boolean) as Recipe[];
            if (filter) found = found.filter(filter);
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

    const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const gotResultRef = useRef(false);

    const toggleVoice = () => {
        if (typeof window === 'undefined') return;
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) { setMode('assistant'); setAiError('La dictée vocale n\'est pas supportée ici (utilise Safari sur iPhone).'); return; }
        // Déjà en écoute → on coupe.
        if (isListening || recognitionRef.current) {
            try { recognitionRef.current?.stop(); } catch {}
            try { recognitionRef.current?.abort?.(); } catch {}
            recognitionRef.current = null;
            setIsListening(false);
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
            return;
        }
        // Mode assistant IA + coupe toute synthèse pour ne pas s'auto-écouter.
        setMode('assistant');
        setAiError(''); setAiResults([]); setAiMessage('');
        if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch {} }

        const rec = new SR();
        rec.lang = 'fr-FR';
        // iOS Safari : interimResults=true renvoie souvent RIEN. On reste en final
        // seul (bien plus fiable) ; le texte s'écrit à la fin de la phrase.
        rec.interimResults = false;
        rec.continuous = false;
        rec.maxAlternatives = 1;
        gotResultRef.current = false;

        rec.onstart = () => {
            setIsListening(true);
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
            // Rien capté après 9 s → on coupe et on explique.
            watchdogRef.current = setTimeout(() => {
                if (!gotResultRef.current) {
                    try { rec.stop(); } catch {}
                    try { rec.abort?.(); } catch {}
                    setAiError('Je n\'ai rien entendu. Réappuie sur le micro et parle près du téléphone.');
                }
            }, 9000);
        };
        rec.onresult = (e: any) => {
            gotResultRef.current = true;
            let text = '';
            for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
            text = text.trim();
            if (text) { setAiQuery(text); askAssistant(text); }
        };
        rec.onerror = (ev: any) => {
            const err = ev?.error;
            if (err === 'not-allowed' || err === 'service-not-allowed') {
                setAiError('Micro refusé. Autorise le micro pour Safari dans Réglages, puis réessaie.');
            } else if (err === 'no-speech' && !gotResultRef.current) {
                setAiError('Je n\'ai rien entendu. Réappuie et parle.');
            }
        };
        rec.onend = () => {
            setIsListening(false);
            recognitionRef.current = null;
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
        };

        recognitionRef.current = rec;
        try { rec.start(); } catch { setIsListening(false); recognitionRef.current = null; }
    };

    // Lancement auto : 0,7 s d'inactivité après frappe OU dictée → recherche IA,
    // sans jamais toucher « Entrée ».
    useEffect(() => {
        if (mode !== 'assistant') return;
        const q = aiQuery.trim();
        if (q.length < 3) return;
        const t = setTimeout(() => askAssistant(q), 700);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aiQuery, mode]);

    // Mode recette
    const filteredRecipes = useMemo(() => {
        if (mode !== 'recipe') return [];
        let pool2 = pool.filter((r) => r.category !== 'restaurant');
        // Chaque filtre coché doit matcher (ET) : « un dessert espagnol express ».
        for (const f of activeFilters) {
            const af = normalize(f);
            pool2 = pool2.filter((r) =>
                normalize(r.category || '') === af ||
                (r.tags || []).some((t: string) => normalize(t).includes(af)));
        }
        if (query.trim().length > 1) {
            const q = normalize(query.trim());
            pool2 = pool2.filter((r) =>
                normalize(r.title).includes(q) ||
                (r.tags || []).some((t: string) => normalize(t).includes(q)));
        }
        if (activeFilters.length === 0 && query.trim().length <= 1) {
            const sorted = [...pool2].sort((a, b) => parseInt(b.id) - parseInt(a.id));
            // Créneau du planificateur (filter imposé) → on montre TOUT le type
            // demandé (toutes les entrées, tous les plats…), pas seulement 10.
            return filter ? sorted : sorted.slice(0, 10);
        }
        return pool2;
    }, [query, mode, activeFilters, pool, filter]);

    // Mode ingrédients
    const ingredientResults = useMemo(() => {
        if (mode !== 'ingredients' || ingTags.length === 0) return [];
        const tags = ingTags.map((t) => t.toLowerCase());
        return pool
            .filter((r) => r.category !== 'restaurant')
            .map((r) => {
                const ingNames = r.ingredients.map((i) => i.name.toLowerCase());
                const has = (tag: string) => ingNames.some((n) => normalize(n).includes(normalize(tag)));
                const matched = tags.filter(has);
                // Ce qui manque, nommément : « il manque le fenouil » vaut mieux
                // qu'un simple 1/2, on sait quoi acheter.
                const missing = tags.filter((t) => !has(t));
                return { recipe: r, matched: matched.length, missing };
            })
            .filter(({ matched }) => matched > 0)
            // Recettes complètes d'abord, puis les plus proches.
            .sort((a, b) => b.matched - a.matched)
            .slice(0, 14);
    }, [ingTags, mode, pool]);

    const addIngTag = () => {
        const val = ingInput.trim().toLowerCase();
        if (val && !ingTags.includes(val)) setIngTags((prev) => [...prev, val]);
        setIngInput('');
    };

    const pick = (recipe: Recipe) => { haptic(8); onRecipeSelect(recipe); if (!embedded) onClose(); };

    // Ouverture : focus + page figée. Fermeture : on réinitialise tout.
    useEffect(() => {
        // En panneau, l'écran est toujours « ouvert » : on focalise le champ une
        // fois et on ne touche NI au scroll de la page NI à l'état saisi.
        if (embedded) {
            const t = setTimeout(() => inputRef.current?.focus(), 120);
            return () => clearTimeout(t);
        }
        if (open) {
            // Raccourci loupe : ouvre direct en mode assistant IA et lance la dictée.
            if (initialMode) setMode(initialMode);
            const t = setTimeout(() => inputRef.current?.focus(), 320);
            let tv: ReturnType<typeof setTimeout> | undefined;
            if (autoVoice) tv = setTimeout(() => toggleVoice(), 420);
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; clearTimeout(t); if (tv) clearTimeout(tv); };
        }
        setQuery(''); setIngTags([]); setIngInput(''); setMode('recipe');
        setActiveGroup(null); setActiveFilters([]);
        setAiQuery(''); setAiResults([]); setAiMessage(''); setAiError('');
        try { recognitionRef.current?.stop(); } catch {}
        setIsListening(false);
    }, [open, embedded]);

    // Une ligne de résultat (image + drapeau + titre + méta).
    const ResultItem = ({ recipe, meta, note }: { recipe: Recipe; meta: string; note?: string }) => {
        return (
            <button className={styles.spItem} onClick={() => pick(recipe)}>
                <div className={styles.spThumbWrap}>
                    <img src={recipe.image} alt="" className={styles.spThumb} loading="lazy" decoding="async" draggable={false} />
                </div>
                <div className={styles.spInfo}>
                    <div className={styles.spTitle}>{decodeHtml(recipe.title)}</div>
                    <div className={styles.spMeta}>{meta}</div>
                    {note && <div className={styles.spMissing}>{note}</div>}
                </div>
            </button>
        );
    };

    const recipeMeta = (r: Recipe) =>
        r.category === 'restaurant'
            ? (r.restaurant?.subType ? `restaurant • ${r.restaurant.subType}` : 'restaurant')
            : `${r.category} • ${r.difficulty}`;

    const body = (
        <>
                    {/* En panneau : gros titre + sous-titre, comme Favoris. */}
                    {embedded && (
                        <div className={styles.spPanelHead}>
                            <h1 className={styles.spPanelTitle}>Recherche</h1>
                            <p className={styles.spPanelSub}>Par mot, par ingrédients, ou en décrivant ton envie.</p>
                        </div>
                    )}

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
                                    placeholder="Riz, fenouil…"
                                    value={ingInput} onChange={(e) => setIngInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addIngTag(); } }}
                                    enterKeyHint="done" autoComplete="off" autoCorrect="off" spellCheck={false}
                                />
                            )}
                            {/* Valider sans clavier : les résultats se recalculent aussitôt. */}
                            {mode === 'ingredients' && ingInput.trim() && (
                                <button className={styles.spAdd} onClick={() => { haptic(8); addIngTag(); }} aria-label="Ajouter l'ingrédient">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </button>
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
                        {!embedded && <button className={styles.spCancel} onClick={onClose}>{hint || 'Terminé'}</button>}
                    </div>

                    {/* Segmented control : mode */}
                    <div className={styles.spSegment}>
                        {([['recipe', 'Recette'], ['ingredients', 'Ingrédients'], ['assistant', 'Assistant']] as [Mode, string][]).map(([m, lbl]) => (
                            <button
                                key={m}
                                className={`${styles.spSeg} ${mode === m ? styles.spSegOn : ''}`}
                                onClick={() => {
                                    haptic(8);
                                    setMode(m); setActiveGroup(null); setActiveFilters([]);
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
                                        // On ne vide PAS les filtres : ils sont cumulatifs entre groupes.
                                        if (activeGroup === g) setActiveGroup(null);
                                        else { setActiveGroup(g); setQuery(''); }
                                    }}
                                >{g === 'categorie' ? 'Catégorie' : g === 'pays' ? 'Pays' : 'Tendances'}
                                    {(() => {
                                        const n = FILTER_GROUPS[g].filter((f: any) => activeFilters.includes(f.tag)).length;
                                        return n > 0 ? <span className={styles.spGroupBadge}>{n}</span> : null;
                                    })()}
                                </button>
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
                                    className={`${styles.spChip} ${activeFilters.includes(f.tag) ? styles.spChipOn : ''}`}
                                    onClick={() => { haptic(8); toggleFilter(f.tag); }}
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
                                {aiBusy && <div className={styles.spHint}>L&apos;assistant cherche…</div>}
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
                                {query.trim().length <= 1 && activeFilters.length === 0 && (
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
                                    ? ingredientResults.map(({ recipe, matched, missing }) => (
                                        <ResultItem
                                            key={recipe.id}
                                            recipe={recipe}
                                            meta={`${recipe.category} • ${matched}/${ingTags.length} ingrédient${ingTags.length > 1 ? 's' : ''}`}
                                            note={missing.length ? `Il manque : ${missing.join(', ')}` : undefined}
                                        />
                                    ))
                                    : <div className={styles.spEmpty}>Aucune recette avec ces ingrédients</div>}
                            </>
                        )}
                    </div>
        </>
    );

    if (embedded) return <div className={styles.spEmbedded}>{body}</div>;

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
                    {body}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
