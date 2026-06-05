'use client';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { Recipe } from '@/mobile/types';
import Portal from '@/mobile/components/Portal';
import styles from './RecipeSheet.module.css';
import RecipeDetails from '@/mobile/components/RecipeDetails/RecipeDetails';

interface RecipeSheetProps {
    recipe: Recipe;
    isOpen: boolean;
    onClose: () => void;
    allRecipes?: Recipe[];
    recipeIndex?: number;
}

const DISMISS_Y = 160;
const DISMISS_V = 600;
const SWIPE_THRESHOLD = 0.25; 
const SWIPE_VELOCITY = 400;

export default function RecipeSheet({ recipe, isOpen, onClose, allRecipes, recipeIndex = 0 }: RecipeSheetProps) {
    const recipes = useMemo(() => allRecipes && allRecipes.length > 0 ? allRecipes : [recipe], [allRecipes, recipe]);
    const [currentIdx, setCurrentIdx] = useState(recipeIndex);
    const [shouldRender, setShouldRender] = useState(isOpen);

    const scrollYRef = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRefs = useRef<Record<number, HTMLDivElement | null>>({});

    // MotionValues
    const y = useMotionValue(0);
    const x = useMotionValue(0); // Offset relatif au centre (0 = centré sur currentIdx)
    const backdropOpacity = useTransform(y, [0, 350], [1, 0]);

    // Gesture tracking
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const touchLastX = useRef(0);
    const gestureType = useRef<'none' | 'horizontal' | 'vertical'>('none');
    const isDraggingY = useRef(false);
    const isDraggingX = useRef(false);

    useEffect(() => {
        setCurrentIdx(recipeIndex);
    }, [recipeIndex, recipe]);

    // Safety cleanup on unmount — ensures body is never left locked
    useEffect(() => {
        return () => {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflow = '';
        };
    }, []);

    // Scroll lock and History State — only depends on isOpen
    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            y.set(0);
            x.set(0);
            scrollYRef.current = window.scrollY;
            document.body.style.top = `-${scrollYRef.current}px`;
            document.body.style.position = 'fixed';
            document.body.style.width = '100vw';
            document.body.style.overflow = 'hidden';

            // Push a temporary state to handle "Back" button/swipe
            window.history.pushState({ modal: 'recipe' }, '');

            const handlePopState = () => {
                onClose();
            };

            window.addEventListener('popstate', handlePopState);
            return () => {
                window.removeEventListener('popstate', handlePopState);
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.overflow = '';
                window.scrollTo(0, scrollYRef.current);
            };
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleAnimationComplete = () => { if (!isOpen) setShouldRender(false); };

    const dismiss = useCallback(() => {
        if (navigator.vibrate) navigator.vibrate(30);
        animate(y, window.innerHeight + 100, { type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.4, onComplete: onClose });
    }, [y, onClose]);

    const snapBack = useCallback(() => {
        animate(y, 0, { type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.3 });
        animate(x, 0, { type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.3 });
    }, [x, y]);

    const goToIndex = useCallback((newIdx: number) => {
        if (newIdx === currentIdx) {
            snapBack();
            return;
        }
        
        const direction = newIdx > currentIdx ? 1 : -1;
        const width = containerRef.current?.offsetWidth || window.innerWidth;
        
        if (navigator.vibrate) navigator.vibrate(10);

        // Animation de transition ultra-fluide
        animate(x, -direction * width, { 
            type: 'tween',
            ease: [0.25, 0.1, 0.25, 1], // Ease standard plus stable
            duration: 0.3,
            onComplete: () => {
                // Atomique : flushSync force le re-render de la nouvelle carte AVANT le reset
                // de x. Sinon React batche setCurrentIdx → 1 frame avec l'ancienne carte
                // recentrée (x déjà à 0) = le rebond/flash en changeant de recette.
                flushSync(() => setCurrentIdx(newIdx));
                x.jump(0);
            }
        });
    }, [currentIdx, x, snapBack]);

    // ─── Touch Handlers ──────────────────────────────────────────────────
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchLastX.current = e.touches[0].clientX;
        gestureType.current = 'none';
        isDraggingY.current = false;
        isDraggingX.current = false;
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const cx = e.touches[0].clientX;
        const cy = e.touches[0].clientY;
        const dx = cx - touchStartX.current;
        const dy = cy - touchStartY.current;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        touchLastX.current = cx;

        const currentScrollEl = scrollRefs.current[currentIdx];
        const atTop = currentScrollEl ? currentScrollEl.scrollTop <= 0 : true;

        if (gestureType.current === 'none') {
            if (absDx > absDy && absDx > 7) gestureType.current = 'horizontal';
            else if (absDy > absDx && absDy > 7) gestureType.current = 'vertical';
        }

        if (gestureType.current === 'vertical') {
            if (atTop && dy > 0) {
                isDraggingY.current = true;
                e.preventDefault();
                y.set(dy * 0.5); // Plus de résistance pour un feeling pro
            }
        }

        if (gestureType.current === 'horizontal') {
            e.preventDefault();
            isDraggingX.current = true;
            
            // Résistance aux bords (plus faible à gauche pour le geste de retour)
            let dragX = dx;
            if (currentIdx === recipes.length - 1 && dx < 0) {
                dragX = dx * 0.2;
            } else if (currentIdx === 0 && dx > 0) {
                // On laisse plus de liberté au début pour le swipe de retour
                dragX = dx * 0.8; 
            }
            x.set(dragX);
        }
    }, [currentIdx, recipes.length, x, y]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const dx = x.get();
        const dy = y.get();
        const width = containerRef.current?.offsetWidth || window.innerWidth;
        const vx = (touchLastX.current - touchStartX.current) / 100; // Estimation simple

        if (gestureType.current === 'vertical' && isDraggingY.current) {
            if (dy > DISMISS_Y) dismiss();
            else snapBack();
        }

        if (gestureType.current === 'horizontal' && isDraggingX.current) {
            if (dx < -width * SWIPE_THRESHOLD || vx < -2) {
                if (currentIdx < recipes.length - 1) goToIndex(currentIdx + 1);
                else snapBack();
            } else if (dx > width * SWIPE_THRESHOLD || vx > 2) {
                if (currentIdx > 0) {
                    goToIndex(currentIdx - 1);
                } else {
                    // Geste de retour : on ferme la fiche
                    dismiss();
                }
            } else {
                snapBack();
            }
        }

        gestureType.current = 'none';
        isDraggingY.current = false;
        isDraggingX.current = false;
    }, [currentIdx, dismiss, recipes.length, snapBack, goToIndex, x, y]);

    if (!shouldRender) return null;

    const currentRecipe = recipes[currentIdx];
    // On ne rend QUE 3 slots pour la performance, mais on les positionne de façon relative
    const prevRecipe = currentIdx > 0 ? recipes[currentIdx - 1] : null;
    const nextRecipe = currentIdx < recipes.length - 1 ? recipes[currentIdx + 1] : null;

    return (
        <Portal>
            <AnimatePresence onExitComplete={handleAnimationComplete}>
                {isOpen && (
                    <div className={styles.container} ref={containerRef}>
                        <motion.div
                            className={styles.backdrop}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{ opacity: backdropOpacity }}
                            onClick={onClose}
                        />

                        <motion.div
                            className={styles.sheet}
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '105%' }}
                            style={{ y }}
                            transition={{ type: 'spring', damping: 35, stiffness: 400, mass: 0.6 }}
                        >
                            <div className={styles.dragHandleContainer}>
                                <div className={styles.dragHandle} />
                            </div>

                            {recipes.length > 1 && (
                                <div className={styles.pagination}>
                                    {recipes.map((_, i) => (
                                        <div key={i} className={`${styles.dot} ${i === currentIdx ? styles.dotActive : ''}`} />
                                    ))}
                                </div>
                            )}

                            {/* TRACK PRINCIPAL */}
                            <motion.div 
                                className={styles.swipeTrack}
                                style={{ x, display: 'flex', width: '100%', height: '100%', position: 'relative' }}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                            >
                                {/* Slot Précédent */}
                                {prevRecipe && (
                                    <div key={`prev-${prevRecipe.id}`} style={{ position: 'absolute', left: '-100%', width: '100%', height: '100%', overflow: 'hidden' }}>
                                        <div className={styles.scrollArea}>
                                            <RecipeDetails recipe={prevRecipe} isModal={true} />
                                        </div>
                                    </div>
                                )}

                                {/* Slot Central */}
                                <div 
                                    key={`curr-${currentRecipe.id}`}
                                    className={styles.scrollArea} 
                                    ref={el => { scrollRefs.current[currentIdx] = el; }}
                                    style={{ width: '100%', height: '100%', overflowY: 'auto' }}
                                >
                                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                                    <RecipeDetails recipe={currentRecipe} isModal={true} />
                                </div>

                                {/* Slot Suivant */}
                                {nextRecipe && (
                                    <div key={`next-${nextRecipe.id}`} style={{ position: 'absolute', left: '100%', width: '100%', height: '100%', overflow: 'hidden' }}>
                                        <div className={styles.scrollArea}>
                                            <RecipeDetails recipe={nextRecipe} isModal={true} />
                                        </div>
                                    </div>
                                )}
                            </motion.div>

                            {/* Nav Arrows */}
                            {recipes.length > 1 && (
                                <>
                                    {currentIdx > 0 && <button className={`${styles.navArrow} ${styles.navLeft}`} onClick={() => goToIndex(currentIdx - 1)}>‹</button>}
                                    {currentIdx < recipes.length - 1 && <button className={`${styles.navArrow} ${styles.navRight}`} onClick={() => goToIndex(currentIdx + 1)}>›</button>}
                                </>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </Portal>
    );
}
