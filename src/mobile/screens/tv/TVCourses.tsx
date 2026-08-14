'use client';

/**
 * Liste de courses « Apple TV+ » — TEST DE DESIGN (route /tv-courses, local).
 *
 * Mêmes fonctions que la liste du site, même stockage : `magic-shopping-list`
 * (ajouts manuels), `meal-planner-week` (plan), `meal-week-checked` (lignes
 * consommées), `shop-done` (rayé). Le moteur de fusion est celui de la prod
 * (`buildConsolidatedItems`), donc les quantités s'additionnent à l'identique
 * et les deux écrans restent interchangeables.
 *
 * Deux vues :
 *   • Semaine — tout fusionné, rangé par rayon de supermarché.
 *   • Jour    — un jour par écran, les ingrédients repas par repas.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
    buildConsolidatedItems, doneKeysOf, isItemDone, fmtQty,
    parseIngredient, cleanIngredientText, getIngIcon,
    type ConsolItem,
} from '@/mobile/lib/ingredients';
import { RAYON_BY_ID, RAYON_ORDER, rayonOf, readRayonOverrides } from '@/lib/rayons';
import { decodeHtml } from '@/mobile/lib/utils';
import { haptic } from './TVHome';
import styles from './tv.module.css';

const ShopActions = dynamic(() => import('@/mobile/components/ShopActions/ShopActions'), { ssr: false });

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

/** Index du jour courant, semaine commençant le lundi. */
const todayIndex = () => (new Date().getDay() + 6) % 7;
const DAY_FULL: Record<string, string> = {
    Lun: 'Lundi', Mar: 'Mardi', Mer: 'Mercredi', Jeu: 'Jeudi',
    Ven: 'Vendredi', Sam: 'Samedi', Dim: 'Dimanche',
};

type ListData = Record<string, {
    title: string;
    image?: string;
    ingredients: ({ name: string; checked?: boolean } | string)[];
    source?: 'planner' | 'manuel';
}>;

