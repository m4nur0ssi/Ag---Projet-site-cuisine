'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import TimerDisplay from './TimerDisplay';
import { annoncerFinChrono } from '@/lib/annonceChrono';

export interface Chrono {
    id: string;
    /** Durée totale, en secondes. */
    duration: number;
    /** Secondes restantes (calculées depuis l'heure de fin : justes même après une mise en veille). */
    remaining: number;
    label: string;
    /** Nom d'ingrédient annoncé à la fin (« carottes : c'est prêt »). */
    nom?: string | null;
    /** Recette qui a lancé ce minuteur (pour l'arrêter à la fin de la recette). */
    recipeId?: string;
    /** En pause : le temps restant est figé jusqu'à la reprise. */
    enPause?: boolean;
}

interface TimerContextType {
    /** Le chrono qui se termine EN PREMIER, ou null. */
    activeTimer: Chrono | null;
    /** Tous les chronos en cours, le plus proche de la fin d'abord. */
    timers: Chrono[];
    startTimer: (minutes: number, label: string, nom?: string | null, recipeId?: string) => void;
    /** Arrête tous les minuteurs lancés par cette recette (fin de préparation). */
    stopRecette: (recipeId: string) => void;
    /** Sans identifiant : arrête le chrono qui finit en premier. */
    stopTimer: (id?: string) => void;
    /** Met en pause ou reprend un chrono : son temps restant ne bouge pas pendant la pause. */
    togglePause: (id: string) => void;
    /** Lance le chrono seulement s'il n'existe pas déjà : naviguer entre les étapes ne le remet jamais à zéro. */
    demarrerSiAbsent: (minutes: number, label: string, nom?: string | null, recipeId?: string) => void;
    /** La préparation affiche déjà les minuteurs dans sa tuile : le bandeau du bas se cache. */
    masquerBandeau: (masque: boolean) => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

interface Depart { id: string; fin: number; duration: number; label: string; nom?: string | null; recipeId?: string; enPause?: boolean; reste?: number }

export function TimerProvider({ children }: { children: React.ReactNode }) {
    // Plusieurs minuteurs en même temps (carottes + pommes de terre) : une liste.
    const [departs, setDeparts] = useState<Depart[]>([]);
    const [maintenant, setMaintenant] = useState(() => Date.now());
    const compteur = useRef(0);
    const [bandeauMasque, setBandeauMasque] = useState(false);
    const masquerBandeau = useCallback((m: boolean) => setBandeauMasque(m), []);

    // Un seul battement pour tous les minuteurs.
    useEffect(() => {
        if (!departs.length) return;
        setMaintenant(Date.now());
        const id = setInterval(() => setMaintenant(Date.now()), 1000);
        return () => clearInterval(id);
    }, [departs.length]);

    const timers = useMemo<Chrono[]>(
        () => departs
            .map((d) => ({
                id: d.id, duration: d.duration, label: d.label, nom: d.nom, recipeId: d.recipeId,
                enPause: !!d.enPause,
                remaining: d.enPause ? Math.max(0, Math.ceil((d.reste ?? 0) / 1000)) : Math.max(0, Math.ceil((d.fin - maintenant) / 1000)),
            }))
            .sort((a, b) => a.remaining - b.remaining),
        [departs, maintenant],
    );

    // Les minuteurs arrivés à zéro sonnent (voix + notification), puis disparaissent.
    useEffect(() => {
        const finis = timers.filter((t) => t.remaining <= 0);
        if (!finis.length) return;
        finis.forEach((t) => {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('Cuisine terminée !', { body: `Le temps est écoulé pour : ${t.label}` });
            }
            void annoncerFinChrono(t.label, undefined, t.nom);
        });
        setDeparts((prev) => prev.filter((d) => !finis.some((f) => f.id === d.id)));
    }, [timers]);

    const startTimer = useCallback((minutes: number, label: string, nom?: string | null, recipeId?: string) => {
        const id = `chrono-${Date.now()}-${compteur.current++}`;
        // Relancer la même étape remplace son minuteur au lieu d'en empiler un double.
        setDeparts((prev) => [
            ...prev.filter((d) => d.label !== label),
            { id, fin: Date.now() + minutes * 60_000, duration: minutes * 60, label, nom, recipeId },
        ]);
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const stopRecette = useCallback((recipeId: string) => {
        setDeparts((prev) => prev.filter((d) => d.recipeId !== recipeId));
    }, []);

    const stopTimer = useCallback((id?: string) => {
        setDeparts((prev) => {
            if (!prev.length) return prev;
            const cible = id ? prev.find((d) => d.id === id) : [...prev].sort((a, b) => a.fin - b.fin)[0];
            return cible ? prev.filter((d) => d.id !== cible.id) : prev;
        });
    }, []);


    /** Pause / reprise : pendant la pause, le temps restant est gelé ; à la reprise, la fin est recalculée. */
    const togglePause = useCallback((id: string) => {
        setDeparts((prev) => prev.map((d) => {
            if (d.id !== id) return d;
            if (d.enPause) return { ...d, enPause: false, reste: undefined, fin: Date.now() + (d.reste ?? 0) };
            return { ...d, enPause: true, reste: Math.max(0, d.fin - Date.now()) };
        }));
    }, []);

    /** Ne relance jamais un chrono déjà en cours (ni en pause) : naviguer ne doit rien réinitialiser. */
    const demarrerSiAbsent = useCallback((minutes: number, label: string, nom?: string | null, recipeId?: string) => {
        setDeparts((prev) => {
            if (prev.some((d) => d.label === label && (recipeId ? d.recipeId === recipeId : true))) return prev;
            const id = `chrono-${Date.now()}-${compteur.current++}`;
            return [...prev, { id, fin: Date.now() + minutes * 60_000, duration: minutes * 60, label, nom, recipeId }];
        });
    }, []);

    return (
        <TimerContext.Provider value={{ activeTimer: timers[0] || null, timers, startTimer, demarrerSiAbsent, togglePause, stopTimer, stopRecette, masquerBandeau }}>
            {children}
            {!bandeauMasque && <TimerDisplay timers={timers} onStop={stopTimer} />}
        </TimerContext.Provider>
    );
}

export const useTimer = () => {
    const context = useContext(TimerContext);
    if (!context) throw new Error('useTimer must be used within a TimerProvider');
    return context;
};
