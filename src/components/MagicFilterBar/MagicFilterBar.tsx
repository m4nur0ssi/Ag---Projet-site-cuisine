'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import styles from './MagicFilterBar.module.css';

interface FilterItem {
    id: string;
    name: string;
    icon: string | React.ReactNode;
    tag?: string;
    color?: string;
}

const AFRICA_SILHOUETTE = (
    <svg viewBox="0 0 512 512" width="22" height="22" fill="currentColor" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
        <path d="M428.1 143.4c-9.7-21.7-18-24.3-18.7-27.4-.7-3.1 3.5-3.5 3.5-3.5-4.5-5.9-6.9-12.8-11.8-19.1-7.6-9.7-13.2-13.5-23.9-13.2-10.7.3-20.1 7.6-26 12.8s-12.8 13.5-17.7 20.8c-4.8 7.3-10.4 16-10.4 16s-2.1-1.4-8-1.7c-5.9-.3-13.9.3-20.5 1.7-6.6 1.4-14.9 3.8-17.7 6.2-2.8 2.4-7.3 8.3-9.7 13.2s-6.9 14.9-7.6 22.5c-.7 7.6 1.4 19.8 1.4 19.8s-7.6 1.7-13.2 2.4c-5.5.7-14.6 1-20.5-2.1-5.9-3.1-11.8-10.7-14.6-14.2-2.8-3.5-6.2-7.3-14.6-7.3s-15.6 1.7-23.2 6.6c-7.6 4.8-10.4 8.7-16.7 16s-8.7 13.9-8.7 21.5c0 7.6 3.1 20.5 4.5 27.7 1.4 7.3 4.2 16 4.9 22.9.7 6.9-1.4 13.9-.3 22.2s4.8 16.3 8 23.2c3.1 6.9 8 13.9 11.4 20.5 3.5 6.6 7.3 12.1 11.1 19.4 3.8 7.3 6.6 16 9 22.9s4.8 13.9 6.2 22.2c1.4 8.3 3.5 19.8 4.2 28.1s1.7 19.8 4.2 28.4c2.4 8.7 6.9 21.5 9.7 28.8 2.8 7.3 8 16.7 11.4 22.2s7.6 10.7 12.8 14.6c5.2 3.8 12.8 8 18 10.1 5.2 2.1 12.1 3.5 18 3.5s15.9-2.1 21.5-6.2c5.5-4.2 11.1-11.4 14.2-18s5.2-15.6 6.9-23.6c1.7-8 4.2-20.1 4.2-20.1s4.5-3.5 10.7-7c6.2-3.5 12.5-6.2 18.7-10.4 6.2-4.2 12.5-12.8 17-19.1s7.3-14.2 8.7-21.5c1.4-7.3 2.1-18.7 2.1-18.7s4.8-4.5 10.7-9c5.9-4.5 12.5-10.4 17-17 4.5-6.6 7.6-13.9 10.1-22.2s2.8-19.8 2.8-19.8 6.9-7.6 12.1-14.9c5.2-7.3 9.4-16 11.4-23.9s2.8-18.4 2.8-18.4.7-6.2 1.4-13.2c.7-6.9 0-14.6-.3-21.5s-.7-14.2.7-21.2c1.4-6.9 4.2-13.9 5.2-20.8.3-6.9-1.4-15.3-4.5-22.9M143.5 240.2c1.4 0 2.8-.7 3.5-1.7.7-1.1.3-2.4-.7-3.1-1.4-1.1-3.5-1.1-4.9 0l-1.4 1.4c-.7 1.1-.3 2.4.7 3.1.7.3 1.8.3 2.8.3z"/>
    </svg>
);

interface MagicFilterBarProps {
    activeTags: string[];
    onSelect: (tag: string, groupId?: string) => void;
    onClear?: () => void;
    showBack?: boolean;
    backUrl?: string;
    backLabel?: string;
    isHome?: boolean;
    listCount?: number;
}

const categories: FilterItem[] = [
    { id: 'cat-aperitifs', name: 'Apéritifs', icon: '', tag: 'aperitifs', color: '#FF7E5F' },
    { id: 'cat-entrees', name: 'Entrées', icon: '', tag: 'entrees', color: '#76B852' },
    { id: 'cat-plats', name: 'Plats', icon: '', tag: 'plats', color: '#8E2DE2' },
    { id: 'cat-accompagnements', name: 'Accompagnements', icon: '', tag: 'accompagnements', color: '#00C853' },
    { id: 'cat-desserts', name: 'Desserts', icon: '', tag: 'desserts', color: '#F80759' },
    { id: 'cat-patisserie', name: 'Pâtisserie', icon: '', tag: 'patisserie', color: '#FFB347' },
];

