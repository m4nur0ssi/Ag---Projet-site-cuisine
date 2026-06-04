'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { mockRecipes } from '@/mobile/data/mockData';
import { decodeHtml } from '@/mobile/lib/utils';
import { normalizeIng, parseIngredient } from '@/mobile/lib/ingredients';
import { supabase } from '@/mobile/lib/supabase';
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

// Vue "Jour J" : une carte par catégorie de plat
const COURSES = [
    { label: 'Apéritif', emoji: '🍹', cat: 'aperitifs' },
    { label: 'Entrée', emoji: '🥗', cat: 'entrees' },
    { label: 'Plat', emoji: '🍽', cat: 'plats' },
    { label: 'Accompagnement', emoji: '🥘', tag: 'accompagnement' },
    { label: 'Dessert', emoji: '🍰', cat: 'desserts' },
    { label: 'Pâtisserie', emoji: '🥐', cat: 'patisserie' },
] as const;
const JOUR_J_KEY = 'JourJ';
const HIDDEN_KEY = 'meal-planner-jourj-hidden';
const SIDE_GROUPS: { key: FilterGroup; label: string }[] = [
    { key: 'tendances', label: 'Tendance' },
    { key: 'pays', label: 'Pays' },
];

interface WeekPlannerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function WeekPlanner({ isOpen, onClose }: WeekPlannerProps) {
    const [plan, setPlan] = useState<Plan>({});
    const [view, setView] = useState<'semaine' | 'jourj'>('semaine');
    const [validated, setValidated] = useState(false);
    const [sideGroup, setSideGroup] = useState<FilterGroup | null>(null);
    const [hiddenCourses, setHiddenCourses] = useState<string[]>([]);
    const [picker, setPicker] = useState<{ day: string; meal: string } | null>(null);
    const [query, setQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('');
    const [activeGroup, setActiveGroup] = useState<FilterGroup | null>(null);
    const [ingMode, setIngMode] = useState(false);
    const [ingTags, setIngTags] = useState<string[]>([]);
    const [ingInput, setIngInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        try { setHiddenCourses(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')); } catch {}
        const apply = (p: Plan) => { setPlan(p); setValidated(Object.keys(p).length > 0); };
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data } = await supabase
                    .from('meal_plans')
                    .select('plan')
                    .eq('user_id', session.user.id)
                    .maybeSingle();
                if (data?.plan) {
                    apply(data.plan);
                    localStorage.setItem('meal-planner-week', JSON.stringify(data.plan));
                    return;
                }
            }
            try { apply(JSON.parse(localStorage.getItem('meal-planner-week') || '{}')); } catch {}
        };
        load();
    }, [isOpen]);

    useEffect(() => {
        if (picker) setTimeout(() => inputRef.current?.focus(), 100);
    }, [picker]);

    // Une fois validé, un clic hors du planificateur le replie
    useEffect(() => {
        if (!isOpen || !validated) return;
        const onDown = (e: MouseEvent) => {
            if (picker) return; // ne pas fermer si le picker est ouvert
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
        };
        const id = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
        return () => { clearTimeout(id); document.removeEventListener('mousedown', onDown); };
    }, [isOpen, validated, picker, onClose]);

    const save = async (newPlan: Plan) => {
        setPlan(newPlan);
        localStorage.setItem('meal-planner-week', JSON.stringify(newPlan));
        // Plan modifié → la liste fusionnée + la pastille doivent se rafraîchir.
        window.dispatchEvent(new Event('shoppingListUpdated'));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await supabase.from('meal_plans').upsert({
                user_id: session.user.id,
                plan: newPlan,
                updated_at: new Date().toISOString(),
            });
        }
    };

    // Quand la recette d'un créneau change, on purge l'état coché ET barré de ce créneau
    // (clés `day|meal|idx`) : une recette qu'on (re)joue ne doit JAMAIS arriver
    // cochée/barrée. Vaut pour 'meal-week-checked' (Tout vider) et 'shop-done' (rayé).
    const clearSlotChecks = (predicate: (key: string) => boolean) => {
        let changed = false;
        ['meal-week-checked', 'shop-done'].forEach(storeKey => {
            try {
                const cur: string[] = JSON.parse(localStorage.getItem(storeKey) || '[]');
                const next = cur.filter(k => !predicate(k));
                if (next.length !== cur.length) {
                    localStorage.setItem(storeKey, JSON.stringify(next));
                    changed = true;
                }
            } catch {}
        });
        if (changed) window.dispatchEvent(new Event('shoppingListUpdated'));
    };

    const removeSlot = (day: string, meal: string) => {
        const np = { ...plan };
        if (np[day]) { delete np[day][meal]; if (!Object.keys(np[day]).length) delete np[day]; }
        clearSlotChecks(k => k.startsWith(`${day}|${meal}|`));
        save(np);
    };

    const assignRecipe = (recipe: any) => {
        if (!picker) return;
        const np = { ...plan };
        if (!np[picker.day]) np[picker.day] = {};
        np[picker.day][picker.meal] = recipe;
        clearSlotChecks(k => k.startsWith(`${picker.day}|${picker.meal}|`));
        save(np);
        closePicker();
    };

    const closePicker = () => {
        setPicker(null);
        setQuery(''); setActiveFilter(''); setActiveGroup(null);
        setIngTags([]); setIngInput(''); setIngMode(false);
    };

    const openRecipe = (recipe: any) => {
        if (!recipe?.id) return;
        // Même logique que l'accueil : ouvre la recette flottante (RecipeSheet),
        // pas de navigation vers /recipe/:id (qui garde la barre catégorie/pays).
        onClose();
        setTimeout(() => window.dispatchEvent(new CustomEvent('openRecipeFromPlanner', { detail: recipe })), 50);
    };

    const toggleCourse = (label: string) => {
        setHiddenCourses(prev => {
            const next = prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label];
            localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
            return next;
        });
        // si on supprime la carte, on vide aussi la recette du plan
        if (!hiddenCourses.includes(label)) removeSlot(JOUR_J_KEY, label);
    };

    const visibleCourses = COURSES.filter(c => !hiddenCourses.includes(c.label));

    const normalize = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    const pick = (pool: any[]) => pool[Math.floor(Math.random() * pool.length)];

    const shuffle = <T,>(arr: T[]) => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };

    // Exclut les fiches restaurant / vidéo sans vraie recette
    const isCookable = (r: any) =>
        (r.ingredients || []).length > 0 &&
        !(r.ingredients || []).some((i: any) => /détaillés dans la vidéo/i.test(i.name || ''));

    const matchesTheme = (r: any, theme?: string) => {
        if (!theme) return true;
        const t = normalize(theme);
        return normalize(r.category || '') === t ||
            (r.tags || []).some((x: string) => normalize(x).includes(t));
    };

    // Remplit toute la semaine (midi + soir) avec des PLATS aléatoires, SANS doublon
    const fillWeek = (theme?: string) => {
        let plats = mockRecipes.filter(r => r.category === 'plats' && isCookable(r) && matchesTheme(r, theme));
        if (!plats.length) plats = mockRecipes.filter(r => r.category === 'plats' && isCookable(r));
        const shuffled = shuffle(plats);
        const slots: [string, string][] = [];
        DAYS.forEach(d => MEALS.forEach(m => slots.push([d, m])));
        const np: Plan = { ...plan };
        slots.forEach(([day, meal], i) => {
            np[day] = { ...(np[day] || {}) };
            np[day][meal] = shuffled[i % shuffled.length];
        });
        clearSlotChecks(k => !k.startsWith(`${JOUR_J_KEY}|`)); // semaine entière re-remplie
        save(np);
        setValidated(false);
    };

    // Remplit le Jour J : une recette aléatoire par catégorie visible, SANS doublon
    const fillJourJ = (theme?: string) => {
        const np: Plan = { ...plan };
        np[JOUR_J_KEY] = { ...(np[JOUR_J_KEY] || {}) };
        const used = new Set<string>();
        visibleCourses.forEach(c => {
            const inCourse = (r: any) => 'cat' in c ? r.category === c.cat : (r.tags || []).some((x: string) => normalize(x).includes(c.tag));
            let pool = mockRecipes.filter(r => inCourse(r) && isCookable(r) && matchesTheme(r, theme) && !used.has(r.id));
            if (!pool.length) pool = mockRecipes.filter(r => inCourse(r) && isCookable(r) && !used.has(r.id));
            if (!pool.length) pool = mockRecipes.filter(r => inCourse(r) && isCookable(r));
            if (pool.length) { const r = pick(pool); used.add(r.id); np[JOUR_J_KEY][c.label] = r; }
        });
        clearSlotChecks(k => k.startsWith(`${JOUR_J_KEY}|`));
        save(np);
        setValidated(false);
    };

    const fill = (theme?: string) => view === 'semaine' ? fillWeek(theme) : fillJourJ(theme);

    // ── Mise à jour de la liste de courses au moment du "Valider" ──
    const collectViewRecipes = () => {
        const map = new Map<string, { recipe: any; count: number }>();
        const add = (r: any) => { if (!r?.id) return; const e = map.get(r.id); map.set(r.id, { recipe: r, count: (e?.count || 0) + 1 }); };
        if (view === 'semaine') DAYS.forEach(d => MEALS.forEach(m => add(plan[d]?.[m])));
        else visibleCourses.forEach(c => add(plan[JOUR_J_KEY]?.[c.label]));
        return Array.from(map.values());
    };

    const addPlanToShoppingList = () => {
        const recipes = collectViewRecipes();
        if (!recipes.length) return;
        let data: Record<string, any> = {};
        try { data = JSON.parse(localStorage.getItem('magic-shopping-list') || '{}'); } catch {}
        // La liste fusionnée relit les ingrédients planifiés DEPUIS le plan (meal-planner-week).
        // On ne duplique donc PAS les ingrédients dans magic-shopping-list, et on purge les
        // anciennes entrées issues du planificateur (sinon ingrédients de recettes
        // supprimées/remplacées restent indéfiniment → ex. 80 ingrédients fantômes).
        Object.keys(data).forEach(k => {
            if (data[k]?.source === 'planner' || data[k]?.count != null) delete data[k];
        });
        // Compte le nombre de LIGNES distinctes du plan courant (pour le toast)
        const lineKeys = new Set<string>();
        recipes.forEach(({ recipe }) => {
            (recipe.ingredients || []).forEach((i: any) => {
                if (!i?.name) return;
                const p = parseIngredient(`${i.quantity || ''} ${i.name || ''}`.trim());
                if (p.name) lineKeys.add(`${normalizeIng(p.name)}|${p.unit}`);
            });
        });
        const total = lineKeys.size;
        localStorage.setItem('magic-shopping-list', JSON.stringify(data));
        window.dispatchEvent(new Event('shoppingListUpdated'));
        window.dispatchEvent(new CustomEvent('magic-toast-notify', {
            detail: `${total} ingrédient${total > 1 ? 's' : ''} ajouté${total > 1 ? 's' : ''} à ta liste 🛒`,
        }));
    };

    // Verrou de catégorie quand le picker est ouvert depuis une carte Jour J
    const courseLock = picker?.day === JOUR_J_KEY
        ? COURSES.find(c => c.label === picker.meal) || null
        : null;

    const searchResults = useMemo(() => {
        let base = mockRecipes.filter(r => r.category !== 'restaurant');
        if (courseLock) {
            base = base.filter(r => isCookable(r) && (
                'cat' in courseLock
                    ? r.category === courseLock.cat
                    : (r.tags || []).some((x: string) => normalize(x).includes(courseLock.tag))
            ));
        }
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
    }, [query, activeFilter, ingMode, ingTags, picker]);

    if (!isOpen) return null;

    return (
        <>
            {/* Panneau inline semaine */}
            <div className={styles.weekPanel} ref={panelRef}>
                <div className={styles.weekPanelInner}>
                    {/* Actions haut-droite : Valider/Modifier + fermer */}
                    <div className={styles.topRight}>
                        <button className={styles.actionBtn} onClick={() => {
                            const next = !validated;
                            setValidated(next);
                            if (next) {
                                // En vue Jour J : demande si on fusionne ces courses ou si on garde
                                // une section Jour J séparée (après Dimanche) dans la liste de courses.
                                if (view === 'jourj') {
                                    const inFused = window.confirm('Ajouter les courses du Jour J à la liste fusionnée ?\n\nOK = oui (fusionnées avec la semaine)\nAnnuler = non (section Jour J séparée)');
                                    localStorage.setItem('jourj-in-fused', inFused ? 'true' : 'false');
                                }
                                addPlanToShoppingList();
                            }
                        }}>
                            {validated ? '✎ Modifier' : '✓ Valider'}
                        </button>
                        <button className={styles.weekCloseBtn} onClick={onClose}>✕</button>
                    </div>

                    {/* Bascule de vue + outils aléatoire/thème (édition uniquement), centrés au-dessus des jours */}
                    <div className={styles.controlsRow}>
                        <div className={styles.viewToggle}>
                            <button
                                className={`${styles.viewBtn} ${view === 'semaine' ? styles.viewBtnActive : ''}`}
                                onClick={() => setView('semaine')}
                            >Les recettes de la semaine</button>
                            <button
                                className={`${styles.viewBtn} ${view === 'jourj' ? styles.viewBtnActive : ''}`}
                                onClick={() => setView('jourj')}
                            >Jour J</button>
                        </div>

                        {!validated && (
                            <div className={styles.toolbar}>
                                <button className={styles.randomBtn} onClick={() => fill()}>
                                    🎲 Aléatoire
                                </button>
                                {SIDE_GROUPS.map(g => (
                                    <button
                                        key={g.key}
                                        className={`${styles.sideGroupBtn} ${sideGroup === g.key ? styles.sideGroupActive : ''}`}
                                        onClick={() => setSideGroup(sideGroup === g.key ? null : g.key)}
                                    >
                                        {g.label}
                                        <span className={styles.chevron}>{sideGroup === g.key ? '▴' : '▾'}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Chips de thème, dépliés sous la barre d'outils */}
                    {!validated && sideGroup && (
                        <div className={styles.themeChipsRow}>
                            {FILTER_GROUPS[sideGroup].map(f => (
                                <button key={f.tag} className={styles.themeBubble} onClick={() => fill(f.tag)}>
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className={styles.layoutRow}>
                        {/* Zone principale : calendrier ou jour J */}
                        <div className={styles.mainArea}>
                            {view === 'semaine' ? (
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
                                                                className={`${styles.recipeVignette} ${validated ? styles.clickable : ''}`}
                                                                onClick={() => validated ? openRecipe(recipe) : setPicker({ day, meal })}
                                                            >
                                                                <img src={recipe.image} alt={recipe.title} className={styles.vignetteImg} />
                                                                <div className={styles.vignetteTitle}>{decodeHtml(recipe.title)}</div>
                                                                {!validated && (
                                                                    <button className={styles.removeVignette} onClick={e => { e.stopPropagation(); removeSlot(day, meal); }}>✕</button>
                                                                )}
                                                            </div>
                                                        ) : validated ? (
                                                            <div className={styles.emptySlotMuted}><span className={styles.emptyText}>—</span></div>
                                                        ) : (
                                                            <button className={styles.emptySlot} onClick={() => setPicker({ day, meal })}>
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
                            ) : (
                                <>
                                    <div className={styles.daysRow}>
                                        {visibleCourses.map(c => {
                                            const recipe = plan[JOUR_J_KEY]?.[c.label];
                                            return (
                                                <div key={c.label} className={`${styles.dayCard} ${styles.jourJCard}`}>
                                                    <button
                                                        className={`${styles.dayName} ${styles.courseTitle} ${styles.courseTitleBtn}`}
                                                        onClick={() => setPicker({ day: JOUR_J_KEY, meal: c.label })}
                                                        title={`Chercher une recette ${c.label.toLowerCase()}`}
                                                    >{c.label}</button>
                                                    <div className={styles.mealSlot}>
                                                        {!validated && (
                                                            <button className={styles.deleteCourse} title="Supprimer cette carte" onClick={() => toggleCourse(c.label)}>✕</button>
                                                        )}
                                                        {recipe ? (
                                                            <div
                                                                className={`${styles.recipeVignette} ${styles.jourJVignette} ${validated ? styles.clickable : ''}`}
                                                                onClick={() => validated ? openRecipe(recipe) : setPicker({ day: JOUR_J_KEY, meal: c.label })}
                                                            >
                                                                <img src={recipe.image} alt={recipe.title} className={`${styles.vignetteImg} ${styles.jourJImg}`} />
                                                                <div className={styles.vignetteTitle}>{decodeHtml(recipe.title)}</div>
                                                            </div>
                                                        ) : validated ? (
                                                            <div className={`${styles.emptySlotMuted} ${styles.jourJEmpty}`}><span className={styles.emptyText}>—</span></div>
                                                        ) : (
                                                            <button className={`${styles.emptySlot} ${styles.jourJEmpty}`} onClick={() => setPicker({ day: JOUR_J_KEY, meal: c.label })}>
                                                                <span className={styles.emptyPlus}>+</span>
                                                                <span className={styles.emptyText}>Pas de recette</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {!validated && hiddenCourses.length > 0 && (
                                        <div className={styles.addCourses}>
                                            <span className={styles.addLabel}>Ajouter :</span>
                                            {COURSES.filter(c => hiddenCourses.includes(c.label)).map(c => (
                                                <button key={c.label} className={styles.addCourseBtn} onClick={() => toggleCourse(c.label)}>+ {c.label}</button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
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

                        {/* Catégorie verrouillée (ouverture depuis une carte Jour J) */}
                        {courseLock && (
                            <div className={styles.lockBanner}>
                                🔒 Recettes : <strong>{courseLock.label}</strong> uniquement
                            </div>
                        )}

                        {/* Groupes Catégorie / Pays / Tendances */}
                        {!ingMode && !courseLock && (
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
                        {activeGroup && !ingMode && !courseLock && (
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
