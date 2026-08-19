'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import styles from './BottomNav.module.css';
import dynamic from 'next/dynamic';
import Portal from '../Portal';
// Recherche « Apple TV+ » (la même que le menu), en remplacement de l'ancien
// SpotlightSearch : la loupe de la barre du bas ouvre désormais ce panneau stylé.
const TVSpotlight = dynamic(() => import('@/mobile/screens/tv/TVSpotlight'), { ssr: false });
import { mockRecipes } from '@/mobile/data/mockData';
import { useTimer } from '@/mobile/components/Timer/TimerContext';
import { decodeHtml } from '@/mobile/lib/utils';
import { supabase } from '@/mobile/lib/supabase';
import { countConsolidatedLines } from '@/mobile/lib/ingredients';

const RecipeSheet = dynamic(() => import('@/mobile/components/RecipeSheet/RecipeSheet'), { ssr: false });

// Icons 
const StorefrontIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);

const HeartIcon = ({ filled, isActive }: { filled?: boolean, isActive?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? "#ff3b30" : "none"} stroke={filled ? "#ff3b30" : (isActive ? "white" : "currentColor")} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
);

const SearchIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
    </svg>
);

const BasketIcon = () => (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
);

const CalendarIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

export default function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [stats, setStats] = useState({ shopping: 0, favorites: 0 });
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [voiceSearch, setVoiceSearch] = useState(false);
    const searchLpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchLpFired = useRef(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const pointerStartX = useRef<number | null>(null);
    const DRAG_THRESHOLD = 8;
    const [isMiniMode, setIsMiniMode] = useState(false);
    const [forceMiniMode, setForceMiniMode] = useState(false);
    const prevPathnameRef = useRef(pathname);
    const forceMiniTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [lastViewed, setLastViewed] = useState<any>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    /**
     * Dans « Ma cave », la pastille du milieu ne sert à rien : elle propose la
     * dernière RECETTE vue, hors sujet quand on range ses bouteilles. Elle
     * devient « Ajouter un vin » et ouvre directement le viseur — le geste
     * qu'on vient faire ici neuf fois sur dix.
     */
    const inCave = pathname === '/ma-cave';
    const [showTimerMode, setShowTimerMode] = useState(false);
    const [isTimerExpanded, setIsTimerExpanded] = useState(false);
    const { activeTimer, stopTimer } = useTimer();
    const dockRef = useRef<HTMLDivElement>(null);
    const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Prefetch des routes de la barre → navigation plus rapide (charge les chunks à l'avance)
    useEffect(() => {
        ['/favorites', '/tv-courses', '/tv-planner', '/'].forEach(p => { try { router.prefetch(p); } catch { /* noop */ } });
    }, [router]);

    // Favoris + Liste + Menu réservés aux connectés : déconnecté = Accueil + Recherche seulement.
    // Liste et Menu pointent vers les écrans « Apple TV+ » (/tv-courses, /tv-planner),
    // comme l'accueil : sans ça la barre du bas ramenait l'ancienne liste de courses
    // et l'ancien planificateur en calque par-dessus les nouveaux écrans.
    const navItems = [
        ...(isLoggedIn ? [
            { id: 'favoris', label: 'Favoris', Icon: HeartIcon, path: '/favorites', badge: stats.favorites },
            { id: 'panier', label: 'Liste', Icon: BasketIcon, path: '/tv-courses', badge: stats.shopping },
        ] : []),
        { id: 'decouvrir', label: 'Accueil', Icon: StorefrontIcon, path: '/' },
        ...(isLoggedIn ? [{ id: 'planner', label: 'Menu', Icon: CalendarIcon, path: '/tv-planner' }] : []),
    ];

    // Toggle between Search and Timer every 3 seconds if timer is active
    useEffect(() => {
        const hasTimer = !!activeTimer;
        if (!hasTimer) {
            setShowTimerMode(false);
            setIsTimerExpanded(false);
            return;
        }

        const interval = setInterval(() => {
            setShowTimerMode(prev => !prev);
        }, 3000);

        return () => clearInterval(interval);
    }, [!!activeTimer]);

    const expandTimer = () => {
        setIsTimerExpanded(true);
        handleVibrate(15);
        
        // Auto-close after 2 seconds
        if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = setTimeout(() => {
            setIsTimerExpanded(false);
        }, 2000);
    };

    const handleSearchOrTimerClick = (e: React.MouseEvent) => {
        // Un appui long vient d'ouvrir la recherche vocale : on n'enchaîne pas le tap.
        if (searchLpFired.current) { searchLpFired.current = false; return; }
        handleVibrate(15);

        const isCurrentlyChrono = activeTimer && (showTimerMode || isMiniMode);

        if (isCurrentlyChrono) {
            setIsTimerExpanded(!isTimerExpanded);
        } else {
            setVoiceSearch(false);
            setIsSearchOpen(true);
            setIsTimerExpanded(false);
        }
    };

    // Appui long sur la loupe → recherche assistant IA + dictée vocale directe.
    const startSearchLp = () => {
        searchLpFired.current = false;
        if (searchLpTimer.current) clearTimeout(searchLpTimer.current);
        searchLpTimer.current = setTimeout(() => {
            searchLpFired.current = true;
            handleVibrate(22);
            setVoiceSearch(true);
            setIsTimerExpanded(false);
            setIsSearchOpen(true);
        }, 450);
    };
    const endSearchLp = () => { if (searchLpTimer.current) clearTimeout(searchLpTimer.current); };

    const renderSearchOrTimer = (forceChronoOnly = false) => {
        if (activeTimer) {
            const mins = Math.floor(activeTimer.remaining / 60);
            const secs = activeTimer.remaining % 60;
            const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

            if (forceChronoOnly) {
                return (
                    <div className={styles.timerBadge}>
                        <span className={styles.timerValue}>{timeStr}</span>
                    </div>
                );
            }

            if (showTimerMode) {
                return (
                    <div className={`${styles.timerBadge} ${activeTimer.remaining > 0 ? styles.pulse : ''}`}>
                        <span className={styles.timerValue}>{timeStr}</span>
                    </div>
                );
            }
        }
        return <SearchIcon />;
    };

    // Close search on route change + show mini mode briefly when returning from a recipe
    useEffect(() => {
        setIsSearchOpen(false);
        setIsTimerExpanded(false);

        const wasOnRecipe = prevPathnameRef.current.startsWith('/recipe/');
        const isOnRecipe = pathname.startsWith('/recipe/');

        if (wasOnRecipe && !isOnRecipe) {
            // Just left a recipe page — show the last viewed card in mini mode for 4s
            setForceMiniMode(true);
            if (forceMiniTimerRef.current) clearTimeout(forceMiniTimerRef.current);
            forceMiniTimerRef.current = setTimeout(() => {
                setForceMiniMode(false);
            }, 4000);
        }

        prevPathnameRef.current = pathname;

        return () => {
            if (forceMiniTimerRef.current) clearTimeout(forceMiniTimerRef.current);
        };
    }, [pathname]);

    useEffect(() => {
        setMounted(true);

        // Handle scroll for Mini Mode
        const handleScroll = () => {
            const threshold = 80;
            setIsMiniMode(window.scrollY > threshold);
        };
        window.addEventListener('scroll', handleScroll);

        // Track last viewed from localStorage with full data to avoid crash
        const updateLastViewed = () => {
            const data = localStorage.getItem('magic-last-viewed');
            if (data) {
                const parsed = JSON.parse(data);
                const fullRecipe = mockRecipes.find(r => r.id.toString() === parsed.id.toString());
                if (fullRecipe) setLastViewed(fullRecipe);
                else setLastViewed(parsed);
            }
        };
        updateLastViewed();
        window.addEventListener('recipeViewed', updateLastViewed);
        
        const updateStats = () => {
            // Liste de courses : MÊME décompte que l'écran (liste fusionnée =
            // semaine + Jour J + par recette + manuel), sinon le badge diverge du
            // « N articles à prendre » affiché en haut de la liste.
            const totalItems = countConsolidatedLines();

            // Favorites
            const favoriteData = JSON.parse(localStorage.getItem('favorites') || '[]');
            const totalFavorites = favoriteData.length;

            setStats({ 
                shopping: totalItems as number,
                favorites: totalFavorites as number
            });
        };
        updateStats();
        window.addEventListener('storage', updateStats);
        window.addEventListener('shoppingListUpdated', updateStats);
        window.addEventListener('magic-favorite-change', updateStats);

        // Session : pilote l'affichage des onglets Favoris/Liste
        supabase.auth.getSession().then(({ data: { session } }) => setIsLoggedIn(!!session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setIsLoggedIn(!!session));

        // Match active index on load
        const idx = navItems.findIndex(item => 
            item.path === '/' ? pathname === '/' : item.path && pathname.startsWith(item.path)
        );
        if (idx !== -1) setActiveIndex(idx);

        return () => {
            subscription.unsubscribe();
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('recipeViewed', updateLastViewed);
            window.removeEventListener('storage', updateStats);
            window.removeEventListener('shoppingListUpdated', updateStats);
            window.removeEventListener('magic-favorite-change', updateStats);
        };
    }, [pathname]);

    // Spring animation for the indicator
    // Plus raide et plus léger : la pastille rattrape le doigt au lieu de le
    // suivre mollement (25/300/0.8 laissait un temps de retard visible).
    const springConfig = { damping: 32, stiffness: 460, mass: 0.6 };
    const springX = useSpring(0, springConfig);
    const xTransform = useTransform(springX, (val) => `${val * 100}%`);

    useEffect(() => {
        if (!isDragging) {
            springX.set(activeIndex);
        }
    }, [activeIndex, isDragging]);

    const handlePointerMove = (e: React.PointerEvent) => {
        // N'active le drag qu'après un déplacement minimum
        if (!isDragging && pointerStartX.current !== null) {
            if (Math.abs(e.clientX - pointerStartX.current) > DRAG_THRESHOLD) {
                setIsDragging(true);
            }
        }
        if (!isDragging || !dockRef.current) return;
        
        const rect = dockRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const count = navItems.length;
        const itemWidth = width / count;
        
        let newIdx = Math.floor(x / itemWidth);
        newIdx = Math.max(0, Math.min(newIdx, count - 1));
        
        springX.set(x / itemWidth); 

        if (newIdx !== activeIndex) {
            setActiveIndex(newIdx); // Transition colors in real-time during drag
            handleVibrate(5);
        }
    };

    const handleVibrate = (ms: number) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(ms);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        const wasDragging = isDragging;
        setIsDragging(false);
        pointerStartX.current = null;

        // Si c'était un vrai drag (pas un simple tap), on navigue selon la position finale
        if (wasDragging && dockRef.current) {
            const rect = dockRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const itemWidth = rect.width / navItems.length;
            let newIdx = Math.floor(x / itemWidth);
            newIdx = Math.max(0, Math.min(newIdx, navItems.length - 1));
            handleItemClick(newIdx);
        }
        // Si c'était un tap simple, le onClick sur le navItem s'en charge
    };

    const handleItemClick = (index: number) => {
        // Retour haptique AVANT la navigation : le doigt reçoit sa réponse tout
        // de suite, même si la page met un instant à venir.
        handleVibrate(8);
        setActiveIndex(index);
        // Ferme toute fiche recette flottante ouverte (sinon elle reste par-dessus la page)
        window.dispatchEvent(new Event('magic-close-sheet'));
        setIsSheetOpen(false);
        const item = navItems[index];
        // Le planificateur est un ÉCRAN (/tv-planner) : le calque WeekPlanner a
        // été retiré de cette barre, plus rien ne pouvait l'ouvrir.
        if ('path' in item && item.path) {
            router.push(item.path);
        }
    };

    const handleRecipeSelect = (recipe: any) => {
        setLastViewed(recipe);
        setIsSheetOpen(true);
        setIsSearchOpen(false);
    };

    if (!mounted) return null;

    return (
        <>
            <TVSpotlight
                open={isSearchOpen}
                onClose={() => { setIsSearchOpen(false); setVoiceSearch(false); }}
                onRecipeSelect={handleRecipeSelect}
                initialMode={voiceSearch ? 'assistant' : undefined}
                autoVoice={voiceSearch}
            />

            <nav id="bottom-nav" className={styles.navWrapper}>
                <div className={`${styles.multiPillContainer} ${(isMiniMode || forceMiniMode) ? styles.isMini : ''}`}>

                   {/* 1. MINI MODE: SPLIT LAYOUT */}
                   <AnimatePresence>
                        {(isMiniMode || forceMiniMode) && (
                            <motion.div 
                                className={styles.miniDockContainer}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 30 }}
                                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                            >
                                <div className={styles.miniLeft} onClick={() => router.push('/')}>
                                    <StorefrontIcon />
                                </div>

                                <div 
                                    className={styles.miniCenter} 
                                    onClick={() => {
                                        if (inCave) {
                                            handleVibrate(12);
                                            window.dispatchEvent(new Event('macave-scan'));
                                            return;
                                        }
                                        if (lastViewed) {
                                            setIsSheetOpen(true);
                                            handleVibrate(15);
                                        }
                                    }}
                                >
                                    {inCave ? (
                                        <>
                                            <span className={styles.miniScanIc}>
                                                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V7a2 2 0 0 1 2-2h2M17 5h2a2 2 0 0 1 2 2v2M21 15v2a2 2 0 0 1-2 2h-2M7 19H5a2 2 0 0 1-2-2v-2M7 12h10" /></svg>
                                            </span>
                                            <span className={styles.miniTitle}>Ajouter un vin</span>
                                        </>
                                    ) : lastViewed ? (
                                        <>
                                            <img src={lastViewed.image} alt={lastViewed.title} className={styles.miniThumb} />
                                            <span className={styles.miniTitle}>{decodeHtml(lastViewed.title)}</span>
                                        </>
                                    ) : (
                                        <span className={styles.miniTitle}>Les Recettes Magiques</span>
                                    )}
                                </div>

                                <motion.div
                                    data-tour="search"
                                    className={styles.miniRight}
                                    onClick={handleSearchOrTimerClick}
                                    onPointerDown={startSearchLp}
                                    onPointerUp={endSearchLp}
                                    onPointerLeave={endSearchLp}
                                >
                                    {renderSearchOrTimer(true)}
                                </motion.div>
                            </motion.div>
                        )}

                        {/* 2. FULL MODE: STITCH DOCK */}
                        {!(isMiniMode || forceMiniMode) && (
                            <motion.div 
                                className={styles.fullDockContainer}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                            >
                                <div 
                                    className={styles.stitchDock}
                                    ref={dockRef}
                                    onPointerDown={(e) => { pointerStartX.current = e.clientX; }}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                    onPointerCancel={() => { setIsDragging(false); pointerStartX.current = null; }}
                                >
                                    <div className={styles.indicatorTrack}>
                                        <motion.div 
                                            className={styles.stitchIndicator}
                                            style={{ 
                                                x: xTransform,
                                                width: `${100 / navItems.length}%`
                                            }}
                                        />
                                    </div>

                                    {navItems.map((item, index) => {
                                        const isActive = activeIndex === index;

                                        return (
                                            <div
                                                key={item.id}
                                                data-tour={item.id === 'favoris' ? 'favorites' : item.id === 'panier' ? 'shopping' : item.id === 'planner' ? 'planner' : undefined}
                                                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                                                onClick={() => handleItemClick(index)}
                                            >
                                                <div className={styles.iconContainer}>
                                                    <div className={`${styles.icon} ${isActive ? styles.iconActive : ''}`}>
                                                        {item.id === 'favoris' ? (
                                                            <HeartIcon filled={stats.favorites > 0} isActive={isActive} />
                                                        ) : (
                                                            item.Icon && <item.Icon />
                                                        )}
                                                    </div>
                                                    
                                                    {(item.badge ?? 0) > 0 && (
                                                        <span className={styles.badge}>
                                                            {(item.badge ?? 0) > 99 ? '99+' : item.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`${styles.label} ${isActive ? styles.activeLabel : ''}`}>
                                                    {item.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <motion.div
                                    data-tour="search"
                                    className={styles.isolatedSearchBtn}
                                    whileTap={{ scale: 0.85 }}
                                    onClick={handleSearchOrTimerClick}
                                    onPointerDown={startSearchLp}
                                    onPointerUp={endSearchLp}
                                    onPointerLeave={endSearchLp}
                                >
                                    {renderSearchOrTimer()}
                                </motion.div>

                                <AnimatePresence>
                                    {isTimerExpanded && activeTimer && (
                                        <motion.div 
                                            className={styles.expandedTimerBubble}
                                            initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 20, scale: 0.8 }}
                                        >
                                            <div className={styles.expandedTime}>
                                                {Math.floor(activeTimer.remaining / 60)}:{(activeTimer.remaining % 60).toString().padStart(2, '0')}
                                            </div>
                                            <div 
                                                className={styles.closeTimerBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    stopTimer();
                                                    setIsTimerExpanded(false);
                                                }}
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                                    <path d="M18 6L6 18M6 6l12 12" />
                                                </svg>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </nav>
            {lastViewed && (
                <RecipeSheet 
                    recipe={lastViewed} 
                    isOpen={isSheetOpen} 
                    onClose={() => setIsSheetOpen(false)} 
                />
            )}
        </>
    );
}
