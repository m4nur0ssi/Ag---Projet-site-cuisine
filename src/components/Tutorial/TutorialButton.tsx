'use client';
import { useState } from 'react';
import TutorialTour, { type TourStep } from './TutorialTour';
import styles from './TutorialButton.module.css';

/**
 * Visite guidée du site : pilule « Tutoriel » + fenêtre à deux tuiles (explication à
 * gauche, exemple jouable à droite). Chaque étape monte les VRAIS composants du site
 * dans sa démo : rien n'est maquetté, donc rien ne peut mentir sur le produit.
 */

/** Cible présente dans le DOM, visible ou non : sert à savoir si l'utilisateur est connecté. */
const exists = (selector?: string) => !!selector && !!document.querySelector(selector);

const PLANNER_REQUIRED = '[data-tour="planner"]'; // proxy « connecté » : sinon ni menu, ni courses

const STEPS: TourStep[] = [
    {
        title: 'Ouvrir une recette',
        text: 'Chaque recette est une carte. Un clic n’importe où dessus ouvre la fiche complète : ingrédients, étapes, minuteur, note et liste de courses.',
        hint: 'Vas-y : clique sur la photo. La fiche s’ouvre ici même, dans le cadre. Le ✕ en haut la referme.',
        demo: { kind: 'card' },
    },
    {
        title: 'Voir la vidéo sans quitter la page',
        text: 'Le bouton ▶ lance la vidéo directement dans la carte. C’est le seul endroit qui n’ouvre pas la fiche : clique à côté du play pour voir la recette.',
        hint: 'Clique le ▶ au centre : la vidéo se lance dans la carte. Clique ailleurs sur la photo : c’est la fiche qui s’ouvre.',
        demo: { kind: 'card' },
    },
    {
        title: 'Trois façons de chercher',
        text: 'Par recette (son nom), par ingrédient (ce qu’il te reste au frigo), ou en langage naturel avec l’IA. Les trois onglets sont là, en haut du cadre.',
        hint: 'Tape « poulet » : les résultats tombent dessous. Essaie l’onglet Ingrédient, puis l’IA avec « une sauce pour une viande rouge ».',
        demo: { kind: 'search' },
    },
    {
        title: 'Le planificateur',
        text: 'Le voici en entier : 7 jours, midi et soir. Sur le site, il s’ouvre avec l’icône calendrier en haut de la page. Les étapes suivantes zooment sur chaque commande — et tout reste modifiable dans le cadre.',
        hint: 'Vue d’ensemble. À partir d’ici, ce que tu fais dans le cadre ne touche jamais ton vrai menu.',
        requires: PLANNER_REQUIRED,
        demo: { kind: 'planner', focus: 'planner-grid', plan: 'week', scale: 0.5 },
    },
    // ── Le planificateur, en bac à sable : jouable, sans toucher au vrai menu ────
    {
        title: 'Menu IA — la semaine entière en un clic',
        text: 'Il remplit les 14 repas d’un coup, sans doublon, en alternant les protéines : jamais la même deux fois dans la journée, ni sur deux repas qui se suivent. Poisson et végé sont servis en priorité pour varier.',
        hint: 'Clique le bouton entouré : les 14 repas se composent d’un coup. Re-clique : une autre semaine, différente.',
        requires: PLANNER_REQUIRED,
        demo: { kind: 'planner', focus: 'planner-ia', plan: 'empty' },
    },
    {
        title: 'Les accompagnements : automatiques, mais pas toujours',
        text: 'Le Menu IA n’ajoute un accompagnement (légume, riz, pâtes…) que si le plat n’en contient pas déjà. Ici, à midi le couscous a déjà ses légumes et sa semoule : rien n’est ajouté. Le soir, la viande est seule : elle reçoit un accompagnement.',
        hint: 'Compare la colonne entourée : midi (couscous) n’a pas d’accompagnement, soir (viande) en a un. Le ✕ sur « Riz Jollof » le retire.',
        requires: PLANNER_REQUIRED,
        // Légèrement réduit : la journée entière (midi + soir + accompagnements) doit
        // tenir d'un seul tenant, c'est la comparaison qui fait la démonstration.
        demo: { kind: 'planner', focus: 'planner-day', plan: 'sides', scale: 0.78 },
    },
    {
        title: 'Composer à la main',
        text: 'Clique une case midi ou soir pour choisir la recette. Glisse-dépose une vignette pour la déplacer sur un autre jour, « Voir » ouvre la fiche, et ✕ retire le plat du créneau.',
        hint: 'Clique la case entourée : le sélecteur s’ouvre dans le cadre, choisis une recette. « Voir » ouvre la fiche, ✕ vide le créneau.',
        requires: PLANNER_REQUIRED,
        demo: { kind: 'planner', focus: 'planner-slot', plan: 'sides' },
    },
    {
        title: 'Supprimer un jour',
        text: 'Le ✕ à côté du nom du jour enlève toute sa colonne : tu ne manges pas là ? Ses recettes disparaissent, et ses ingrédients sortent de la liste de courses. Re-cliquer le jour le remet, vide.',
        hint: 'Clique le ✕ entouré, à côté de « Lun » : la colonne disparaît. Un bouton « + Lundi » apparaît en bas pour le remettre.',
        requires: PLANNER_REQUIRED,
        demo: { kind: 'planner', focus: 'planner-delete-day', plan: 'week' },
    },
    {
        title: 'Tout effacer / repartir de zéro',
        text: '🗑 vide les menus de la vue affichée (la semaine, ou le Jour J), après confirmation. À côté, les boutons Pays / Tendance remplissent la semaine sur un thème précis (Italie, Healthy…) au lieu du hasard.',
        hint: 'Clique « Pays » ou « Tendance » puis un thème (Italie, Healthy…) : la semaine se remplit dessus. 🗑 vide tout.',
        requires: PLANNER_REQUIRED,
        demo: { kind: 'planner', focus: 'planner-clear', plan: 'week' },
    },
    {
        title: 'Jour J — le repas spécial',
        text: 'Un onglet à part pour un seul repas complet : une recette par catégorie (apéritif, entrée, plat, accompagnement, dessert). Pratique pour un dîner d’invités, sans toucher à la semaine.',
        hint: 'Clique l’onglet entouré : la vue bascule sur une carte par catégorie. « Les recettes de la semaine » revient en arrière.',
        requires: PLANNER_REQUIRED,
        demo: { kind: 'planner', focus: 'planner-jourj', plan: 'week' },
    },
    {
        title: 'Valider → la liste de courses',
        text: '« ✓ Valider » envoie tous les ingrédients du menu dans la liste de courses, regroupés et sans doublon. Le menu passe en lecture seule ; « ✎ Modifier » le rouvre à l’édition.',
        hint: 'Clique « ✓ Valider » : le menu passe en lecture seule et « ✎ Modifier » le rouvre. Rassure-toi : ici rien ne part dans ta vraie liste.',
        requires: PLANNER_REQUIRED,
        demo: { kind: 'planner', focus: 'planner-validate', plan: 'week' },
    },
    {
        title: 'La liste de courses',
        text: 'Les ingrédients de ton planning arrivent ici, regroupés et dédoublonnés. Coche ce que tu as déjà, garde le reste.',
        hint: 'Voici l’icône, en haut de la page. La liste, elle, est une page entière : elle ne tient pas dans le cadre.',
        requires: PLANNER_REQUIRED,
        demo: { kind: 'clone', selector: '[data-tour="shopping"]', zoom: 2.6 },
    },
    {
        title: 'L’extension Chrome « Courses Magiques »',
        text: 'Sur ordinateur : depuis la liste de courses, tu ouvres le site de ton magasin et l’extension remplit ton panier toute seule, article par article. Voici la bulle d’installation, telle qu’elle t’attend sur la page Liste de courses.',
        hint: 'Clique « Comment l’installer ? » : les 5 étapes se déplient ici même.',
        requires: PLANNER_REQUIRED,
        desktopOnly: true,
        demo: { kind: 'extension' },
    },
    {
        title: 'Tes favoris',
        text: 'Le cœur en haut à droite de chaque carte range la recette dans tes favoris. La page Favoris, accessible par l’icône ❤️ en haut du site, rassemble tout : tes notes perso et les plats que tu as déjà cuisinés.',
        hint: 'Le cœur est en haut à droite de la carte. Attention : celui-ci est réel — un clic ajoute vraiment la recette à tes favoris (re-clique pour l’enlever).',
        requires: PLANNER_REQUIRED,
        demo: { kind: 'card' },
    },
];

export default function TutorialButton() {
    const [steps, setSteps] = useState<TourStep[] | null>(null);

    // Certaines étapes n'ont pas d'objet : le planificateur et les courses n'existent
    // que pour les connectés, l'extension Chrome que sur ordinateur.
    const start = () => {
        const isMobile = window.matchMedia('(max-width: 1023px)').matches;
        const usable = STEPS.filter(s => (!s.desktopOnly || !isMobile) && (!s.requires || exists(s.requires)));
        if (!usable.length) return;
        setSteps(usable);
    };

    const finish = () => setSteps(null);

    return (
        <>
            <button className={styles.btn} onClick={start} aria-label="Lancer le tutoriel du site">
                <span className={styles.label}>Tutoriel</span>
            </button>
            {steps && <TutorialTour steps={steps} onClose={finish} />}
        </>
    );
}
