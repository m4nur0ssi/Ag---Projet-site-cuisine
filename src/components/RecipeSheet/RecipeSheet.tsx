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

export default function RecipeSheet({ recipe, isOpen, onClose }: RecipeSheetProps) {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const scrollYRef = useRef(0);
    const controls = useDragControls();
    
    // Variables for manual swipe detection on scroll area
    const touchStartY = useRef(0);
    const touchStartTime = useRef(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && recipe) {
            localStorage.setItem('magic-last-viewed', JSON.stringify({
                id: recipe.id,
                title: recipe.title,
                image: recipe.image
            }));
            window.dispatchEvent(new Event('recipeViewed'));
        }
    }, [isOpen, recipe]);

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

    if (!recipe || !shouldRender) return null;

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
                            {/* Handle visuel de swipe - Uniquement ça permet de dragger physiquement la feuille */}
                            <div 
                                className={styles.dragHandleContainer}
                                onPointerDown={(e) => controls.start(e)}
                                style={{ width: '100%', height: '40px', position: 'absolute', top: 0, zIndex: 100, display: 'flex', justifyContent: 'center', paddingTop: '12px' }}
                            >
                                <div className={styles.dragHandle} style={{ position: 'relative', top: 0 }} />
                            </div>

                            <div 
                                className={styles.scrollArea}
                                ref={scrollRef}
                                onTouchStart={handleTouchStart}
                                onTouchEnd={handleTouchEnd}
                                style={{ paddingTop: '30px' }} // Laisse la place pour le drag handle
                            >
                                <button className={styles.closeBtn} onClick={onClose} style={{ top: '10px' }}>✕</button>
                                <RecipeDetails recipe={recipe} isModal={true} />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </Portal>
    );
}
