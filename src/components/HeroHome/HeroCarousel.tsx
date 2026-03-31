'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { mockRecipes } from '@/data/mockData';
import styles from './HeroCarousel.module.css';

import { Recipe } from '@/types';

interface HeroCarouselProps {
    recipes?: Recipe[];
    badgeText?: string;
}

export default function HeroCarousel({ recipes, badgeText = "Dernière pépite ✨" }: HeroCarouselProps) {
    const carouselRecipes = (recipes && recipes.length > 0) ? recipes.slice(0, 5) : mockRecipes.slice(0, 5);
    const [currentIndex, setCurrentIndex] = useState(0);
    const recipesCount = carouselRecipes.length;

    const countries = ['france', 'italie', 'espagne', 'grece', 'liban', 'usa', 'mexique', 'orient', 'maroc', 'japon', 'asie'];
    const countryFlags: Record<string, string> = {
        france: '🇫🇷', italie: '🇮🇹', espagne: '🇪🇸', grece: '🇬🇷', 
        liban: '🇱🇧', usa: '🇺🇸', mexique: '🇲🇽', orient: '🕌',
        maroc: '🇲🇦', japon: '🇯🇵', asie: '🥢'
    };

    const nextSlide = useCallback(() => {
        if (recipesCount === 0) return;
        setCurrentIndex((prev) => (prev + 1) % recipesCount);
    }, [recipesCount]);

    const prevSlide = useCallback(() => {
        if (recipesCount === 0) return;
        setCurrentIndex((prev) => (prev - 1 + recipesCount) % recipesCount);
    }, [recipesCount]);

    useEffect(() => {
        if (recipesCount === 0) return;
        const timer = setInterval(nextSlide, 5000);
        return () => clearInterval(timer);
    }, [nextSlide, recipesCount]);

    if (recipesCount === 0) return null;

    const handleDragEnd = (_event: any, info: PanInfo) => {
        if (info.offset.x < -50) {
            nextSlide();
        } else if (info.offset.x > 50) {
            prevSlide();
        }
    };

    return (
        <div className={styles.carouselContainer}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={carouselRecipes[currentIndex].id}
                    className={styles.slide}
                    initial={{ opacity: 0, scale: 0.9, x: 50 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 1.1, x: -50 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={handleDragEnd}
                    style={{ 
                        '--halo-color': (
                            carouselRecipes[currentIndex].category === 'aperitifs' ? 'rgba(16, 185, 129, 0.5)' :
                            carouselRecipes[currentIndex].category === 'entrees' ? 'rgba(16, 185, 129, 0.5)' :
                            carouselRecipes[currentIndex].category === 'plats' ? 'rgba(245, 158, 11, 0.5)' :
                            carouselRecipes[currentIndex].category === 'desserts' ? 'rgba(239, 68, 68, 0.5)' :
                            carouselRecipes[currentIndex].category === 'patisserie' ? 'rgba(245, 158, 11, 0.5)' :
                            carouselRecipes[currentIndex].category === 'restaurant' ? 'rgba(59, 130, 246, 0.5)' :
                            'rgba(127, 13, 242, 0.5)'
                        )
                    } as React.CSSProperties}
                >
                    <Link href={`/recipe/${carouselRecipes[currentIndex].id}`} className={styles.linkWrapper}>
                        <div className={styles.imageWrapper}>
                            {/* AJOUT DU PAYS EN HAUT À GAUCHE */}
                            {carouselRecipes[currentIndex].tags?.some(t => countries.includes(t.toLowerCase())) && (
                                <div className={styles.countryBadge}>
                                    {carouselRecipes[currentIndex].tags?.find(t => countries.includes(t.toLowerCase()))?.toUpperCase()}
                                    {' '}
                                    {countryFlags[carouselRecipes[currentIndex].tags?.find(t => countries.includes(t.toLowerCase()))?.toLowerCase() || '']}
                                </div>
                            )}

                            <Image 
                                src={carouselRecipes[currentIndex].image} 
                                alt={carouselRecipes[currentIndex].title}
                                fill
                                sizes="(max-width: 768px) 100vw, 800px"
                                className={styles.image}
                                style={{ objectFit: 'cover' }}
                                draggable="false"
                                priority={currentIndex === 0}
                            />
                            <div className={styles.overlay} />
                            <div className={styles.recipeInfo}>
                                <span className={styles.tag}>{badgeText}</span>
                                <h3 className={styles.recipeTitle}>{carouselRecipes[currentIndex].title}</h3>
                                <div className={styles.recipeMeta}>
                                    <span>⏱️ {(carouselRecipes[currentIndex].prepTime || 0) + (carouselRecipes[currentIndex].cookTime || 0)} min</span>
                                    <span>•</span>
                                    <span className={styles.difficulty}>{carouselRecipes[currentIndex].difficulty}</span>
                                </div>
                            </div>
                        </div>
                    </Link>
                </motion.div>
            </AnimatePresence>

            <div className={styles.indicators}>
                {carouselRecipes.map((_, index) => (
                    <button
                        key={index}
                        className={`${styles.indicator} ${index === currentIndex ? styles.active : ''}`}
                        onClick={() => setCurrentIndex(index)}
                        aria-label={`Aller à la slide ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}
