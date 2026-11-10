'use client';

import { annoncerFinChrono } from '@/lib/annonceChrono';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';

/** Ce qu'on affiche à côté d'un chrono : de quelle recette il vient. */
export interface RecetteChrono { titre: string; image?: string; /** Index de l'étape qui a lancé le chrono. */ etape?: number }

export interface Chrono {
    id: string;
    /** Durée totale, en secondes. */
    duration: number;
    /** Secondes restantes (calculées depuis l'heure de fin, donc justes même après une mise en veille). */
    remaining: number;
    label: string;
    recipeId?: string;
    recette?: RecetteChrono;
    /** Nom d'ingrédient annoncé à la fin (« carottes : c'est prêt »). */
    nom?: string | null;
}

interface TimerContextType {
    /** Le chrono qui se termine EN PREMIER (celui que montre la loupe), ou null. */
    activeTimer: Chrono | null;
    /** Tous les chronos en cours, le plus proche de la fin d'abord. */
    timers: Chrono[];
    startTimer: (minutes: number, label: string, recipeId?: string, recette?: RecetteChrono, nom?: string | null) => void;
    /** Sans identifiant : arrête le chrono qui finit en premier. */
    stopTimer: (id?: string) => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

interface Depart { id: string; fin: number; duration: number; label: string; recipeId?: string; recette?: RecetteChrono; nom?: string | null }

export function TimerProvider({ children }: { children: React.ReactNode }) {
    // Plusieurs recettes peuvent cuire en même temps : une liste, pas un seul chrono.
    const [departs, setDeparts] = useState<Depart[]>([]);
    const [maintenant, setMaintenant] = useState(() => Date.now());
    const compteur = useRef(0);

    // Un seul battement pour tous les chronos.
    useEffect(() => {
        if (!departs.length) return;
        setMaintenant(Date.now());
        const id = setInterval(() => setMaintenant(Date.now()), 1000);
        return () => clearInterval(id);
    }, [departs.length]);

    const timers = useMemo<Chrono[]>(
        () => departs
            .map((d) => ({
                id: d.id, duration: d.duration, label: d.label, recipeId: d.recipeId, recette: d.recette, nom: d.nom,
                remaining: Math.max(0, Math.ceil((d.fin - maintenant) / 1000)),
            }))
            .sort((a, b) => a.remaining - b.remaining),
        [departs, maintenant],
    );

    // Les chronos arrivés à zéro sonnent (voix + notification), puis disparaissent.
    useEffect(() => {
        const finis = timers.filter((t) => t.remaining <= 0);
        if (!finis.length) return;
        finis.forEach((t) => {
            const quoi = t.recette ? `${t.recette.titre} — ${t.label}` : t.label;
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('Cuisine terminée !', { body: `Le temps est écoulé pour : ${quoi}` });
            }
            void annoncerFinChrono(t.label, t.recette?.titre, t.nom);
        });
        // Réinitialise les étapes d'une recette seulement quand plus aucun de ses minuteurs ne tourne.
        const recettes = new Set(finis.map((t) => t.recipeId).filter(Boolean) as string[]);
        recettes.forEach((r) => {
            if (!timers.some((t) => t.recipeId === r && t.remaining > 0)) {
                window.dispatchEvent(new CustomEvent('timerReset', { detail: { recipeId: r } }));
            }
        });
        setDeparts((prev) => prev.filter((d) => !finis.some((f) => f.id === d.id)));
    }, [timers]);

    const startTimer = useCallback((minutes: number, label: string, recipeId?: string, recette?: RecetteChrono, nom?: string | null) => {
        const fin = Date.now() + minutes * 60_000;
        const id = `chrono-${Date.now()}-${compteur.current++}`;
        // Plusieurs minuteurs par recette peuvent s'empiler (une étape = un minuteur) ;
        // relancer la même étape remplace le sien au lieu de l'ajouter en double.
        setDeparts((prev) => [
            ...prev.filter((d) => !(recipeId && d.recipeId === recipeId && d.label === label)),
            { id, fin, duration: minutes * 60, label, recipeId, recette, nom },
        ]);
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const stopTimer = useCallback((id?: string) => {
        setDeparts((prev) => {
            if (!prev.length) return prev;
            const cible = id
                ? prev.find((d) => d.id === id)
                : [...prev].sort((a, b) => a.fin - b.fin)[0];
            if (!cible) return prev;
            const reste = prev.filter((d) => d.id !== cible.id);
            if (cible.recipeId && !reste.some((d) => d.recipeId === cible.recipeId)) {
                window.dispatchEvent(new CustomEvent('timerReset', { detail: { recipeId: cible.recipeId } }));
            }
            return reste;
        });
    }, []);

    return (
        <TimerContext.Provider value={{ activeTimer: timers[0] || null, timers, startTimer, stopTimer }}>
            {children}
        </TimerContext.Provider>
    );
}

export const useTimer = () => {
    const context = useContext(TimerContext);
    if (!context) throw new Error('useTimer must be used within a TimerProvider');
    return context;
};
