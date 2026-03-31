import React from 'react';
import styles from './SplitTitle.module.css';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

interface SplitTitleProps {
    text: string;
    className?: string;
    large?: boolean;
    delay?: number;
    noAnimation?: boolean;
    showThemeToggle?: boolean;
}

export default function SplitTitle({
    text,
    className = '',
    large = false,
    delay = 0,
    noAnimation = false,
    showThemeToggle = false
}: SplitTitleProps) {
    // Split logic for 2nd line positioning
    const words = text.split(' ');
    // On veut scinder à peu près au milieu, ou forcer une 2ème ligne si plus de 3 mots
    const half = Math.ceil(words.length / 2);
    const line1 = words.slice(0, half).join(' ');
    const line2 = words.slice(half).join(' ');

    return (
        <div className={`${styles.titleContainer} ${large ? styles.large : ''} ${className}`}>
            <span className={styles.gradient} style={{ animation: noAnimation ? 'none' : undefined, animationDelay: `${delay}s` }}>
                {showThemeToggle && (
                    <ThemeToggle className={styles.inTitleToggle} />
                )}
                {/* Si c'est large, on force une seule ligne (pas de split) */}
                {large ? text : (
                    <>
                        {line1}
                        {line2 && (
                            <>
                                <br className={styles.mobileOnlyBr} />
                                {" "}{line2}
                            </>
                        )}
                    </>
                )}
            </span>
        </div>
    );
}
