'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import HeroCarousel from './HeroCarousel';
import { mockRecipes } from '@/data/mockData';
import styles from './HeroHome.module.css';

interface HeroHomeProps {
    onSelect?: (tag: string) => void;
}

export default function HeroHome({ onSelect }: HeroHomeProps) {
    const totalRecipes = mockRecipes.length;
    
    const featuredRecipes = useMemo(() => {
        const featured = mockRecipes.filter(r => r.isFeatured);
        // S'il n'y a pas assez de recettes "À la une", on prend les 5 dernières
        return featured.length >= 3 ? featured.slice(0, 5) : mockRecipes.slice(0, 5);
    }, []);
    
    return (
        <section className={styles.heroWrapper}>
            <div className={styles.heroContent}>
                {/* Colonne de GAUCHE : Stats */}
                <motion.div
                    className={styles.textContent}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div className={styles.statsGroup}>
                        <div className={styles.statPill}>
                            <span className={styles.statBigValue}>{totalRecipes}</span>
                            <span className={styles.statMinLabel}>RECETTES <br/>MAGIQUES</span>
                        </div>
                    </div>

                    <div className={styles.actionGroup}>
                        <a href="#categories" className={styles.ctaButton}>
                            <span>Explorer</span>
                        </a>
                    </div>
                </motion.div>

                {/* Colonne de DROITE : Carrousel dynamique */}
                <motion.div
                    className={styles.carouselArea}
                    initial={{ opacity: 0, scale: 0.9, x: 50 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                >
                    <HeroCarousel 
                            recipes={featuredRecipes} 
                            badgeText="À LA UNE ✨"
                        />
                </motion.div>
            </div>
        </section>
    );
}
