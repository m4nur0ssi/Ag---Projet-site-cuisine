'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Recipe } from '@/mobile/types';
import RecipeDetail from '@/mobile/components/RecipeDetail/RecipeDetail';
import styles from './HeroCarousel.module.css';

interface HeroCarouselProps {
    recipes: Recipe[];
}

export default function HeroCarousel({ recipes }: HeroCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

    const handleNext = () => setCurrentIndex((prev) => (prev + 1) % recipes.length);
    const handlePrev = () => setCurrentIndex((prev) => (prev - 1 + recipes.length) % recipes.length);

    if (!recipes || recipes.length === 0) return null;

    return (
        <section className={styles.heroContainer}>
            <div className={styles.header}>
                <h2 className={styles.heroTitle}>À LA UNE</h2>
                <div className={styles.pagination}>
                    {recipes.map((_, i) => (
                        <div 
                            key={i} 
                            className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''}`} 
                        />
                    ))}
                </div>
            </div>

            <div className={styles.carouselWrapper}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        className={styles.slide}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => setSelectedRecipe(recipes[currentIndex])}
                    >
                        <div className={styles.imageContainer}>
                            <Image
                                src={recipes[currentIndex].image || "/placeholder-recipe.jpg"}
                                alt={recipes[currentIndex].title}
                                fill
                                priority={true}
                                className={styles.slideImage}
                                style={{ objectFit: 'cover' }}
                            />
                            <div className={styles.overlay} />
                            
                            {/* PLAY BUTTON ICON */}
                            <motion.div 
                                className={styles.playButton}
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <div className={styles.playIcon}>▶</div>
                            </motion.div>

                            <div className={styles.slideContent}>
                                <span className={styles.category}>{recipes[currentIndex].category}</span>
                                <h3 className={styles.title}>{recipes[currentIndex].title}</h3>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>

                <button className={`${styles.navBtn} ${styles.prevBtn}`} onClick={handlePrev}>‹</button>
                <button className={`${styles.navBtn} ${styles.nextBtn}`} onClick={handleNext}>›</button>
            </div>

            <AnimatePresence>
                {selectedRecipe && (
                    <RecipeDetail 
                        recipe={selectedRecipe} 
                        onClose={() => setSelectedRecipe(null)} 
                    />
                )}
            </AnimatePresence>
        </section>
    );
}
