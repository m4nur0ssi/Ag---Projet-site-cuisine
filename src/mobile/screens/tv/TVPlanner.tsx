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
import PrixMoyen from '@/components/PrixMoyen/PrixMoyen';
import { prixRecette, additionner } from '@/lib/recipe-price';
import { normalizeIng, parseIngredient } from '@/mobile/lib/ingredients';
import { rayonOf } from '@/lib/rayons';
import { isCookable, hasSideIncluded, isSweet, proteinOf } from '@/lib/mealClassify';
import { isTVSide, isTVMain, sidePool } from './sides';
import {
    DAYS, DAY_FULL, MEALS, JOUR_J, COURSES, todayIndex,
    chargerPlan, enregistrerPlan, poserRecette, oublierCoches, PLAN_EVENT,
    posableEnSemaine, recetteEnMain, prendreEnMain, origineEnMain, reposer, creneauAccepte, EN_MAIN_EVENT,
    type Plan, type Slot,
} from './plan';
import { matchesTag } from './themes';
import { pourAdultes } from '@/lib/bebe';

/*
 * Ce que le planificateur a le droit de piocher TOUT SEUL : pas de recette de
 * bébé dans un menu composé pour la table. Poser une recette de bébé à la main
 * reste possible — c'est un choix, pas un tirage.
 */
const CATALOGUE_AUTO = mockRecipes.filter(pourAdultes);
import { FILTER_GROUPS, type FilterGroup } from '@/lib/searchFilters';
import { partagerMenu, preparerMenu } from '@/lib/partage-menu';
import { supabase } from '@/mobile/lib/supabase';
import { totalMinutes, formatMinutes } from './timing';
import { estimateRecipeTiming } from '@/lib/recipe-timing';
import { haptic } from './TVHome';
import { readCart, removeCartRecipe, CART_EVENT, type CartRecipe } from './recipeCart';
import { timingFromSteps, passiveLabelFor, COURSE_OFFSET, type TimelineInput } from '@/lib/cooking-timeline';
import styles from './tv.module.css';
import Tip from '@/components/Tip/Tip';
import TVToast from './TVToast';
import { ecrireStock } from '@/lib/stockage';
import { ouvrirClavier } from '@/lib/clavier';