const countries: FilterItem[] = [
    { id: 'cnt-france', name: 'France', icon: '🇫🇷', tag: 'France', color: '#0055A4' },
    { id: 'cnt-italie', name: 'Italie', icon: '🇮🇹', tag: 'Italie', color: '#008C45' },
    { id: 'cnt-espagne', name: 'Espagne', icon: '🇪🇸', tag: 'Espagne', color: '#F1BF00' },
    { id: 'cnt-grece', name: 'Grèce', icon: '🇬🇷', tag: 'Grece', color: '#0D5EAF' },
    { id: 'cnt-liban', name: 'Liban', icon: '🇱🇧', tag: 'Liban', color: '#EE161F' },
    { id: 'cnt-usa', name: 'USA', icon: '🇺🇸', tag: 'USA', color: '#B22234' },
    { id: 'cnt-mexique', name: 'Mexique', icon: '🇲🇽', tag: 'Mexique', color: '#006847' },
    { id: 'cnt-orient', name: 'Orient', icon: '🕌', tag: 'Orient', color: '#8B4513' },
    { id: 'cnt-asie', name: 'Asie', icon: '🥢', tag: 'Asie', color: '#E41E26' },
    { id: 'cnt-afrique', name: 'Afrique', icon: AFRICA_SILHOUETTE, tag: 'Afrique', color: '#FFD700' },
];

const trends: FilterItem[] = [
    { id: 'trn-paques', name: 'Pâques', icon: '', tag: 'pâques', color: '#ffcc33' },
    { id: 'trn-noel', name: 'Noël', icon: '', tag: 'noël', color: '#ff3b30' },
    { id: 'trn-summer', name: "Voilà l'été", icon: '☀️', tag: 'voila-lete', color: '#FF7E5F' },
    { id: 'trn-winter', name: "C'est l'hiver", icon: '❄️', tag: 'cest-lhiver', color: '#3B82F6' },
    { id: 'trn-glaces', name: 'Les Glaces', icon: '', tag: 'glaces', color: '#F472B6' },
    { id: 'trn-boissons', name: 'Rafraîchissements', icon: '', tag: 'boissons', color: '#3B82F6' },
    { id: 'trn-simplissime', name: 'Simplissime', icon: '', tag: 'simplissime', color: '#FFD700' },
    { id: 'trn-dolce-vita', name: 'Dolce Vita', icon: '', tag: 'italie', color: '#008C45' },
    { id: 'trn-healthy', name: 'Healthy', icon: '', tag: 'healthy', color: '#A8E063' },
    { id: 'trn-astuces', name: 'Astuces', icon: '', tag: 'astuces', color: '#FFD700' },
    { id: 'trn-airfryer', name: 'Airfryer', icon: '', tag: 'airfryer', color: '#43C6AC' },
    { id: 'trn-barbecue', name: 'Barbecue', icon: '', tag: 'barbecue', color: '#FF416C' },
    { id: 'trn-pas-cher', name: 'Pas Cher', icon: '', tag: 'pas cher', color: '#0BA360' },
    { id: 'trn-express', name: 'Express', icon: '', tag: 'express', color: '#FDFC47' },
    { id: 'trn-sauces', name: 'Sauces', icon: '', tag: 'sauces', color: '#FF8C00' },
    { id: 'trn-famille', name: 'Famille', icon: '', tag: 'famille', color: '#FF416C' },
    { id: 'trn-vege', name: 'Végé', icon: '', tag: 'vegetarien', color: '#00C853' }
];

