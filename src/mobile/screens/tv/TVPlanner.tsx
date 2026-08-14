'use client';

/**
 * Planificateur « Apple TV+ » — TEST DE DESIGN (route /tv-planner, local).
 *
 * Parti pris : UN JOUR PAR ÉCRAN, balayé horizontalement, au lieu de la grille
 * 7 × 2 qui écrasait quatorze cases sur la largeur d'un téléphone.
 *
 * Deux modes, comme le planificateur du site :
 *   • Semaine — Lun→Dim, deux créneaux (Midi / Soir), uniquement des PLATS.
 *     Un plat servi nu (viande ou poisson sans féculent ni légume) ouvre une
 *     ligne « Accompagnement », stockée dans `recipe.side` comme en prod.
 *   • Jour J  — un repas complet : apéritif, entrée, plat, accompagnement,
 *     dessert, pâtisserie. Chaque carte n'accepte que sa catégorie.
 *
 * Les données restent CELLES DU PLANIFICATEUR EXISTANT : même clé locale
 * `meal-planner-week`, même table Supabase `meal_plans`, même événement
 * `shoppingListUpdated`. Les deux écrans sont interchangeables.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Recipe } from '@/mobile/types';
import { mockRecipes } from '@/mobile/data/mockData';
import { decodeHtml } from '@/mobile/lib/utils';
import { supabase } from '@/mobile/lib/supabase';
import { normalizeIng, parseIngredient } from '@/mobile/lib/ingredients';
import { rayonOf } from '@/lib/rayons';
import { isCookable, hasSideIncluded, isSweet, proteinOf } from '@/lib/mealClassify';
import { isTVSide, isTVMain, sidePool } from './sides';
import { THEMES, matchesTag } from './themes';
import { totalMinutes, formatMinutes } from './timing';
import { haptic } from './TVHome';
import { readCart, removeCartRecipe, CART_EVENT, type CartRecipe } from './recipeCart';
import styles from './tv.module.css';

const TVSpotlight = dynamic(() => import('./TVSpotlight'), { ssr: false });
const RecipeSheet = dynamic(() => import('@/mobile/components/RecipeSheet/RecipeSheet'), { ssr: false });

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
const DAY_FULL: Record<string, string> = {
    Lun: 'Lundi', Mar: 'Mardi', Mer: 'Mercredi', Jeu: 'Jeudi',
    Ven: 'Vendredi', Sam: 'Samedi', Dim: 'Dimanche',
};
const MEALS = ['Midi', 'Soir'] as const;
const JOUR_J = 'JourJ';

/** Index du jour courant, semaine commençant le lundi (getDay : 0 = dimanche). */
const todayIndex = () => (new Date().getDay() + 6) % 7;

/** Cartes du repas complet, et ce que chacune accepte. */
const COURSES: { label: string; accepts: (r: Recipe) => boolean }[] = [
    { label: 'Apéritif', accepts: (r) => r.category === 'aperitifs' && isCookable(r) },
    { label: 'Entrée', accepts: (r) => r.category === 'entrees' && isCookable(r) },
    { label: 'Plat', accepts: (r) => isTVMain(r) },
    { label: 'Accompagnement', accepts: (r) => isTVSide(r) },
    { label: 'Dessert', accepts: (r) => r.category === 'desserts' && isCookable(r) },
    { label: 'Pâtisserie', accepts: (r) => r.category === 'patisserie' && isCookable(r) },
];

type Slot = Recipe & { side?: Recipe };
type Plan = Record<string, Record<string, Slot>>;

const label = (r: Recipe) => decodeHtml(r.title || '');

