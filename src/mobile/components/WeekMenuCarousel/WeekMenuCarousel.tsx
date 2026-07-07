'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, MotionValue } from 'framer-motion';
import { decodeHtml } from '@/mobile/lib/utils';
import { parseIngredient, getIngIcon, buildConsolidatedItems, cleanIngredientText, expandIngredientLines } from '@/mobile/lib/ingredients';
import type { ConsolItem } from '@/mobile/lib/ingredients';
import ShopActions from '@/mobile/components/ShopActions/ShopActions';
import styles from './WeekMenuCarousel.module.css';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const FULL: Record<string, string> = { Lun: 'Lundi', Mar: 'Mardi', Mer: 'Mercredi', Jeu: 'Jeudi', Ven: 'Vendredi', Sam: 'Samedi', Dim: 'Dimanche' };
const MEALS = ['Midi', 'Soir'] as const;
const GAP = 16;

type Plan = Record<string, Record<string, any>>;

// Ligne d'affichage depuis une chaîne brute (ingrédient déjà découpé).
const lineFromRaw = (piece: string) => {
    const p = parseIngredient(piece);
    return { icon: getIngIcon(p.name), name: cleanIngredientText(piece) };
};

const openRecipe = (recipe: any) => {
    if (!recipe?.id) return;
    window.dispatchEvent(new CustomEvent('openRecipeFromPlanner', { detail: recipe }));
};

// Consolide les ingrédients de créneaux donnés (clé réelle `day|meal`) en lignes.
// On passe le set `checked` pour EXCLURE les ingrédients rayés (cochés) : ils ne
// doivent ni partir sur Carrefour ni être partagés.
const consolidateSlots = (
    slots: { day: string; meal: string; recipe: any }[],
    checked: Set<string>,
): ConsolItem[] => {
    const wp: Record<string, Record<string, any>> = {};
    slots.forEach(({ day, meal, recipe }) => {
        if (!recipe) return;
        wp[day] = wp[day] || {};
        wp[day][meal] = recipe;
    });
    return buildConsolidatedItems(wp, checked, {});
};

