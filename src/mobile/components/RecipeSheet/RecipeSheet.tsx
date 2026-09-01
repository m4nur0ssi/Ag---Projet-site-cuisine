'use client';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { Recipe } from '@/mobile/types';
import Portal from '@/mobile/components/Portal';
import styles from './RecipeSheet.module.css';
import RecipeDetails from '@/mobile/components/RecipeDetails/RecipeDetails';
import { demarrerDiagnosticAnimations } from '@/mobile/lib/diag-animations';
import { chargerVideos, completer, detailsPrets } from '@/mobile/data/videos-embed';

interface RecipeSheetProps {
    recipe: Recipe;
    isOpen: boolean;
    onClose: () => void;
    allRecipes?: Recipe[];
    recipeIndex?: number;
}

// Distance au-delà de laquelle un glissement lent ferme la fiche. Un geste
// rapide n'a pas à l'atteindre : la vitesse suffit (voir handleTouchEnd).
const DISMISS_Y = 120;
const DISMISS_V = 600;
const SWIPE_THRESHOLD = 0.25; 
const SWIPE_VELOCITY = 400;

export default function RecipeSheet({ recipe, isOpen, onClose, allRecipes, recipeIndex = 0 }: RecipeSheetProps) {
    const baseRecipes = useMemo(() => allRecipes && allRecipes.length > 0 ? allRecipes : [recipe], [allRecipes, recipe]);
    const [recipes, setRecipes] = useState(baseRecipes);
    const [currentIdx, setCurrentIdx] = useState(recipeIndex);
    // Resync quand on ouvre une nouvelle fiche (props changent).
    useEffect(() => { setRecipes(baseRecipes.map(completer)); }, [baseRecipes]);

    /*
     * Rendre à la recette ses étapes, ses ingrédients et sa VIDÉO.
     *
     * L'accueil ne transporte plus ces trois-là — ils pèsent les trois quarts du
     * catalogue et ne servent qu'ici. Ils reviennent d'un module chargé à part.
     * C'était à l'appelant de les recoller, et un seul le faisait : la fiche
     * ouverte depuis le planificateur, la recherche, les favoris ou la barre du
     * bas arrivait sans `videoHtml`, donc SANS L'ONGLET VIDÉO.
     *
     * On le fait donc ici, une bonne fois : plus personne ne peut l'oublier.
     */
    useEffect(() => {
        if (!isOpen || detailsPrets()) return;
        let vivant = true;
        chargerVideos().then(() => {
            if (vivant) setRecipes((liste) => liste.map(completer));
        });
        return () => { vivant = false; };
    }, [isOpen, baseRecipes]);
    const [shouldRender, setShouldRender] = useState(isOpen);
    /**
     * Les recettes déjà construites, par identifiant.
     *
     * Une carte montée ne se démonte JAMAIS tant que la fiche est ouverte : la
     * remonter rejouerait ses animations d'entrée — le fondu des onglets, le
     * compteur de votes — et un balayage enchaîné retomberait dessus en pleine
     * apparition. Seule une carte encore inconnue attend une frame avant de se
     * construire, pour ne pas se bâtir dans le même bloc synchrone que la fin de
     * l'animation.
     */
    const [montees, setMontees] = useState<string[]>([]);

    const scrollYRef = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);
    /** La piste horizontale : on lui écrit sa transformation à la main au changement de recette. */
    const trackRef = useRef<HTMLDivElement | null>(null);
    const scrollRefs = useRef<Record<number, HTMLDivElement | null>>({});

    // MotionValues
    const y = useMotionValue(0);
    const x = useMotionValue(0); // Offset relatif au centre (0 = centré sur currentIdx)
    const backdropOpacity = useTransform(y, [0, 350], [1, 0]);

    // Gesture tracking
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const touchLastX = useRef(0);
    const touchLastY = useRef(0);
    const touchLastT = useRef(0);
    /** Vitesse verticale du doigt en px/ms, sur les dernières millisecondes. */
    const vitesseY = useRef(0);
    const gestureType = useRef<'none' | 'horizontal' | 'vertical'>('none');
    const isDraggingY = useRef(false);
    const isDraggingX = useRef(false);

    useEffect(() => {
        setCurrentIdx(recipeIndex);
    }, [recipeIndex, recipe]);

    // Clic sur une recette similaire → l'ouvrir DANS le sheet (même UX), pas une navigation.
    useEffect(() => {
        if (!isOpen) return;
        const onOpenRecipe = (e: Event) => {
            const r = (e as CustomEvent).detail;
            if (!r) return;
            const idx = recipes.findIndex(x => String(x.id) === String(r.id));
            if (idx >= 0) {
                setCurrentIdx(idx);
            } else {
                setRecipes(prev => [...prev, r]);
                setCurrentIdx(recipes.length);
            }
            x.jump(0);
            y.set(0);
            requestAnimationFrame(() => {
                Object.values(scrollRefs.current).forEach(el => { if (el) el.scrollTop = 0; });
            });
        };
        window.addEventListener('openRecipe', onOpenRecipe);
        return () => window.removeEventListener('openRecipe', onOpenRecipe);
    }, [isOpen, recipes, x, y]);

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
            /*
             * Derrière la fiche, on voit TOUJOURS le haut du site.
             *
             * Le verrou figeait la page là où le doigt l'avait laissée : ouvrir
             * une recette depuis le héros montrait la signature et le nombre de
             * recettes, l'ouvrir depuis le bas de l'accueil montrait un bout de
             * rangée quelconque. La fiche flottait donc sur un fond différent à
             * chaque fois, alors que c'est un décor : il doit être le même.
             *
             * `scrollYRef` garde la vraie position pour la rendre à la fermeture
             * — on revient exactement là où on avait cliqué.
             */
            document.body.style.top = '0px';
            document.body.style.position = 'fixed';
            document.body.style.width = '100vw';
            document.body.style.overflow = 'hidden';

            // Push a temporary state to handle "Back" button/swipe
            window.history.pushState({ modal: 'recipe' }, '');

            const handlePopState = () => {
                onClose();
            };

            // Fermeture forcée depuis l'extérieur (ex. clic Accueil dans la barre du bas)
            const handleForceClose = () => onClose();

            window.addEventListener('popstate', handlePopState);
            window.addEventListener('magic-close-sheet', handleForceClose);
            return () => {
                window.removeEventListener('popstate', handlePopState);
                window.removeEventListener('magic-close-sheet', handleForceClose);
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

    // Relevé embarqué : inerte sans `?diag=anim` dans l'adresse.
    useEffect(() => { if (isOpen) demarrerDiagnosticAnimations(); }, [isOpen]);

    /*
     * Les voisines rejoignent la liste juste après la carte demandée. Deux
     * déclencheurs : la frame suivante, et un minuteur de secours — dans un
     * onglet en arrière-plan, requestAnimationFrame est gelé, et sans ce filet
     * les cartes voisines ne se monteraient jamais.
     */
    useEffect(() => {
        if (!isOpen) { setMontees([]); return; }
        const monter = () => setMontees((deja) => {
            const voulues = [currentIdx - 1, currentIdx, currentIdx + 1]
                .map((i) => recipes[i]?.id)
                .filter(Boolean)
                .map(String);
            const manquantes = voulues.filter((id) => !deja.includes(id));
            return manquantes.length ? [...deja, ...manquantes] : deja;
        });
        const frame = requestAnimationFrame(monter);
        const secours = setTimeout(monter, 120);
        return () => { cancelAnimationFrame(frame); clearTimeout(secours); };
    }, [isOpen, currentIdx, recipes]);

    /**
     * Sortie de la fiche.
     *
     * La durée n'est plus fixe : elle se déduit de la vitesse du doigt et de ce
     * qu'il reste à parcourir. Un geste franc rendait la main en 400 ms — le
     * temps que la fiche descende à sa propre allure, sans rapport avec celle du
     * poignet. On garde la même courbe, on la parcourt au rythme du geste, entre
     * 130 et 260 ms.
     */
    const dismiss = useCallback((vitesse = 0) => {
        if (navigator.vibrate) navigator.vibrate(30);
        const reste = window.innerHeight + 100 - y.get();
        // vitesse en px/ms ; on plafonne pour ne pas obtenir d'animation nulle.
        const duree = Math.min(0.26, Math.max(0.13, reste / Math.max(vitesse, 1.2) / 1000));
        animate(y, window.innerHeight + 100, {
            type: 'tween', ease: [0.32, 0.72, 0, 1], duration: duree, onComplete: onClose,
        });
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
        const width = pasDuCarrousel();
        
        if (navigator.vibrate) navigator.vibrate(10);

        // Animation de transition ultra-fluide
        animate(x, -direction * width, { 
            type: 'tween',
            ease: [0.25, 0.1, 0.25, 1], // Ease standard plus stable
            duration: 0.3,
            onComplete: () => {
                /*
                 * Le rebond en changeant de recette venait d'ici.
                 *
                 * flushSync monte bien la nouvelle carte tout de suite, mais
                 * `x.jump(0)` ne fait que poser la valeur : framer n'écrit la
                 * transformation qu'à sa frame suivante. Le navigateur peignait
                 * donc une image avec le NOUVEAU contenu encore décalé d'une
                 * largeur d'écran — on apercevait la recette d'après — avant que
                 * tout ne revienne en place. Seize millisecondes, largement assez
                 * pour lire un à-coup.
                 *
                 * On écrit donc la transformation nous-mêmes, dans le même bloc
                 * synchrone : la première image peinte est déjà la bonne. Framer
                 * réécrira la même valeur à sa frame suivante, sans effet visible.
                 */
                flushSync(() => setCurrentIdx(newIdx));
                x.jump(0);
                if (trackRef.current) trackRef.current.style.transform = 'translateX(0px)';
            }
        });
    }, [currentIdx, x, snapBack]);

    // ─── Touch Handlers ──────────────────────────────────────────────────
    const handleTouchStart = useCallback((e: TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchLastX.current = e.touches[0].clientX;
        touchLastY.current = e.touches[0].clientY;
        touchLastT.current = performance.now();
        vitesseY.current = 0;
        gestureType.current = 'none';
        isDraggingY.current = false;
        isDraggingX.current = false;
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        const cx = e.touches[0].clientX;
        const cy = e.touches[0].clientY;
        const dx = cx - touchStartX.current;
        const dy = cy - touchStartY.current;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // Vitesse instantanée : c'est elle qui distingue un geste franc d'un
        // glissement hésitant, et elle vaut mieux qu'une distance seuil.
        const maintenant = performance.now();
        const dt = maintenant - touchLastT.current;
        if (dt > 0) vitesseY.current = (cy - touchLastY.current) / dt;
        touchLastX.current = cx;
        touchLastY.current = cy;
        touchLastT.current = maintenant;

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

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        const dx = x.get();
        const dy = y.get();
        const width = pasDuCarrousel();
        const vx = (touchLastX.current - touchStartX.current) / 100; // Estimation simple

        if (gestureType.current === 'vertical' && isDraggingY.current) {
            // DISMISS_V existait sans jamais servir : seule la distance comptait,
            // si bien qu'un geste vif mais court ramenait la fiche en place.
            const lance = vitesseY.current * 1000 > DISMISS_V && dy > 24;
            if (dy > DISMISS_Y || lance) dismiss(vitesseY.current);
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

    /*
     * Les gestes sont branchés À LA MAIN sur la piste, en `passive: false`.
     *
     * React attache `touchmove` en mode PASSIF : le `preventDefault()` du
     * gestionnaire horizontal n'avait aucun effet — mesuré en envoyant un
     * touchmove annulable, `defaultPrevented` restait faux. Safari gardait donc
     * son propre traitement du geste par-dessus le déplacement JS, et c'est son
     * rebond élastique que l'on voyait à chaque changement de recette.
     *
     * Le branchement se fait depuis la RÉFÉRENCE de la piste et non depuis un
     * effet : l'élément y est garanti, sans dépendre de l'ordre des rendus.
     * Les enveloppes ci-dessous sont créées une fois pour toutes et lisent le
     * gestionnaire courant, ce qui évite de tout re-brancher à chaque frappe.
     */
    const gestes = useRef({ start: handleTouchStart, move: handleTouchMove, end: handleTouchEnd });
    gestes.current = { start: handleTouchStart, move: handleTouchMove, end: handleTouchEnd };

    const enveloppes = useRef({
        start: (e: TouchEvent) => gestes.current.start(e),
        move: (e: TouchEvent) => gestes.current.move(e),
        end: (e: TouchEvent) => gestes.current.end(e),
    });

    /**
     * Largeur d'un pas du carrousel.
     *
     * C'est celle de LA PISTE, pas celle de l'écran : les emplacements voisins
     * sont posés à `left: ±100%` de la piste, et la piste vit dans une fiche
     * large de 94 %. On mesurait le conteneur, qui occupe tout l'écran — 375
     * contre 351 sur un iPhone, 402 contre 378 sur un grand modèle. L'animation
     * emmenait donc la carte 24 pixels trop loin, et le basculement la recalait
     * d'un coup : l'à-coup dans le sens du geste, à chaque changement de recette.
     */
    const pasDuCarrousel = useCallback(
        () => trackRef.current?.offsetWidth || containerRef.current?.offsetWidth || window.innerWidth,
        [],
    );

    const brancherPiste = useCallback((el: HTMLDivElement | null) => {
        const precedent = trackRef.current;
        if (precedent === el) return;
        const { start, move, end } = enveloppes.current;
        if (precedent) {
            precedent.removeEventListener('touchstart', start);
            precedent.removeEventListener('touchmove', move);
            precedent.removeEventListener('touchend', end);
            precedent.removeEventListener('touchcancel', end);
        }
        trackRef.current = el;
        if (el) {
            const opts = { passive: false } as AddEventListenerOptions;
            el.addEventListener('touchstart', start, opts);
            el.addEventListener('touchmove', move, opts);
            el.addEventListener('touchend', end, opts);
            el.addEventListener('touchcancel', end, opts);
        }
    }, []);


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
                            /*
                             * Sortie en tween court plutôt qu'au ressort : après un
                             * balayage, la fiche est DÉJÀ hors écran (dismiss l'y a
                             * emmenée) et le ressort ne faisait qu'ajouter trois cents
                             * millisecondes avant de rendre la main. L'entrée garde
                             * son ressort, elle.
                             */
                            exit={{ y: '105%', transition: { type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.18 } }}
                            style={{ y }}
                            transition={{ type: 'spring', damping: 35, stiffness: 400, mass: 0.6 }}
                        >
                            <div className={styles.dragHandleContainer} />

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
                                ref={brancherPiste}
                                style={{ x, display: 'flex', width: '100%', height: '100%', position: 'relative' }}
                            >
                                {/*
                                 * LES TROIS EMPLACEMENTS — précédent, courant, suivant.
                                 *
                                 * Ils étaient écrits en trois blocs distincts, avec des clés
                                 * portant leur RÔLE (`prev-`, `curr-`, `next-`). En changeant
                                 * de recette, celle qu'on venait de faire glisser passait de
                                 * `next-1234` à `curr-1234` : pour React, deux éléments sans
                                 * rapport. Il démontait donc la carte affichée et en
                                 * remontait une neuve, à l'identique — le temps de reconstruire
                                 * une fiche entière, images comprises, dans le même bloc
                                 * synchrone que la fin de l'animation. D'où la secousse, à
                                 * chaque passage.
                                 *
                                 * Une seule liste, des clés portant l'IDENTIFIANT de la
                                 * recette, une position calculée depuis l'écart à l'index
                                 * courant : React reconnaît les cartes déjà montées et se
                                 * contente de les déplacer.
                                 */}
                                {[-1, 0, 1].map((ecart) => {
                                    const idx = currentIdx + ecart;
                                    const r = recipes[idx];
                                    if (!r) return null;
                                    const courante = ecart === 0;
                                    return (
                                        <div
                                            key={r.id}
                                            style={{
                                                position: 'absolute',
                                                left: `${ecart * 100}%`,
                                                width: '100%',
                                                height: '100%',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div
                                                className={styles.scrollArea}
                                                ref={courante ? (el) => { scrollRefs.current[currentIdx] = el; } : undefined}
                                            >
                                                {courante && <button className={styles.closeBtn} onClick={onClose}>✕</button>}
                                                {/*
                                                 * La carte voisine qui vient d'apparaître attend une
                                                 * image avant de se construire : sans ça, elle se
                                                 * monte pendant la frame où l'on recentre la piste.
                                                 */}
                                                {(courante || montees.includes(String(r.id))) && <RecipeDetails recipe={r} isModal={true} />}
                                            </div>
                                        </div>
                                    );
                                })}
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
