'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './BackToTop.module.css';

export default function BackToTop() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const toggleVisibility = () => {
            if (window.pageYOffset > 500) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener('scroll', toggleVisibility);
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.button
                    className={styles.backToTop}
                    onClick={scrollToTop}
                    initial={{ opacity: 0, scale: 0.7, y: 30, x: '-50%' }}
                    animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
                    exit={{ opacity: 0, scale: 0.7, y: 30, x: '-50%' }}
                    whileHover={{ 
                        scale: 1.05,
                        backgroundColor: 'rgba(255, 255, 255, 0.12)',
                        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4), 0 0 20px rgba(127, 13, 242, 0.4)'
                    }}
                    whileTap={{ scale: 0.95 }}
                >
                    <div className={styles.content}>
                        <svg className={styles.arrowIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 19V5M5 12l7-7 7 7" />
                        </svg>
                        <span className={styles.text}>MAGIE</span>
                    </div>
                </motion.button>
            )}
        </AnimatePresence>
    );
}
