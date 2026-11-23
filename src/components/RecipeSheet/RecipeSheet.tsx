'use client';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Recipe } from '@/types';
import Portal from '@/components/Portal';
import styles from './RecipeSheet.module.css';
import RecipeDetails from '@/components/RecipeDetails/RecipeDetails';
import { ecrireStock } from '@/lib/stockage';

const Chevron = ({ gauche }: { gauche?: boolean }) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={gauche ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5'} />
    </svg>
);

interface RecipeSheetProps {
    recipe: Recipe;
    isOpen: boolean;
    onClose: () => void;
    /** Parcours d'une sélection (recherche) : flèches ‹ ›, clavier ← →, « 3 / 42 ». */
    navigation?: { position: number; total: number; precedent?: () => void; suivant?: () => void };
}

export default function RecipeSheet({ recipe: initialRecipe, isOpen, onClose, navigation }: RecipeSheetProps) {
    const [currentRecipe, setCurrentRecipe] = useState(initialRecipe);
    const [shouldRender, setShouldRender] = useState(isOpen);
    const scrollYRef = useRef(0);
    const controls = useDragControls();
    const sheetRef = useRef<HTMLDivElement>(null);

    /*
     * Flèches ‹ › posées DANS la photo : souris seulement (survol + pointeur
     * précis). Sur iPad et tout écran tactile, on balaye.
     */
    const [sourisFine, setSourisFine] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
        const maj = () => setSourisFine(mq.matches);
        maj();
        mq.addEventListener?.('change', maj);
        return () => mq.removeEventListener?.('change', maj);
    }, []);
    const [cadrePhoto, setCadrePhoto] = useState<HTMLElement | null>(null);

    // Sync when parent changes recipe
    useEffect(() => { setCurrentRecipe(initialRecipe); }, [initialRecipe]);

    // Clavier ← → : recette précédente / suivante de la sélection.
    useEffect(() => {
        if (!isOpen || !navigation) return;
        const onKey = (e: KeyboardEvent) => {
            const cible = e.target as HTMLElement | null;
            if (cible && /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName)) return;
            if (e.key === 'ArrowRight') navigation.suivant?.();
            else if (e.key === 'ArrowLeft') navigation.precedent?.();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, navigation]);

    // Nouvelle recette de la sélection : on repart du haut de la fiche.
    useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [initialRecipe]);

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
    // La photo se monte après la fiche (et change à chaque recette) : on la retrouve.
    const aDesFleches = !!navigation && sourisFine;
    useEffect(() => {
        if (!isOpen || !aDesFleches) { setCadrePhoto(null); return; }
        let essais = 0;
        const t = setInterval(() => {
            const el = scrollRef.current?.querySelector('[class*="imageCardContainer"]') as HTMLElement | null;
            if (el || ++essais > 40) {
                clearInterval(t);
                setCadrePhoto((p) => (p === el ? p : el));
            }
        }, 50);
        return () => clearInterval(t);
    }, [isOpen, aDesFleches, currentRecipe]);

    /*
     * La fiche s'arrête PILE sous la première rangée de pilules (préparation,
     * cuisson, difficulté, note, calories). À hauteur fixe, elle coupait la
     * rangée en deux sur certaines recettes et laissait du vide sur d'autres :
     * la mesure se fait donc sur le contenu réel, photo chargée comprise.
     */
    const [hauteur, setHauteur] = useState<number | null>(null);
    /*
     * Changement de recette dans la fiche ouverte (balayage, flèches) : la
     * nouvelle fiche se monte vide — photo et polices pas encore là — et sa
     * première mesure est trop courte. La fiche rétrécissait de ~50 px
     * (le bord haut descendait) puis regrandissait 140 ms plus tard : le
     * « sursaut » à chaque passage. On garde donc la hauteur précédente le
     * temps que la nouvelle se stabilise, puis on la rejoint en douceur.
     */
    const idMesure = useRef<string | null>(null);
    const [lisse, setLisse] = useState(false);
    // Parcours d'une sélection : hauteur constante, le haut de la fiche ne bouge plus.
    const parcours = !!navigation;
    useEffect(() => {
        if (!isOpen || parcours) { setHauteur(null); setLisse(false); idMesure.current = null; return; }
        const id = String(currentRecipe?.id ?? '');
        const changement = idMesure.current !== null && idMesure.current !== id;
        idMesure.current = id;
        const gel = changement ? performance.now() + 420 : 0;
        if (changement) setLisse(true);
        const mesurer = () => {
            if (performance.now() < gel) return;
            const zone = scrollRef.current;
            const rangee = zone?.querySelector('[class*="metaContent"]') as HTMLElement | null;
            if (!zone || !rangee) return;
            // + un souffle sous la rangée : coupée au pixel près, elle donnait
            // l'impression d'être tranchée plutôt que posée.
            const bas = rangee.getBoundingClientRect().bottom
                - zone.getBoundingClientRect().top + zone.scrollTop + 16;
            const plafond = window.innerHeight * 0.96;
            const cible = Math.round(Math.max(420, Math.min(plafond, bas)));
            setHauteur((v) => (v === cible ? v : cible));
        };
        /*
         * La photo du héros, les polices et la note arrivent après le premier
         * rendu, et chacune déplace la rangée. Un observateur seul ratait la
         * dernière secousse : on remesure quelques fois pendant deux secondes,
         * puis on s'arrête. L'écriture n'a lieu que si la valeur change.
         */
        mesurer();
        const apresGel = changement ? setTimeout(mesurer, 440) : undefined;
        const battement = setInterval(mesurer, 140);
        const fin = setTimeout(() => clearInterval(battement), 2200);
        const ro = new ResizeObserver(mesurer);
        const cible = scrollRef.current?.firstElementChild;
        if (cible) ro.observe(cible);
        window.addEventListener('resize', mesurer);
        return () => {
            clearInterval(battement);
            clearTimeout(fin);
            if (apresGel) clearTimeout(apresGel);
            ro.disconnect();
            window.removeEventListener('resize', mesurer);
        };
    }, [isOpen, currentRecipe, parcours]);

    useEffect(() => {
        if (isOpen && currentRecipe) {
            ecrireStock('magic-last-viewed', JSON.stringify({
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

    const touchStartX = useRef(0);
    // Un geste qui commence dans une zone qui défile en largeur (carrousel, tableau) lui appartient.
    const geste_horizontal_interdit = useRef(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
        touchStartX.current = e.touches[0].clientX;
        touchStartTime.current = Date.now();
        geste_horizontal_interdit.current = false;
        for (let el = e.target as HTMLElement | null; el && el !== scrollRef.current; el = el.parentElement) {
            const ox = getComputedStyle(el).overflowX;
            if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 4) { geste_horizontal_interdit.current = true; break; }
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const touchEndY = e.changedTouches[0].clientY;
        const timeDiff = Date.now() - touchStartTime.current;
        const distanceY = touchEndY - touchStartY.current;
        const velocity = distanceY / timeDiff;

        // Balayage horizontal : recette précédente / suivante de la sélection (comme ← → au
        // clavier). Sur iPad, ni clavier ni souris : sans ce geste on ne pouvait pas avancer.
        const distanceX = e.changedTouches[0].clientX - touchStartX.current;
        if (navigation && !geste_horizontal_interdit.current && timeDiff < 900
            && Math.abs(distanceX) > 60 && Math.abs(distanceX) > 1.8 * Math.abs(distanceY)) {
            if (distanceX < 0) navigation.suivant?.(); else navigation.precedent?.();
            return;
        }

        // Si le geste est rapide vers le bas (swipe fort)
        // ou si on tire fortement vers le bas alors qu'on est déjà en haut
        const isStrongSwipeDown = velocity > 1.2 && distanceY > 50;
        const isPullingDownAtTop = (scrollRef.current?.scrollTop === 0) && distanceY > 80 && velocity > 0.5;

        if (isStrongSwipeDown || isPullingDownAtTop) {
            onClose();
        }
    };

    if (!currentRecipe || !shouldRender) return null;

    const fleches = cadrePhoto && navigation && cadrePhoto.isConnected ? createPortal(
        <>
            <button type="button" className={`${styles.flechePhoto} ${styles.flecheGauche}`}
                onClick={(e) => { e.stopPropagation(); navigation.precedent?.(); }}
                disabled={!navigation.precedent} aria-label="Recette précédente"><Chevron gauche /></button>
            <button type="button" className={`${styles.flechePhoto} ${styles.flecheDroite}`}
                onClick={(e) => { e.stopPropagation(); navigation.suivant?.(); }}
                disabled={!navigation.suivant} aria-label="Recette suivante"><Chevron /></button>
            <span className={styles.comptePhoto}>{navigation.position} / {navigation.total}</span>
        </>,
        cadrePhoto,
    ) : null;

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
                            ref={sheetRef}
                            style={parcours ? { height: '96vh' } : hauteur ? { height: `${hauteur}px`, ...(lisse ? { transition: 'height .28s cubic-bezier(.32,.72,0,1)' } : null) } : undefined}
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

                            {/* Plus de flèches sur la photo : on change de recette au clavier (← →), pas au clic. */}

                            <div
                                className={styles.scrollArea}
                                ref={scrollRef}
                                onTouchStart={handleTouchStart}
                                onTouchEnd={handleTouchEnd}
                            >
                                <RecipeDetails key={String(currentRecipe.id)} recipe={currentRecipe} isModal={true} />
                                {fleches}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </Portal>
    );
}
