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
import { isCookable, isSauce } from '@/lib/mealClassify';
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
        semaine: posableEnSemaine(r),
        courses: COURSES.filter((c) => c.accepts(r)).map((c) => c.label),
    };
}

/**
 * Ce qu'un créneau de la semaine accepte : TOUT ce qui se cuisine.
 *
 * La semaine n'a longtemps accepté que des plats. La règle se défendait pour
 * le remplissage automatique — « Composer » ne va pas proposer une tarte pour
 * un mardi soir — mais elle empêchait aussi de poser à la main l'entrée qu'on
 * avait choisie, et rien ne le disait : le créneau restait simplement
 * introuvable. On pose maintenant ce qu'on veut ; c'est « Composer » et
 * « Surprends-moi » qui continuent de ne servir que des plats.
 *
 * Restent dehors ce qui n'est pas un repas : fiches restaurant, recettes sans
 * ingrédients, sauces et condiments.
 */
export const posableEnSemaine = (r: Recipe): boolean => isCookable(r) && !isSauce(r);

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

/* ── La recette qu'on tient en main ──────────────────────────────────────────
 *
 * Deuxième façon de caser une recette : plutôt que de choisir le créneau dans
 * un volet, on emporte la recette JUSQU'AU planificateur et on la pose sur
 * l'écran en grand — là où l'on voit les photos, les temps, ce qu'il y a déjà.
 *
 * Elle voyage dans `sessionStorage` parce que le geste traverse une navigation
 * (l'accueil s'en va, le planificateur arrive) : un état React ne survivrait
 * pas. Et parce qu'elle ne doit pas rester en main d'une visite à l'autre — on
 * ne retrouve pas, trois jours plus tard, une recette collée au doigt.
 */

const CLE_EN_MAIN = 'magic-plan-en-main';

/** Émis quand on prend une recette en main, ou qu'on la repose. */
export const EN_MAIN_EVENT = 'magic-plan-en-main-change';

/**
 * Le temps que la main reste fermée.
 *
 * Une recette prise en main puis abandonnée en chemin ne doit pas ressurgir
 * une demi-heure plus tard, collée au doigt, sans qu'on comprenne d'où elle
 * sort. On ne peut pas la relâcher au démontage de l'écran — React monte deux
 * fois en développement, et le premier nettoyage la ferait disparaître avant
 * même d'être vue. On lui donne donc une durée de vie.
 */
const VIE_EN_MAIN_MS = 10 * 60 * 1000;

/** La recette actuellement en main, s'il y en a une. */
export function recetteEnMain(): Recipe | null {
    if (typeof window === 'undefined') return null;
    try {
        const brut = sessionStorage.getItem(CLE_EN_MAIN);
        if (!brut) return null;
        const { recette, pris } = JSON.parse(brut) as { recette: Recipe; pris: number };
        if (!recette || Date.now() - pris > VIE_EN_MAIN_MS) {
            sessionStorage.removeItem(CLE_EN_MAIN);
            return null;
        }
        return recette;
    } catch { return null; }
}

/** Prend la recette en main : le planificateur l'attendra à l'arrivée. */
export function prendreEnMain(r: Recipe): void {
    try {
        sessionStorage.setItem(CLE_EN_MAIN, JSON.stringify({ recette: r, pris: Date.now() }));
    } catch { /* plein */ }
    window.dispatchEvent(new CustomEvent(EN_MAIN_EVENT, { detail: r }));
}

/** Repose la recette : posée dans un créneau, ou abandonnée. */
export function reposer(): void {
    try { sessionStorage.removeItem(CLE_EN_MAIN); } catch { /* noop */ }
    window.dispatchEvent(new CustomEvent(EN_MAIN_EVENT, { detail: null }));
}

/** Ce créneau accepte-t-il la recette qu'on tient ? */
export function creneauAccepte(r: Recipe, jour: string, repas: string): boolean {
    if (jour === JOUR_J) return !!COURSES.find((c) => c.label === repas)?.accepts(r);
    return posableEnSemaine(r);
}
