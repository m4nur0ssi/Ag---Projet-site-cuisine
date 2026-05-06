'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import styles from './BottomNav.module.css';
import dynamic from 'next/dynamic';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import SpotlightSearch from '../SpotlightSearch/SpotlightSearch';
import { mockRecipes } from '@/data/mockData';
import { useTimer } from '@/components/Timer/TimerContext';
import { decodeHtml } from '@/lib/utils';

const RecipeSheet = dynamic(() => import('@/components/RecipeSheet/RecipeSheet'), { ssr: false });

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

export default function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [stats, setStats] = useState({ shopping: 0, favorites: 0 });
    const [mounted, setMounted] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isMiniMode, setIsMiniMode] = useState(false);
    const [lastViewed, setLastViewed] = useState<any>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [showTimerMode, setShowTimerMode] = useState(false);
    const [isTimerExpanded, setIsTimerExpanded] = useState(false);
    const { activeTimer, stopTimer } = useTimer();
    const dockRef = useRef<HTMLDivElement>(null);
    const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

    const navItems = [
        { id: 'favoris', label: 'Favoris', Icon: HeartIcon, path: '/favorites', badge: stats.favorites },
        { id: 'panier', label: 'Liste', Icon: BasketIcon, path: '/shopping-list', badge: stats.shopping },
        { id: 'decouvrir', label: 'Accueil', Icon: StorefrontIcon, path: '/' },
        { id: 'mode', label: 'Mode', isComponent: true, component: <ThemeToggle /> },
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
        handleVibrate(15);
        
        const isCurrentlyChrono = activeTimer && (showTimerMode || isMiniMode);
        
        if (isCurrentlyChrono) {
            setIsTimerExpanded(!isTimerExpanded);
        } else {
            setIsSearchOpen(true);
            setIsTimerExpanded(false);
        }
    };

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

    useEffect(() => {
        setMounted(true);
        
        // Handle scroll for Mini Mode
        const handleScroll = () => {
            const threshold = 150;
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
            // Shopping list
            const shopData = JSON.parse(localStorage.getItem('magic-shopping-list') || '{}');
            const totalItems = Object.values(shopData).reduce((acc: number, val: any) => {
                if (!val.ingredients) return acc;
                const unCheckedCount = val.ingredients.filter((ing: any) => typeof ing === 'object' ? !ing.checked : true).length;
                return acc + unCheckedCount;
            }, 0);
            
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
        
        // Match active index on load
        const idx = navItems.findIndex(item => 
            item.path === '/' ? pathname === '/' : item.path && pathname.startsWith(item.path)
        );
        if (idx !== -1) setActiveIndex(idx);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('recipeViewed', updateLastViewed);
            window.removeEventListener('storage', updateStats);
            window.removeEventListener('shoppingListUpdated', updateStats);
            window.removeEventListener('magic-favorite-change', updateStats);
        };
    }, [pathname]);

    // Spring animation for the indicator
    const springConfig = { damping: 25, stiffness: 300, mass: 0.8 };
    const springX = useSpring(0, springConfig);
    const xTransform = useTransform(springX, (val) => `${val * 100}%`);

    useEffect(() => {
        if (!isDragging) {
            springX.set(activeIndex);
        }
    }, [activeIndex, isDragging]);

    const handlePointerMove = (e: React.PointerEvent) => {
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
        setIsDragging(false);
        if (!dockRef.current) return;
        
        const rect = dockRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const itemWidth = rect.width / navItems.length;
        let newIdx = Math.floor(x / itemWidth);
        newIdx = Math.max(0, Math.min(newIdx, navItems.length - 1));
        
        handleItemClick(newIdx);
    };

    const handleItemClick = (index: number) => {
        setActiveIndex(index);
        const item = navItems[index];
        // Now using union types safely or checking for path
        if ('path' in item && item.path) {
            router.push(item.path);
        }
        handleVibrate(10);
    };

    const handleRecipeSelect = (recipe: any) => {
        setLastViewed(recipe);
        setIsSheetOpen(true);
        setIsSearchOpen(false);
    };

    if (!mounted) return null;

    return (
        <>
            <AnimatePresence>
                {isSearchOpen && (
                    <SpotlightSearch 
                        isOpen={isSearchOpen} 
                        onClose={() => setIsSearchOpen(false)} 
                        onRecipeSelect={handleRecipeSelect}
                    />
                )}
            </AnimatePresence>

            <nav className={styles.navWrapper}>
                <div className={`${styles.multiPillContainer} ${isMiniMode ? styles.isMini : ''}`}>
                   
                   {/* 1. MINI MODE: SPLIT LAYOUT */}
                   <AnimatePresence>
                        {isMiniMode && (
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
                                        if (lastViewed) {
                                            setIsSheetOpen(true);
                                            handleVibrate(15);
                                        }
                                    }}
                                >
                                    {lastViewed ? (
                                        <>
                                            <img src={lastViewed.image} alt={lastViewed.title} className={styles.miniThumb} />
                                            <span className={styles.miniTitle}>{decodeHtml(lastViewed.title)}</span>
                                        </>
                                    ) : (
                                        <span className={styles.miniTitle}>Les Recettes Magiques</span>
                                    )}
                                </div>

                                <motion.div 
                                    className={styles.miniRight} 
                                    onClick={handleSearchOrTimerClick}
                                >
                                    {renderSearchOrTimer(true)}
                                </motion.div>
                            </motion.div>
                        )}

                        {/* 2. FULL MODE: STITCH DOCK */}
                        {!isMiniMode && (
                            <motion.div 
                                className={styles.fullDockContainer}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                            >
                                <div 
                                    className={styles.stitchDock}
                                    ref={dockRef}
                                    onPointerDown={() => setIsDragging(true)}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                    onPointerCancel={() => setIsDragging(false)}
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
                                                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                                                onClick={() => handleItemClick(index)}
                                            >
                                                <div className={styles.iconContainer}>
                                                    {item.isComponent ? (
                                                        item.component
                                                    ) : (
                                                        <div className={`${styles.icon} ${isActive ? styles.iconActive : ''}`}>
                                                            {item.id === 'favoris' ? (
                                                                <HeartIcon filled={stats.favorites > 0} isActive={isActive} />
                                                            ) : (
                                                                item.Icon && <item.Icon />
                                                            )}
                                                        </div>
                                                    )}
                                                    
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
                                    className={styles.isolatedSearchBtn}
                                    whileTap={{ scale: 0.85 }}
                                    onClick={handleSearchOrTimerClick}
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