export default function MagicFilterBar({
    activeTags,
    onSelect,
    onClear,
}: MagicFilterBarProps) {
    const [activeGroup, setActiveGroup] = useState<string | null>(null);
    const [dynamicAccent, setDynamicAccent] = useState('#7f0df2');
    const railRef = useRef<HTMLDivElement>(null);

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
            'patisserie': '#d97706',
            'accompagnements': '#00C853',
            'aperitifs': '#FF7E5F',
            'entrees': '#76B852',
            'plats': '#8E2DE2'
        };
        const lastTag = activeTags[activeTags.length - 1];
        if (lastTag && colors[lastTag.toLowerCase()]) setDynamicAccent(colors[lastTag.toLowerCase()]);
        else setDynamicAccent('#7f0df2');
    }, [activeTags]);

    const groups = [
        { id: 'categories', label: 'Catégories', items: categories },
        { id: 'countries', label: 'Pays', items: countries },
        { id: 'trends', label: 'Tendance', items: trends },
    ];

    const toggleGroup = (id: string) => {
        setActiveGroup(prev => prev === id ? null : id);
    };

    // Scroll molette + hover auto-scroll sur le rail des filtres
    useEffect(() => {
        const el = railRef.current;
        if (!el) return;

        // Molette
        const onWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });

        // Hover auto-scroll (même logique que les carousels)
        const speedRef = { current: 0 };
        const targetRef = { current: 0 };
        let rafId: number | null = null;
        let delayTimer: ReturnType<typeof setTimeout> | null = null;
        let isScrolling = false;

        const loop = () => {
            if (speedRef.current !== 0) el.scrollLeft += speedRef.current;
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);

        const onMove = (e: MouseEvent) => {
            const { left, width } = el.getBoundingClientRect();
            const x = e.clientX - left;
            const edge = width * 0.18;
            let speed = 0;
            if (x < edge) speed = -((edge - x) / edge) * 7;
            else if (x > width - edge) speed = ((x - (width - edge)) / edge) * 7;
            targetRef.current = speed;

            if (speed !== 0) {
                if (isScrolling) { speedRef.current = speed; }
                else if (delayTimer === null) {
                    delayTimer = setTimeout(() => {
                        delayTimer = null;
                        if (targetRef.current !== 0) { isScrolling = true; speedRef.current = targetRef.current; }
                    }, 300);
                }
            } else {
                if (delayTimer) { clearTimeout(delayTimer); delayTimer = null; }
                speedRef.current = 0; isScrolling = false;
            }
        };
        const onLeave = () => {
            if (delayTimer) { clearTimeout(delayTimer); delayTimer = null; }
            speedRef.current = 0; isScrolling = false;
        };

        el.addEventListener('mousemove', onMove);
        el.addEventListener('mouseleave', onLeave);
        return () => {
            el.removeEventListener('wheel', onWheel);
            el.removeEventListener('mousemove', onMove);
            el.removeEventListener('mouseleave', onLeave);
            if (rafId) cancelAnimationFrame(rafId);
            if (delayTimer) clearTimeout(delayTimer);
        };
    }, [activeGroup]);

    // Chips des filtres actifs, groupées par groupe
    const activeChips = groups.flatMap(group =>
        group.items
            .filter(i => activeTags.includes(i.tag || i.id))
            .map(i => ({ label: i.name, color: i.color || '#7f0df2', tag: i.tag || i.id, groupId: group.id }))
    );

    return (
        <div className={styles.systemWrapper}>
            {/* MAIN DOCK */}
            <div className={styles.wellDock}>
                {groups.map((group) => {
                    const isMenuOpen = activeGroup === group.id;
                    const selectedItems = group.items.filter(i => activeTags.includes(i.tag || i.id));
                    const hasSelection = selectedItems.length > 0;
                    const isActive = isMenuOpen || hasSelection;
                    // Afficher le nom de la sélection dans le bouton
                    const selectionLabel = hasSelection
                        ? selectedItems.map(i => i.name).join(', ')
                        : null;
                    return (
                        <button
                            key={group.id}
                            className={`${styles.dockItem} ${isActive ? styles.active : ''} ${hasSelection ? styles.hasSelection : ''}`}
                            onClick={() => toggleGroup(group.id)}
                        >
                            {hasSelection ? selectionLabel : group.label}
                            {isActive && (
                                <motion.div
                                    layoutId={`mainIndicator-${group.id}`}
                                    className={styles.activeIndicator}
                                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                        </button>
                    );
                })}
                {/* Bouton Tout effacer */}
                {onClear && (
                    <motion.button
                        className={styles.clearBtn}
                        onClick={onClear}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        ✕
                    </motion.button>
                )}
            </div>

            {/* SECONDARY DOCK (UNFOLDED) */}
            <AnimatePresence>
                {activeGroup && (
                    <motion.div
                        key="secondary-dock"
                        initial={{ height: 0, opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ height: 'auto', opacity: 1, scale: 1, y: 0 }}
                        exit={{ height: 0, opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className={styles.unfoldedWrapper}
                    >
                        <div className={styles.wellDockSecondary}>
                            <div className={styles.railScrollArea} ref={railRef}>
                                <div className={styles.itemsRail}>
                                    {groups.find(g => g.id === activeGroup)?.items?.map((item) => {
                                        const itemTag = item.tag || item.id;
                                        const isSelected = activeTags.includes(itemTag);
                                        return (
                                            <motion.button
                                                key={item.id}
                                                className={`${styles.subItem} ${isSelected ? styles.selected : ''}`}
                                                onClick={() => {
                                                    onSelect(itemTag, activeGroup || undefined);
                                                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                                                        navigator.vibrate(isSelected ? [10] : [15, 30, 15]);
                                                    }
                                                }}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.95 }}
                                                style={{ 
                                                    '--active-color': item.color || '#ff3b30'
                                                } as any}
                                            >
                                                {isSelected && (
                                                    <motion.div 
                                                        layoutId={`aura-glow-${activeGroup}`}
                                                        className={styles.auraGlow}
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                                        style={{ background: `radial-gradient(circle, ${item.color || '#ff3b30'} 0%, transparent 70%)` }}
                                                    />
                                                )}
                                                {activeGroup === 'countries' && item.icon && (
                                                    <span className={styles.itemIcon}>{item.icon}</span>
                                                )}
                                                <span className={styles.itemName}>{item.name}</span>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* CHIPS — filtres actifs individuellement supprimables */}
            <AnimatePresence>
                {activeChips.length > 0 && (
                    <motion.div
                        className={styles.chipsStrip}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {activeChips.map(chip => (
                            <motion.button
                                key={chip.tag}
                                className={styles.activeChip}
                                style={{ borderColor: chip.color, background: `${chip.color}28` }}
                                onClick={() => onSelect(chip.tag, chip.groupId)}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <span>{chip.label}</span>
                                <span className={styles.chipClose}>✕</span>
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

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
