'use client';

import React from 'react';
import { motion } from 'framer-motion';
import styles from './MinuteurEtape.module.css';

interface MinuteurEtapeProps {
    /** Durée totale et temps restant, en secondes. */
    duration: number;
    remaining: number;
    /** Ce qui cuit (affiché sous le temps). */
    libelle: string;
    onArreter: () => void;
    /** Version compacte : anneau à gauche, temps et « Arrêter » à droite (tuile mobile). */
    compact?: boolean;
}

const RAYON = 70;
const CIRCONF = 2 * Math.PI * RAYON;

const formate = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
        ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
        : `${m}:${sec.toString().padStart(2, '0')}`;
};

/**
 * Le minuteur d'une étape : un anneau qui se vide, le temps au centre. La tuile
 * d'ingrédients se retourne dessus (rotation 3D) ; « Arrêter » la ramène.
 */
export default function MinuteurEtape({ duration, remaining, libelle, onArreter, compact = false }: MinuteurEtapeProps) {
    const fraction = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
    return (
        <motion.div
            className={`${styles.bloc} ${compact ? styles.blocCompact : ''}`}
            initial={{ rotateY: -90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            role="timer"
            aria-live="off"
        >
            <div className={`${styles.anneau} ${compact ? styles.anneauCompact : ''}`}>
                <svg viewBox="0 0 160 160" className={styles.svg} aria-hidden>
                    <circle cx="80" cy="80" r={RAYON} className={styles.fond} />
                    <motion.circle
                        cx="80"
                        cy="80"
                        r={RAYON}
                        className={styles.progres}
                        strokeDasharray={CIRCONF}
                        animate={{ strokeDashoffset: CIRCONF * (1 - fraction) }}
                        transition={{ duration: 0.9, ease: 'linear' }}
                    />
                </svg>
                <div className={styles.temps}>{formate(remaining)}</div>
            </div>
            <div className={styles.colonne}>
                <div className={styles.libelle}>{libelle}</div>
                <button type="button" className={styles.arreter} onClick={onArreter}>Arrêter</button>
            </div>
        </motion.div>
    );
}

const R_MINI = 15;
const C_MINI = 2 * Math.PI * R_MINI;

/** Un minuteur en pilule (anneau 36 px, temps, nom, croix) : pour empiler plusieurs minuteurs dans la tuile. */
export function MiniMinuteur({ duration, remaining, libelle, onArreter }: MinuteurEtapeProps) {
    const fraction = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
    return (
        <motion.li
            layout
            className={styles.pilule}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
            <svg viewBox="0 0 36 36" className={styles.piluleSvg} aria-hidden>
                <circle cx="18" cy="18" r={R_MINI} className={styles.piluleFond} />
                <circle
                    cx="18" cy="18" r={R_MINI}
                    className={styles.piluleProgres}
                    strokeDasharray={C_MINI}
                    strokeDashoffset={C_MINI * (1 - fraction)}
                />
            </svg>
            <span className={styles.piluleTemps}>{formate(remaining)}</span>
            <span className={styles.piluleNom}>{libelle}</span>
            <button type="button" className={styles.piluleStop} onClick={onArreter} aria-label={`Arrêter le minuteur : ${libelle}`}>✕</button>
        </motion.li>
    );
}
