'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TIPS } from '@/lib/tips';
import styles from './Tip.module.css';

const SEEN_KEY = 'magic-tips-seen-v1';

const seen = (): string[] => {
    try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); return Array.isArray(v) ? v : []; }
    catch { return []; }
};

/** Marque une astuce comme vue — depuis n'importe où (fermeture, geste accompli). */
export function markTipSeen(id: string) {
    try {
        const list = seen();
        if (list.includes(id)) return;
        localStorage.setItem(SEEN_KEY, JSON.stringify([...list, id]));
    } catch { /* stockage refusé : l'astuce reviendra, tant pis */ }
}

/**
 * Bulle d'astuce de première visite.
 *
 * Elle ne s'affiche qu'une fois par écran et par navigateur, se ferme d'une
 * croix, et attend une seconde avant d'apparaître : arriver sur une page ET
 * recevoir un conseil dans la même image, c'est deux choses à lire en même
 * temps. Le mot « {geste} » du texte devient « appui long » ou « clic droit »
 * selon l'appareil — la consigne doit désigner le geste que CETTE personne peut
 * faire.
 */
export default function Tip({ id, delay = 1000 }: { id: keyof typeof TIPS | string; delay?: number }) {
    const [show, setShow] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const tip = TIPS[id as string];

    useEffect(() => {
        if (!tip) return;
        if (seen().includes(tip.id)) return;
        const t = setTimeout(() => setShow(true), delay);
        return () => clearTimeout(t);
    }, [tip, delay]);

    if (!tip || !show || typeof document === 'undefined') return null;

    const close = () => {
        setLeaving(true);
        markTipSeen(tip.id);
        setTimeout(() => setShow(false), 260);
    };

    const coarse = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
    const text = tip.text.replace('{geste}', coarse ? 'appui long' : 'clic droit');

    return createPortal(
        <div className={`${styles.wrap} ${leaving ? styles.leaving : ''}`} role="status">
            <div className={styles.bubble}>
                <button className={styles.close} onClick={close} aria-label="Fermer l’astuce">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
                <div className={styles.kicker}>{tip.kicker}</div>
                <div className={styles.title}>{tip.title}</div>
                <p className={styles.text}>{text}</p>
                <button className={styles.cta} onClick={close}>{tip.cta || 'J’ai compris'}</button>
            </div>
        </div>,
        document.body,
    );
}
