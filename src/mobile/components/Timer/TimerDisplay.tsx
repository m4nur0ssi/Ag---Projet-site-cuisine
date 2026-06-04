'use client';

import React, { useMemo } from 'react';
import styles from './TimerDisplay.module.css';

interface TimerDisplayProps {
    duration: number;
    remaining: number;
    label: string;
    onStop: () => void;
}

export default function TimerDisplay({ duration, remaining, label, onStop }: TimerDisplayProps) {
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const progress = (remaining / duration) * 100;

    // Calculate SVG circle properties
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (remaining / duration) * circumference;

    return (
        <div className={styles.container}>
            <div className={styles.glass}>
                <div className={styles.progressCircle}>
                    <svg className={styles.svg}>
                        <circle
                            className={styles.circleBg}
                            cx="40"
                            cy="40"
                            r={radius}
                        />
                        <circle
                            className={styles.circleFill}
                            cx="40"
                            cy="40"
                            r={radius}
                            style={{
                                strokeDasharray: circumference,
                                strokeDashoffset: strokeDashoffset
                            }}
                        />
                    </svg>
                    <div className={styles.timeValue}>{formatTime(remaining)}</div>
                </div>

                <div className={styles.info}>
                    <div className={styles.label}>{label}</div>
                    <button onClick={onStop} className={styles.stopBtn}>
                        Arrêter
                    </button>
                </div>
            </div>
        </div>
    );
}
