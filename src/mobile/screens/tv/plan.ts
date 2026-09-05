/**
 * Le planificateur, en un seul endroit.
 * =====================================
 *
 * Jusqu'ici, seul l'écran `/tv-planner` savait lire et écrire la semaine. Poser
 * une recette depuis ailleurs — une rangée de l'accueil, une grille de
 * catégorie, la fiche elle-même — demandait de recopier ce savoir, et deux
 * copies finissent toujours par diverger sur un détail (la clé locale, l'envoi
 * à Supabase, les cases déjà cochées de la liste de courses).
 *
 * Tout ce qui touche au plan passe donc par ici. `TVPlanner` s'en sert comme le
 * choix rapide de la fiche : même clé `meal-planner-week`, même table
 * `meal_plans`, même événement `shoppingListUpdated`.
 */

import { Recipe } from '@/mobile/types';
import { supabase } from '@/mobile/lib/supabase';
import { ecrireStock } from '@/lib/stockage';
import { isCookable } from '@/lib/mealClassify';
import { isTVMain, isTVSide } from './sides';

export const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

export const DAY_FULL: Record<string, string> = {
    Lun: 'Lundi', Mar: 'Mardi', Mer: 'Mercredi', Jeu: 'Jeudi',
    Ven: 'Vendredi', Sam: 'Samedi', Dim: 'Dimanche',
};

export const MEALS = ['Midi', 'Soir'] as const;

export const JOUR_J = 'JourJ';

/** Index du jour courant, semaine commençant le lundi (getDay : 0 = dimanche). */
export const todayIndex = () => (new Date().getDay() + 6) % 7;

/** Cartes du repas complet, et ce que chacune accepte. */
export const COURSES: { label: string; accepts: (r: Recipe) => boolean }[] = [
    { label: 'Apéritif', accepts: (r) => r.category === 'aperitifs' && isCookable(r) },
    { label: 'Entrée', accepts: (r) => r.category === 'entrees' && isCookable(r) },
    { label: 'Plat', accepts: (r) => isTVMain(r) },
    { label: 'Accompagnement', accepts: (r) => isTVSide(r) },
    { label: 'Dessert', accepts: (r) => r.category === 'desserts' && isCookable(r) },
    { label: 'Pâtisserie', accepts: (r) => r.category === 'patisserie' && isCookable(r) },
];

export type Slot = Recipe & { side?: Recipe };
export type Plan = Record<string, Record<string, Slot>>;

/** Émis dès que le plan change, pour que les écrans ouverts se remettent à jour. */
export const PLAN_EVENT = 'magic-plan-change';

/**
 * Demande l'ouverture du planificateur.
 *
 * Au bureau, le planificateur n'est pas une page mais un calque tenu par
 * l'en-tête : on ne peut pas y aller par une adresse, on le fait ouvrir.
 */
export const OUVRIR_PLANIFICATEUR = 'magic-open-planner';

const CLE = 'meal-planner-week';

/** Le plan tel qu'il est sur l'appareil. Ne part jamais sur le réseau. */
export function lirePlan(): Plan {
    try { return JSON.parse(localStorage.getItem(CLE) || '{}'); } catch { return {}; }
}

/**
 * Le plan de référence : celui du compte s'il y en a un, sinon celui de
 * l'appareil. Le résultat est recopié en local, pour que la lecture suivante
 * soit immédiate.
 */
export async function chargerPlan(): Promise<Plan> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data } = await supabase
                .from('meal_plans').select('plan')
                .eq('user_id', session.user.id).maybeSingle();
            if (data?.plan) {
                ecrireStock(CLE, JSON.stringify(data.plan));
                return data.plan as Plan;
            }
        }
    } catch { /* hors ligne : le cache local fait l'affaire */ }
    return lirePlan();
}

/**
 * « Vider » (liste de courses) marque les créneaux comme « déjà pris »
 * (meal-week-checked, clé `jour|repas|idx`). Sans purge, replanifier le même
 * créneau laisserait ses ingrédients invisibles dans « La semaine ».
 */
export function oublierCoches(jour: string, repas: string) {
    try {
        const arr: string[] = JSON.parse(localStorage.getItem('meal-week-checked') || '[]');
        const kept = arr.filter((k) => !k.startsWith(`${jour}|${repas}|`));
        if (kept.length !== arr.length) localStorage.setItem('meal-week-checked', JSON.stringify(kept));
    } catch { /* noop */ }
}

/** Enregistre partout : local, Supabase, et prévient qui écoute. */
export async function enregistrerPlan(next: Plan): Promise<void> {
    ecrireStock(CLE, JSON.stringify(next));
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('shoppingListUpdated'));
        // Le survol « recettes du jour » de l'icône planificateur, au bureau.
        window.dispatchEvent(new Event('meal-plan-updated'));
        window.dispatchEvent(new CustomEvent(PLAN_EVENT, { detail: next }));
    }
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await supabase.from('meal_plans').upsert({
                user_id: session.user.id,
                plan: next,
                updated_at: new Date().toISOString(),
            });
        }
    } catch { /* hors ligne : le local garde la trace */ }
}

/** Le plan obtenu en posant (ou en retirant) une recette dans un créneau. */
export function poserRecette(plan: Plan, jour: string, repas: string, recette: Recipe | null): Plan {
    const next: Plan = { ...plan, [jour]: { ...(plan[jour] || {}) } };
    if (recette) { next[jour][repas] = recette as Slot; oublierCoches(jour, repas); }
    else delete next[jour][repas];
    if (!Object.keys(next[jour]).length) delete next[jour];
    return next;
}

/**
 * Où cette recette a-t-elle le droit d'aller ?
 *
 * Les créneaux de la semaine (midi, soir) n'acceptent que des plats — c'est la
 * règle du planificateur depuis toujours. Une entrée, un dessert ou un apéritif
 * n'a donc qu'une destination : la carte du Jour J qui porte son nom.
 */
export function placesPour(r: Recipe): { semaine: boolean; courses: string[] } {
    return {
        semaine: isTVMain(r),
        courses: COURSES.filter((c) => c.accepts(r)).map((c) => c.label),
    };
}

/**
 * Catégories qui ont au moins une place dans le planificateur. Sert de
 * jugement de repli quand les ingrédients ne sont pas encore chargés.
 */
const CATEGORIES_PLANIFIABLES = new Set([
    'plats', 'entrees', 'desserts', 'patisserie', 'aperitifs', 'accompagnements',
]);

/**
 * Faut-il proposer « Ajouter au planificateur » pour cette recette ?
 *
 * Attention : l'accueil ne transporte PAS les ingrédients (ils pèsent les trois
 * quarts du catalogue et sont chargés à part). Or `placesPour` s'appuie sur
 * `isCookable`, qui exige une liste d'ingrédients : posée sur une recette
 * allégée, la question répondait toujours « nulle part », et l'entrée de menu
 * n'apparaissait jamais.
 *
 * On tranche donc sur la catégorie tant que les ingrédients manquent. Le volet,
 * lui, recharge les détails avant d'afficher les créneaux : c'est là que la
 * règle exacte s'applique.
 */
export function planifiable(r: Recipe): boolean {
    const p = placesPour(r);
    if (p.semaine || p.courses.length > 0) return true;
    if ((r.ingredients || []).length > 0) return false;
    return CATEGORIES_PLANIFIABLES.has((r.category || '').toLowerCase());
}
