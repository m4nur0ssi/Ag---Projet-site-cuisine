'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './SplashScreen.module.css';
import { mockRecipes } from '@/mobile/data/mockData';
import RecipeCardiOS26 from '@/mobile/components/RecipeCard/RecipeCardiOS26';
import { useAuth } from '@/mobile/hooks/useAuth';

export default function SplashScreen() {
    const { user, signInWithGoogle } = useAuth();
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    
    // Pour ne pas re-afficher le splash pendant la session (bump la version pour forcer sa réapparition)
    const SESSION_KEY = 'hasSeenMagicSplash-v8';

    useEffect(() => {
        const hasSeenSplash = sessionStorage.getItem(SESSION_KEY);
        
        if (!hasSeenSplash) {
            setShouldRender(true);
            setIsVisible(true);
            document.documentElement.classList.add('is-splashing');
        } else {
            // Safety: if the class is somehow there, remove it
            document.documentElement.classList.remove('is-splashing');
        }

        // Cleanup on unmount just in case
        return () => {
             document.documentElement.classList.remove('is-splashing');
        };
    }, []);

    const closeSplash = () => {
        setIsVisible(false);
        sessionStorage.setItem(SESSION_KEY, 'true');
        document.documentElement.classList.remove('is-splashing');
        // On attend la fin de l'animation pour arrêter de render
        setTimeout(() => setShouldRender(false), 800);
    };

    const latestRecipes = useMemo(() => {
        // On prend les 6 dernières recettes triées par ID décroissant
        return [...mockRecipes]
            .sort((a, b) => parseInt(b.id) - parseInt(a.id))
            .slice(0, 6);
    }, []);

    const recipeCountText = useMemo(() => {
        return `${mockRecipes.length} recettes`;
    }, []);

    if (!shouldRender) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div 
                    className={styles.splashContainer}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ 
                        opacity: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0)',
                        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
                    }}
                >
                    <motion.div 
                        className={styles.iosFrame}
                        initial={{ scale: 1.1, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: -40, transition: { duration: 0.5 } }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {/* HEADER: TITLES + STATS */}
                        <motion.div 
                            className={styles.header}
                            animate={{ 
                                opacity: isSheetOpen ? 0 : 1,
                                y: isSheetOpen ? -20 : 0
                            }}
                            transition={{ duration: 0.4 }}
                        >
                            <motion.h1 
                                className={styles.titleMain}
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.8 }}
                            >
                                Les Recettes
                            </motion.h1>
                            <motion.span 
                                className={styles.titleMagiques}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2, duration: 1, type: 'spring' }}
                            >
                                Magiques
                            </motion.span>
                            
                            <motion.div 
                                className={styles.recipeCount}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4, duration: 0.8 }}
                                style={{ color: '#FFFFFF' }} 
                            >
                                {recipeCountText}
                            </motion.div>
                        </motion.div>

                        {/* AUTO-CYCLING SINGLE CARD CAROUSEL (Main entrance focus) */}
                        <div className={styles.singleCarouselContainer}>
                            <AutoCyclingCard 
                                recipes={latestRecipes} 
                                onCloseSplash={closeSplash} 
                                isSheetOpen={isSheetOpen}
                                onSheetOpen={() => setIsSheetOpen(true)}
                                onSheetClose={() => {
                                    setIsSheetOpen(false);
                                    closeSplash();
                                }}
                            />
                        </div>

                        {/* EXPLORER BUTTON */}
                        <motion.div 
                            className={styles.footer}
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ 
                                opacity: isSheetOpen ? 0 : 1,
                                y: isSheetOpen ? 20 : 0
                            }}
                            transition={{ delay: isSheetOpen ? 0 : 1.2, duration: 0.4 }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                <button
                                    className={styles.explorerBtn}
                                    onClick={closeSplash}
                                    aria-label="Explorer les recettes"
                                >
                                    Explorer
                                </button>
                                {!user && (
                                    <button
                                        className={styles.explorerBtn}
                                        onClick={(e) => { e.stopPropagation(); signInWithGoogle(); }}
                                        aria-label="Se connecter avec Google"
                                    >
                                        Se connecter
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function AutoCyclingCard({ 
    recipes, 
    onCloseSplash,
    isSheetOpen,
    onSheetOpen,
    onSheetClose
}: { 
    recipes: any[], 
    onCloseSplash: () => void,
    isSheetOpen: boolean,
    onSheetOpen: () => void,
    onSheetClose: () => void 
}) {
    const [index, setIndex] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setIndex(prev => (prev + 1) % recipes.length);
        }, 5000);
    };

    useEffect(() => {
        if (isSheetOpen) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }
        startTimer();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [recipes.length, isSheetOpen]);

    const handleNext = () => {
        setIndex(prev => (prev + 1) % recipes.length);
        startTimer();
    };

    const handlePrev = () => {
        setIndex(prev => (prev - 1 + recipes.length) % recipes.length);
        startTimer();
    };

    const activeRecipe = recipes[index];

    return (
        <div className={styles.cyclingWrapper}>
            <AnimatePresence mode="wait">
                <motion.div 
                    key={activeRecipe.id}
                    className={styles.activeCardStage}
                    initial={{ opacity: 0, x: 50, scale: 0.9, rotateY: 20 }}
                    animate={{ 
                        opacity: 1, 
                        x: 0, 
                        scale: 1,
                        rotateY: 0
                    }}
                    exit={{ 
                        opacity: 0, 
                        x: -50, 
                        scale: 0.9,
                        rotateY: -20
                    }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(_, info) => {
                        const threshold = 100;
                        if (info.offset.x < -threshold) {
                            handleNext();
                        } else if (info.offset.x > threshold) {
                            handlePrev();
                        }
                    }}
                    transition={{ 
                        duration: 0.5, 
                        ease: [0.16, 1, 0.3, 1] 
                    }}
                >
                    <motion.h2 
                        className={styles.activeTitle}
                        animate={{ opacity: isSheetOpen ? 0 : 1 }}
                    >
                        {activeRecipe.title}
                    </motion.h2>
                    <RecipeCardiOS26 
                        recipe={activeRecipe} 
                        size="small" 
                        hideTitle 
                        hideVideo 
                        isIntroMode={true}
                        onSheetOpen={onSheetOpen}
                        onSheetClose={onSheetClose}
                    />
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
