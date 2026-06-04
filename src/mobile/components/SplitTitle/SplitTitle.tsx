import React from 'react';
import styles from './SplitTitle.module.css';

interface SplitTitleProps {
    text: string;
    className?: string;
    large?: boolean;
    delay?: number;
    noAnimation?: boolean;
}

export default function SplitTitle({ 
    text, 
    className = '', 
    large = false, 
    delay = 0,
    noAnimation = false 
}: SplitTitleProps) {
    return (
        <div className={`${styles.titleContainer} ${large ? styles.large : ''} ${className}`}>
            <span className={styles.gradient} style={{ animation: noAnimation ? 'none' : undefined, animationDelay: `${delay}s` }}>
                {text}
            </span>
        </div>
    );
}
