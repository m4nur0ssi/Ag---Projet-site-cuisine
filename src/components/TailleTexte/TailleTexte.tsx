'use client';

import React from 'react';
import { ECHELLE_MAX, ECHELLE_MIN } from '@/lib/echelle-preparation';
import styles from './TailleTexte.module.css';

interface TailleTexteProps {
    echelle: number;
    plus: () => void;
    moins: () => void;
}

/** Deux boutons A− et A+ : la taille du texte de la carte d'étape, en préparation. */
export default function TailleTexte({ echelle, plus, moins }: TailleTexteProps) {
    return (
        <div className={styles.groupe} role="group" aria-label="Taille du texte">
            <button
                type="button"
                className={styles.bouton}
                onClick={moins}
                disabled={echelle <= ECHELLE_MIN}
                aria-label="Texte plus petit"
            >
                A<span className={styles.petit}>−</span>
            </button>
            <span className={styles.valeur} aria-hidden>{Math.round(echelle * 100)}</span>
            <button
                type="button"
                className={styles.bouton}
                onClick={plus}
                disabled={echelle >= ECHELLE_MAX}
                aria-label="Texte plus grand"
            >
                A<span className={styles.grand}>+</span>
            </button>
        </div>
    );
}
