'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Recipe } from '@/types';
import { decodeHtml } from '@/lib/utils';
import dynamic from 'next/dynamic';
import Portal from '@/components/Portal';
import styles from './RecipeCard.module.css';

const RecipeSheet = dynamic(() => import('@/components/RecipeSheet/RecipeSheet'), { ssr: false });
const FavoriteButton = dynamic(() => import('@/components/FavoriteButton/FavoriteButton'), { ssr: false });
const ShareButton = dynamic(() => import('@/components/ShareButton/ShareButton'), { ssr: false });
const VoteButton = dynamic(() => import('@/components/VoteButton/VoteButton'), { ssr: false });

interface RecipeCardiOS26Props {
    recipe: Recipe;
    onPlayToggle?: (playing: boolean) => void;
    size?: 'large' | 'small';
    isGrid?: boolean;
    isFavoritesPage?: boolean;
    hideTitle?: boolean;
    hideVideo?: boolean;
    onCloseSplash?: () => void;
    isIntroMode?: boolean;
    onSheetOpen?: () => void;
    onSheetClose?: () => void;
    customGradient?: string;
    customOnClick?: () => void;
}

export default function RecipeCardiOS26({ 
    recipe, 
    onPlayToggle, 
    size = 'large',
    isGrid = false,
    isFavoritesPage = false,
    hideTitle = false,
    hideVideo = false,
    onCloseSplash,
    isIntroMode = false,
    onSheetOpen,
    onSheetClose,
    customGradient,
    customOnClick
}: RecipeCardiOS26Props) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        onPlayToggle?.(isPlaying);
    }, [isPlaying, onPlayToggle]);

    const getCategoryGradient = (category: string) => {
        if (customGradient) return customGradient;

        const cat = category?.toLowerCase().replace(/[^\w\s]/gi, '').trim() || 'all';

        switch (cat) {
            case 'aperitifs': 
            case 'apéritifs':
            case 'apéro gourmand': return 'linear-gradient(90deg, #F59E0B, #EA580C)';
            case 'entrees': 
            case 'entrées':
            case 'entrées fraîches': return 'linear-gradient(90deg, #10B981, #059669)';
            case 'plats': 
            case 'plats de chef': return 'linear-gradient(90deg, #3B82F6, #4F46E5)';
            case 'desserts':
            case 'pâtisserie':
            case 'douceurs sucrées': return 'linear-gradient(90deg, #EC4899, #9333EA)';
            case 'thématiques du moment': return 'linear-gradient(90deg, #10b981, #3b82f6)'; // Blue-green
            case 'les nouveautés': return 'linear-gradient(90deg, #10b981, #3b82f6)';
            case 'nouveautés spéciales pâques': 
            case 'spécial pâques': return 'linear-gradient(90deg, #F59E0B, #FFCC33)';
            case 'coups de cœur simplissimes': return 'linear-gradient(90deg, #4facfe, #00f2fe)';
            default: return 'linear-gradient(90deg, #10B981, #3B82F6)';
        }
    };
    const titleGradient = getCategoryGradient(recipe.category);

    const videoIdMatch = recipe.videoHtml?.match(/data-video-id="(\d+)"/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    const embedUrl = videoId ? `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&muted=0&controls=1&loop=1` : null;

    const countryFlags: Record<string, string> = {
        france: '🇫🇷', italie: '🇮🇹', espagne: '🇪🇸', grece: '🇬🇷',
        liban: '🇱🇧', usa: '🇺🇸', mexique: '🇲🇽', orient: '🕌',
        maroc: '🇲🇦', japon: '🇯🇵', asie: '🥢', afrique: '🌍'
    };
    const countries = Object.keys(countryFlags);
    const recipeCountryTag = recipe.tags?.find(t => countries.includes(t.toLowerCase()));
    const flag = recipeCountryTag ? countryFlags[recipeCountryTag.toLowerCase()] : null;

    // --- Hashtag Logic (iOS 26 Unified Style) ---
    const hashtags = useMemo(() => {
        let baseTags = recipe.tags?.filter(t => !countries.includes(t.toLowerCase())) || [];
        
        // Regrouper 'simple', 'facile', 'simplissime' sous un seul '#SIMPLISSIME'
        const hasSimplissimeCore = baseTags.some(t => {
            const low = t.toLowerCase();
            return low === 'simple' || low === 'facile' || low === 'simplissime';
        });

        // Filtrer les originaux simplissimes
        let filtered = baseTags.filter(t => {
            const low = t.toLowerCase();
            return low !== 'simple' && low !== 'facile' && low !== 'simplissime';
        });

        const final: string[] = [];
        if (hasSimplissimeCore) final.push('SIMPLISSIME');
        
        // Ajouter le reste jusqu'à 3
        filtered.forEach(t => {
            if (final.length < 3) final.push(t);
        });

        return final;
    }, [recipe.tags, countries]);

    const handleOpenDetail = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (customOnClick) {
            customOnClick();
            return;
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(10);
        }
        onSheetOpen?.();
        setIsSheetOpen(true);
    };

    const truncateTitle = (title: string, maxLen: number = 22) => {
        if (title.length <= maxLen) return title;
        
        const sub = title.substring(0, maxLen);
        const lastSpace = sub.lastIndexOf(' ');
        
        if (lastSpace === -1) return sub + '...';
        return title.substring(0, lastSpace) + '...';
    };

    const isThematicCard = recipe.id?.startsWith('theme-');

    return (
        <div className={`${styles.recipeContainer} ${isGrid ? styles.isGrid : ''}`}>
            {/* 1. Floating Title Pill ABOVE the card */}
            {!hideTitle && !isThematicCard && (
                <motion.div 
                    className={styles.titlePill}
                    whileHover={{ scale: 1.05 }}
                    onClick={handleOpenDetail}
                >
                    <h3 
                        className={styles.titleText}
                        style={{ 
                            backgroundImage: titleGradient,
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}
                    >
                        {truncateTitle(decodeHtml(recipe.title))}
                    </h3>
                </motion.div>
            )}

            {/* 2. Main Visual Card */}
            <motion.div
                ref={cardRef}
                className={`${styles.card} ${size === 'small' ? styles.small : ''}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                onClick={() => {
                    if (customOnClick) {
                        customOnClick();
                        return;
                    }
                    if (onCloseSplash) onCloseSplash();
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(10);
                    }
                    onSheetOpen?.();
                    setIsSheetOpen(true);
                }}
            >

                {/* Image */}
                <div className={styles.imageWrapper}>
                    {recipe.image && (
                        <Image
                            src={recipe.image}
                            alt={recipe.title}
                            fill
                            style={{ objectFit: 'cover' }}
                            className={styles.image}
                        />
                    )}
                </div>

                {/* Overlays */}
                
                {/* Top Right: Heart Accent (Minimalist) */}
                {!isIntroMode && !isThematicCard && (
                    <div className={styles.topRightHeart} onClick={(e) => e.stopPropagation()}>
                        <FavoriteButton
                            recipeId={recipe.id}
                            initialFavorite={recipe.isFavorite}
                            imageUrl={recipe.image}
                            className={styles.minimalistHeart}
                        />
                    </div>
                )}

                {/* Central Play Button (if has video) */}
                {embedUrl && !isPlaying && !hideVideo && !isIntroMode && (
                    <button 
                        className={styles.playCenter}
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsPlaying(true);
                        }}
                    >
                        <div className={styles.playCircle}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                                <polygon points="5,3 19,12 5,21" />
                            </svg>
                        </div>
                    </button>
                )}

                {/* In-Card Video Player */}
                {isPlaying && embedUrl && (
                    <div className={styles.videoInCard} onClick={(e) => e.stopPropagation()}>
                        <iframe 
                            src={embedUrl}
                            className={styles.iframeInCard}
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                        />
                        <button 
                            className={styles.closeVideoInCard}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsPlaying(false);
                            }}
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Removals as per request: no bottom bars, no hashtags */}
            </motion.div>

            {/* Recipe Sheet */}
            <RecipeSheet 
                recipe={recipe} 
                isOpen={isSheetOpen} 
                onClose={() => {
                    setIsSheetOpen(false);
                    onSheetClose?.();
                }} 
            />
        </div>
    );
}

function getHashTagColor(index: number) {
    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899'];
    return colors[index % colors.length];
}
