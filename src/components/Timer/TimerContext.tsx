'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import TimerDisplay from './TimerDisplay';

interface TimerContextType {
    activeTimer: { duration: number; remaining: number; label: string } | null;
    startTimer: (minutes: number, label: string) => void;
    stopTimer: () => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: React.ReactNode }) {
    const [activeTimer, setActiveTimer] = useState<{ duration: number; remaining: number; label: string } | null>(null);

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
            setActiveTimer(null);
        }
        return () => clearInterval(interval);
    }, [activeTimer]);

    const startTimer = (minutes: number, label: string) => {
        setActiveTimer({ duration: minutes * 60, remaining: minutes * 60, label });
        if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    };

    const stopTimer = () => setActiveTimer(null);

    return (
        <TimerContext.Provider value={{ activeTimer, startTimer, stopTimer }}>
            {children}
            {activeTimer && (
                <TimerDisplay
                    duration={activeTimer.duration}
                    remaining={activeTimer.remaining}
                    label={activeTimer.label}
                    onStop={stopTimer}
                />
            )}
        </TimerContext.Provider>
    );
}

export const useTimer = () => {
    const context = useContext(TimerContext);
    if (!context) throw new Error('useTimer must be used within a TimerProvider');
    return context;
};