export default function TVPlanner({ embedded = false }: { embedded?: boolean }) {
    const router = useRouter();
    const params = useSearchParams();
    const [mode, setMode] = useState<'semaine' | 'jourj' | 'panier'>(params.get('mode') === 'jourj' ? 'jourj' : 'semaine');
    // « Mes recettes » : ingrédients choisis à la main dans les fiches (magic-shopping-list).
    const [cart, setCart] = useState<CartRecipe[]>([]);
    useEffect(() => {
        const load = () => setCart(readCart());
        load();
        window.addEventListener(CART_EVENT, load);
        window.addEventListener('storage', load);
        return () => { window.removeEventListener(CART_EVENT, load); window.removeEventListener('storage', load); };
    }, []);
    const [plan, setPlan] = useState<Plan>({});
    const [index, setIndex] = useState(todayIndex);
    // `side` : le choix vise l'accompagnement du plat de ce créneau.
    const [picker, setPicker] = useState<{ day: string; meal: string; side?: boolean } | null>(null);
    const [detail, setDetail] = useState<Recipe | null>(null);
    const [recap, setRecap] = useState<{ total: number; rayons: { id: string; n: number }[] } | null>(null);
    const pagerRef = useRef<HTMLDivElement>(null);

    // ── Chargement : Supabase si connecté, sinon cache local ───────────────
    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data } = await supabase
                    .from('meal_plans').select('plan')
                    .eq('user_id', session.user.id).maybeSingle();
                if (data?.plan) {
                    setPlan(data.plan);
                    localStorage.setItem('meal-planner-week', JSON.stringify(data.plan));
                    return;
                }
            }
            try { setPlan(JSON.parse(localStorage.getItem('meal-planner-week') || '{}')); } catch { /* vide */ }
        };
        load();
    }, []);

    /** Enregistre partout : local, Supabase, et prévient la liste de courses. */
    const save = useCallback(async (next: Plan) => {
        setPlan(next);
        localStorage.setItem('meal-planner-week', JSON.stringify(next));
        window.dispatchEvent(new Event('shoppingListUpdated'));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await supabase.from('meal_plans').upsert({
                user_id: session.user.id,
                plan: next,
                updated_at: new Date().toISOString(),
            });
        }
    }, []);

    const setSlot = (day: string, meal: string, recipe: Recipe | null) => {
        const next: Plan = { ...plan, [day]: { ...(plan[day] || {}) } };
        if (recipe) next[day][meal] = recipe as Slot;
        else delete next[day][meal];
        if (!Object.keys(next[day]).length) delete next[day];
        save(next);
    };

    /** Accompagnement rattaché au plat du créneau (même forme qu'en prod). */
    const setSide = (day: string, meal: string, side: Recipe | null) => {
        const main = plan[day]?.[meal];
        if (!main) return;
        const next: Plan = { ...plan, [day]: { ...(plan[day] || {}) } };
        if (side) next[day][meal] = { ...main, side };
        else { const { side: _drop, ...rest } = main; next[day][meal] = rest as Slot; }
        save(next);
    };

    const clearAll = () => {
        const isJourJ = mode === 'jourj';
        if (!window.confirm(isJourJ ? 'Effacer le menu Jour J ?' : 'Effacer tous les repas de la semaine ?')) return;
        haptic(12);
        const next: Plan = { ...plan };
        if (isJourJ) delete next[JOUR_J];
        else DAYS.forEach((d) => delete next[d]);
        save(next);
        setRecap(null);
    };

    // ── Jour courant : lu sur le défilement natif du pager ────────────────
    useEffect(() => {
        const el = pagerRef.current;
        if (!el || mode !== 'semaine') return;
        const onScroll = () => {
            const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            setIndex((prev) => (prev === i ? prev : i));
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, [mode]);

    const goToDay = (i: number) => {
        pagerRef.current?.scrollTo({ left: i * (pagerRef.current.clientWidth || 0), behavior: 'smooth' });
    };

    // Ouverture : on se place sur AUJOURD'HUI, pas sur lundi.
    useEffect(() => {
        if (mode !== 'semaine') return;
        const el = pagerRef.current;
        if (!el) return;
        const i = todayIndex();
        // Sans délai, la largeur du pager n'est pas encore connue.
        const t = setTimeout(() => { el.scrollLeft = i * el.clientWidth; setIndex(i); }, 60);
        return () => clearTimeout(t);
    }, [mode]);

    const planned = useMemo(() => (mode === 'jourj'
        ? Object.keys(plan[JOUR_J] || {}).length
        : DAYS.reduce((n, d) => n + Object.keys(plan[d] || {}).length, 0)), [plan, mode]);

    /** Ce que le choix en cours doit accepter. */
    const pickerFilter = useMemo(() => {
        if (!picker) return undefined;
        if (picker.side) return isTVSide;
        if (picker.day === JOUR_J) return COURSES.find((c) => c.label === picker.meal)?.accepts;
        return isTVMain; // créneau de semaine : uniquement des plats
    }, [picker]);

    /**
     * « Valider » : même logique que le planificateur existant — la liste
     * fusionnée relit les ingrédients DEPUIS le plan, on purge donc les
     * anciennes entrées issues du planificateur au lieu de les dupliquer.
     */
    const validate = () => {
        const slots = mode === 'jourj'
            ? COURSES.map((c) => plan[JOUR_J]?.[c.label]).filter(Boolean) as Slot[]
            : DAYS.flatMap((d) => MEALS.map((m) => plan[d]?.[m]).filter(Boolean) as Slot[]);
        // Les accompagnements comptent aussi dans les courses.
        const recipes: Recipe[] = slots.flatMap((s) => (s.side ? [s, s.side] : [s]));
        if (!recipes.length) return;
        haptic(12);

        let data: Record<string, any> = {};
        try { data = JSON.parse(localStorage.getItem('magic-shopping-list') || '{}'); } catch { /* vide */ }
        Object.keys(data).forEach((k) => {
            if (data[k]?.source === 'planner' || data[k]?.count != null) delete data[k];
        });

        const lines = new Set<string>();
        const rayonCount = new Map<string, number>();
        recipes.forEach((recipe) => {
            (recipe.ingredients || []).forEach((i: any) => {
                if (!i?.name) return;
                const p = parseIngredient(`${i.quantity || ''} ${i.name || ''}`.trim());
                if (!p.name) return;
                const k = `${normalizeIng(p.name)}|${p.unit}`;
                if (lines.has(k)) return;
                lines.add(k);
                const rid = rayonOf(p.name, {});
                rayonCount.set(rid, (rayonCount.get(rid) || 0) + 1);
            });
        });

        localStorage.setItem('magic-shopping-list', JSON.stringify(data));
        window.dispatchEvent(new Event('shoppingListUpdated'));
        window.dispatchEvent(new CustomEvent('magic-toast-notify', {
            detail: `${lines.size} ingrédient${lines.size > 1 ? 's' : ''} ajouté${lines.size > 1 ? 's' : ''} à ta liste 🛒`,
        }));
        setRecap({
            total: lines.size,
            rayons: [...rayonCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => ({ id, n })),
        });
    };

    /** Tendances proposées au générateur (sous-ensemble lisible des thèmes). */
    const TRENDS = useMemo(
        () => ['healthy', 'vegetarien', 'express', 'dolce-vita', 'barbecue', 'pas cher', 'minceur']
            .map((tag) => ({ tag, label: THEMES.find((t) => t.tag === tag)?.title || tag })),
        []
    );
    const [composer, setComposer] = useState(false);

    const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

    /**
     * Compose tout le menu d'un coup, sur une tendance facultative. Les plats ne
     * se répètent pas, les protéines alternent, et un plat servi nu reçoit sa
     * garniture — comme le ferait un menu proposé à la main.
     */
    const compose = (tag: string | null) => {
        haptic(12);
        setComposer(false);
        const fits = (r: Recipe) => !tag || matchesTag(r, tag);

        const next: Plan = { ...plan };
        const used = new Set<string>();
        const sides = shuffle(sidePool(mockRecipes).filter(fits).length >= 6
            ? sidePool(mockRecipes).filter(fits)
            : sidePool(mockRecipes));

        const pickFrom = (accepts: (r: Recipe) => boolean, lastProtein?: string): Recipe | null => {
            // Vivier de la tendance. On ne le quitte JAMAIS tant qu'il n'est pas
            // vide : un menu « Végétarien » à court de recettes doit se répéter,
            // surtout pas glisser vers des pâtes à la merguez.
            const onTrend = mockRecipes.filter((r) => r.image && accepts(r) && fits(r));
            const pool = onTrend.length ? onTrend : mockRecipes.filter((r) => r.image && accepts(r));
            if (!pool.length) return null;

            // Priorité : pas encore servi ET protéine différente de la veille.
            const fresh = pool.filter((r) => !used.has(String(r.id)));
            const varied = fresh.filter((r) => proteinOf(r) !== lastProtein);
            const from = varied.length ? varied : fresh.length ? fresh : pool;

            const pick = from[Math.floor(Math.random() * from.length)];
            used.add(String(pick.id));
            return pick;
        };

        let sideIdx = 0;
        const withSide = (main: Recipe): Slot => {
            if (hasSideIncluded(main) || isSweet(main)) return main as Slot;
            const side = sides[sideIdx++ % Math.max(1, sides.length)];
            return side ? ({ ...main, side } as Slot) : (main as Slot);
        };

        if (mode === 'jourj') {
            next[JOUR_J] = {};
            COURSES.forEach((c) => {
                if (c.label === 'Accompagnement') return; // rattaché au plat
                const pick = pickFrom(c.accepts);
                if (pick) next[JOUR_J][c.label] = c.label === 'Plat' ? withSide(pick) : (pick as Slot);
            });
        } else {
            let last: string | undefined;
            DAYS.forEach((d) => {
                next[d] = {};
                MEALS.forEach((m) => {
                    const pick = pickFrom(isTVMain, last);
                    if (!pick) return;
                    last = proteinOf(pick);
                    next[d][m] = withSide(pick);
                });
                if (!Object.keys(next[d]).length) delete next[d];
            });
        }
        save(next);
        setRecap(null);
    };

    /** Remplit un créneau au hasard, dans la bonne catégorie. */
    const surprise = (day: string, meal: string, accepts: (r: Recipe) => boolean) => {
        const pool = mockRecipes.filter((r) => r.image && accepts(r));
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (!pick) return;
        haptic(8);
        setSlot(day, meal, pick);
    };

    // ── Rendu d'un créneau (semaine ou Jour J) ─────────────────────────────
    const SlotView = ({ day, meal, accepts, sideable }: {
        day: string; meal: string; accepts: (r: Recipe) => boolean; sideable?: boolean;
    }) => {
        const slot = plan[day]?.[meal];
        // Viande ou poisson servi nu → on propose une garniture.
        const needsSide = !!slot && !!sideable && !hasSideIncluded(slot) && !isSweet(slot);

        return (
            <div className={styles.planSlot}>
                <div className={styles.planSlotHead}>
                    <span className={styles.planMeal}>{meal}</span>
                    {slot && (
                        <span className={styles.planSlotActions}>
                            <button className={styles.planSwap} onClick={() => { haptic(8); setPicker({ day, meal }); }}>
                                Changer
                            </button>
                            <button className={styles.planRemove} onClick={() => { haptic(10); setSlot(day, meal, null); }}>
                                Retirer
                            </button>
                        </span>
                    )}
                </div>

                {slot ? (
                    <>
                        {/* Un tap sur la carte ouvre la fiche complète de la recette. */}
                        <button className={styles.planCard} onClick={() => { haptic(8); setDetail(slot); }}>
                            <img src={slot.image} alt="" className={styles.planCardImg} draggable={false} />
                            <div className={styles.planCardScrim} />
                            <div className={styles.planCardText}>
                                <div className={styles.planCardTitle}>{label(slot)}</div>
                                <div className={styles.planCardMeta}>
                                    {formatMinutes(totalMinutes(slot))} · Voir la recette ›
                                </div>
                            </div>
                        </button>

                        {needsSide && (
                            <div className={styles.planSide}>
                                {slot.side ? (
                                    <>
                                        <img src={slot.side.image} alt="" className={styles.planSideImg} draggable={false} />
                                        <button className={styles.planSideText} onClick={() => { haptic(8); setDetail(slot.side!); }}>
                                            <span className={styles.planSideKicker}>Accompagnement</span>
                                            <span className={styles.planSideTitle}>{label(slot.side)}</span>
                                        </button>
                                        <button className={styles.planRemove} onClick={() => { haptic(10); setSide(day, meal, null); }}>
                                            Retirer
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        className={styles.planSideAdd}
                                        onClick={() => { haptic(8); setPicker({ day, meal, side: true }); }}
                                    >
                                        <span className={styles.planPlus}>+</span>
                                        Ajouter un accompagnement
                                        <span className={styles.planSideWhy}>ce plat est servi nu</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className={styles.planEmpty}>
                        <button className={styles.planAdd} onClick={() => { haptic(8); setPicker({ day, meal }); }}>
                            <span className={styles.planPlus}>+</span>
                            Choisir {meal === 'Plat' || meal === 'Midi' || meal === 'Soir' ? 'un plat' : 'une recette'}
                        </button>
                        <button className={styles.planSurprise} onClick={() => surprise(day, meal, accepts)}>
                            Surprends-moi
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`${styles.page} ${embedded ? styles.embedded : ''}`}>
            <header className={styles.planHead}>
                {/* Dans le shell desktop, la sidebar gère le retour : pas de flèche ici. */}
                {!embedded && (
                    <button className={styles.planBack} onClick={() => router.push('/')} aria-label="Retour">
                        <svg viewBox="0 0 8 14" fill="none" width="13" height="13">
                            <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                )}
                <div>
                    <div className={styles.planKicker}>Planificateur</div>
                    <h1 className={styles.planTitle}>{mode === 'jourj' ? 'Jour J' : 'Ma semaine'}</h1>
                </div>
                <div className={styles.planCount}>
                    {planned} {mode === 'jourj' ? 'plat' : 'repas'}<br />planifié{planned > 1 ? 's' : ''}
                </div>
            </header>

            <div className={styles.planModes}>
                {(['semaine', 'jourj'] as const).map((m) => (
                    <button
                        key={m}
                        className={`${styles.planMode} ${mode === m ? styles.planModeOn : ''}`}
                        onClick={() => { haptic(6); setMode(m); setRecap(null); }}
                    >
                        {m === 'semaine' ? 'Semaine' : 'Jour J'}
                    </button>
                ))}
                {/* 3ᵉ onglet : n'apparaît que si on a choisi des ingrédients dans une recette. */}
                {cart.length > 0 && (
                    <button
                        className={`${styles.planMode} ${mode === 'panier' ? styles.planModeOn : ''}`}
                        onClick={() => { haptic(6); setMode('panier'); setRecap(null); }}
                    >
                        Mes recettes
                    </button>
                )}
            </div>

            {mode === 'panier' ? (
                <section className={styles.planSlide}>
                    <h2 className={styles.planDayTitle}>Mes recettes</h2>
                    <div className={styles.cartList}>
                        {cart.map((r) => (
                            <div key={r.id} className={styles.cartCard}>
                                <div className={styles.cartCardHead}>
                                    {r.image && <img src={r.image} alt="" className={styles.cartThumb} draggable={false} />}
                                    <div className={styles.cartTitle}>{decodeHtml(r.title)}</div>
                                    <button className={styles.cartRemove} onClick={() => { haptic(8); removeCartRecipe(r.id); }}>Retirer</button>
                                </div>
                                <ul className={styles.cartIngs}>
                                    {r.ingredients.map((ing, i) => (
                                        <li key={i} className={styles.cartIng}>{ing.replace(/^-\s*/, '')}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>
            ) : mode === 'semaine' ? (
                <>
                    {/* Barre des jours : repère fixe pendant qu'on balaie. */}
                    <div className={styles.planDays}>
                        {DAYS.map((d, i) => (
                            <button
                                key={d}
                                className={`${styles.planDay} ${i === index ? styles.planDayOn : ''}`}
                                onClick={() => { haptic(6); goToDay(i); }}
                            >
                                {d}
                                {Object.keys(plan[d] || {}).length > 0 && <i className={styles.planDot} />}
                            </button>
                        ))}
                    </div>

                    <div className={styles.planPager} ref={pagerRef}>
                        {DAYS.map((day) => (
                            <section className={styles.planSlide} key={day}>
                                <h2 className={styles.planDayTitle}>{DAY_FULL[day]}</h2>
                                {MEALS.map((meal) => (
                                    <SlotView key={meal} day={day} meal={meal} accepts={isTVMain} sideable />
                                ))}
                            </section>
                        ))}
                    </div>
                </>
            ) : (
                <section className={styles.planSlide}>
                    <h2 className={styles.planDayTitle}>Le menu</h2>
                    {COURSES.map((c) => (
                        <SlotView
                            key={c.label}
                            day={JOUR_J}
                            meal={c.label}
                            accepts={c.accepts}
                            sideable={c.label === 'Plat'}
                        />
                    ))}
                </section>
            )}

            {mode !== 'panier' && (
                <div className={styles.planFooter}>
                    <button className={styles.planCompose} onClick={() => { haptic(8); setComposer(true); }}>
                        Composer
                    </button>
                    <button className={styles.planClear} onClick={clearAll} disabled={!planned}>Effacer</button>
                    <button className={styles.planValidate} onClick={validate} disabled={!planned}>
                        {planned ? 'Remplir ma liste de courses' : 'Rien de planifié'}
                    </button>
                </div>
            )}

            <AnimatePresence>
                {recap && (
                    <motion.div
                        className={styles.planRecap}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        onClick={() => router.push('/tv-courses')}
                    >
                        <strong>{recap.total} ingrédients</strong> dans ta liste
                        <span className={styles.planRecapGo}>Voir la liste ›</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Composer : une tendance, et tout le menu se remplit. */}
            <AnimatePresence>
                {composer && (
                    <motion.div
                        className={styles.menuBackdrop}
                        onClick={() => setComposer(false)}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <motion.div
                            className={styles.composeCard}
                            onClick={(e) => e.stopPropagation()}
                            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
                        >
                            <div className={styles.composeTitle}>
                                Composer {mode === 'jourj' ? 'le menu' : 'la semaine'}
                            </div>
                            <div className={styles.composeHint}>
                                Une tendance, et {mode === 'jourj' ? 'chaque plat du menu' : 'les quatorze repas'} se remplissent.
                            </div>
                            <div className={styles.composeChips}>
                                <button className={styles.composeChip} onClick={() => compose(null)}>Au hasard</button>
                                {TRENDS.map((t) => (
                                    <button key={t.tag} className={styles.composeChip} onClick={() => compose(t.tag)}>
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Le choix réutilise la loupe TV, restreinte à la bonne famille. */}
            <TVSpotlight
                open={!!picker}
                onClose={() => setPicker(null)}
                filter={pickerFilter}
                hint="Annuler"
                onRecipeSelect={(r) => {
                    if (picker?.side) setSide(picker.day, picker.meal, r);
                    else if (picker) setSlot(picker.day, picker.meal, r);
                    setPicker(null);
                }}
            />

            {detail && (
                <RecipeSheet recipe={detail} isOpen={true} onClose={() => setDetail(null)} />
            )}
        </div>
    );
}
