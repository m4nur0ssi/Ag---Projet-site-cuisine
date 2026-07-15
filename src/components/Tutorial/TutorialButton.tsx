'use client';
import { useState } from 'react';
import TutorialTour, { findTarget, type TourStep } from './TutorialTour';
import styles from './TutorialButton.module.css';

/**
 * Visite guidée du site : pilule « Tutoriel » + projecteur sur chaque fonctionnalité.
 * Les cibles sont marquées par `data-tour="…"` dans les composants concernés ; une
 * étape dont la cible est absente de l'écran s'affiche simplement centrée.
 */

// Le bouton du planificateur est une BASCULE : on ne clique que s'il est fermé, sinon
// on le refermerait en passant d'une étape du planificateur à la suivante.
const plannerIsOpen = () => !!findTarget('[data-tour="planner-ia"]') || !!findTarget('[data-tour="planner-validate"]');
const openPlanner = () => { if (!plannerIsOpen()) findTarget('[data-tour="planner"]')?.click(); };
const closePlanner = () => { if (plannerIsOpen()) findTarget('[data-tour="planner"]')?.click(); };
// Sur desktop, les icônes Favoris / Panier n'existent QUE dans le header scrollé (en
// haut de page il n'y a que Recherche + planificateur). On referme le planificateur et
// on descend un peu pour que ces cibles apparaissent. Sans effet sur mobile (BottomNav
// toujours visible).
const revealHeaderIcons = () => { closePlanner(); window.scrollTo({ top: 700, behavior: 'auto' }); };
const STEPS: TourStep[] = [
    {
        selector: '[data-tour="card"]',
        radius: 26,
        title: 'Ouvrir une recette',
        text: 'Clique n’importe où sur une carte pour ouvrir la fiche complète : ingrédients, étapes, minuteur, note et liste de courses.',
    },
    {
        selector: '[data-tour="play"]',
        radius: 999,
        title: 'Voir la vidéo sans quitter la page',
        text: 'Le bouton ▶ lance la vidéo directement dans la carte. C’est le seul endroit qui n’ouvre pas la fiche : clique à côté du play pour voir la recette.',
    },
    {
        selector: '[data-tour="search"]',
        radius: 999,
        title: 'Trois façons de chercher',
        text: 'Par recette (son nom), par ingrédient (ce qu’il te reste au frigo), ou en langage naturel avec l’IA : « une sauce pour une viande rouge », « un restaurant italien avec terrasse ».',
    },
    {
        selector: '[data-tour="planner"]',
        radius: 999,
        title: 'Le planificateur',
        text: 'Ton menu de la semaine, midi et soir. On l’ouvre : les étapes suivantes détaillent chaque bouton.',
    },
    // ── Planificateur ouvert : chaque étape éclaire une commande réelle ──────────
    {
        selector: '[data-tour="planner-ia"]',
        radius: 14,
        requires: '[data-tour="planner"]',
        lazyTarget: true,
        before: () => openPlanner(),
        title: 'Menu IA — la semaine entière en un clic',
        text: 'Il remplit les 14 repas d’un coup, sans doublon, en alternant les protéines : jamais la même deux fois dans la journée, ni sur deux repas qui se suivent. Poisson et végé sont servis en priorité pour varier.',
    },
    {
        selector: '[data-tour="planner-side"]',
        // L'emplacement accompagnement n'existe que si le créneau contient déjà un plat
        // (planificateur vide → on éclaire le créneau lui-même).
        fallback: '[data-tour="planner-slot"]',
        radius: 14,
        requires: '[data-tour="planner"]',
        lazyTarget: true,
        before: () => openPlanner(),
        title: 'Les accompagnements : automatiques, mais pas toujours',
        text: 'Le Menu IA n’ajoute un accompagnement (légume, riz, pâtes…) que si le plat n’en contient pas déjà : un couscous ou des pâtes n’en reçoivent pas, un steak si. Clique dessus pour le changer, ou sur la case vide pour en ajouter un toi-même.',
    },
    {
        selector: '[data-tour="planner-slot"]',
        radius: 14,
        requires: '[data-tour="planner"]',
        lazyTarget: true,
        before: () => openPlanner(),
        title: 'Composer à la main',
        text: 'Clique une case midi ou soir pour choisir la recette. Glisse-dépose une vignette pour la déplacer sur un autre jour, « Voir » ouvre la fiche, et ✕ retire le plat du créneau.',
    },
    {
        selector: '[data-tour="planner-delete-day"]',
        radius: 999,
        requires: '[data-tour="planner"]',
        lazyTarget: true,
        before: () => openPlanner(),
        title: 'Supprimer un jour',
        text: 'Le ✕ à côté du nom du jour enlève toute sa colonne : tu ne manges pas là ? Ses recettes disparaissent, et ses ingrédients sortent de la liste de courses. Re-cliquer le jour le remet, vide.',
    },
    {
        selector: '[data-tour="planner-clear"]',
        radius: 14,
        requires: '[data-tour="planner"]',
        lazyTarget: true,
        before: () => openPlanner(),
        title: 'Tout effacer / repartir de zéro',
        text: '🗑 vide les menus de la vue affichée (la semaine, ou le Jour J), après confirmation. À côté, les boutons Catégories / Pays / Tendance remplissent la semaine sur un thème précis (Italie, Healthy…) au lieu du hasard.',
    },
    {
        selector: '[data-tour="planner-jourj"]',
        radius: 14,
        requires: '[data-tour="planner"]',
        lazyTarget: true,
        before: () => openPlanner(),
        title: 'Jour J — le repas spécial',
        text: 'Un onglet à part pour un seul repas complet : une recette par catégorie (apéritif, entrée, plat, accompagnement, dessert). Pratique pour un dîner d’invités, sans toucher à la semaine.',
    },
    {
        selector: '[data-tour="planner-validate"]',
        radius: 14,
        requires: '[data-tour="planner"]',
        lazyTarget: true,
        before: () => openPlanner(),
        title: 'Valider → la liste de courses',
        text: '« ✓ Valider » envoie tous les ingrédients du menu dans la liste de courses, regroupés et sans doublon. Le menu passe en lecture seule ; « ✎ Modifier » le rouvre à l’édition.',
    },
    {
        selector: '[data-tour="shopping"]',
        radius: 999,
        requires: '[data-tour="planner"]', // proxy « connecté » : sinon ni panier ni favoris
        lazyTarget: true,
        before: () => revealHeaderIcons(),
        title: 'La liste de courses',
        text: 'Les ingrédients de ton planning arrivent ici, regroupés et dédoublonnés. Coche ce que tu as déjà, garde le reste.',
    },
    {
        selector: '[data-tour="shopping"]',
        radius: 999,
        requires: '[data-tour="planner"]',
        lazyTarget: true,
        before: () => revealHeaderIcons(),
        title: 'L’extension Chrome « Courses Magiques »',
        text: 'Sur ordinateur : depuis la liste de courses, tu ouvres le site de ton magasin et l’extension remplit ton panier toute seule, article par article. L’installation est expliquée sur la page Liste de courses.',
        desktopOnly: true,
    },
    {
        selector: '[data-tour="favorites"]',
        radius: 999,
        requires: '[data-tour="planner"]',
        lazyTarget: true,
        before: () => revealHeaderIcons(),
        title: 'Tes favoris',
        text: 'Le cœur sur une fiche range la recette ici. Tu retrouves aussi tes notes perso et les plats que tu as déjà cuisinés.',
    },
];

export default function TutorialButton() {
    const [steps, setSteps] = useState<TourStep[] | null>(null);

    // Certaines cibles n'existent que pour les connectés (planificateur, courses,
    // favoris) : on ne garde que les étapes dont la cible est réellement à l'écran.
    // L'extension Chrome n'a pas de sens sur mobile → écartée sur petit écran.
    const start = () => {
        const isMobile = window.matchMedia('(max-width: 1023px)').matches;
        // `lazyTarget` : cible créée en cours de route (panneau planificateur ouvert par
        // l'étape) → on la garde même si elle n'est pas encore dans le DOM.
        const usable = STEPS.filter(s =>
            (!s.desktopOnly || !isMobile)
            && (!s.requires || findTarget(s.requires))
            && (!s.selector || s.lazyTarget || findTarget(s.selector))
        );
        setSteps(usable.length ? usable : null);
    };

    return (
        <>
            <button className={styles.btn} onClick={start} aria-label="Lancer le tutoriel du site">
                <span className={styles.label}>Tutoriel</span>
            </button>
            {steps && <TutorialTour steps={steps} onClose={() => { closePlanner(); setSteps(null); }} />}
        </>
    );
}
