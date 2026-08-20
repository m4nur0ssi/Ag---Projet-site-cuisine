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
import { matchesTag } from './themes';
import { FILTER_GROUPS, type FilterGroup } from '@/lib/searchFilters';
import { totalMinutes, formatMinutes } from './timing';
import { estimateRecipeTiming } from '@/lib/recipe-timing';
import { haptic } from './TVHome';
import { readCart, removeCartRecipe, CART_EVENT, type CartRecipe } from './recipeCart';
import { timingFromSteps, passiveLabelFor, COURSE_OFFSET, type TimelineInput } from '@/lib/cooking-timeline';
import styles from './tv.module.css';
import Tip from '@/components/Tip/Tip';

const TVSpotlight = dynamic(() => import('./TVSpotlight'), { ssr: false });
const CookingTimeline = dynamic(() => import('@/mobile/components/CookingTimeline/CookingTimeline'), { ssr: false });
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

    // « Vider » (liste de courses) marque les créneaux comme « déjà pris »
    // (meal-week-checked, clé `day|meal|idx`). Sans purge, replanifier le même
    // créneau laissait ses ingrédients invisibles dans « La semaine ». On efface
    // donc ces marques dès qu'on (re)pose une recette dans le créneau.
    const clearWeekChecked = (day: string, meal: string) => {
        try {
            const arr: string[] = JSON.parse(localStorage.getItem('meal-week-checked') || '[]');
            const kept = arr.filter((k) => !k.startsWith(`${day}|${meal}|`));
            if (kept.length !== arr.length) localStorage.setItem('meal-week-checked', JSON.stringify(kept));
        } catch { /* noop */ }
    };

    const setSlot = (day: string, meal: string, recipe: Recipe | null) => {
        const next: Plan = { ...plan, [day]: { ...(plan[day] || {}) } };
        if (recipe) { next[day][meal] = recipe as Slot; clearWeekChecked(day, meal); }
        else delete next[day][meal];
        if (!Object.keys(next[day]).length) delete next[day];
        save(next);
    };

    /** Accompagnement rattaché au plat du créneau (même forme qu'en prod). */
    const setSide = (day: string, meal: string, side: Recipe | null) => {
        const main = plan[day]?.[meal];
        if (!main) return;
        const next: Plan = { ...plan, [day]: { ...(plan[day] || {}) } };
        if (side) { next[day][meal] = { ...main, side }; clearWeekChecked(day, meal); }
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
        const items: { name: string; checked: boolean }[] = [];
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
                // Libellé lisible (quantité + nom) réellement stocké dans la liste.
                const label = `${i.quantity ? i.quantity + ' ' : ''}${i.name}`.trim();
                items.push({ name: label, checked: false });
            });
        });

        // On écrit RÉELLEMENT le menu dans la liste (bug : seule la purge était sauvée
        // → liste vide). Une entrée « planner » agrégée, dédoublonnée par rayon.
        if (items.length) {
            data['planner-menu'] = {
                title: 'Mon menu planifié',
                source: 'planner',
                count: items.length,
                ingredients: items,
            };
        }

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

    /**
     * Sélection du compositeur : trois familles, cumulables.
     * Entre familles c'est un ET (Italie ET Express), dans une famille un OU
     * (Italie OU Grèce) — comme les filtres du menu.
     */
    type Sel = Record<FilterGroup, string[]>;
    const EMPTY_SEL: Sel = { categorie: [], pays: [], tendances: [] };
    const [sel, setSel] = useState<Sel>(EMPTY_SEL);
    const [fam, setFam] = useState<FilterGroup>('tendances');
    const [famQuery, setFamQuery] = useState('');
    const [famAll, setFamAll] = useState(false);
    const selCount = sel.categorie.length + sel.pays.length + sel.tendances.length;

    const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const FAM_LABEL: Record<FilterGroup, string> = { tendances: 'Tendances', pays: 'Pays', categorie: 'Catégories' };

    /** Une recette passe si CHAQUE famille cochée trouve au moins un de ses tags. */
    const selFits = useCallback((r: Recipe, s: Sel) => {
        const groups = [s.categorie, s.pays, s.tendances].filter((g) => g.length);
        if (!groups.length) return true;
        // L'utilisateur a coché une catégorie lui-même : les garde-fous des thèmes
        // (« Express » écarte les desserts) n'ont plus lieu d'être.
        const opts = { ignoreCategoryGuards: !!s.categorie.length };
        return groups.every((g) => g.some((t) => matchesTag(r, t, opts)));
    }, []);

    // Combien de recettes répondent VRAIMENT à la sélection, dans le rôle attendu
    // (un créneau de semaine veut un plat). Sans ce compte, on coche trois filtres
    // et on découvre après coup que la semaine est hors sujet.
    const selMatches = useMemo(() => {
        const accepts = mode === 'semaine' ? isTVMain : (r: Recipe) => isCookable(r);
        return mockRecipes.filter((r) => r.image && accepts(r) && selFits(r, sel)).length;
    }, [sel, mode, selFits]);

    // Nombre de créneaux à remplir : sert à prévenir quand la sélection est trop
    // étroite pour la semaine (14 repas) ou le menu du Jour J.
    const NEEDED = mode === 'semaine' ? DAYS.length * MEALS.length : COURSES.filter((c) => c.label !== 'Accompagnement').length;

    const famItems = useMemo(() => {
        const all = FILTER_GROUPS[fam];
        const q = norm(famQuery.trim());
        return q ? all.filter((i) => norm(i.label).includes(q)) : all;
    }, [fam, famQuery]);

    const toggleSel = (tag: string) => {
        haptic(6);
        setSel((prev) => {
            const cur = prev[fam];
            return { ...prev, [fam]: cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag] };
        });
    };

    const [composer, setComposer] = useState(false);
    const [showTimeline, setShowTimeline] = useState(false);
    // Semaine intelligente : express en semaine.
    const [smart, setSmart] = useState({ express: false });

    // Déroulé de la soirée (Jour J) : un item par plat du menu, avec sa part
    // active (prépa) et passive (four/frigo) devinée depuis les étapes.
    const timelineItems = useMemo<TimelineInput[]>(() => {
        if (mode !== 'jourj') return [];
        const out: TimelineInput[] = [];
        COURSES.forEach((c) => {
            const slot = plan[JOUR_J]?.[c.label] as Slot | undefined;
            if (!slot) return;
            const push = (r: any, label: string) => {
                const { active, passive } = timingFromSteps(r.steps);
                out.push({
                    key: `${label}-${r.id}`, label, title: decodeHtml(r.title || ''),
                    active, passive, activeLabel: 'Prépa', passiveLabel: passiveLabelFor(r.steps),
                    readyOffset: COURSE_OFFSET[label] ?? 20,
                });
            };
            push(slot, c.label);
            if (slot.side) push(slot.side, 'Accompagnement');
        });
        return out;
    }, [mode, plan]);

    const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

    /**
     * Compose tout le menu d'un coup, sur une tendance facultative. Les plats ne
     * se répètent pas, les protéines alternent, et un plat servi nu reçoit sa
     * garniture — comme le ferait un menu proposé à la main.
     */
    const compose = (chosen: Sel | null) => {
        haptic(12);
        setComposer(false);
        const sub = chosen || EMPTY_SEL;
        const tagged = !!(sub.categorie.length || sub.pays.length || sub.tendances.length);
        // Nouveau menu = liste fraîche : on efface les marques « déjà pris » qui
        // masqueraient les créneaux réécrits dans « La semaine ».
        try { localStorage.removeItem('meal-week-checked'); } catch { /* noop */ }
        const fits = (r: Recipe) => selFits(r, sub);

        const next: Plan = { ...plan };
        const used = new Set<string>();
        const sides = shuffle(sidePool(mockRecipes).filter(fits).length >= 6
            ? sidePool(mockRecipes).filter(fits)
            : sidePool(mockRecipes));

        const totalTime = (r: Recipe) => { const t = estimateRecipeTiming(r.steps); return t.prepTime + t.cookTime; };

        // Combien de créneaux la tendance n'a PAS pu remplir. On ne peut pas
        // laisser un trou dans la semaine, mais on doit le dire : sinon on
        // annonce « Express » et on sert un plat de trois quarts d'heure.
        let offTrend = 0;

        const pickFrom = (accepts: (r: Recipe) => boolean, opts?: { lastProtein?: string; express?: boolean }): Recipe | null => {
            const onTrend = mockRecipes.filter((r) => r.image && accepts(r) && fits(r));
            if (!onTrend.length && tagged) offTrend++;
            const pool = onTrend.length ? onTrend : mockRecipes.filter((r) => r.image && accepts(r));
            if (!pool.length) return null;

            const fresh = pool.filter((r) => !used.has(String(r.id)));
            let from = fresh.length ? fresh : pool;

            // Protéine différente de la veille (préférence, pas obligation).
            const varied = from.filter((r) => proteinOf(r) !== opts?.lastProtein);
            if (varied.length) from = varied;

            // Express : on cherche d'abord sous 30 min, puis sous 45 — plutôt que
            // de renoncer d'un coup et de prendre n'importe quelle durée.
            if (opts?.express) {
                const quick = from.filter((r) => totalTime(r) <= 30);
                const okish = quick.length ? quick : from.filter((r) => totalTime(r) <= 45);
                if (okish.length) from = okish; else offTrend++;
            }

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
            DAYS.forEach((d, di) => {
                next[d] = {};
                // Express en SEMAINE (Lun→Ven), plats plus libres le week-end.
                const express = smart.express && di < 5;
                MEALS.forEach((m) => {
                    const pick = pickFrom(isTVMain, { lastProtein: last, express });
                    if (!pick) return;
                    last = proteinOf(pick);
                    next[d][m] = withSide(pick);
                });
                if (!Object.keys(next[d]).length) delete next[d];
            });
        }
        save(next);
        setRecap(null);

        // On DIT ce qui vient d'être fait. La feuille se referme et quatorze
        // repas changent d'un coup : sans un mot, on croit qu'il ne s'est rien
        // passé — et on ne sait pas si la tendance a pu être tenue partout.
        const filled = mode === 'jourj'
            ? Object.keys(next[JOUR_J] || {}).length
            : Object.values(next).reduce((n, day) => n + Object.keys(day || {}).length, 0);
        const labelOf = (g: FilterGroup, t: string) =>
            FILTER_GROUPS[g].find((i) => i.tag === t)?.label.replace(/^[^\p{L}]+/u, '') || t;
        const what = tagged
            ? ([...sub.categorie.map((t) => labelOf('categorie', t)),
                ...sub.pays.map((t) => labelOf('pays', t)),
                ...sub.tendances.map((t) => labelOf('tendances', t))].join(' + '))
            : 'Au hasard';
        const msg = offTrend > 0
            ? `${what} · ${filled} repas — ${offTrend} créneau${offTrend > 1 ? 'x' : ''} hors filtre, faute de recette`
            : `${what} · ${filled} repas composés`;
        window.dispatchEvent(new CustomEvent('magic-toast-notify', { detail: msg }));
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

    // Desktop : le déroulé s'ouvre EN PLACE dans le panneau (sidebar conservée à
    // gauche), pas en modale plein écran. Même composant/interface que le mobile.
    if (embedded && showTimeline) {
        return (
            <div className={`${styles.page} ${styles.embedded}`}>
                <header className={styles.planHead}>
                    <button className={styles.planBack} onClick={() => setShowTimeline(false)} aria-label="Retour au planificateur">
                        <svg viewBox="0 0 8 14" fill="none" width="13" height="13"><path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <div>
                        <div className={styles.planKicker}>Planificateur · Jour J</div>
                        <h1 className={styles.planTitle}>Déroulé de la soirée</h1>
                    </div>
                </header>
                <div style={{ padding: '4px 4px 40px' }}>
                    <CookingTimeline items={timelineItems} />
                </div>
            </div>
        );
    }

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
                    {timelineItems.length > 0 && (
                        <button className={styles.planTimelineBtn} onClick={() => { haptic(8); setShowTimeline(true); }}>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                            Déroulé de la soirée
                        </button>
                    )}
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

            {/* Composer : des filtres cumulables, et tout le menu se remplit. */}
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
                                Coche ce que tu veux — catégories, pays, tendances se combinent —
                                et {mode === 'jourj' ? 'chaque plat du menu' : 'les quatorze repas'} se remplissent.
                            </div>
                            {mode === 'semaine' && (
                                <div className={styles.smartRow}>
                                    <button
                                        className={`${styles.smartToggle} ${smart.express ? styles.smartOn : ''}`}
                                        onClick={() => setSmart((s) => ({ ...s, express: !s.express }))}
                                    >
                                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
                                        Express en semaine
                                    </button>
                                </div>
                            )}
                            {/* Cinquante et quelques filtres ne tiennent pas à plat :
                                on montre une famille à la fois, filtrable, repliée
                                aux douze premiers. Cocher n'ENVOIE rien — c'est le
                                bouton du bas qui lance. */}
                            <div className={styles.famTabs}>
                                {(['tendances', 'pays', 'categorie'] as FilterGroup[]).map((g) => (
                                    <button
                                        key={g}
                                        className={`${styles.famTab} ${fam === g ? styles.famTabOn : ''}`}
                                        onClick={() => { haptic(5); setFam(g); setFamQuery(''); setFamAll(false); }}
                                    >
                                        {FAM_LABEL[g]}
                                        {sel[g].length > 0 && <span className={styles.famTabCount}>{sel[g].length}</span>}
                                    </button>
                                ))}
                            </div>

                            <input
                                className={styles.famSearch}
                                value={famQuery}
                                onChange={(e) => { setFamQuery(e.target.value); setFamAll(true); }}
                                placeholder={`Filtrer ${FAM_LABEL[fam].toLowerCase()}…`}
                            />

                            <div className={styles.composeChips}>
                                {(famAll ? famItems : famItems.slice(0, 12)).map((it) => (
                                    <button
                                        key={it.tag}
                                        className={`${styles.composeChip} ${sel[fam].includes(it.tag) ? styles.composeChipOn : ''}`}
                                        onClick={() => toggleSel(it.tag)}
                                    >
                                        {it.label}
                                    </button>
                                ))}
                                {!famAll && famItems.length > 12 && (
                                    <button className={`${styles.composeChip} ${styles.composeChipMore}`} onClick={() => setFamAll(true)}>
                                        +{famItems.length - 12} autres
                                    </button>
                                )}
                                {!famItems.length && <div className={styles.composeHint}>Aucun filtre à ce nom.</div>}
                            </div>

                            {/* Ce qui est coché, toutes familles confondues, et ce que
                                ça laisse réellement comme recettes. */}
                            {selCount > 0 && (
                                <div className={styles.selRecap}>
                                    <div className={styles.selPills}>
                                        {(['categorie', 'pays', 'tendances'] as FilterGroup[]).flatMap((g) =>
                                            sel[g].map((t) => (
                                                <button
                                                    key={`${g}-${t}`}
                                                    className={styles.selPill}
                                                    onClick={() => { haptic(5); setSel((p) => ({ ...p, [g]: p[g].filter((x) => x !== t) })); }}
                                                >
                                                    {FILTER_GROUPS[g].find((i) => i.tag === t)?.label || t} ✕
                                                </button>
                                            )))}
                                        <button className={styles.selClear} onClick={() => { haptic(6); setSel(EMPTY_SEL); }}>Tout effacer</button>
                                    </div>
                                </div>
                            )}

                            {/* Pied épinglé : le compte et le bouton ne doivent jamais
                                partir sous le pli quand les pastilles défilent. */}
                            <div className={styles.composeFooter}>
                                {selCount > 0 && selMatches < NEEDED && (
                                    <div className={styles.selCountLow}>
                                        Trop peu pour {NEEDED} créneaux — certains sortiront du filtre.
                                    </div>
                                )}
                                <button
                                    className={styles.composeLaunch}
                                    onClick={() => compose(selCount ? sel : null)}
                                    disabled={selCount > 0 && selMatches === 0}
                                >
                                    {selCount
                                        ? `Composer · ${selMatches} recette${selMatches > 1 ? 's' : ''}`
                                        : 'Composer au hasard'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Déroulé de la soirée : sur MOBILE, feuille modale ; sur DESKTOP, vue
                inline dans le panneau (gérée par le retour anticipé plus haut). */}
            <AnimatePresence>
                {showTimeline && !embedded && (
                    <motion.div
                        className={styles.menuBackdrop}
                        onClick={() => setShowTimeline(false)}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <motion.div
                            className={styles.timelineSheet}
                            onClick={(e) => e.stopPropagation()}
                            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                        >
                            <div className={styles.timelineHead}>
                                <div>
                                    <div className={styles.composeTitle}>Déroulé de la soirée</div>
                                    <div className={styles.composeHint}>Quand lancer chaque plat pour tout servir à l’heure.</div>
                                </div>
                                <button className={styles.timelineClose} onClick={() => setShowTimeline(false)} aria-label="Fermer">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                                </button>
                            </div>
                            <CookingTimeline items={timelineItems} />
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
            <Tip id="planner" />
        </div>
    );
}
