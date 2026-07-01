'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { mockRecipes } from '@/data/mockData';
import { decodeHtml } from '@/lib/utils';
import Link from 'next/link';
import { normalizeIng, parseIngredient } from '@/lib/ingredients';
import { rayonOf, RAYON_BY_ID } from '@/lib/rayons';
import { supabase } from '@/lib/supabase';
import styles from './WeekPlanner.module.css';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MEALS = ['Midi', 'Soir'] as const;

// Listes complètes — identiques à la barre de filtres de l'accueil (MagicFilterBar).
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
        { label: '🇺🇸 USA', tag: 'USA' },
    ],
    tendances: [
        { label: '🔥 Airfryer', tag: 'Airfryer' },
        { label: '💡 Astuces', tag: 'Astuces' },
        { label: '🥩 Barbecue', tag: 'Barbecue' },
        { label: '🥤 Rafraîchissements', tag: 'boissons' },
        { label: '🍝 Dolce Vita', tag: 'dolce-vita' },
        { label: '⚡ Express', tag: 'Express' },
        { label: '👨‍👩‍👧 Famille', tag: 'famille' },
        { label: '🍦 Les Glaces', tag: 'glaces' },
        { label: '🌿 Healthy', tag: 'Healthy' },
        { label: '🎄 Noël', tag: 'Noël' },
        { label: '🐰 Pâques', tag: 'pâques' },
        { label: '💰 Pas Cher', tag: 'Pas cher' },
        { label: '🥫 Sauces', tag: 'sauces' },
        { label: '✨ Simplissime', tag: 'simplissime' },
        { label: '☀️ Voilà l\'été', tag: 'voila-lete' },
        { label: '🥬 Végé', tag: 'vegetarien' },
        { label: '❄️ C\'est l\'hiver', tag: 'cest-lhiver' },
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
const HIDDEN_DAYS_KEY = 'meal-planner-hidden-days';
const DAY_FULL: Record<string, string> = { Lun: 'Lundi', Mar: 'Mardi', Mer: 'Mercredi', Jeu: 'Jeudi', Ven: 'Vendredi', Sam: 'Samedi', Dim: 'Dimanche' };
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
    const [hiddenDays, setHiddenDays] = useState<string[]>([]);
    // Mini-résumé de la liste affiché sous le panneau juste après "Valider".
    const [recap, setRecap] = useState<{ total: number; rayons: { id: string; n: number }[] } | null>(null);
    // side: true → le picker cible l'accompagnement du plat de ce créneau (recipe.side)
    const [picker, setPicker] = useState<{ day: string; meal: string; side?: boolean } | null>(null);
    // Cadenas de catégorie déverrouillé → l'utilisateur voit TOUTES les recettes.
    const [lockOpen, setLockOpen] = useState(false);
    // Slot en cours de glisser-déposer (vue semaine).
    const [drag, setDrag] = useState<{ day: string; meal: string } | null>(null);
    const [dragOver, setDragOver] = useState<string | null>(null);
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
        setRecap(null); // le mini-résumé n'apparaît qu'APRÈS un Valider de la session courante
        try { setHiddenCourses(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')); } catch {}
        try { setHiddenDays(JSON.parse(localStorage.getItem(HIDDEN_DAYS_KEY) || '[]')); } catch {}
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
        if (picker) { setLockOpen(false); setTimeout(() => inputRef.current?.focus(), 100); }
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
        // …et le survol "recettes du jour" de l'icône planificateur (Header).
        window.dispatchEvent(new Event('meal-plan-updated'));
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

    // Glisser-déposer : déplace la recette d'un créneau vers un autre (midi↔soir, autre jour).
    // La recette présente sur la cible est REMPLACÉE (annulée) par celle qu'on dépose.
    const moveSlot = (from: { day: string; meal: string }, to: { day: string; meal: string }) => {
        if (from.day === to.day && from.meal === to.meal) return;
        const r = plan[from.day]?.[from.meal];
        if (!r) return;
        const np = { ...plan };
        np[from.day] = { ...np[from.day] };
        delete np[from.day][from.meal];
        if (!Object.keys(np[from.day]).length) delete np[from.day];
        np[to.day] = { ...(np[to.day] || {}) };
        np[to.day][to.meal] = r;
        clearSlotChecks(k => k.startsWith(`${from.day}|${from.meal}|`) || k.startsWith(`${to.day}|${to.meal}|`));
        save(np);
    };

    const assignRecipe = (recipe: any) => {
        if (!picker) return;
        const np = { ...plan };
        if (!np[picker.day]) np[picker.day] = {};
        if (picker.side) {
            // Accompagnement : on l'attache au plat existant (recipe.side), comme le Menu IA.
            const main = np[picker.day][picker.meal];
            if (main) np[picker.day][picker.meal] = { ...main, side: recipe };
        } else {
            np[picker.day][picker.meal] = recipe;
            clearSlotChecks(k => k.startsWith(`${picker.day}|${picker.meal}|`));
        }
        save(np);
        closePicker();
    };

    // Retire l'accompagnement attaché à un plat
    const removeSide = (day: string, meal: string) => {
        const np = { ...plan };
        const main = np[day]?.[meal];
        if (main?.side) { const { side, ...rest } = main; np[day][meal] = rest; save(np); }
    };

    const closePicker = () => {
        setPicker(null);
        setLockOpen(false);
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

    // Jours visibles de la semaine. Supprimer un jour vide sa colonne du plan
    // (donc il disparaît aussi des ingrédients de la semaine) ; le rajouter le
    // ré-affiche vide. Même logique que les cartes Jour J.
    const visibleDays = DAYS.filter(d => !hiddenDays.includes(d));
    const toggleDay = (day: string) => {
        setHiddenDays(prev => {
            const hiding = !prev.includes(day);
            const next = hiding ? [...prev, day] : prev.filter(d => d !== day);
            localStorage.setItem(HIDDEN_DAYS_KEY, JSON.stringify(next));
            if (hiding) {
                // Vide les recettes du jour supprimé → absentes des ingrédients de la semaine.
                const np = { ...plan };
                delete np[day];
                clearSlotChecks(k => k.startsWith(`${day}|`));
                save(np);
            }
            return next;
        });
    };

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
        let plats = mockRecipes.filter(r => isMainDish(r) && matchesTheme(r, theme));
        if (!plats.length) plats = mockRecipes.filter(isMainDish);
        const shuffled = shuffle(plats);
        const slots: [string, string][] = [];
        visibleDays.forEach(d => MEALS.forEach(m => slots.push([d, m])));
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
            const inCourse = (r: any) =>
                c.label === 'Plat' ? isMainDish(r)
                : !('cat' in c) ? isSideDish(r) // carte Accompagnement
                : r.category === c.cat;
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

    // #2 — Menu IA : composition ÉQUILIBRÉE déterministe (fiable, instantanée).
    // Détecte la protéine de chaque plat, alterne d'un repas à l'autre, évite la
    // même protéine 2 fois le même jour ou 2 repas de suite, et favorise la variété
    // (végé / poisson inclus en priorité).
    const [iaBusy, setIaBusy] = useState(false);

    const proteinOf = (r: any): string => {
        const t = `${r.title || ''} ${(r.tags || []).join(' ')} ${(r.ingredients || []).map((i: any) => i.name).join(' ')}`.toLowerCase();
        if (/poisson|saumon|thon|cabillaud|crevette|colin|merlu|sardine|maquereau|gambas|lieu|truite|dorade|crustac/.test(t)) return 'poisson';
        if (/agneau|mouton/.test(t)) return 'agneau';
        if (/b[oœ]uf|steak|bavette|kefta|carne|bourguignon|paleron/.test(t)) return 'boeuf';
        if (/\bporc\b|lardon|jambon|bacon|saucisse|chorizo|p[âa]t[ée]/.test(t)) return 'porc';
        if (/poulet|volaille|dinde|chicken|pollo|escalope/.test(t)) return 'poulet';
        if (/v[ée]g[ée]tarien|tofu|pois chiche|lentille|aubergine|courgette|champignon|brocoli|[ée]pinard|l[ée]gume|halloumi|f[ée]ta/.test(t)) return 'vege';
        return 'autre';
    };

    // Reclassement automatique des recettes (règle utilisateur) :
    //  • pas de viande/poisson  → accompagnement (jamais en plat principal)
    //  • c'est une sauce        → sauce (exclue des plats principaux ET des accompagnements)
    const MEAT_FISH = new Set(['poisson', 'boeuf', 'agneau', 'porc', 'poulet']);
    const isSauce = (r: any): boolean =>
        (r.tags || []).some((t: string) => /sauce/i.test(t)) || /\bsauces?\b/i.test(r.title || '');
    // Sucré (dessert / pâtisserie / glace / boisson) : exclu des plats ET des
    // accompagnements (règle utilisateur : un accompagnement = légume / féculent salé).
    const SWEET_RX = /glace|sorbet|g[âa]teau|cr[êe]pe|gaufre|tiramisu|mousse au chocolat|panna cotta|\bflan\b|cheesecake|clafoutis|crumble|cookie|brownie|muffin|cupcake|macaron|[ée]clair|beignet|churros|pancake|nougat|pavlova|profiterole|riz au lait|pain perdu|pain d['’][ée]pices|compote|tarte sucr|tarte aux (pomme|fraise|citron|framboise|abricot|poire|myrtille)|cr[èe]me (br[ûu]l[ée]e|p[âa]tissi[èe]re|dessert|anglaise)|fondant au chocolat/i;
    const isSweet = (r: any): boolean =>
        ['desserts', 'dessert', 'patisserie', 'patisseries', 'glaces', 'glace', 'boissons'].includes((r.category || '').toLowerCase())
        || (r.tags || []).some((t: string) => /dessert|p[âa]tisserie|glace|sorbet|sucr/i.test(t))
        || SWEET_RX.test(r.title || '');
    // Vrai PLAT = catégorie plats, cuisinable, non-sauce, avec une protéine viande/poisson.
    const isMainDish = (r: any): boolean =>
        r.category === 'plats' && isCookable(r) && !isSauce(r) && MEAT_FISH.has(proteinOf(r));

    // Un plat est "complet" s'il embarque déjà un accompagnement (féculent ou légume).
    // Sinon le Menu IA lui adjoint une recette d'accompagnement (recipe.side).
    const SIDE_RX = /\briz\b|p[âa]tes|pasta|spaghetti|tagliatelle|nouille|pur[ée]e|pomme de terre|patate|frite|semoule|couscous|boulgour|quinoa|polenta|gnocchi|lentille|haricot|brocoli|[ée]pinard|courgette|aubergine|carotte|poireau|chou|champignon|petits pois|ratatouille|l[ée]gume|salade|gratin|po[êe]l[ée]e/i;
    const hasSideIncluded = (r: any): boolean =>
        SIDE_RX.test(r.title || '') || (r.ingredients || []).some((i: any) => SIDE_RX.test(i?.name || ''));
    // Pool d'accompagnements : recettes taggées "Accompagnements" + tout plat SANS viande/poisson
    // (légumes/féculents), hors sauces.
    const isSideDish = (r: any): boolean => {
        if (!isCookable(r) || isSauce(r) || isSweet(r)) return false;
        if ((r.tags || []).some((t: string) => /accompagnement/i.test(t))) return true;
        return r.category === 'plats' && !MEAT_FISH.has(proteinOf(r));
    };

    const fillIA = (theme?: string) => {
        if (view !== 'semaine') { fillJourJ(theme); return; }
        setIaBusy(true);
        try {
            let plats = mockRecipes.filter(r => isMainDish(r) && matchesTheme(r, theme));
            if (plats.length < 14) plats = mockRecipes.filter(isMainDish);

            // Regroupe par protéine (mélangé pour varier à chaque clic).
            const groups: Record<string, any[]> = {};
            shuffle(plats).forEach(r => { const p = proteinOf(r); (groups[p] = groups[p] || []).push(r); });
            // Ordre de priorité : végé/poisson d'abord pour garantir leur présence + variété.
            const order = ['vege', 'poisson', 'boeuf', 'agneau', 'porc', 'poulet', 'autre'].filter(g => groups[g]?.length);

            const used = new Set<string>();
            const popFrom = (g: string): any | null => {
                const arr = groups[g];
                while (arr && arr.length) { const r = arr.shift(); if (r && !used.has(r.id)) { used.add(r.id); return r; } }
                return null;
            };

            const slots: [string, string][] = [];
            visibleDays.forEach(d => MEALS.forEach(m => slots.push([d, m])));

            // File d'accompagnements (mélangée, sans doublon sur la semaine).
            const sideQueue = shuffle(mockRecipes.filter(isSideDish));
            const popSide = (): any | null => {
                while (sideQueue.length) { const s = sideQueue.shift(); if (s && !used.has(s.id)) { used.add(s.id); return s; } }
                return null;
            };

            const np: Plan = { ...plan };
            let gi = 0, lastProtein: string | null = null;
            const dayProtein: Record<string, string> = {};

            slots.forEach(([day, meal]) => {
                np[day] = { ...(np[day] || {}) };
                let chosen: any = null, chosenP: string | null = null;
                // 1) groupe différent du repas précédent ET de l'autre repas du jour
                for (let k = 0; k < order.length; k++) {
                    const g = order[(gi + k) % order.length];
                    if (!groups[g]?.length || g === lastProtein || dayProtein[day] === g) continue;
                    const r = popFrom(g);
                    if (r) { chosen = r; chosenP = g; gi = (gi + k + 1) % order.length; break; }
                }
                // 2) sinon n'importe quel groupe avec du stock
                if (!chosen) for (const g of order) { const r = popFrom(g); if (r) { chosen = r; chosenP = g; break; } }
                if (chosen) {
                    // Plat sans féculent/légume intégré → on lui adjoint un accompagnement.
                    if (!hasSideIncluded(chosen)) {
                        const side = popSide();
                        if (side) chosen = { ...chosen, side };
                    }
                    np[day][meal] = chosen; lastProtein = chosenP; dayProtein[day] = chosenP as string;
                }
            });

            clearSlotChecks(k => !k.startsWith(`${JOUR_J_KEY}|`));
            save(np);
            setValidated(false);
        } finally {
            setIaBusy(false);
        }
    };

    // ── Mise à jour de la liste de courses au moment du "Valider" ──
    const collectViewRecipes = () => {
        const map = new Map<string, { recipe: any; count: number }>();
        const add = (r: any) => { if (!r?.id) return; const e = map.get(r.id); map.set(r.id, { recipe: r, count: (e?.count || 0) + 1 }); };
        if (view === 'semaine') visibleDays.forEach(d => MEALS.forEach(m => add(plan[d]?.[m])));
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
        // Compte le nombre de LIGNES distinctes du plan courant (toast + mini-résumé par rayon)
        const lineKeys = new Set<string>();
        const rayonCount = new Map<string, number>();
        recipes.forEach(({ recipe }) => {
            (recipe.ingredients || []).forEach((i: any) => {
                if (!i?.name) return;
                const p = parseIngredient(`${i.quantity || ''} ${i.name || ''}`.trim());
                if (!p.name) return;
                const k = `${normalizeIng(p.name)}|${p.unit}`;
                if (lineKeys.has(k)) return;
                lineKeys.add(k);
                const rid = rayonOf(p.name, {});
                rayonCount.set(rid, (rayonCount.get(rid) || 0) + 1);
            });
        });
        const total = lineKeys.size;
        const rayons = [...rayonCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => ({ id, n }));
        setRecap({ total, rayons });
        localStorage.setItem('magic-shopping-list', JSON.stringify(data));
        window.dispatchEvent(new Event('shoppingListUpdated'));
        window.dispatchEvent(new CustomEvent('magic-toast-notify', {
            detail: `${total} ingrédient${total > 1 ? 's' : ''} ajouté${total > 1 ? 's' : ''} à ta liste 🛒`,
        }));
    };

    // Verrou de catégorie : carte Jour J → la catégorie de la carte ; picker.side →
    // uniquement des accompagnements.
    const courseLock = picker?.side
        ? COURSES.find(c => c.label === 'Accompagnement') || null
        : picker?.day === JOUR_J_KEY
            ? COURSES.find(c => c.label === picker.meal) || null
            : null;
    // Cadenas ouvert → on ignore le verrou et on montre toutes les recettes.
    const effectiveLock = lockOpen ? null : courseLock;

    const searchResults = useMemo(() => {
        let base = mockRecipes.filter(r => r.category !== 'restaurant');
        if (effectiveLock) {
            base = base.filter(r =>
                effectiveLock.label === 'Plat' ? isMainDish(r)
                : effectiveLock.label === 'Accompagnement' ? isSideDish(r)
                : isCookable(r) && 'cat' in effectiveLock && r.category === effectiveLock.cat
            );
        }
        if (ingMode && ingTags.length > 0) {
            const tags = ingTags.map(t => normalize(t));
            return base.map(r => {
                const names = r.ingredients.map(i => normalize(i.name));
                const matched = tags.filter(t => names.some(n => n.includes(t))).length;
                return { r, score: matched };
            }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.r);
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
            // Pas de filtre : on montre tout (catégorie verrouillée incluse), trié récent.
            return [...base].sort((a, b) => parseInt(b.id) - parseInt(a.id));
        }
        // Filtre/catégorie/pays/tendance actif : TOUTES les recettes correspondantes (scroll).
        return pool;
    }, [query, activeFilter, ingMode, ingTags, picker, lockOpen]);

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
                            if (!next) setRecap(null);
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
                                <button className={styles.randomBtn} onClick={() => fillIA()} disabled={iaBusy} title="Menu équilibré composé par l'IA">
                                    {iaBusy ? 'Composition…' : 'Menu IA'}
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
                                <>
                                <div className={styles.daysRow}>
                                    {visibleDays.map(day => (
                                        <div key={day} className={styles.dayCard}>
                                            <div className={styles.dayName}>
                                                {day}
                                                {!validated && (
                                                    <button className={styles.deleteDay} title="Supprimer ce jour" onClick={() => toggleDay(day)}>✕</button>
                                                )}
                                            </div>
                                            {MEALS.map(meal => {
                                                const recipe = plan[day]?.[meal];
                                                const slotKey = `${day}|${meal}`;
                                                return (
                                                    <div
                                                        key={meal}
                                                        className={`${styles.mealSlot} ${dragOver === slotKey ? styles.dropTarget : ''}`}
                                                        onDragOver={!validated ? (e) => { if (!drag) return; e.preventDefault(); setDragOver(slotKey); } : undefined}
                                                        onDragLeave={() => setDragOver(prev => prev === slotKey ? null : prev)}
                                                        onDrop={!validated ? (e) => { if (!drag) return; e.preventDefault(); moveSlot(drag, { day, meal }); setDrag(null); setDragOver(null); } : undefined}
                                                    >
                                                        <div className={styles.mealTag}>{meal}</div>
                                                        {recipe ? (
                                                            <>
                                                            <div
                                                                className={`${styles.recipeVignette} ${validated ? styles.clickable : ''} ${drag?.day === day && drag?.meal === meal ? styles.dragging : ''}`}
                                                                draggable={!validated}
                                                                onDragStart={!validated ? () => setDrag({ day, meal }) : undefined}
                                                                onDragEnd={() => { setDrag(null); setDragOver(null); }}
                                                                onClick={() => validated ? openRecipe(recipe) : setPicker({ day, meal })}
                                                            >
                                                                <img src={recipe.image} alt={recipe.title} className={styles.vignetteImg} />
                                                                <div className={styles.vignetteTitle}>{decodeHtml(recipe.title)}</div>
                                                                {!validated && (
                                                                    <button className={styles.removeVignette} onClick={e => { e.stopPropagation(); removeSlot(day, meal); }}>✕</button>
                                                                )}
                                                            </div>
                                                            {/* Accompagnement (Menu IA ou ajouté à la main) — cliquable vers sa fiche */}
                                                            {recipe.side ? (
                                                                <div
                                                                    className={styles.sideVignette}
                                                                    onClick={(e) => { e.stopPropagation(); validated ? openRecipe(recipe.side) : setPicker({ day, meal, side: true }); }}
                                                                    title={`Accompagnement : ${decodeHtml(recipe.side.title)}`}
                                                                >
                                                                    {recipe.side.image
                                                                        ? <img src={recipe.side.image} alt={recipe.side.title} className={styles.sideThumb} />
                                                                        : <span className={styles.sideThumbFallback}>🥗</span>}
                                                                    <div className={styles.sideMeta}>
                                                                        <span className={styles.sideBadge}>Accompagnement</span>
                                                                        <span className={styles.sideName}>{decodeHtml(recipe.side.title)}</span>
                                                                    </div>
                                                                    {!validated && (
                                                                        <button className={styles.removeSide} onClick={e => { e.stopPropagation(); removeSide(day, meal); }} title="Retirer l'accompagnement">✕</button>
                                                                    )}
                                                                </div>
                                                            ) : !validated ? (
                                                                <button className={styles.addSideBtn} onClick={(e) => { e.stopPropagation(); setPicker({ day, meal, side: true }); }}>
                                                                    + Accompagnement
                                                                </button>
                                                            ) : null}
                                                            </>
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
                                {!validated && hiddenDays.length > 0 && (
                                    <div className={styles.addCourses}>
                                        <span className={styles.addLabel}>Ajouter un jour :</span>
                                        {DAYS.filter(d => hiddenDays.includes(d)).map(d => (
                                            <button key={d} className={styles.addCourseBtn} onClick={() => toggleDay(d)}>+ {DAY_FULL[d]}</button>
                                        ))}
                                    </div>
                                )}
                                </>
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
                    {/* Mini-résumé de la liste, visible juste après "Valider" */}
                    {recap && validated && recap.total > 0 && (
                        <div className={styles.recap}>
                            <div className={styles.recapInfo}>
                                <span className={styles.recapTotal}>🛒 {recap.total} ingrédient{recap.total > 1 ? 's' : ''} dans ta liste</span>
                                <div className={styles.recapRayons}>
                                    {recap.rayons.map(r => {
                                        const ra = RAYON_BY_ID[r.id] || RAYON_BY_ID['autre'];
                                        return <span key={r.id} className={styles.recapChip}>{ra.emoji} {ra.label} · {r.n}</span>;
                                    })}
                                </div>
                            </div>
                            <Link href="/shopping-list" className={styles.recapLink} onClick={onClose}>Voir la liste →</Link>
                        </div>
                    )}
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

                        {/* Catégorie verrouillée (ouverture depuis une carte Jour J / accompagnement).
                            Clic sur le cadenas → déverrouille et affiche toutes les recettes. */}
                        {courseLock && (
                            <button
                                type="button"
                                className={styles.lockBanner}
                                onClick={() => setLockOpen(o => !o)}
                                title={lockOpen ? 'Reverrouiller sur cette catégorie' : 'Voir toutes les recettes'}
                            >
                                {lockOpen
                                    ? <>🔓 Toutes les recettes — <strong>cliquer pour reverrouiller sur {courseLock.label}</strong></>
                                    : <>🔒 Recettes : <strong>{courseLock.label}</strong> uniquement — cliquer pour tout voir</>}
                            </button>
                        )}

                        {/* Groupes Catégorie / Pays / Tendances */}
                        {!ingMode && !effectiveLock && (
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
                        {activeGroup && !ingMode && !effectiveLock && (
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
