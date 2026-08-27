'use client';

import { useCallback, useRef, useState } from 'react';
import styles from './SwipeRow.module.css';

/**
 * Une ligne qu'on écarte du doigt pour la supprimer, comme dans Mail.
 * ==================================================================
 *
 * Le geste raconte l'action : la ligne glisse vers la gauche et découvre un
 * panneau rouge « Supprimer ». On peut s'arrêter là — le panneau reste ouvert,
 * et il faut le toucher pour confirmer — ou pousser franchement, et la ligne
 * part sans confirmation. C'est exactement le comportement d'iOS, y compris le
 * fait qu'un simple contact ailleurs referme la ligne.
 *
 * Deux choix techniques, appris à nos dépens sur la fiche recette :
 *
 *   • les écouteurs sont posés à la main en `passive: false`. React attache
 *     `touchmove` en mode passif, où `preventDefault()` est ignoré en silence —
 *     Safari garderait alors son propre geste par-dessus le nôtre ;
 *   • le retour en place se fait par une transition CSS, pas par un ressort :
 *     une courbe qui dépasse sa cible se lit comme un rebond, et c'est
 *     précisément ce qu'on ne veut pas ici.
 */
const LARGEUR_PANNEAU = 116;  // ce qu'on découvre quand la ligne reste ouverte
const MARGE = 6;              // air entre la pastille et le bord de la ligne
const SEUIL_OUVERTURE = 40;   // au-delà, la ligne reste ouverte au relâchement
const PART_SUPPRESSION = 0.55; // fraction de la largeur au-delà de laquelle on supprime

export default function SwipeRow({
    onDelete,
    children,
    libelle = 'Supprimer',
}: {
    onDelete: () => void;
    children: React.ReactNode;
    libelle?: string;
}) {
    const [decalage, setDecalage] = useState(0);
    const [glisse, setGlisse] = useState(false);
    const [partant, setPartant] = useState(false);

    const conteneur = useRef<HTMLDivElement | null>(null);
    const departX = useRef(0);
    const departY = useRef(0);
    const ouvertAuDepart = useRef(0);
    const sens = useRef<'indecis' | 'horizontal' | 'vertical'>('indecis');

    const largeur = () => conteneur.current?.offsetWidth || window.innerWidth;

    const supprimer = useCallback(() => {
        setPartant(true);
        setDecalage(largeur());
        // On laisse la ligne sortir de l'écran avant de la retirer des données.
        window.setTimeout(onDelete, 220);
    }, [onDelete]);

    const debut = useCallback((e: TouchEvent) => {
        departX.current = e.touches[0].clientX;
        departY.current = e.touches[0].clientY;
        ouvertAuDepart.current = decalage;
        sens.current = 'indecis';
        setGlisse(true);
    }, [decalage]);

    const bouge = useCallback((e: TouchEvent) => {
        const dx = e.touches[0].clientX - departX.current;
        const dy = e.touches[0].clientY - departY.current;

        if (sens.current === 'indecis') {
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) sens.current = 'horizontal';
            else if (Math.abs(dy) > 8) sens.current = 'vertical';
        }
        if (sens.current !== 'horizontal') return;

        // Le défilement vertical de la liste ne doit pas emporter le geste.
        e.preventDefault();
        const brut = ouvertAuDepart.current - dx;
        // Vers la droite au-delà du repos : résistance, la ligne n'a rien à montrer.
        setDecalage(brut < 0 ? brut * 0.25 : brut);
    }, []);

    const fin = useCallback(() => {
        setGlisse(false);
        if (sens.current !== 'horizontal') return;
        if (decalage > largeur() * PART_SUPPRESSION) supprimer();
        else setDecalage(decalage > SEUIL_OUVERTURE ? LARGEUR_PANNEAU : 0);
    }, [decalage, supprimer]);

    /** Branchement manuel : `passive: false` est indispensable au preventDefault. */
    const brancher = useCallback((el: HTMLDivElement | null) => {
        const precedent = conteneur.current;
        if (precedent === el) return;
        if (precedent) {
            precedent.removeEventListener('touchstart', debut);
            precedent.removeEventListener('touchmove', bouge);
            precedent.removeEventListener('touchend', fin);
            precedent.removeEventListener('touchcancel', fin);
        }
        conteneur.current = el;
        if (el) {
            const opts = { passive: false } as AddEventListenerOptions;
            el.addEventListener('touchstart', debut, opts);
            el.addEventListener('touchmove', bouge, opts);
            el.addEventListener('touchend', fin, opts);
            el.addEventListener('touchcancel', fin, opts);
        }
    }, [debut, bouge, fin]);

    return (
        <div className={styles.enveloppe} ref={brancher}>
            {/*
              * La pastille grandit avec le geste, comme dans Fichiers : au début
              * ce n'est qu'un liseré rouge, et le mot n'apparaît qu'une fois la
              * place suffisante. Elle reste détachée des bords de la ligne.
              */}
            {/* Largeur nulle au repos : une largeur négative serait ignorée par le
                navigateur, et la pastille resterait visible en liseré rouge. */}
            <button
                className={styles.panneau}
                style={{ width: Math.max(0, decalage - MARGE), visibility: decalage > 1 ? 'visible' : 'hidden' }}
                onClick={supprimer}
                tabIndex={decalage > 0 ? 0 : -1}
                aria-hidden={decalage === 0}
                aria-label={libelle}
            >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
                    <path d="M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
                </svg>
                {decalage > LARGEUR_PANNEAU * 0.72 && <span className={styles.libelle}>{libelle}</span>}
            </button>

            <div
                className={styles.contenu}
                style={{
                    transform: `translateX(${-decalage}px)`,
                    transition: glisse ? 'none' : `transform ${partant ? 220 : 220}ms cubic-bezier(0.22, 0.61, 0.36, 1)`,
                }}
                // Un contact sur la ligne ouverte la referme, sans déclencher son action.
                onClickCapture={(e) => {
                    if (decalage > 0) { e.preventDefault(); e.stopPropagation(); setDecalage(0); }
                }}
            >
                {children}
            </div>
        </div>
    );
}
