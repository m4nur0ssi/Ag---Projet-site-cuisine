'use client';
import { useState, useEffect } from 'react';
import styles from './ThemeToggle.module.css';

interface ThemeToggleProps {
    className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
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
            <div className={`${styles.iconContainer} ${theme === 'light' ? styles.isLight : ''}`}>
                <span className={styles.icon}>
                    {theme === 'light' ? '☀️' : '🌙'}
                </span>
            </div>
        </button>
    );
}
