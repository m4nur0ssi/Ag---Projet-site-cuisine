'use client';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Recipe } from '@/types';
import Portal from '@/components/Portal';
import styles from './RecipeSheet.module.css';
import RecipeDetails from '@/components/RecipeDetails/RecipeDetails';

interface RecipeSheetProps {
    recipe: Recipe;
    isOpen: boolean;
    onClose: () => void;
}

export default function RecipeSheet({ recipe: initialRecipe, isOpen, onClose }: RecipeSheetProps) {
    const [currentRecipe, setCurrentRecipe] = useState(initialRecipe);
    const [shouldRender, setShouldRender] = useState(isOpen);
    const scrollYRef = useRef(0);
    const controls = useDragControls();

    // Sync when parent changes recipe
    useEffect(() => { setCurrentRecipe(initialRecipe); }, [initialRecipe]);

    // Listen for openRecipe event from similar recipes
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: Event) => {
            const r = (e as CustomEvent).detail;
            if (r) {
                setCurrentRecipe(r);
                setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
            }
        };
        window.addEventListener('openRecipe', handler);
        return () => window.removeEventListener('openRecipe', handler);
    }, [isOpen]);
    
    // Variables for manual swipe detection on scroll area
    const touchStartY = useRef(0);
    const touchStartTime = useRef(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && currentRecipe) {
            localStorage.setItem('magic-last-viewed', JSON.stringify({
                id: currentRecipe.id,
                title: currentRecipe.title,
                image: currentRecipe.image
            }));
            window.dispatchEvent(new Event('recipeViewed'));
        }
    }, [isOpen, currentRecipe]);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            scrollYRef.current = window.scrollY;
            document.body.style.top = `-${scrollYRef.current}px`;
            document.body.style.position = 'fixed';
            document.body.style.width = '100vw'; 
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflow = '';
            
            if (isOpen) {
                window.scrollTo(0, scrollYRef.current);
            }
        };
    }, [isOpen]);

    const handleAnimationComplete = () => {
        if (!isOpen) {
            setShouldRender(false);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
        touchStartTime.current = Date.now();
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const touchEndY = e.changedTouches[0].clientY;
        const timeDiff = Date.now() - touchStartTime.current;
        const distanceY = touchEndY - touchStartY.current;
        const velocity = distanceY / timeDiff;

        // Si le geste est rapide vers le bas (swipe fort)
        // ou si on tire fortement vers le bas alors qu'on est déjà en haut
        const isStrongSwipeDown = velocity > 1.2 && distanceY > 50;
        const isPullingDownAtTop = (scrollRef.current?.scrollTop === 0) && distanceY > 80 && velocity > 0.5;

        if (isStrongSwipeDown || isPullingDownAtTop) {
            onClose();
        }
    };

    if (!currentRecipe || !shouldRender) return null;

    return (
        <Portal>
            <AnimatePresence onExitComplete={handleAnimationComplete}>
                {isOpen && (
                    <div className={styles.container}>
                        {/* Backdrop sombre interactif */}
                        <motion.div 
                            className={styles.backdrop}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                        />

                        {/* La "Feuille" (Sheet) iOS 26 */}
                        <motion.div
                            className={styles.sheet}
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '105%' }}
                            drag="y"
                            dragControls={controls}
                            dragListener={false} // Désactive le drag global pour laisser le scroll natif fonctionner parfaitement
                            dragConstraints={{ top: 0, bottom: 0 }} // Empêche le drag de dépasser vers le haut
                            dragElastic={0.1}
                            onDragEnd={(_, info) => {
                                if (info.offset.y > 50 || info.velocity.y > 200) {
                                    onClose();
                                }
                            }}
                            transition={{ 
                                type: 'spring', 
                                damping: 35, 
                                stiffness: 400,
                                mass: 0.6
                            }}
                        >
                            {/* Zone de drag (invisible) — permet de glisser la feuille, sans trait visible */}
                            <div
                                className={styles.dragHandleContainer}
                                onPointerDown={(e) => controls.start(e)}
                                style={{ width: '100%', height: '40px', position: 'absolute', top: 0, zIndex: 100 }}
                            />

                            {/* Croix fixe — hors du scrollArea pour rester cliquable */}
                            <button className={styles.closeBtn} onClick={onClose}>✕</button>

                            <div
                                className={styles.scrollArea}
                                ref={scrollRef}
                                onTouchStart={handleTouchStart}
                                onTouchEnd={handleTouchEnd}
                                style={{ paddingTop: '30px' }}
                            >
                                <RecipeDetails key={String(currentRecipe.id)} recipe={currentRecipe} isModal={true} />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </Portal>
    );
}