function MealBlock({ day, label, recipe, slotKey, isSelected, onSelect, done, ingSel, onToggleDone, onToggleIngSel, onShopped }: { day: string; label: string; recipe: any; slotKey: string; isSelected: boolean; onSelect: (key: string) => void; done: Set<string>; ingSel: Set<string>; onToggleDone: (key: string) => void; onToggleIngSel: (key: string) => void; onShopped: (item: ConsolItem) => void }) {
    const prodNameRaw = (s: string) => parseIngredient(s).name || s;
    // Découpe les blocs groupés en ingrédients individuels (clés `day|label|origIdx|sub`
    // = exactement celles de la consolidation/courses), puis tri alphabétique par nom.
    // L'accompagnement (recipe.side, Menu IA) ajoute ses ingrédients avec clés `s`-préfixées.
    const rows = [
        ...(recipe?.ingredients || []).map((ing: any, origIdx: number) => ({ ing, origIdx: `${origIdx}` })),
        ...((recipe?.side?.ingredients || []).map((ing: any, origIdx: number) => ({ ing, origIdx: `s${origIdx}` }))),
    ]
        .filter((x: any) => x.ing?.name)
        .flatMap(({ ing, origIdx }: any) =>
            expandIngredientLines(`${ing.quantity || ''} ${ing.name || ''}`.trim())
                .map((piece: string, sub: number) => ({ piece, key: `${day}|${label}|${origIdx}|${sub}` }))
        )
        .sort((a: { piece: string }, b: { piece: string }) =>
            prodNameRaw(a.piece).localeCompare(prodNameRaw(b.piece), 'fr', { sensitivity: 'base' }));
    return (
        <div className={styles.meal}>
            <div className={styles.mealHead}>
                <span className={styles.mealTag}>{label}</span>
                {recipe && (
                    <button
                        className={`${styles.selectBtn} ${isSelected ? styles.selectBtnOn : ''}`}
                        onClick={(e) => { e.stopPropagation(); onSelect(slotKey); }}
                        title="Sélectionner la recette pour faire les courses ensemble"
                    >
                        {isSelected ? '✓ Recette' : '+ Recette'}
                    </button>
                )}
            </div>
            {recipe ? (
                <div className={styles.mealBody}>
                    <button className={styles.vignette} onClick={() => openRecipe(recipe)}>
                        {recipe.image
                            ? <img src={recipe.image} alt={recipe.title} className={styles.vignetteImg} />
                            : <div className={styles.vignetteFallback}>🍽</div>}
                        <span className={styles.vignetteTitle}>{decodeHtml(recipe.title)}</span>
                    </button>
                    {/* Accompagnement suggéré (Menu IA) — cliquable vers sa fiche */}
                    {recipe.side && (
                        <button className={styles.sideRow} onClick={() => openRecipe(recipe.side)}>
                            {recipe.side.image
                                ? <img src={recipe.side.image} alt={recipe.side.title} className={styles.sideRowThumb} />
                                : <span className={styles.sideRowFallback}>🥗</span>}
                            <span className={styles.sideRowMeta}>
                                <span className={styles.sideRowBadge}>Accompagnement</span>
                                <span className={styles.sideRowName}>{decodeHtml(recipe.side.title)}</span>
                            </span>
                        </button>
                    )}
                    <motion.ul
                        className={styles.ingList}
                        initial="hidden"
                        animate="show"
                        variants={{ show: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } } }}
                    >
                        {rows.map(({ piece, key }: { piece: string; key: string }) => {
                            const l = lineFromRaw(piece);
                            const isDone = done.has(key);
                            const isSel = ingSel.has(key);
                            return (
                                <motion.li
                                    key={key}
                                    className={`${styles.ingItem} ${isDone ? styles.ingChecked : ''} ${isSel ? styles.ingSelected : ''}`}
                                    variants={{ hidden: { opacity: 0, x: 12 }, show: { opacity: 1, x: 0 } }}
                                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                                >
                                    {/* Clic nom/pilule = rayer (fait) */}
                                    <span className={styles.ingIcon} onClick={() => onToggleDone(key)}>{l.icon}</span>
                                    <span className={styles.ingName} onClick={() => onToggleDone(key)}>{l.name}</span>
                                    {/* Clic cercle = sélectionner (cible Carrefour) */}
                                    <button className={styles.ingCheck} onClick={(e) => { e.stopPropagation(); onToggleIngSel(key); }} aria-label="Sélectionner">
                                        {isSel && (
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                    </button>
                                </motion.li>
                            );
                        })}
                    </motion.ul>
                    {/* Courses pour cette recette seule */}
                    <ShopActions items={consolidateSlots([{ day, meal: label, recipe }], new Set())} title={decodeHtml(recipe.title)} checkedKeys={ingSel} onShopped={onShopped} />
                </div>
            ) : (
                <div className={styles.mealEmpty}>Pas de recette</div>
            )}
        </div>
    );
}

function DayCard({ day, plan, index, scrollX, step, selected, onSelect, done, ingSel, onToggleDone, onToggleIngSel, onShopped, onDayClick }: { day: string; plan: Plan; index: number; scrollX: MotionValue<number>; step: number; selected: Set<string>; onSelect: (key: string) => void; done: Set<string>; ingSel: Set<string>; onToggleDone: (key: string) => void; onToggleIngSel: (key: string) => void; onShopped: (item: ConsolItem) => void; onDayClick?: (i: number) => void }) {
    const s = step || 1;
    const scale = useTransform(scrollX, [(index - 1) * s, index * s, (index + 1) * s], [0.92, 1, 0.92], { clamp: true });
    const opacity = useTransform(scrollX, [(index - 1) * s, index * s, (index + 1) * s], [0.55, 1, 0.55], { clamp: true });
    const dayPlan = plan[day] || {};
    const isJourJ = day === 'JourJ';
    // Jour J : les "créneaux" sont les catégories (Apéritif, Entrée, Plat…) ; sinon Midi/Soir.
    const mealLabels: string[] = isJourJ ? Object.keys(dayPlan) : (MEALS as readonly string[]).slice();
    const title = isJourJ ? 'Jour J' : FULL[day];
    const daySlots = mealLabels.map(m => ({ day, meal: m, recipe: dayPlan[m] })).filter(s => s.recipe);
    return (
        <motion.div className={styles.card} style={{ scale, opacity }}>
            <div className={styles.cardHeader}>
                <span
                    className={styles.dayFull}
                    onClick={() => onDayClick?.(index)}
                    style={onDayClick ? { cursor: 'pointer' } : undefined}
                    title="Aller à ce jour"
                >{title}</span>
            </div>
            <div className={styles.meals}>
                {mealLabels.map(m => (
                    <MealBlock
                        key={m}
                        day={day}
                        label={m}
                        recipe={dayPlan[m]}
                        slotKey={`${day}|${m}`}
                        isSelected={selected.has(`${day}|${m}`)}
                        onSelect={onSelect}
                        done={done}
                        ingSel={ingSel}
                        onToggleDone={onToggleDone}
                        onToggleIngSel={onToggleIngSel}
                        onShopped={onShopped}
                    />
                ))}
            </div>
            {/* Courses pour toute la journée / tout le Jour J */}
            {daySlots.length > 0 && (
                <div className={styles.dayShop}>
                    <span className={styles.dayShopLabel}>{isJourJ ? 'Courses Jour J' : `Courses du ${FULL[day].toLowerCase()}`}</span>
                    <ShopActions items={consolidateSlots(daySlots, new Set())} title={isJourJ ? 'Courses Jour J' : `Courses ${FULL[day]}`} checkedKeys={ingSel} onShopped={onShopped} />
                </div>
            )}
        </motion.div>
    );
}

