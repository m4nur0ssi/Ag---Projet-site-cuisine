'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import styles from './DifficultyMeter.module.css';

interface Props {
    prepTime?: number;
    cookTime?: number;
    steps?: number;
    difficulty?: string; // indice de secours si pas de temps/étapes
    showCaption?: boolean; // affiche "X étapes" à côté (desktop). false = barres seules (PWA).
}

// Niveau 1..3 — piloté D'ABORD par le nombre d'étapes (plus d'étapes = plus difficile) ;
// le temps total et le champ difficulté ne servent que de repli si les étapes manquent.
const computeLevel = (prep = 0, cook = 0, steps = 0, difficulty = ''): number => {
    if (steps > 0) {
        if (steps >= 9) return 3;
        if (steps >= 5) return 2;
        return 1;
    }
    const total = prep + cook;
    const d = difficulty.toLowerCase();
    if (d.includes('difficile') || total >= 60) return 3;
    if (d.includes('moy') || total >= 30) return 2;
    return 1;
};

const LEVELS = [
    { from: '#34d399', to: '#10b981', glow: 'rgba(16,185,129,0.55)' },   // 1 — vert
    { from: '#fbbf24', to: '#f59e0b', glow: 'rgba(245,158,11,0.55)' },   // 2 — ambre
    { from: '#fb7185', to: '#ef4444', glow: 'rgba(239,68,68,0.55)' },    // 3 — rouge
];

export default function DifficultyMeter({ prepTime, cookTime, steps, difficulty, showCaption = true }: Props) {
    const level = useMemo(
        () => computeLevel(prepTime, cookTime, steps, difficulty),
        [prepTime, cookTime, steps, difficulty]
    );
    const color = LEVELS[level - 1];

    return (
        <div className={styles.wrap}>
            {/* Barres ascendantes type signal — remplies jusqu'au niveau */}
            <div className={styles.bars} aria-label={`Niveau ${level} sur 3`}>
                {[0, 1, 2].map((i) => {
                    const on = i < level;
                    return (
                        <motion.span
                            key={i}
                            className={styles.bar}
                            style={{
                                height: 8 + i * 6,
                                background: on
                                    ? `linear-gradient(180deg, ${color.from}, ${color.to})`
                                    : undefined,
                                boxShadow: on ? `0 0 10px ${color.glow}` : undefined,
                            }}
                            initial={{ scaleY: 0, opacity: 0 }}
                            animate={{ scaleY: 1, opacity: 1 }}
                            transition={{
                                delay: 0.12 + i * 0.09,
                                type: 'spring',
                                stiffness: 520,
                                damping: 18,
                            }}
                        />
                    );
                })}
                {/* Halo qui pulse sur la dernière barre allumée */}
                <motion.span
                    className={styles.pulse}
                    style={{ left: (level - 1) * 11, height: 8 + (level - 1) * 6, boxShadow: `0 0 0 0 ${color.glow}` }}
                    animate={{ boxShadow: [`0 0 0 0 ${color.glow}`, `0 0 0 7px rgba(0,0,0,0)`] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                />
            </div>
        </div>
    );
}
