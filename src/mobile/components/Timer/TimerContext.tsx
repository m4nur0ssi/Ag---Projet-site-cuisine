'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import TimerDisplay from './TimerDisplay';

interface TimerContextType {
    activeTimer: { duration: number; remaining: number; label: string; recipeId?: string } | null;
    startTimer: (minutes: number, label: string, recipeId?: string) => void;
    stopTimer: () => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: React.ReactNode }) {
    const [activeTimer, setActiveTimer] = useState<{ duration: number; remaining: number; label: string; recipeId?: string } | null>(null);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (activeTimer && activeTimer.remaining > 0) {
            interval = setInterval(() => {
                setActiveTimer(prev => prev ? { ...prev, remaining: prev.remaining - 1 } : null);
            }, 1000);
        } else if (activeTimer && activeTimer.remaining === 0) {
            // Timer finished
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('Cuisine terminée !', { body: `Le temps est écoulé pour : ${activeTimer.label}` });
            }
            alert(`Fin du temps pour : ${activeTimer.label}`);
            
            // Reinitialiser les étapes de la recette concernée
            if (activeTimer.recipeId) {
                window.dispatchEvent(new CustomEvent('timerReset', { detail: { recipeId: activeTimer.recipeId } }));
            }
            
            setActiveTimer(null);
        }
        return () => clearInterval(interval);
    }, [activeTimer]);

    const startTimer = (minutes: number, label: string, recipeId?: string) => {
        setActiveTimer({ duration: minutes * 60, remaining: minutes * 60, label, recipeId });
        if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    };

    const stopTimer = () => {
        if (activeTimer?.recipeId) {
            window.dispatchEvent(new CustomEvent('timerReset', { detail: { recipeId: activeTimer.recipeId } }));
        }
        setActiveTimer(null);
    };

    return (
        <TimerContext.Provider value={{ activeTimer, startTimer, stopTimer }}>
            {children}
        </TimerContext.Provider>
    );
}

export const useTimer = () => {
    const context = useContext(TimerContext);
    if (!context) throw new Error('useTimer must be used within a TimerProvider');
    return context;
};
