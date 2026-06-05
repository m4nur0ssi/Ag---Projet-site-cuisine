'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Portal from '@/components/Portal';
import styles from './WinePairing.module.css';

interface Wine {
    name: string;
    color: 'rouge' | 'blanc' | 'rosé' | 'effervescent';
    country: string;
    flag: string;
    region: string;
    grape: string;
    priceMin: number;
    priceMax: number;
    tier: string;
    why: string;
}

interface Props {
    recipeId: string;
    title?: string;
    category?: string;
    ingredients: { name?: string }[] | string[];
    compact?: boolean;
}

// Teintes réalistes de la robe du vin.
const COLOR_DOT: Record<string, string> = {
    rouge: '#7b1e2b',          // bordeaux profond
    blanc: '#e6d27a',          // doré pâle
    'rosé': '#f3a8bd',         // rose
    effervescent: '#efe3a0',   // pâle pétillant
};

const cacheKey = (id: string) => `wine-pairing-v1-${id}`;

// Lien de recherche Vivino (base mondiale, page recherche fiable → pas de 404).
const vivinoUrl = (w: Wine) =>
    `https://www.vivino.com/search/wines?q=${encodeURIComponent(`${w.name} ${w.region || ''}`.trim())}`;

export default function WinePairing({ recipeId, title, category, ingredients, compact = false }: Props) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [wines, setWines] = useState<Wine[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const names = (ingredients || []).map((i: any) => (typeof i === 'string' ? i : i?.name || '')).filter(Boolean);

    const load = async () => {
        setError(null);
        // Cache local par recette → instantané au re-clic, zéro appel.
        try {
            const cached = localStorage.getItem(cacheKey(recipeId));
            if (cached) { setWines(JSON.parse(cached)); return; }
        } catch { /* ignore */ }

        setLoading(true);
        try {
            const res = await fetch('/api/wine-pairing', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ title, category, ingredients: names }),
            });
            const data = await res.json();
            if (!res.ok || !data.wines) {
                setError(data?.error === 'ANTHROPIC_API_KEY manquante'
                    ? 'Service indisponible (clé manquante).'
                    : /credit|crédit|balance/i.test(data?.detail || '')
                        ? 'Service momentanément indisponible (crédits API).'
                        : 'Impossible de proposer un vin pour le moment.');
                return;
            }
            setWines(data.wines);
            try { localStorage.setItem(cacheKey(recipeId), JSON.stringify(data.wines)); } catch { /* ignore */ }
        } catch {
            setError('Pas de connexion. Réessaie plus tard.');
        } finally {
            setLoading(false);
        }
    };

    const openSheet = () => {
        setOpen(true);
        if (!wines) load();
    };

    return (
        <>
            <button
                type="button"
                className={`${styles.pill} ${compact ? styles.compact : ''}`}
                onClick={openSheet}
            >
                <span className={styles.glass}>🍷</span>
                Quel vin&nbsp;?
            </button>

            <Portal>
                <AnimatePresence>
                    {open && (
                        <>
                            <motion.div
                                className={styles.backdrop}
                                onClick={() => setOpen(false)}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            />
                            <motion.div
                                className={styles.sheet}
                                initial={{ y: '100%', opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: '100%', opacity: 0 }}
                                transition={{ type: 'spring', damping: 28, stiffness: 420, mass: 0.7 }}
                            >
                                <div className={styles.handle} />
                                <div className={styles.header}>
                                    <h3 className={styles.heading}>🍷 Accords vins</h3>
                                    <button className={styles.close} onClick={() => setOpen(false)}>✕</button>
                                </div>

                                {loading && (
                                    <div className={styles.center}>
                                        <div className={styles.spinner} />
                                        <p className={styles.muted}>Le sommelier analyse la recette…</p>
                                    </div>
                                )}

                                {error && !loading && (
                                    <div className={styles.center}>
                                        <span style={{ fontSize: '2.2rem' }}>🍇</span>
                                        <p className={styles.muted}>{error}</p>
                                        <button className={styles.retry} onClick={load}>Réessayer</button>
                                    </div>
                                )}

                                {!loading && !error && wines && (
                                    <div className={styles.list}>
                                        {wines.map((w, i) => (
                                            <motion.div
                                                key={i}
                                                className={styles.card}
                                                initial={{ opacity: 0, y: 14 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.06 * i }}
                                            >
                                                <div className={styles.cardTop}>
                                                    <span
                                                        className={styles.colorDot}
                                                        style={{ background: COLOR_DOT[w.color] || '#999' }}
                                                    />
                                                    <span className={styles.wineName}>{w.name}</span>
                                                    <span className={styles.flag}>{w.flag}</span>
                                                </div>
                                                <div className={styles.meta}>
                                                    {w.region} · {w.grape}
                                                </div>
                                                <div className={styles.row}>
                                                    <span className={styles.price}>{w.priceMin}–{w.priceMax} €</span>
                                                    <span className={styles.tier}>{w.tier}</span>
                                                </div>
                                                <p className={styles.why}>{w.why}</p>
                                                <a
                                                    className={styles.link}
                                                    href={vivinoUrl(w)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    Voir le vin
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M7 17 17 7M7 7h10v10" />
                                                    </svg>
                                                </a>
                                            </motion.div>
                                        ))}
                                        <p className={styles.disclaimer}>À déguster avec modération.</p>
                                    </div>
                                )}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </Portal>
        </>
    );
}
