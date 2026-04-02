'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ThemeToggle.module.css';

interface ThemeToggleProps {
    className?: string;
    children?: React.ReactNode;
}

export default function ThemeToggle({ className, children }: ThemeToggleProps) {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    useEffect(() => {
        // Init theme from localStorage or system preference
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            setTheme('light');
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
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