const TVSpotlight = dynamic(() => import('./TVSpotlight'), { ssr: false });
const CookingTimeline = dynamic(() => import('@/mobile/components/CookingTimeline/CookingTimeline'), { ssr: false });
const RecipeSheet = dynamic(() => import('@/mobile/components/RecipeSheet/RecipeSheet'), { ssr: false });


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
    /*
     * La recette apportée depuis une carte ou une fiche.
     *
     * On arrive ici en la tenant : tous les créneaux qui l'acceptent affichent
     * « Poser ici », et une barre en bas rappelle ce qu'on a dans la main tant
     * qu'on ne l'a pas posée.
     */
    const [enMain, setEnMain] = useState<Recipe | null>(null);
    /** Partage : « ça part… », puis le lien copié ou la feuille du système. */
    const [partage, setPartage] = useState<'repos' | 'en-cours'>('repos');
    useEffect(() => {
        setEnMain(recetteEnMain());
        const suivre = (e: Event) => setEnMain((e as CustomEvent).detail as Recipe | null);
        window.addEventListener(EN_MAIN_EVENT, suivre);
        return () => window.removeEventListener(EN_MAIN_EVENT, suivre);
    }, []);
    const pagerRef = useRef<HTMLDivElement>(null);

    // ── Chargement : Supabase si connecté, sinon cache local ───────────────
    useEffect(() => {
        let vivant = true;
        chargerPlan().then((p) => { if (vivant) setPlan(p); });
        return () => { vivant = false; };
    }, []);

    /* La semaine se remplit aussi d'ailleurs (volet « Ajouter au
       planificateur » d'une carte ou d'une fiche). L'écran, s'il est déjà
       ouvert derrière, doit montrer le créneau qui vient d'être pris. */
    useEffect(() => {
        const onPlan = (e: Event) => setPlan((e as CustomEvent).detail as Plan);
        window.addEventListener(PLAN_EVENT, onPlan);
        return () => window.removeEventListener(PLAN_EVENT, onPlan);
    }, []);

    /** Enregistre partout : local, Supabase, et prévient la liste de courses. */
    const save = useCallback(async (next: Plan) => {
        setPlan(next);
        await enregistrerPlan(next);
    }, []);

    const setSlot = (day: string, meal: string, recipe: Recipe | null) => {
        save(poserRecette(plan, day, meal, recipe));
    };

    /* ── Déplacer un repas d'un jour à l'autre ───────────────────────────────
     *
     * Jusqu'ici, changer un plat de jour demandait de le retirer, d'aller au
     * bon créneau, puis de le rechercher. On l'attrape désormais et on le
     * dépose : au doigt, l'appui tenu décolle la carte ; à la souris, trois
     * pixels suffisent. Le créneau visé s'allume, et s'il est déjà pris les
     * deux repas s'échangent — jamais rien ne disparaît en route.
     *
     * DEUX PRÉCAUTIONS qui expliquent la forme du code :
     *
     *   • ce qui suit le doigt est un SOSIE posé dans la page, pas la carte
     *     elle-même. L'écran se redessine sans prévenir (la semaine change, un
     *     message passe) et la vraie carte est alors reconstruite : elle
     *     repartait à sa place au milieu du geste ;
     *   • les mouvements sont écoutés sur la FENÊTRE, pas sur la carte. Sans
     *     ça, dès que la carte est reconstruite, plus personne ne reçoit la
     *     suite du glissé.
     */
    const tirage = useRef<{
        day: string; meal: string; rect: DOMRect; sosie: HTMLElement | null;
        x: number; y: number; touch: boolean;
        presse: ReturnType<typeof setTimeout> | null; actif: boolean;
    } | null>(null);
    const vise = useRef<HTMLElement | null>(null);
    /** Instant du dernier lâcher : le clic qui suit appartient au glissé. */
    const apresTirage = useRef(0);
    /** Dernier changement de jour pendant un glissé (le pager ne saute pas en boucle). */
    const dernierSaut = useRef(0);
    const defile = useRef<ReturnType<typeof setInterval> | null>(null);

    const creneauSous = (x: number, y: number): HTMLElement | null => {
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        return (el?.closest('[data-creneau]') as HTMLElement | null) || null;
    };

    const viser = (el: HTMLElement | null) => {
        if (vise.current === el) return;
        vise.current?.classList.remove(styles.planSlotCible);
        const t = tirage.current;
        if (el && el.dataset.creneau !== `${t?.day}|${t?.meal}`) {
            el.classList.add(styles.planSlotCible);
            vise.current = el;
        } else {
            vise.current = null;
        }
    };

    /** Poser le repas ailleurs. Créneau occupé : les deux s'échangent. */
    const deplacer = (de: { day: string; meal: string }, vers: { day: string; meal: string }) => {
        if (de.day === vers.day && de.meal === vers.meal) return;
        const source = plan[de.day]?.[de.meal];
        if (!source) return;
        const cible = plan[vers.day]?.[vers.meal];
        let next = poserRecette(plan, de.day, de.meal, (cible as Recipe) || null);
        next = poserRecette(next, vers.day, vers.meal, source as Recipe);
        save(next);
        reposer();   // le geste est allé au bout : la main se rouvre
        haptic(14);
        window.dispatchEvent(new CustomEvent('magic-toast-notify', {
            detail: {
                text: cible
                    ? `${label(source)} et ${label(cible)} ont échangé de place`
                    : `${label(source)} · ${DAY_FULL[vers.day] || vers.day} ${vers.meal.toLowerCase()}`,
            },
        }));
    };

    /*
     * Défilement automatique près des bords : une semaine ne tient pas dans un
     * écran. En haut et en bas, la page défile ; à gauche et à droite, on
     * change de JOUR — c'est ce qui permet d'emmener un plat de lundi à
     * dimanche sans lâcher.
     */
    const arreterDefilement = () => {
        if (defile.current) { clearInterval(defile.current); defile.current = null; }
    };
    const bordsPendantLeGlisse = (x: number, y: number) => {
        const marge = 110;
        const pas = y < marge ? -14 : y > window.innerHeight - marge ? 14 : 0;
        if (!pas) arreterDefilement();
        else if (!defile.current) defile.current = setInterval(() => window.scrollBy(0, pas), 16);

        if (mode !== 'semaine') return;
        const el = pagerRef.current;
        if (!el) return;
        // Les bords du CARROUSEL, pas ceux de la fenêtre : au bureau, la semaine
        // n'occupe qu'un panneau, et l'écran est large.
        const cadre = el.getBoundingClientRect();
        const bord = 54;
        const sens = x < cadre.left + bord ? -1 : x > cadre.right - bord ? 1 : 0;
        if (!sens || Date.now() - dernierSaut.current < 700) return;
        const courant = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
        const suivant = Math.max(0, Math.min(DAYS.length - 1, courant + sens));
        if (suivant === courant) return;
        dernierSaut.current = Date.now();
        haptic(8);
        goToDay(suivant);
    };

    /** Le sosie : la carte que l'on voit voyager sous le doigt. */
    const creerSosie = (source: HTMLElement, rect: DOMRect) => {
        const sosie = source.cloneNode(true) as HTMLElement;
        sosie.style.cssText = [
            'position:fixed', `left:${rect.left}px`, `top:${rect.top}px`,
            `width:${rect.width}px`, `height:${rect.height}px`,
            'margin:0', 'z-index:30000', 'pointer-events:none',
            'opacity:0.94', 'transform:scale(1.03)', 'transition:none',
            'box-shadow:0 24px 60px rgba(0,0,0,.6)', 'border-radius:18px',
        ].join(';');
        document.body.appendChild(sosie);
        return sosie;
    };

    const finTirage = (x?: number, y?: number) => {
        arreterDefilement();
        const t = tirage.current;
        tirage.current = null;
        window.removeEventListener('pointermove', enMouvement);
        window.removeEventListener('pointerup', auLacher);
        window.removeEventListener('pointercancel', auLacher);
        if (t?.presse) clearTimeout(t.presse);
        t?.sosie?.remove();
        const cible = t?.actif
            ? (vise.current || (x != null && y != null ? creneauSous(x, y) : null))
            : null;
        if (t?.actif) apresTirage.current = Date.now();
        vise.current?.classList.remove(styles.planSlotCible);
        vise.current = null;
        const dest = cible?.dataset.creneau?.split('|');
        if (t?.actif && dest && dest.length === 2) deplacer({ day: t.day, meal: t.meal }, { day: dest[0], meal: dest[1] });
    };

    /*
     * Les écouteurs posés sur la fenêtre doivent garder la MÊME identité pour
     * pouvoir être retirés — mais lire, eux, l'état du rendu courant. D'où ce
     * relais : une enveloppe stable, un contenu remis à jour à chaque rendu.
     */
    const bougerRef = useRef<(e: PointerEvent) => void>(() => {});
    const lacherRef = useRef<(e: PointerEvent) => void>(() => {});
    const enMouvement = useCallback((e: PointerEvent) => bougerRef.current(e), []);
    const auLacher = useCallback((e: PointerEvent) => lacherRef.current(e), []);

    bougerRef.current = (e: PointerEvent) => {
        const t = tirage.current;
        if (!t) return;
        const dx = e.clientX - t.x;
        const dy = e.clientY - t.y;
        if (!t.actif) {
            if (!t.touch) { if (Math.hypot(dx, dy) > 3) demarrerTirage(); return; }
            // Le doigt bouge avant que la carte décolle : c'est un défilement.
            if (Math.hypot(dx, dy) > 12) { if (t.presse) clearTimeout(t.presse); finTirage(); }
            return;
        }
        // La page ne défile plus sous la carte qu'on tient.
        if (e.cancelable) e.preventDefault();
        if (t.sosie) t.sosie.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`;
        viser(creneauSous(e.clientX, e.clientY));
        bordsPendantLeGlisse(e.clientX, e.clientY);
    };
    lacherRef.current = (e: PointerEvent) => finTirage(e.clientX, e.clientY);

    const demarrerTirage = () => {
        const t = tirage.current;
        if (!t || t.actif) return;
        const source = document.querySelector(`[data-creneau="${t.day}|${t.meal}"] button[class*="planCard"]`) as HTMLElement | null;
        const repas = plan[t.day]?.[t.meal];
        if (!source || !repas) return;
        t.actif = true;
        t.presse = null;
        haptic(12);
        t.sosie = creerSosie(source, t.rect);
        /*
         * L'appui long fait DEUX choses à la fois, et c'est voulu : la carte
         * décolle pour qui veut la faire glisser, et la recette passe « en
         * main » pour qui préfère lâcher, changer de jour tranquillement, puis
         * toucher un créneau. Un seul geste, deux façons de s'en servir — la
         * semaine défile un jour par écran, viser à l'aveugle en tenant le
         * doigt appuyé n'est pas donné à tout le monde.
         */
        prendreEnMain(repas as Recipe, { jour: t.day, repas: t.meal });
    };

    /** Les gestes de la carte d'un créneau, prêts à étaler sur le bouton. */
    const prises = (day: string, meal: string) => ({
        onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
            if (e.button === 2) return;
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const touch = e.pointerType !== 'mouse';
            const t = {
                day, meal, rect, sosie: null as HTMLElement | null,
                x: e.clientX, y: e.clientY, touch,
                presse: null as ReturnType<typeof setTimeout> | null, actif: false,
            };
            tirage.current = t;
            window.addEventListener('pointermove', enMouvement, { passive: false });
            window.addEventListener('pointerup', auLacher);
            window.addEventListener('pointercancel', auLacher);
            // Au doigt, l'appui TENU décolle la carte : un glissé immédiat doit
            // rester un défilement de la page.
            if (touch) t.presse = setTimeout(() => { if (tirage.current === t) demarrerTirage(); }, 300);
        },
    });

    /** Accompagnement rattaché au plat du créneau (même forme qu'en prod). */
    const setSide = (day: string, meal: string, side: Recipe | null) => {
        const main = plan[day]?.[meal];
        if (!main) return;
        const next: Plan = { ...plan, [day]: { ...(plan[day] || {}) } };
        if (side) { next[day][meal] = { ...main, side }; oublierCoches(day, meal); }
        else { const { side: _drop, ...rest } = main; next[day][meal] = rest as Slot; }
        save(next);
    };

    const clearAll = () => {
        const isJourJ = mode === 'jourj';
        // Plus de fenêtre système : elle cassait net l'écran TV+. On efface, et
        // on DIT ce qui vient de disparaître — c'est le message qui rassure,
        // pas la question posée avant.
        haptic(12);
        const next: Plan = { ...plan };
        const retires = isJourJ
            ? Object.keys(plan[JOUR_J] || {}).length
            : DAYS.reduce((n, d) => n + Object.keys(plan[d] || {}).length, 0);
        if (isJourJ) delete next[JOUR_J];
        else DAYS.forEach((d) => delete next[d]);
        // Filet : le plan d'avant est gardé le temps du message. Effacer quatorze
        // repas sans recours ne vaut pas mieux que la fenêtre qu'on a retirée.
        const avant: Plan = JSON.parse(JSON.stringify(plan));
        save(next);
        setRecap(null);
        window.dispatchEvent(new CustomEvent('magic-toast-notify', {
            detail: {
                text: isJourJ
                    ? `Menu du Jour J effacé · ${retires} plat${retires > 1 ? 's' : ''} retiré${retires > 1 ? 's' : ''}`
                    : `Semaine effacée · ${retires} repas retiré${retires > 1 ? 's' : ''}`,
                undoLabel: 'Annuler',
                onUndo: () => { save(avant); haptic(8); },
            },
        }));
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

    /**
     * Ce que le plan coûte.
     *
     * Les accompagnements comptent comme les plats — ils finissent dans le même
     * caddie. Le prix d'une recette est calculé une seule fois par identifiant :
     * le même plat peut revenir deux fois dans la semaine, mais il ne se relit
     * pas deux fois.
     */
    const prixParJour = useMemo(() => {
        const cache = new Map<string, ReturnType<typeof prixRecette>>();
        const prixDe = (r: Recipe) => {
            const k = String(r.id);
            if (!cache.has(k)) cache.set(k, prixRecette(r));
            return cache.get(k) || null;
        };
        const duJour = (jour: string, repas: readonly string[]) => additionner(
            repas
                .map((m) => plan[jour]?.[m] as Slot | undefined)
                .filter(Boolean)
                .flatMap((slot) => (slot!.side ? [slot!, slot!.side as Recipe] : [slot!]))
                .map(prixDe),
        );
        const jours: Record<string, ReturnType<typeof additionner>> = {};
        DAYS.forEach((d) => { jours[d] = duJour(d, MEALS); });
        return {
            jours,
            semaine: additionner(DAYS.map((d) => jours[d])),
            jourJ: duJour(JOUR_J, COURSES.map((c) => c.label)),
        };
    }, [plan]);

    const prixCourant = mode === 'jourj' ? prixParJour.jourJ : prixParJour.semaine;

    /** Ce que le choix en cours doit accepter. */
    const pickerFilter = useMemo(() => {
        if (!picker) return undefined;
        if (picker.side) return isTVSide;
        if (picker.day === JOUR_J) return COURSES.find((c) => c.label === picker.meal)?.accepts;
        // Créneau de semaine : tout ce qui se cuisine. On y met ce qu'on veut —
        // c'est « Composer » qui reste discipliné, pas la main de l'utilisateur.
        return posableEnSemaine;
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

        ecrireStock('magic-shopping-list', JSON.stringify(data));
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
    /** Les libellés partagés portent un emoji de tête ; le compositeur n'en veut pas. */
    const plain = (label: string) => label.replace(/^[^\p{L}]+/u, '').trim();

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
        return q ? all.filter((i) => norm(i.label).includes(q)) : all;   // l'emoji ne gêne pas : norm() le laisse hors des lettres
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
        const sides = shuffle(sidePool(CATALOGUE_AUTO).filter(fits).length >= 6
            ? sidePool(CATALOGUE_AUTO).filter(fits)
            : sidePool(CATALOGUE_AUTO));

        const totalTime = (r: Recipe) => { const t = estimateRecipeTiming(r.steps); return t.prepTime + t.cookTime; };

        // Combien de créneaux la tendance n'a PAS pu remplir. On ne peut pas
        // laisser un trou dans la semaine, mais on doit le dire : sinon on
        // annonce « Express » et on sert un plat de trois quarts d'heure.
        let offTrend = 0;

        const pickFrom = (accepts: (r: Recipe) => boolean, opts?: { lastProtein?: string; express?: boolean }): Recipe | null => {
            const onTrend = CATALOGUE_AUTO.filter((r) => r.image && accepts(r) && fits(r));
            if (!onTrend.length && tagged) offTrend++;
            const pool = onTrend.length ? onTrend : CATALOGUE_AUTO.filter((r) => r.image && accepts(r));
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
            plain(FILTER_GROUPS[g].find((i) => i.tag === t)?.label || t) || t;
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

    /**
     * « Voilà ce qu'on mange samedi » : le menu part sous forme de LIEN.
     *
     * On envoie un instantané — le menu partagé ne bougera plus quand on
     * réorganisera sa semaine. La liste de courses est calculée ici, avec le
     * moteur du site : la page publique se contente d'afficher.
     */
    const partagerCeMenu = async () => {
        if (partage === 'en-cours' || !planned) return;
        haptic(10);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.dispatchEvent(new CustomEvent('magic-toast-notify', { detail: 'Connecte-toi pour partager ton menu.' }));
            return;
        }
        setPartage('en-cours');
        let liste: Record<string, any> = {};
        try { liste = JSON.parse(localStorage.getItem('magic-shopping-list') || '{}'); } catch { /* liste vide */ }
        const instantane = preparerMenu(plan, {
            mode: mode === 'jourj' ? 'jourj' : 'semaine',
            titre: mode === 'jourj' ? 'Le menu du grand jour' : 'Le menu de la semaine',
            liste,
        });
        const { url, erreur } = await partagerMenu(instantane, session.access_token);
        setPartage('repos');
        if (!url) {
            window.dispatchEvent(new CustomEvent('magic-toast-notify', { detail: erreur || 'Le partage n’a pas abouti.' }));
            return;
        }
        const texte = mode === 'jourj' ? 'Voilà le menu du grand jour' : 'Voilà ce qu’on mange cette semaine';
        try {
            if (navigator.share) await navigator.share({ title: instantane.titre, text: texte, url });
            else {
                await navigator.clipboard.writeText(url);
                window.dispatchEvent(new CustomEvent('magic-toast-notify', { detail: 'Lien copié — il n’attend qu’à être envoyé.' }));
            }
        } catch { /* partage annulé : le lien existe, on n'insiste pas */ }
    };

    /** Remplit un créneau au hasard, dans la bonne catégorie. */
    const surprise = (day: string, meal: string, accepts: (r: Recipe) => boolean) => {
        const pool = CATALOGUE_AUTO.filter((r) => r.image && accepts(r));
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (!pick) return;
        haptic(8);
        setSlot(day, meal, pick);
    };

    // ── Rendu d'un créneau (semaine ou Jour J) ─────────────────────────────
    /**
     * Poser la recette qu'on tient dans ce créneau.
     *
     * On repose la main tout de suite : le geste est fini, et la barre du bas
     * doit disparaître au moment où la carte apparaît, pas après.
     */
    const poserEnMain = (day: string, meal: string) => {
        if (!enMain) return;
        const remplace = plan[day]?.[meal];
        const venue = origineEnMain();
        haptic(14);
        /*
         * Une recette prise DANS la semaine se DÉPLACE : sa case de départ se
         * vide, et si la case d'arrivée était prise, les deux repas
         * s'échangent. Sans ça, prendre lundi pour poser jeudi laissait le plat
         * aux deux endroits.
         */
        if (venue && (venue.jour !== day || venue.repas !== meal)) {
            let next = poserRecette(plan, venue.jour, venue.repas, (remplace as Recipe) || null);
            next = poserRecette(next, day, meal, enMain);
            save(next);
        } else {
            setSlot(day, meal, enMain);
        }
        reposer();
        window.dispatchEvent(new CustomEvent('magic-toast-notify', {
            detail: {
                text: remplace
                    ? venue
                        ? `${label(enMain)} et ${label(remplace)} ont échangé de place`
                        : `${label(enMain)} remplace ${label(remplace)} · ${DAY_FULL[day] || day} ${meal.toLowerCase()}`
                    : `${venue ? 'Déplacé' : 'Ajouté'} · ${DAY_FULL[day] || day} ${meal.toLowerCase()}`,
            },
        }));
    };

    const SlotView = ({ day, meal, accepts, surprend, sideable }: {
        day: string; meal: string;
        accepts: (r: Recipe) => boolean;
        /** Ce que « Surprends-moi » a le droit de tirer (par défaut, ce que le créneau accepte). */
        surprend?: (r: Recipe) => boolean;
        sideable?: boolean;
    }) => {
        const slot = plan[day]?.[meal];
        // Viande ou poisson servi nu → on propose une garniture.
        const needsSide = !!slot && !!sideable && !hasSideIncluded(slot) && !isSweet(slot);

        return (
            <div className={styles.planSlot} data-creneau={`${day}|${meal}`}>
                <div className={styles.planSlotHead}>
                    <span className={styles.planMeal}>{meal}</span>
                    {slot && (
                        <span className={styles.planSlotActions}>
                            {enMain && creneauAccepte(enMain, day, meal) ? (
                                <button className={styles.planPoser} onClick={() => poserEnMain(day, meal)}>
                                    Poser ici
                                </button>
                            ) : (
                                <button className={styles.planSwap} onClick={() => { haptic(8); ouvrirClavier(); setPicker({ day, meal }); }}>
                                    Changer
                                </button>
                            )}
                            <button className={styles.planRemove} onClick={() => { haptic(10); setSlot(day, meal, null); }}>
                                Retirer
                            </button>
                        </span>
                    )}
                </div>

                {slot ? (
                    <div className={`${styles.planPair} ${sideable ? styles.planPairSplit : ''}`}>
                        {/* Un tap sur la carte ouvre la fiche complète de la recette. */}
                        <button
                            className={styles.planCard}
                            onClick={() => {
                                // Le clic qui suit un glissé n'ouvre pas la fiche.
                                if (Date.now() - apresTirage.current < 400) return;
                                haptic(8); setDetail(slot);
                            }}
                            {...prises(day, meal)}
                        >
                            <img src={slot.image} alt="" className={styles.planCardImg} draggable={false} />
                            <div className={styles.planCardScrim} />
                            <div className={styles.planCardText}>
                                <div className={styles.planCardTitle}>{label(slot)}</div>
                                <div className={styles.planCardMeta}>
                                    {formatMinutes(totalMinutes(slot))} · Voir la recette ›
                                </div>
                            </div>
                        </button>

                        {sideable && (
                            <div className={styles.planSide}>
                                {slot.side ? (
                                    <>
                                        {/* La garniture est une carte à part entière, de la
                                            taille du plat : une vignette de 104 px à côté
                                            d'une photo pleine largeur ne se regardait pas. */}
                                        <button className={styles.planSideCard} onClick={() => { haptic(8); setDetail(slot.side!); }}>
                                            <img src={slot.side.image} alt="" className={styles.planCardImg} draggable={false} />
                                            <div className={styles.planCardScrim} />
                                            <div className={styles.planCardText}>
                                                <div className={styles.planSideKicker}>Accompagnement</div>
                                                <div className={styles.planCardTitle}>{label(slot.side)}</div>
                                                <div className={styles.planCardMeta}>
                                                    {formatMinutes(totalMinutes(slot.side))} · Voir la recette ›
                                                </div>
                                            </div>
                                        </button>
                                        <button className={styles.planSideRemove} onClick={() => { haptic(10); setSide(day, meal, null); }}>
                                            Retirer
                                        </button>
                                    </>
                                ) : needsSide ? (
                                    <button
                                        className={styles.planSideAdd}
                                        onClick={() => { haptic(8); ouvrirClavier(); setPicker({ day, meal, side: true }); }}
                                    >
                                        <span className={styles.planPlus}>+</span>
                                        Ajouter un accompagnement
                                        <span className={styles.planSideWhy}>ce plat est servi nu</span>
                                    </button>
                                ) : (
                                    /* Le plat porte déjà sa garniture (gratin, salade
                                       composée, plat complet) : on le DIT, plutôt que
                                       de laisser une moitié vide sans explication. */
                                    <div className={styles.planSideNone}>
                                        <span className={styles.planSideKicker}>Accompagnement</span>
                                        <span className={styles.planSideNoneText}>Ce plat se suffit à lui-même.</span>
                                        <button
                                            className={styles.planSideAddLite}
                                            onClick={() => { haptic(8); ouvrirClavier(); setPicker({ day, meal, side: true }); }}
                                        >
                                            + En ajouter un quand même
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className={`${styles.planEmpty} ${enMain && creneauAccepte(enMain, day, meal) ? styles.planEmptyCible : ''}`}>
                        {enMain && creneauAccepte(enMain, day, meal) ? (
                            /* Une recette est en main : ce créneau ne propose plus de
                               choisir ni de tirer au sort — il propose de la recevoir. */
                            <button className={styles.planPoserGrand} onClick={() => poserEnMain(day, meal)}>
                                <img src={enMain.image} alt="" className={styles.planPoserVignette} draggable={false} />
                                <span className={styles.planPoserTexte}>
                                    <span className={styles.planPoserQuoi}>Poser ici</span>
                                    <span className={styles.planPoserNom}>{label(enMain)}</span>
                                </span>
                            </button>
                        ) : (
                            <>
                                <button className={styles.planAdd} onClick={() => { haptic(8); ouvrirClavier(); setPicker({ day, meal }); }}>
                                    <span className={styles.planPlus}>+</span>
                                    Choisir {meal === 'Plat' ? 'un plat' : 'une recette'}
                                </button>
                                <button className={styles.planSurprise} onClick={() => surprise(day, meal, surprend || accepts)}>
                                    Surprends-moi
                                </button>
                            </>
                        )}
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

    // Le bouton de partage, écrit une fois : il se loge dans la pastille de prix,
    // et repart seul quand il n'y a pas de prix à afficher.
    const boutonPartage = (
        <button
            className={styles.planPartage}
            onClick={partagerCeMenu}
            disabled={partage === 'en-cours'}
            aria-label="Partager ce menu"
        >
            {partage === 'en-cours' ? (
                <span className={styles.planPartageRond} />
            ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 15V3" /><path d="m8 7 4-4 4 4" />
                    <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
                </svg>
            )}
        </button>
    );

    return (
        <div className={`${styles.page} ${embedded ? styles.embedded : ''} ${enMain ? styles.pageEnMain : ''}`}>
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

            {/* Ce que le plan coûte : la question vient tout de suite après « combien
                de repas ». Rien de planifié, rien à afficher.

                Le partage vit DANS cette pastille, à droite du chiffre : c'est le
                même objet — « voilà ce qu'on mange, et voilà ce que ça coûte » —
                et l'en-tête n'a plus deux boutons qui se disputent le coin droit.
                Le prix peut manquer (recettes sans ingrédients chiffrables) ; le
                bouton, lui, doit rester : il part alors seul sur la même ligne. */}
            {mode !== 'panier' && planned > 0 && (
                <div className={styles.planPrix}>
                    {prixCourant ? (
                        <PrixMoyen
                            prix={prixCourant}
                            libelle={mode === 'jourj' ? 'Prix du menu' : 'Prix de la semaine'}
                            taille="grande"
                            sombre
                            action={boutonPartage}
                        />
                    ) : boutonPartage}
                </div>
            )}

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
                                <div className={styles.planDayHead}>
                                    <h2 className={styles.planDayTitle}>{DAY_FULL[day]}</h2>
                                    {/* Le prix du jour : c'est à cette échelle qu'on
                                        décide de remplacer un plat par un autre. */}
                                    <PrixMoyen prix={prixParJour.jours[day]} libelle="Ce jour" taille="petite" sombre />
                                </div>
                                {MEALS.map((meal) => (
                                    <SlotView key={meal} day={day} meal={meal} accepts={posableEnSemaine} surprend={isTVMain} sideable />
                                ))}
                            </section>
                        ))}
                    </div>
                </>
            ) : (
                <section className={styles.planSlide}>
                    <div className={styles.jourjHead}>
                        <h2 className={styles.planDayTitle}>Le menu</h2>
                        <span className={styles.jourjCount}>
                            {planned} plat{planned > 1 ? 's' : ''} sur {COURSES.length}
                        </span>
                    </div>
                    {/* En grille sur grand écran : six cartes pleine largeur
                        étiraient des photos de 640 px sur 483 — soit le double en
                        pixels réels sur un écran Retina, d'où le flou. */}
                    <div className={styles.jourjGrid}>
                        {COURSES.map((c) => (
                            <SlotView
                                key={c.label}
                                day={JOUR_J}
                                meal={c.label}
                                accepts={c.accepts}
                                /* Pas de garniture accolée ici : « Accompagnement »
                                   est un service du menu, avec sa propre carte. Les
                                   deux se superposaient dans la même case. */
                            />
                        ))}
                    </div>
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
                        {/* Au téléphone, « Remplir ma liste de courses » ne tient pas sur la
                            ligne des trois boutons : il passait à trois lignes et la barre
                            grimpait au milieu des cartes. Le libellé court prend le relais
                            sous 430 px, le long reste au-dessus (voir tv.module.css). */}
                        {planned ? (
                            <>
                                <span className={styles.planValidateLong}>Remplir ma liste de courses</span>
                                <span className={styles.planValidateShort}>Liste de courses</span>
                            </>
                        ) : 'Rien de planifié'}
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
                                        {plain(it.label)}
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
                                                    {plain(FILTER_GROUPS[g].find((i) => i.tag === t)?.label || t)} ✕
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
            {/* ── La recette qu'on tient ─────────────────────────────────────
                Tant qu'elle n'est pas posée, elle reste visible : c'est ce qui
                explique pourquoi les créneaux disent « Poser ici », et c'est la
                seule sortie si on change d'avis. */}
            <AnimatePresence>
                {enMain && (
                    <motion.div
                        className={styles.enMainBar}
                        initial={{ y: 90, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 90, opacity: 0 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 340 }}
                    >
                        <img src={enMain.image} alt="" className={styles.enMainVignette} draggable={false} />
                        <div className={styles.enMainTexte}>
                            <div className={styles.enMainKicker}>Choisissez un créneau</div>
                            <div className={styles.enMainNom}>{label(enMain)}</div>
                        </div>
                        <button
                            className={styles.enMainAnnuler}
                            onClick={() => { haptic(8); reposer(); }}
                            aria-label="Reposer la recette"
                        >
                            Annuler
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <Tip id="planner" />
            <TVToast />
        </div>
    );
}
