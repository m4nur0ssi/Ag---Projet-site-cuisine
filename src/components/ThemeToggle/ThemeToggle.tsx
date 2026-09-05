'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ThemeToggle.module.css';
import { ecrireStock } from '@/lib/stockage';

interface ThemeToggleProps {
    className?: string;
    children?: React.ReactNode;
}

export default function ThemeToggle({ className, children }: ThemeToggleProps) {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    /* Le thème est déjà résolu et posé sur <html> par le script d'amorçage du
       layout (choix enregistré, sinon réglage du système) : le bouton lit ce
       qui est réellement affiché plutôt que de refaire ce calcul. */
    useEffect(() => {
        const actuel = document.documentElement.getAttribute('data-theme');
        setTheme(actuel === 'light' ? 'light' : 'dark');
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        ecrireStock('theme', newTheme);
        
        // Vibration haptique iOS
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(10);
        }
    };

    return (
        <button 
            className={`${styles.toggle} ${className || ''}`} 
            onClick={toggleTheme}
            aria-label="Changer de thème"
            title={theme === 'light' ? 'Mode Sombre' : 'Mode Clair'}
        >
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                    key={theme}
                    className={styles.iconContainer}
                    initial={{ rotate: -180, scale: 0, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    exit={{ rotate: 180, scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                    <span className={styles.icon}>
                        {theme === 'light' ? '☀️' : '🌙'}
                    </span>
                </motion.div>
            </AnimatePresence>
            {children}
        </button>
    );
}
