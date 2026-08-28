'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Réduit un titre jusqu'à ce qu'il tienne dans sa colonne.
 *
 * La taille du titre de la fiche était exprimée en `vw` : elle suivait la
 * LARGEUR DE LA FENÊTRE alors que le titre vit dans une colonne étroite, à côté
 * de la photo. Sur un grand écran, la police montait à 60 px dans une colonne de
 * 230 px, et le navigateur faisait ce qu'on lui avait demandé — il coupait les
 * mots en syllabes, tirets compris.
 *
 * Corriger la CSS ne suffit pas : aucune unité universelle ne mesure le parent.
 * `cqw` le ferait, mais il manque à Safari 15 et la règle entière y serait
 * ignorée. On mesure donc, comme le ferait un typographe : on descend d'un cran
 * tant qu'un mot dépasse, et jamais en dessous d'un plancher.
 *
 * @param cle   Change quand le titre change : on remesure.
 * @param plancher Part du corps d'origine sous laquelle on ne descend pas.
 */
export function useAjusterTitre<T extends HTMLElement>(cle: unknown, plancher = 0.5) {
    const ref = useRef<T | null>(null);

    const ajuster = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        // On repart TOUJOURS de la taille voulue par la CSS : sans cette remise
        // à zéro, un titre court hériterait de la réduction du précédent.
        el.style.fontSize = '';
        const depart = parseFloat(getComputedStyle(el).fontSize);
        if (!depart) return;
        const mini = depart * plancher;
        let taille = depart;
        /*
         * Un mot dépasse-t-il la colonne ?
         *
         * Pas `scrollWidth` du parent, ni `getBoundingClientRect` : le titre est
         * INCLINÉ (`skewX`), et ces deux-là comptent la transformation. Ils
         * signalaient un débordement permanent, et le titre descendait jusqu'au
         * plancher même quand il tenait large. `offsetWidth` donne la largeur de
         * mise en page, celle d'avant la transformation.
         */
        const deborde = () => {
            const dispo = el.clientWidth;
            let large = 0;
            el.querySelectorAll('*').forEach((n) => {
                large = Math.max(large, (n as HTMLElement).offsetWidth);
            });
            return large > dispo + 1;
        };
        while (taille > mini && deborde()) {
            taille -= 2;
            el.style.fontSize = `${taille}px`;
        }
    }, [plancher]);

    useLayoutEffect(() => {
        ajuster();
        // La colonne bouge avec la fenêtre : on remesure quand elle change.
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', ajuster);
            return () => window.removeEventListener('resize', ajuster);
        }
        const ro = new ResizeObserver(ajuster);
        const el = ref.current;
        if (el?.parentElement) ro.observe(el.parentElement);
        return () => ro.disconnect();
    }, [ajuster, cle]);

    return ref;
}
