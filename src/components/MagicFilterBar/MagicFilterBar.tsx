'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mockRecipes } from '../../data/mockData';
import styles from './MagicFilterBar.module.css';

interface FilterItem {
    id: string;
    name: string;
    icon: string | React.ReactNode;
    tag?: string;
}

const AFRICA_SILHOUETTE = (
    <svg viewBox="0 0 512 512" width="22" height="22" fill="currentColor" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
        <path d="M428.1 143.4c-9.7-21.7-18-24.3-18.7-27.4-.7-3.1 3.5-3.5 3.5-3.5-4.5-5.9-6.9-12.8-11.8-19.1-7.6-9.7-13.2-13.5-23.9-13.2-10.7.3-20.1 7.6-26 12.8s-12.8 13.5-17.7 20.8c-4.8 7.3-10.4 16-10.4 16s-2.1-1.4-8-1.7c-5.9-.3-13.9.3-20.5 1.7-6.6 1.4-14.9 3.8-17.7 6.2-2.8 2.4-7.3 8.3-9.7 13.2s-6.9 14.9-7.6 22.5c-.7 7.6 1.4 19.8 1.4 19.8s-7.6 1.7-13.2 2.4c-5.5.7-14.6 1-20.5-2.1-5.9-3.1-11.8-10.7-14.6-14.2-2.8-3.5-6.2-7.3-14.6-7.3s-15.6 1.7-23.2 6.6c-7.6 4.8-10.4 8.7-16.7 16s-8.7 13.9-8.7 21.5c0 7.6 3.1 20.5 4.5 27.7 1.4 7.3 4.2 16 4.9 22.9.7 6.9-1.4 13.9-.3 22.2s4.8 16.3 8 23.2c3.1 6.9 8 13.9 11.4 20.5 3.5 6.6 7.3 12.1 11.1 19.4 3.8 7.3 6.6 16 9 22.9s4.8 13.9 6.2 22.2c1.4 8.3 3.5 19.8 4.2 28.1s1.7 19.8 4.2 28.4c2.4 8.7 6.9 21.5 9.7 28.8 2.8 7.3 8 16.7 11.4 22.2s7.6 10.7 12.8 14.6c5.2 3.8 12.8 8 18 10.1 5.2 2.1 12.1 3.5 18 3.5s15.9-2.1 21.5-6.2c5.5-4.2 11.1-11.4 14.2-18s5.2-15.6 6.9-23.6c1.7-8 4.2-20.1 4.2-20.1s4.5-3.5 10.7-7c6.2-3.5 12.5-6.2 18.7-10.4 6.2-4.2 12.5-12.8 17-19.1s7.3-14.2 8.7-21.5c1.4-7.3 2.1-18.7 2.1-18.7s4.8-4.5 10.7-9c5.9-4.5 12.5-10.4 17-17 4.5-6.6 7.6-13.9 10.1-22.2s2.8-19.8 2.8-19.8 6.9-7.6 12.1-14.9c5.2-7.3 9.4-16 11.4-23.9s2.8-18.4 2.8-18.4.7-6.2 1.4-13.2c.7-6.9 0-14.6-.3-21.5s-.7-14.2.7-21.2c1.4-6.9 4.2-13.9 5.2-20.8.3-6.9-1.4-15.3-4.5-22.9M143.5 240.2c1.4 0 2.8-.7 3.5-1.7.7-1.1.3-2.4-.7-3.1-1.4-1.1-3.5-1.1-4.9 0l-1.4 1.4c-.7 1.1-.3 2.4.7 3.1.7.3 1.8.3 2.8.3z"/>
    </svg>
);

interface MagicFilterBarProps {
    activeTags: string[];
    onSelect: (tag: string) => void;
    showBack?: boolean;
    backUrl?: string;
    backLabel?: string;
    isHome?: boolean;
    listCount?: number;
}

const categories: FilterItem[] = [
    { id: 'aperitifs', name: 'Apéritifs', icon: '🍹' },
    { id: 'entrees', name: 'Entrées', icon: '🥗' },
    { id: 'plats', name: 'Plats', icon: '🍲' },
    { id: 'vegetarien', name: 'Végé', icon: '🥬' },
    { id: 'desserts', name: 'Desserts', icon: '🍰' },
    { id: 'patisserie', name: 'Pâtisserie', icon: '🥐' },
    { id: 'restaurant', name: 'Restaurant', icon: '🍽️' },
];

