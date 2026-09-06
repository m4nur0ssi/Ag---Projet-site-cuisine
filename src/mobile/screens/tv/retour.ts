'use client';

/**
 * Le geste « retour », partagé par tous les calques.
 * =================================================
 *
 * Extrait de l'accueil TV, où il vivait seul. Le volet « Ajouter au
 * planificateur » s'ouvre aussi depuis une fiche recette, sur des écrans qui
 * n'avaient pas cette mécanique : un balayage depuis le bord y quittait la
 * page au lieu de refermer le volet — et, dans l'application installée, cela
 * revient à la relancer.
 *
 * Tout calque qui s'ouvre doit passer par ici, pour que la pile reste commune :
 * deux mécaniques concurrentes se rendraient des entrées qu'elles n'ont pas
 * posées.
 */

import { useEffect, useRef } from 'react';

/**
 * Le geste « retour » d'iOS (balayage depuis le bord) doit refermer le calque
 * ouvert — grille de catégorie, fiche, menu… — et non quitter la page. Chaque
 * calque ajoute donc une entrée d'historique à l'ouverture, retirée à la
 * fermeture par l'interface. Empilement naturel : le dernier ouvert se ferme
 * en premier.
 */
/**
 * Retour programmé en attente, PARTAGÉ par tous les calques.
 *
 * Un calque qui se ferme rend son entrée d'historique (`history.back()`), mais
 * `popstate` n'arrive qu'au tour suivant : quand un même geste ferme un calque
 * et en ouvre un autre (menu → « Rechercher », menu → « Visite guidée »), ce
 * retour tombait APRÈS le `pushState` du nouveau calque et le refermait
 * aussitôt — l'écran clignotait et rien ne s'ouvrait. On diffère donc le
 * retour d'un tour : si un calque s'ouvre entre-temps, il reprend simplement
 * l'entrée du précédent au lieu d'en empiler une seconde.
 */
let pendingBack: ReturnType<typeof setTimeout> | null = null;
/**
 * Un calque qui se referme rend l'entrée d'historique qu'il avait ajoutée. Le
 * `popstate` qui en découle était pris pour un geste « retour » par les calques
 * RESTÉS ouverts : fermer le menu d'appui long depuis une grille de catégorie
 * fermait la grille avec lui, et on se retrouvait à l'accueil. Ce drapeau dit
 * que le retour vient de nous, et qu'il ne concerne personne d'autre.
 */
let backEstDeNous = false;

/**
 * Ce « retour » vient-il de NOUS ?
 *
 * Un calque qui se ferme par un bouton rend son entrée d'historique, ce qui
 * émet un `popstate` qui ne concerne personne d'autre. Les calques qui gèrent
 * le retour à leur façon — la fiche recette, par exemple — doivent poser la
 * question avant de se fermer, sinon un seul geste en referme deux.
 *
 * Lecture SANS consommer : le drapeau doit rester lisible par les autres, et
 * c'est `useBackToClose` qui le baisse.
 */
export function estRetourInterne(): boolean {
    return backEstDeNous;
}

export function useBackToClose(isOpen: boolean, close: () => void) {
    const holds = useRef(false);
    const closeRef = useRef(close);
    closeRef.current = close;

    // Marqueur de démontage. DÉFINI AVANT l'effet principal : React exécute les
    // nettoyages dans l'ordre de déclaration, donc au démontage celui-ci passe
    // en premier et l'effet principal sait qu'il ne s'agit pas d'une simple
    // fermeture de calque.
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const from = window.location.pathname;
        if (pendingBack !== null) { clearTimeout(pendingBack); pendingBack = null; }
        else window.history.pushState({ tvOverlay: Date.now() }, '');
        holds.current = true;
        const onPop = () => {
            if (backEstDeNous) { backEstDeNous = false; return; }
            holds.current = false;
            closeRef.current();
        };
        window.addEventListener('popstate', onPop);
        return () => {
            window.removeEventListener('popstate', onPop);
            // Fermé par le geste « retour » : l'entrée est déjà partie, rien à rendre.
            if (!holds.current) return;
            holds.current = false;
            // Écran démonté = NAVIGATION en cours (menu → planificateur, menu →
            // liste). Rendre l'entrée annulerait la navigation et ramènerait à
            // l'accueil — c'est ce qui rendait le menu inopérant. On ne peut pas
            // se fier à l'URL : le routeur ne l'a pas encore changée à cet instant.
            if (!alive.current) return;
            // Fermé par un bouton : on rend l'entrée ajoutée, sinon il faudrait
            // deux retours pour quitter la page.
            pendingBack = setTimeout(() => {
                pendingBack = null;
                if (window.location.pathname !== from) return;
                backEstDeNous = true;
                window.history.back();
                // Filet : si aucun `popstate` ne vient (navigation entre-temps),
                // le drapeau ne doit pas rester levé et avaler un vrai retour.
                setTimeout(() => { backEstDeNous = false; }, 400);
            }, 0);
        };
    }, [isOpen]);
}