export default function TVCourses() {
    const router = useRouter();
    const [mode, setMode] = useState<'semaine' | 'jour' | 'recette'>('semaine');
    const [list, setList] = useState<ListData>({});
    const [plan, setPlan] = useState<Record<string, Record<string, any>>>({});
    const [weekChecked, setWeekChecked] = useState<Set<string>>(new Set());
    const [done, setDone] = useState<Set<string>>(new Set());
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [overrides, setOverrides] = useState<Record<string, string>>({});
    const [dayIdx, setDayIdx] = useState(todayIndex);
    // Le Jour J n'entre dans les courses que si on le demande explicitement.
    const [withJourJ, setWithJourJ] = useState(false);
    // Mode « Par recette » : cases cochées, clé `day|meal|rIdx|idx`.
    const [recipeSel, setRecipeSel] = useState<Set<string>>(new Set());
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const [qty, setQty] = useState('');

    // ── Lecture : même sources que la liste du site ────────────────────────
    useEffect(() => {
        const read = () => {
            const j = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) || d); } catch { return JSON.parse(d); } };
            setList(j('magic-shopping-list', '{}'));
            setPlan(j('meal-planner-week', '{}'));
            setWeekChecked(new Set(j('meal-week-checked', '[]')));
            setDone(new Set(j('shop-done', '[]')));
            setOverrides(readRayonOverrides());
        };
        read();
        window.addEventListener('shoppingListUpdated', read);
        window.addEventListener('storage', read);
        return () => {
            window.removeEventListener('shoppingListUpdated', read);
            window.removeEventListener('storage', read);
        };
    }, []);

    /** Liste fusionnée : moteur de la prod, quantités additionnées. */
    const items = useMemo<ConsolItem[]>(
        () => buildConsolidatedItems(plan, weekChecked, list as any, withJourJ),
        [plan, weekChecked, list, withJourJ]
    );

    const hasJourJ = Object.keys(plan.JourJ || {}).length > 0;

    /** Rangée par rayon de supermarché, dans l'ordre du magasin. */
    const byRayon = useMemo(() => {
        const map = new Map<string, ConsolItem[]>();
        items.forEach((it) => {
            const rid = rayonOf(it.name, overrides);
            if (!map.has(rid)) map.set(rid, []);
            map.get(rid)!.push(it);
        });
        return [...map.entries()].sort((a, b) => (RAYON_ORDER[a[0]] ?? 99) - (RAYON_ORDER[b[0]] ?? 99));
    }, [items, overrides]);

    const persistDone = (s: Set<string>) => {
        localStorage.setItem('shop-done', JSON.stringify([...s]));
        window.dispatchEvent(new Event('shoppingListUpdated'));
    };

    /** Barrer : « je l'ai déjà à la maison » ou « c'est dans le panier ». */
    const toggleDone = (it: ConsolItem) => {
        haptic(8);
        setDone((prev) => {
            const n = new Set(prev);
            const keys = doneKeysOf(it);
            const already = keys.every((k) => n.has(k));
            keys.forEach((k) => (already ? n.delete(k) : n.add(k)));
            persistDone(n);
            return n;
        });
    };

    const markDone = (it: ConsolItem) => setDone((prev) => {
        const n = new Set(prev);
        doneKeysOf(it).forEach((k) => n.add(k));
        persistDone(n);
        return n;
    });

    /** Sélection : c'est elle qui alimente le partage et la recherche magasin. */
    const toggleSelect = (it: ConsolItem) => {
        haptic(6);
        setSelected((prev) => {
            const n = new Set(prev);
            const k = it.key;
            n.has(k) ? n.delete(k) : n.add(k);
            return n;
        });
    };
    const selectedKeys = useMemo(() => {
        const s = new Set<string>();
        items.filter((i) => selected.has(i.key)).forEach((i) => i.keys.forEach((k) => s.add(k)));
        return s;
    }, [items, selected]);

    const saveList = useCallback((next: ListData) => {
        localStorage.setItem('magic-shopping-list', JSON.stringify(next));
        setList(next);
        window.dispatchEvent(new Event('shoppingListUpdated'));
    }, []);

    /** Ajout libre : ce qui manque et qu'aucune recette ne prévoit. */
    const addManual = () => {
        const n = name.trim();
        if (!n) return;
        haptic(10);
        const raw = `${qty.trim() || '1'} ${n}`;
        const next: ListData = { ...list };
        const entry = next.manuel
            ? { ...next.manuel, ingredients: [...next.manuel.ingredients] }
            : { title: 'Ajouts manuels', source: 'manuel' as const, ingredients: [] as { name: string; checked: boolean }[] };
        entry.ingredients.push({ name: raw, checked: false });
        next.manuel = entry;
        saveList(next);
        setName(''); setQty(''); setAdding(false);
    };

    /** Retirer définitivement une ligne ajoutée à la main. */
    const removeManual = (display: string) => {
        const entry = list.manuel;
        if (!entry) return;
        haptic(10);
        const next: ListData = { ...list };
        const kept = entry.ingredients.filter((ing) => {
            const raw = typeof ing === 'string' ? ing : ing.name;
            return cleanIngredientText(raw) !== display && raw !== display;
        });
        if (kept.length) next.manuel = { ...entry, ingredients: kept };
        else delete next.manuel;
        saveList(next);
    };

    const clearAll = () => {
        if (!window.confirm('Vider toute la liste de courses ?')) return;
        haptic(12);
        localStorage.removeItem('magic-shopping-list');
        setList({});
        // Les lignes du plan sont marquées « prises » pour ne pas revenir.
        const checked = new Set(weekChecked);
        Object.keys(plan).forEach((d) => {
            Object.keys(plan[d] || {}).forEach((m) => {
                (plan[d][m]?.ingredients || []).forEach((_: unknown, idx: number) => checked.add(`${d}|${m}|${idx}`));
            });
        });
        setWeekChecked(checked);
        localStorage.setItem('meal-week-checked', JSON.stringify([...checked]));
        window.dispatchEvent(new Event('shoppingListUpdated'));
    };

    const restants = items.filter((it) => !isItemDone(it, done)).length;

    // ── Vue Jour : les ingrédients repas par repas ─────────────────────────
    const dayLines = (day: string) => {
        const meals = plan[day] || {};
        return Object.entries(meals).flatMap(([meal, recipe]: [string, any]) => {
            const withSide = recipe?.side ? [recipe, recipe.side] : [recipe];
            return withSide.flatMap((r: any, rIdx: number) =>
                (r?.ingredients || []).map((ing: any, idx: number) => {
                    const raw = `${ing?.quantity || ''} ${ing?.name || ''}`.trim();
                    const p = parseIngredient(raw);
                    return {
                        key: `${day}|${meal}|${rIdx}|${idx}`,
                        // Clé de « pris » identique à celle de la prod pour le plat principal.
                        doneKey: rIdx === 0 ? `${day}|${meal}|${idx}` : `${day}|${meal}|side|${idx}`,
                        meal,
                        recipe: decodeHtml(r?.title || ''),
                        icon: getIngIcon(p.name || raw),
                        text: cleanIngredientText(raw) || raw,
                    };
                })
            );
        });
    };

    /** Toutes les recettes planifiées, chacune avec ses lignes d'ingrédients. */
    const planRecipes = useMemo(() => {
        const out: { id: string; day: string; meal: string; title: string; image?: string;
                     lines: { key: string; icon: string; text: string }[] }[] = [];
        const visit = (day: string) => {
            Object.entries(plan[day] || {}).forEach(([meal, recipe]: [string, any]) => {
                const withSide = recipe?.side ? [recipe, recipe.side] : [recipe];
                withSide.forEach((r: any, rIdx: number) => {
                    if (!r?.title) return;
                    out.push({
                        id: `${day}|${meal}|${rIdx}`,
                        day, meal,
                        title: decodeHtml(r.title),
                        image: r.image,
                        lines: (r.ingredients || []).map((ing: any, idx: number) => {
                            const raw = `${ing?.quantity || ''} ${ing?.name || ''}`.trim();
                            const p = parseIngredient(raw);
                            return {
                                key: `${day}|${meal}|${rIdx}|${idx}`,
                                icon: getIngIcon(p.name || raw),
                                text: cleanIngredientText(raw) || raw,
                            };
                        }),
                    });
                });
            });
        };
        DAYS.forEach(visit);
        if (withJourJ) visit('JourJ');
        return out;
    }, [plan, withJourJ]);

    /** Partage d'UNE recette : uniquement les lignes cochées de celle-ci. */
    const shareRecipe = async (r: { title: string; lines: { key: string; text: string }[] }) => {
        const picked = r.lines.filter((l) => recipeSel.has(l.key));
        if (!picked.length) return;
        haptic(10);
        const text = `🛒 ${r.title}\n\n` + picked.map((l) => `• ${l.text}`).join('\n');
        const nav = navigator as Navigator & { share?: (d: unknown) => Promise<void> };
        if (nav.share) {
            try { await nav.share({ title: r.title, text }); } catch { /* partage annulé */ }
            return;
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const toggleDayLine = (doneKey: string) => {
        haptic(6);
        setDone((prev) => {
            const n = new Set(prev);
            n.has(doneKey) ? n.delete(doneKey) : n.add(doneKey);
            persistDone(n);
            return n;
        });
    };

    return (
        <div className={styles.page}>
            <header className={styles.planHead}>
                <button className={styles.planBack} onClick={() => router.push('/')} aria-label="Retour">
                    <svg viewBox="0 0 8 14" fill="none" width="13" height="13">
                        <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <div>
                    <div className={styles.planKicker}>Courses</div>
                    <h1 className={styles.planTitle}>Ma liste</h1>
                </div>
                <div className={styles.planCount}>
                    {restants} article{restants > 1 ? 's' : ''}<br />à prendre
                </div>
            </header>

            <div className={styles.planModes}>
                {([['semaine', 'La semaine'], ['jour', 'Jour par jour'], ['recette', 'Par recette']] as const).map(([m, lbl]) => (
                    <button
                        key={m}
                        className={`${styles.planMode} ${mode === m ? styles.planModeOn : ''}`}
                        onClick={() => { haptic(6); setMode(m); }}
                    >
                        {lbl}
                    </button>
                ))}
            </div>

            {mode === 'semaine' ? (
                <div className={styles.courseBody}>
                    {hasJourJ && (
                        <button
                            className={`${styles.courseJourJ} ${withJourJ ? styles.courseJourJOn : ''}`}
                            onClick={() => { haptic(8); setWithJourJ((v) => !v); }}
                        >
                            <span className={styles.courseJourJDot} />
                            {withJourJ ? 'Jour J inclus dans la liste' : 'Ajouter les ingrédients du Jour J'}
                        </button>
                    )}

                    {!items.length && (
                        <p className={styles.courseEmpty}>
                            Ta liste est vide. Planifie des repas, ou ajoute un article à la main.
                        </p>
                    )}

                    {byRayon.map(([rid, group]) => (
                        <section className={styles.courseRayon} key={rid}>
                            <h2 className={styles.courseRayonTitle}>
                                {RAYON_BY_ID[rid]?.label || 'Divers'}
                                <span className={styles.courseRayonCount}>{group.length}</span>
                            </h2>

                            {group.map((it) => {
                                const struck = isItemDone(it, done);
                                const isManual = !!it.manual;
                                return (
                                    <div className={`${styles.courseRow} ${struck ? styles.courseRowDone : ''}`} key={it.key}>
                                        {/* Case : sélectionne pour le magasin et le partage. */}
                                        <button
                                            className={`${styles.courseCheck} ${selected.has(it.key) ? styles.courseCheckOn : ''}`}
                                            onClick={() => toggleSelect(it)}
                                            aria-label="Sélectionner"
                                        >
                                            {selected.has(it.key) && (
                                                <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
                                                    <path d="M4.5 12.5 9.5 17.5 19.5 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                        </button>

                                        {/* Le texte barre / débarre : « je l'ai déjà ». */}
                                        <button className={styles.courseText} onClick={() => toggleDone(it)}>
                                            <span className={styles.courseIcon}>{it.icon}</span>
                                            <span className={styles.courseName}>{it.display}</span>
                                            {it.count > 1 && <span className={styles.courseCount}>×{it.count}</span>}
                                        </button>

                                        {isManual && (
                                            <button
                                                className={styles.courseDelete}
                                                onClick={() => removeManual(it.display)}
                                                aria-label="Supprimer"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </section>
                    ))}
                </div>
            ) : mode === 'jour' ? (
                <div className={styles.courseBody}>
                    <div className={styles.planDays}>
                        {DAYS.map((d, i) => (
                            <button
                                key={d}
                                className={`${styles.planDay} ${i === dayIdx ? styles.planDayOn : ''}`}
                                onClick={() => { haptic(6); setDayIdx(i); }}
                            >
                                {d}
                                {Object.keys(plan[d] || {}).length > 0 && <i className={styles.planDot} />}
                            </button>
                        ))}
                    </div>

                    <h2 className={styles.planDayTitle}>{DAY_FULL[DAYS[dayIdx]]}</h2>

                    {(() => {
                        const lines = dayLines(DAYS[dayIdx]);
                        if (!lines.length) {
                            return <p className={styles.courseEmpty}>Rien de planifié ce jour-là.</p>;
                        }
                        let lastRecipe = '';
                        return lines.map((l) => {
                            const head = l.recipe !== lastRecipe ? (lastRecipe = l.recipe) : null;
                            const struck = done.has(l.doneKey);
                            return (
                                <div key={l.key}>
                                    {head && (
                                        <h3 className={styles.courseRecipe}>
                                            <span className={styles.courseMeal}>{l.meal}</span>{head}
                                        </h3>
                                    )}
                                    <button
                                        className={`${styles.courseRow} ${styles.courseRowFlat} ${struck ? styles.courseRowDone : ''}`}
                                        onClick={() => toggleDayLine(l.doneKey)}
                                    >
                                        <span className={styles.courseIcon}>{l.icon}</span>
                                        <span className={styles.courseName}>{l.text}</span>
                                    </button>
                                </div>
                            );
                        });
                    })()}
                </div>
            ) : null}

            {mode === 'recette' && (
                <div className={styles.courseBody}>
                    {!planRecipes.length && (
                        <p className={styles.courseEmpty}>Aucune recette planifiée pour l&apos;instant.</p>
                    )}
                    {planRecipes.map((r) => {
                        const picked = r.lines.filter((l) => recipeSel.has(l.key)).length;
                        return (
                            <section className={styles.courseCard} key={r.id}>
                                <header className={styles.courseCardHead}>
                                    {r.image && <img src={r.image} alt="" className={styles.courseCardImg} draggable={false} />}
                                    <div className={styles.courseCardTitles}>
                                        <span className={styles.courseMeal}>{DAY_FULL[r.day] || 'Jour J'} · {r.meal}</span>
                                        <span className={styles.courseCardTitle}>{r.title}</span>
                                    </div>
                                </header>

                                {r.lines.map((l) => (
                                    <button
                                        key={l.key}
                                        className={`${styles.courseRow} ${styles.courseRowFlat}`}
                                        onClick={() => {
                                            haptic(6);
                                            setRecipeSel((prev) => {
                                                const n = new Set(prev);
                                                n.has(l.key) ? n.delete(l.key) : n.add(l.key);
                                                return n;
                                            });
                                        }}
                                    >
                                        <span className={`${styles.courseCheck} ${recipeSel.has(l.key) ? styles.courseCheckOn : ''}`}>
                                            {recipeSel.has(l.key) && (
                                                <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
                                                    <path d="M4.5 12.5 9.5 17.5 19.5 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                        </span>
                                        <span className={styles.courseIcon}>{l.icon}</span>
                                        <span className={styles.courseName}>{l.text}</span>
                                    </button>
                                ))}

                                {/* Le partage n'apparaît que pour la recette dont on a coché des lignes. */}
                                <AnimatePresence>
                                    {picked > 0 && (
                                        <motion.button
                                            className={styles.courseShareOne}
                                            onClick={() => shareRecipe(r)}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 8 }}
                                        >
                                            Partager {picked} ingrédient{picked > 1 ? 's' : ''} de cette recette
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                            </section>
                        );
                    })}
                </div>
            )}

            {/* Partage + recherche magasin : la cible, ce sont les articles cochés. */}
            {mode === 'semaine' && selected.size > 0 && (
                <div className={styles.courseShop}>
                    <ShopActions
                        items={items}
                        checkedKeys={selectedKeys}
                        title="Ma liste de courses"
                        onShopped={markDone}
                    />
                </div>
            )}

            <div className={styles.planFooter}>
                <button className={styles.planCompose} onClick={() => { haptic(8); setAdding(true); }}>Ajouter</button>
                <button className={styles.planClear} onClick={clearAll} disabled={!items.length}>Vider</button>
                <button className={styles.planValidate} onClick={() => router.push('/tv-planner')}>
                    Planificateur
                </button>
            </div>

            <AnimatePresence>
                {adding && (
                    <motion.div
                        className={styles.menuBackdrop}
                        onClick={() => setAdding(false)}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <motion.div
                            className={styles.composeCard}
                            onClick={(e) => e.stopPropagation()}
                            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
                        >
                            <div className={styles.composeTitle}>Ajouter un article</div>
                            <div className={styles.composeHint}>Ce qu&apos;aucune recette ne prévoit : éponges, café, pain…</div>
                            <div className={styles.courseForm}>
                                <input
                                    className={styles.courseQty}
                                    value={qty}
                                    onChange={(e) => setQty(e.target.value)}
                                    placeholder="2"
                                    inputMode="text"
                                />
                                <input
                                    className={styles.courseInput}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') addManual(); }}
                                    placeholder="Baguettes"
                                    autoFocus
                                />
                            </div>
                            <button className={styles.courseAddBtn} onClick={addManual}>Ajouter à la liste</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