const countries: FilterItem[] = [
    { id: 'france', name: 'France', icon: '🇫🇷', tag: 'france' },
    { id: 'italie', name: 'Italie', icon: '🇮🇹', tag: 'italie' },
    { id: 'espagne', name: 'Espagne', icon: '🇪🇸', tag: 'espagne' },
    { id: 'grece', name: 'Grèce', icon: '🇬🇷', tag: 'grece' },
    { id: 'liban', name: 'Liban', icon: '🇱🇧', tag: 'liban' },
    { id: 'usa', name: 'USA', icon: '🇺🇸', tag: 'usa' },
    { id: 'mexique', name: 'Mexique', icon: '🇲🇽', tag: 'mexique' },
    { id: 'orient', name: 'Orient', icon: '🕌', tag: 'orient' },
    { id: 'asie', name: 'Asie', icon: '🥢', tag: 'asie' },
    { id: 'afrique', name: 'Afrique', icon: AFRICA_SILHOUETTE, tag: 'afrique' },
];

const trends: FilterItem[] = [
    { id: 'healthy', name: 'Healthy', icon: '🥗', tag: 'Healthy' },
    { id: 'astuces', name: 'Astuces', icon: '💡', tag: 'Astuces' },
    { id: 'airfryer', name: 'Airfryer', icon: '💨', tag: 'airfryer' },
    { id: 'barbecue', name: 'Barbecue', icon: '🍖', tag: 'Barbecue' },
    { id: 'pas-cher', name: 'Pas Cher', icon: '🪙', tag: 'Pas cher' },
    { id: 'express', name: 'Express', icon: '⚡', tag: 'Express' },
    { id: 'epice', name: 'Epicé', icon: '🌶️', tag: 'épicé' },
];

