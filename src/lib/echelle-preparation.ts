'use client';

import { useEffect, useState } from 'react';

/**
 * Taille du texte en préparation, réglable pour lire à un mètre. Mémorisée sur
 * l'appareil. Bornes : 85 % à 150 %, par pas de 15 %.
 */
const CLE = 'preparation-echelle';
export const ECHELLE_MIN = 0.85;
export const ECHELLE_MAX = 1.5;
const PAS = 0.15;

export function useEchelle() {
    const [echelle, setEchelle] = useState(1);

    useEffect(() => {
        try {
            const v = parseFloat(localStorage.getItem(CLE) || '1');
            if (v >= ECHELLE_MIN && v <= ECHELLE_MAX) setEchelle(v);
        } catch { /* stockage indisponible : taille par défaut */ }
    }, []);

    const regler = (delta: number) => setEchelle((prev) => {
        const n = Math.round(Math.min(ECHELLE_MAX, Math.max(ECHELLE_MIN, prev + delta)) * 100) / 100;
        try { localStorage.setItem(CLE, String(n)); } catch { /* noop */ }
        return n;
    });

    return { echelle, plus: () => regler(PAS), moins: () => regler(-PAS) };
}
