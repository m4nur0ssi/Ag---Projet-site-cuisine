'use client';

import React from 'react';
import styles from './PortionsControl.module.css';

interface Props {
    value: number;
    base: number;          // portions d'origine de la recette
    onChange: (n: number) => void;
    min?: number;
    max?: number;
    compact?: boolean;     // aligne taille/forme sur le convertisseur mobile (36px)
}

// Stepper de portions inline (pill) — pilote le scaling live des quantités.
// Placé à côté du Convertisseur pour rester cohérent visuellement.
export default function PortionsControl({ value, base, onChange, min = 1, max = 50, compact = false }: Props) {
    const haptic = () => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8);
    };
    const dec = () => { if (value > min) { onChange(value - 1); haptic(); } };
    const inc = () => { if (value < max) { onChange(value + 1); haptic(); } };

    const scaled = base && value !== base;

    return (
        <div className={`${styles.pill} ${compact ? styles.compact : ''} ${scaled ? styles.active : ''}`}>
            <span className={styles.icon}>👥</span>
            <button
                type="button"
                className={styles.step}
                onClick={dec}
                disabled={value <= min}
                aria-label="Moins de portions"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>
            <span className={styles.value}>
                {value}
                <span className={styles.unit}>pers.</span>
            </span>
            <button
                type="button"
                className={styles.step}
                onClick={inc}
                disabled={value >= max}
                aria-label="Plus de portions"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>
        </div>
    );
}