export default function WeekMenuCarousel() {
    const [plan, setPlan] = useState<Plan>({});
    const [active, setActive] = useState(0);
    const [step, setStep] = useState(0);
    const [done, setDone] = useState<Set<string>>(new Set());     // rayé/fait (persisté 'shop-done')
    const [ingSel, setIngSel] = useState<Set<string>>(new Set()); // ingrédients cochés (cible Carrefour)
    const [selected, setSelected] = useState<Set<string>>(new Set()); // recettes sélectionnées
    const [jourjFused, setJourjFused] = useState(true);
    const trackRef = useRef<HTMLDivElement>(null);
    const cardEls = useRef<(HTMLDivElement | null)[]>([]);
    const didFocus = useRef(false);
    const scrollX = useMotionValue(0);

    useEffect(() => {
        const read = () => {
            try { setPlan(JSON.parse(localStorage.getItem('meal-planner-week') || '{}')); } catch { setPlan({}); }
            try { setDone(new Set(JSON.parse(localStorage.getItem('shop-done') || '[]'))); } catch {}
            setJourjFused(localStorage.getItem('jourj-in-fused') !== 'false');
        };
        read();
        window.addEventListener('shoppingListUpdated', read);
        window.addEventListener('storage', read);
        return () => { window.removeEventListener('shoppingListUpdated', read); window.removeEventListener('storage', read); };
    }, []);

    // Clic sur le nom/pilule = rayer (fait). Persisté, reste visible barré.
    const toggleDone = (key: string) => {
        setDone(prev => {
            const n = new Set(prev);
            n.has(key) ? n.delete(key) : n.add(key);
            localStorage.setItem('shop-done', JSON.stringify(Array.from(n)));
            window.dispatchEvent(new Event('shoppingListUpdated'));
            return n;
        });
    };
    // Clic sur le CERCLE = sélectionner (cible Carrefour/partage).
    const toggleIngSel = (key: string) => {
        setIngSel(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    };
    // Recherché sur Carrefour → rayer toutes les clés de la ligne.
    const onShopped = (item: ConsolItem) => {
        setDone(prev => {
            const n = new Set(prev);
            (item.keys.length ? item.keys : []).forEach(k => n.add(k));
            localStorage.setItem('shop-done', JSON.stringify(Array.from(n)));
            window.dispatchEvent(new Event('shoppingListUpdated'));
            return n;
        });
    };

    const toggleSelect = (key: string) => {
        setSelected(prev => {
            const n = new Set(prev);
            n.has(key) ? n.delete(key) : n.add(key);
            return n;
        });
    };

    // Recettes sélectionnées (clé `day|meal`) → créneaux pour courses groupées
    const selectedSlots = Array.from(selected)
        .map(k => { const [day, meal] = k.split('|'); return { day, meal, recipe: plan[day]?.[meal] }; })
        .filter(s => s.recipe);

    // mesure du pas (largeur carte + gap)
    useEffect(() => {
        const measure = () => { if (cardEls.current[0]) setStep(cardEls.current[0]!.offsetWidth + GAP); };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [plan]);

    const onScroll = () => {
        const el = trackRef.current;
        if (!el) return;
        scrollX.set(el.scrollLeft);
        // carte dont le centre est le plus proche du centre du viewport
        const center = el.scrollLeft + el.clientWidth / 2;
        let best = 0, bestDist = Infinity;
        cardEls.current.forEach((c, i) => {
            if (!c) return;
            const cc = c.offsetLeft + c.offsetWidth / 2;
            const d = Math.abs(cc - center);
            if (d < bestDist) { bestDist = d; best = i; }
        });
        setActive(best);
    };

    const goTo = (i: number) => {
        const track = trackRef.current;
        const card = cardEls.current[i];
        if (!track || !card) return;
        // scroll HORIZONTAL du track seulement (jamais la page verticalement)
        const tr = track.getBoundingClientRect();
        const cr = card.getBoundingClientRect();
        const delta = (cr.left + cr.width / 2) - (tr.left + tr.width / 2);
        track.scrollTo({ left: track.scrollLeft + delta, behavior: 'smooth' });
    };

    // Colonnes affichées : la semaine + éventuellement une section Jour J (si l'utilisateur
    // a choisi de NE PAS la fusionner) après Dimanche.
    const colHasRecipe = (c: string) => { const p = plan[c]; return !!p && Object.keys(p).length > 0; };
    const showJourJ = !jourjFused && colHasRecipe('JourJ');
    // Seuls les jours qui ont au moins une recette sont affichés (un jour supprimé
    // dans le planificateur n'a plus de recette → il disparaît de la semaine).
    const weekCols = DAYS.filter(colHasRecipe);
    const COLS = showJourJ ? [...weekCols, 'JourJ'] : weekCols;
    const segLabel = (c: string) => (c === 'JourJ' ? 'JJ' : c);
    const colFull = (c: string) => (c === 'JourJ' ? 'Jour J' : FULL[c]);

    // Affiche d'emblée le 1er jour qui a une recette (au lieu de Lun vide).
    useEffect(() => {
        if (didFocus.current || !step) return;
        const idx = COLS.findIndex(colHasRecipe);
        if (idx < 0) return;
        didFocus.current = true;
        if (idx === 0) return;
        const t = setTimeout(() => {
            const track = trackRef.current;
            const card = cardEls.current[idx];
            if (!track || !card || !track.clientWidth) return;
            const left = Math.max(0, card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2);
            track.scrollLeft = left;
            scrollX.set(left);
            setActive(idx);
        }, 150);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan, step]);

    const hasPlan = COLS.some(colHasRecipe);

    if (!hasPlan) {
        return (
            <div className={styles.empty}>
                <div className={styles.emptyIcon}>📅</div>
                <h2 className={styles.emptyTitle}>Aucun menu validé</h2>
                <p className={styles.emptySub}>Compose et valide une semaine dans le planificateur pour la voir ici.</p>
            </div>
        );
    }

    return (
        <div className={styles.wrap}>
            {/* Segmented jours */}
            <div className={styles.segmented}>
                {COLS.map((d, i) => (
                    <button
                        key={d}
                        className={`${styles.segBtn} ${active === i ? styles.segActive : ''} ${d === 'JourJ' ? styles.segJourJ : ''}`}
                        onClick={() => goTo(i)}
                    >{segLabel(d)}</button>
                ))}
            </div>

            <div ref={trackRef} className={styles.track} onScroll={onScroll}>
                {COLS.map((d, i) => (
                    <div key={d} ref={(el) => { cardEls.current[i] = el; }} className={styles.snap}>
                        <DayCard day={d} plan={plan} index={i} scrollX={scrollX} step={step} selected={selected} onSelect={toggleSelect} done={done} ingSel={ingSel} onToggleDone={toggleDone} onToggleIngSel={toggleIngSel} onShopped={onShopped} onDayClick={goTo} />
                    </div>
                ))}
            </div>

            {/* Points de pagination */}
            <div className={styles.dots}>
                {COLS.map((d, i) => (
                    <button key={d} aria-label={colFull(d)} onClick={() => goTo(i)}
                        className={`${styles.dot} ${active === i ? styles.dotActive : ''}`} />
                ))}
            </div>

            {/* Barre flottante : courses pour les recettes sélectionnées (ex. lun midi + jeu soir) */}
            {selectedSlots.length > 0 && (
                <div className={styles.selectionBar}>
                    <div className={styles.selectionInfo}>
                        <span className={styles.selectionCount}>{selectedSlots.length} recette{selectedSlots.length > 1 ? 's' : ''} sélectionnée{selectedSlots.length > 1 ? 's' : ''}</span>
                        <button className={styles.selectionClear} onClick={() => setSelected(new Set())}>Effacer</button>
                    </div>
                    <ShopActions items={consolidateSlots(selectedSlots, new Set())} title="Courses sélection" size="md" checkedKeys={ingSel} onShopped={onShopped} />
                </div>
            )}
        </div>
    );
}