export default function MagicFilterBar({ 
    activeTags, 
    onSelect, 
    showBack = false, 
    backUrl,
    backLabel,
    isHome = false,
    listCount = 0
}: MagicFilterBarProps) {
    const router = useRouter();
    const [activeGroup, setActiveGroup] = useState('categories');
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    const [dynamicAccent, setDynamicAccent] = useState('#7f0df2');
    const [isLuckyRolling, setIsLuckyRolling] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const itemsScrollRef = useRef<HTMLDivElement>(null);

    const handleItemsMouseMove = (e: React.MouseEvent) => {
        if (!itemsScrollRef.current) return;
        
        // Uniquement sur Desktop
        if (window.matchMedia('(pointer: coarse)').matches) return;

        const container = itemsScrollRef.current;
        const rect = container.getBoundingClientRect();
        
        const x = e.clientX - rect.left;
        const threshold = 100;
        
        let percentage;
        if (x < threshold) {
            percentage = 0;
        } else if (x > rect.width - threshold) {
            percentage = 1;
        } else {
            percentage = (x - threshold) / (rect.width - 2 * threshold);
        }
        
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;
        const maxScroll = scrollWidth - clientWidth;
        
        if (maxScroll > 0) {
            container.scrollLeft = percentage * maxScroll;
        }
    };

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        const handleScroll = () => setScrolled(window.scrollY > 40);

        const handleToggleGroup = (e: any) => {
            const groupId = e.detail;
            setExpandedGroup(prev => prev === groupId ? null : groupId);
            setActiveGroup(groupId);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        window.addEventListener('scroll', handleScroll);
        window.addEventListener('magic-toggle-group', handleToggleGroup);

        return () => {
            window.removeEventListener('resize', checkMobile);
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('magic-toggle-group', handleToggleGroup);
        };
    }, []);

    useEffect(() => {
        const colors: Record<string, string> = {
            'france': '#3b82f6',
            'italie': '#10b981',
            'espagne': '#f59e0b',
            'orient': '#7c2d12',
            'asie': '#dc2626',
            'afrique': '#eab308',
            'vegetarien': '#4ade80',
            'desserts': '#f472b6',
            'patisserie': '#d97706'
        };
        const lastTag = activeTags[activeTags.length - 1];
        if (lastTag && colors[lastTag]) setDynamicAccent(colors[lastTag]);
        else setDynamicAccent('#7f0df2');
    }, [activeTags]);

    const handleLuckyClick = () => {
        setIsLuckyRolling(true);
        setTimeout(() => {
            const randomIndex = Math.floor(Math.random() * mockRecipes.length);
            const recipe = mockRecipes[randomIndex];
            setIsLuckyRolling(false);
            window.location.href = `/recipe/${recipe.id}`;
        }, 800);
    };

    const Rail = ({ items }: { items: FilterItem[] }) => (
        <div className={styles.railContainer}>
            <div className={styles.railScroll}>
                <div className={styles.railContent}>
                    {items.map((item) => (
                        <button
                            key={item.id}
                            className={`${styles.filterItem} ${activeTags.includes(item.tag || item.id) ? styles.active : ''}`}
                            onClick={() => {
                                onSelect(item.tag || item.id);
                                if (isMobile) setExpandedGroup(null);
                            }}
                        >
                            <span className={styles.itemIcon}>{item.icon}</span>
                            <span className={styles.itemName}>{item.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    const groups = [
        { id: 'categories', icon: '🍴', label: 'Plats', items: categories },
        { id: 'countries', icon: '🌍', label: 'Pays', items: countries },
        { id: 'trends', icon: '🏷️', label: 'Tendances', items: trends },
    ];

    const currentItems = groups.find(g => g.id === activeGroup)?.items || categories;

    return (
        <div className={`${styles.mobileLayoutContainer} ${scrolled ? styles.shrunk : ''}`}>
            {/* STICKY WRAPPER: Contains the filter bar logic */}
            <div className={styles.stickyWrapper}>
                
                {/* 1. PC VIEW: FIXED HORIZONTAL LAYOUT */}
                {!isMobile && (
                    <motion.div className={styles.container}>
                        <div className={styles.glassInnerPC}>
                            <div className={styles.groupSwitcher}>
                                {groups.map((group) => (
                                    <button
                                        key={group.id}
                                        className={`${styles.groupBtn} ${activeGroup === group.id ? styles.groupBtnActive : ''}`}
                                        onClick={() => {
                                            setActiveGroup(group.id);
                                            setExpandedGroup(group.id);
                                        }}
                                    >
                                        <span className={styles.groupIcon}>{group.icon}</span>
                                        <span className={styles.groupLabelPC}>{group.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className={styles.separator} />
                            <div className={styles.itemsScrollContainerPC}>
                                <div 
                                    ref={itemsScrollRef}
                                    className={styles.itemsScrollPC}
                                    onMouseMove={handleItemsMouseMove}
                                >
                                    <div className={styles.itemsWrapperPC}>
                                        {currentItems.map((item) => (
                                            <button
                                                key={item.id}
                                                className={`${styles.filterItem} ${activeTags.includes(item.tag || item.id) ? styles.active : ''}`}
                                                onClick={() => onSelect(item.tag || item.id)}
                                            >
                                                <span className={styles.itemIcon}>{item.icon}</span>
                                                <span className={styles.itemName}>{item.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className={styles.separator} />
                            <div className={styles.actionsPC}>
                                <motion.button 
                                    className={styles.luckyBtn}
                                    onClick={handleLuckyClick}
                                    animate={isLuckyRolling ? { rotate: [0, -5, 5, -5, 5, 0] } : {}}
                                >
                                    🍀
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* 2. MOBILE VIEW: THE DYNAMIC STACKED NAV IS GONE, ONLY FILTERS REMAIN */}
                {isMobile && (
                    <div className={styles.mobileContainer}>
                        {/* THE NAVIGATION ROW (SEARCH, FAVORITES, ETC.) IS NOW IN THE HEADER */}
                        
                        {/* BACK BUTTON (Only in recipe details) */}
                        {showBack && backUrl && (
                            <div className={styles.mobileBackRow}>
                                <button
                                    className={styles.mobileBackBtn}
                                    onClick={() => router.push(backUrl)}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M15 18l-6-6 6-6" />
                                    </svg>
                                    {backLabel || 'Retour'}
                                </button>
                            </div>
                        )}

                        {/* EXPANDED MENU (THE ITEMS RAIL) */}
                        <AnimatePresence>
                            {(expandedGroup || isHome) && (
                                <motion.div 
                                    key="expanded-menu"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className={styles.mobileExpandedMenu}
                                >
                                    <Rail 
                                        items={groups.find(g => g.id === (expandedGroup || activeGroup))?.items || []} 
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* MOBILE ONLY LUCKY BUTTON - NON STICKY */}
            {isMobile && (
                <AnimatePresence>
                    {!scrolled && isHome && (
                        <motion.div 
                            className={styles.mobileActions}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                        >
                            <motion.button 
                                className={styles.luckyBtnMobile}
                                onClick={handleLuckyClick}
                                animate={isLuckyRolling ? { rotate: [0, -10, 10, -10, 10, 0], scale: 1.1 } : {}}
                            >
                                🍀 Tente ta chance
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
            
            <Glow dynamicAccent={dynamicAccent} />
        </div>
    );
}

function Glow({ dynamicAccent }: { dynamicAccent: string }) {
    return (
        <div className={styles.glowContainer} style={{ '--glow-color': dynamicAccent } as any}>
            <div className={`${styles.glowOrb} ${styles.glowOrb1}`} />
            <div className={`${styles.glowOrb} ${styles.glowOrb2}`} />
            <div className={`${styles.glowOrb} ${styles.glowOrb3}`} />
        </div>
    );
}
