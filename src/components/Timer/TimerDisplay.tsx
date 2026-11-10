'use client';

import React from 'react';
import styles from './TimerDisplay.module.css';

interface Chrono { id: string; duration: number; remaining: number; label: string }

interface TimerDisplayProps {
    timers: Chrono[];
    onStop: (id: string) => void;
}

const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
        ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${m}:${s.toString().padStart(2, '0')}`;
};

const RAYON = 35;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

/** Les minuteurs en cours, empilés en bas à droite : un anneau + le temps + « Arrêter » chacun. */
export default function TimerDisplay({ timers, onStop }: TimerDisplayProps) {
    if (!timers.length) return null;
    return (
        <div className={styles.container} aria-live="polite">
            {timers.map((t) => (
                <div key={t.id} className={styles.glass}>
                    <div className={styles.progressCircle}>
                        <svg className={styles.svg}>
                            <circle className={styles.circleBg} cx="40" cy="40" r={RAYON} />
                            <circle
                                className={styles.circleFill}
                                cx="40"
                                cy="40"
                                r={RAYON}
                                style={{
                                    strokeDasharray: CIRCONFERENCE,
                                    strokeDashoffset: CIRCONFERENCE - (t.remaining / t.duration) * CIRCONFERENCE,
                                }}
                            />
                        </svg>
                        <div className={styles.timeValue}>{formatTime(t.remaining)}</div>
                    </div>
                    <div className={styles.info}>
                        <div className={styles.label}>{t.label}</div>
                        <button onClick={() => onStop(t.id)} className={styles.stopBtn}>Arrêter</button>
                    </div>
                </div>
            ))}
        </div>
    );
}
