'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Recipe } from '@/mobile/types';
import { decodeHtml } from '@/mobile/lib/utils';
import dynamic from 'next/dynamic';
import Portal from '@/mobile/components/Portal';
import { useRatingStats } from '@/mobile/lib/ratings';
import styles from './RecipeCardiOS26.module.css';

// Cache module-level : dominante (assombrie) par image de thème → "r, g, b"
const themeBandCache = new Map<string, string>();

/**
 * Couleur dominante de l'image de thème, assombrie pour le bandeau titre.
 * Échantillonne la bande horizontale médiane (fond de la carte, sous le titre incrusté).
 */
function useThemeBandColor(src: string | undefined, enabled: boolean): string | null {
    const [rgb, setRgb] = useState<string | null>(() => (src && themeBandCache.get(src)) || null);
    useEffect(() => {
        if (!enabled || !src) return;
        const cached = themeBandCache.get(src);
        if (cached) { setRgb(cached); return; }
        const img = new window.Image();
        img.src = src;
        img.onload = () => {
            try {
                const w = 48, h = 48;
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.drawImage(img, 0, 0, w, h);
                const data = ctx.getImageData(0, Math.round(h * 0.4), w, Math.round(h * 0.2)).data;
                let r = 0, g = 0, b = 0, n = 0;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] < 200) continue; // pixels transparents (SVG)
                    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
                }
                if (!n) return;
                const d = 0.55; // assombrir pour contraster avec le titre blanc
                const val = `${Math.round((r / n) * d)}, ${Math.round((g / n) * d)}, ${Math.round((b / n) * d)}`;
                themeBandCache.set(src, val);
                setRgb(val);
            } catch { /* image illisible → bandeau sombre par défaut */ }
        };
    }, [src, enabled]);
    return rgb;
}

const RecipeSheet = dynamic(() => import('@/mobile/components/RecipeSheet/RecipeSheet'), { ssr: false });
const FavoriteButton = dynamic(() => import('@/mobile/components/FavoriteButton/FavoriteButton'), { ssr: false });
const ShareButton = dynamic(() => import('@/mobile/components/ShareButton/ShareButton'), { ssr: false });
const VoteButton = dynamic(() => import('@/mobile/components/VoteButton/VoteButton'), { ssr: false });

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
    allRecipes?: Recipe[];
    recipeIndex?: number;
    /** Rang (1,2,3…) affiché en pastille — utilisé par le carrousel Top ⭐. */
    rank?: number;
    /** Pilule titre+drapeau incrustée en haut de la photo (au lieu de flotter au-dessus de la carte). */
    inCardTitle?: boolean;
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
    customOnClick,
    allRecipes,
    recipeIndex,
    rank,
    inCardTitle = false
}: RecipeCardiOS26Props) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const ratingStats = useRatingStats();
    const stat = ratingStats?.get(String(recipe.id)) || null;
    const themeBand = useThemeBandColor(recipe.image, !!recipe.id?.startsWith('theme-'));

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
        <div className={`${styles.recipeContainer} ${isGrid ? styles.isGrid : ''} ${inCardTitle ? styles.inCardMode : ''}`}>
            {/* 1. Floating Title Pill ABOVE the card (mode normal uniquement) */}
            {/* Cartes thème : titre déjà incrusté dans l'image → pas de pilule (évite le double titre) */}
            {!hideTitle && !isThematicCard && !inCardTitle && (
                <motion.div
                    className={`${styles.titlePill} ${flag && !isIntroMode ? styles.withFlag : ''}`}
                    whileHover={{ scale: 1.05 }}
                    onClick={handleOpenDetail}
                >
                    {flag && !isIntroMode && (
                        <span className={styles.pillFlag} aria-label={`Origine : ${recipeCountryTag}`}>
                            {flag}
                        </span>
                    )}
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
                data-tour="card"
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
                            style={{
                                objectFit: 'cover',
                                objectPosition: isThematicCard ? '50% 62%' : 'center',
                            }}
                            className={styles.image}
                        />
                    )}
                </div>

                {/* Carte thème : titre HTML propre en haut (recouvre le titre incrusté
                    doublonné de certaines images → un seul titre net).
                    Bandeau teinté de la couleur dominante de l'image (assombrie), pas noir. */}
                {isThematicCard && (() => {
                    const band = themeBand || '8, 8, 12';
                    return (
                        <div
                            style={{
                                position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4,
                                padding: '9px 10px 20px', textAlign: 'center',
                                fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.09em',
                                textTransform: 'uppercase', color: '#fff',
                                /* Bandeau opaque : recouvre le titre incrusté de l'image → 1 seul titre */
                                background: `linear-gradient(180deg, rgb(${band}) 0%, rgb(${band}) 40px, rgba(${band}, 0.45) 54px, rgba(${band}, 0) 100%)`,
                                textShadow: '0 1px 5px rgba(0,0,0,0.35)', pointerEvents: 'none',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}
                        >
                            {decodeHtml(recipe.title)}
                        </div>
                    );
                })()}

                {/* Carte thème : bouton Partager → lien direct sur le thème filtré (/?tag=…) */}
                {isThematicCard && (
                    <div
                        style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 6, color: '#fff', transform: 'scale(0.6)', transformOrigin: 'bottom right' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ShareButton
                            light
                            url={typeof window !== 'undefined'
                                ? `${window.location.origin}/?tag=${encodeURIComponent(recipe.tags?.[0] || '')}`
                                : undefined}
                            title={`Thème : ${decodeHtml(recipe.title)}`}
                        />
                    </div>
                )}

                {/* Titre + drapeau incrustés en haut de la photo (mode inCardTitle) */}
                {inCardTitle && !isThematicCard && (
                    <div className={`${styles.inCardTitleOverlay} ${flag && !isIntroMode ? styles.withFlag : ''}`}>
                        {flag && !isIntroMode && (
                            <span className={styles.pillFlag} aria-label={`Origine : ${recipeCountryTag}`}>
                                {flag}
                            </span>
                        )}
                        <h3
                            className={styles.inCardTitleText}
                            style={{
                                backgroundImage: titleGradient,
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            {truncateTitle(decodeHtml(recipe.title))}
                        </h3>
                    </div>
                )}

                {/* Overlays */}

                {/* Rang Top ⭐ (carrousel top des recettes) */}
                {rank != null && !isThematicCard && (
                    <div style={{
                        // En mode inCardTitle, la pilule titre occupe le haut → pastille juste dessous
                        position: 'absolute', top: inCardTitle ? 62 : 8, left: 8, zIndex: 5,
                        minWidth: 26, height: 26, padding: '0 7px', borderRadius: 13,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: '0.8rem',
                        color: rank <= 3 ? '#1a1200' : '#fff',
                        background: rank === 1 ? 'linear-gradient(135deg,#FFD86B,#F5A623)'
                            : rank === 2 ? 'linear-gradient(135deg,#E8E8EE,#B8BFCB)'
                            : rank === 3 ? 'linear-gradient(135deg,#E7A977,#C77B3E)'
                            : 'rgba(0,0,0,0.62)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                    }}>
                        #{rank}
                    </div>
                )}

                {/* Badge note moyenne ⭐ (visible par tous, si la recette a des avis) */}
                {stat && stat.count > 0 && !isThematicCard && !isIntroMode && (
                    <div style={{
                        position: 'absolute', bottom: 8, left: 8, zIndex: 5,
                        display: 'flex', alignItems: 'center', gap: 3,
                        padding: '3px 8px', borderRadius: 12,
                        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                        fontWeight: 700, fontSize: '0.78rem', color: '#fff',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    }}>
                        <span style={{ color: '#FBBF24' }}>★</span>
                        <span>{stat.avg.toFixed(1)}</span>
                    </div>
                )}

                {/* Top Left: Country Flag — seulement si pas de pilule titre (sinon le drapeau est dans la pilule) */}
                {!isIntroMode && !isThematicCard && flag && rank == null && hideTitle && (
                    <div className={styles.topLeftFlag}>{flag}</div>
                )}

                {/* Cœur — en bas à droite si inCardTitle (la pilule occupe le haut), sinon en haut à droite */}
                {!isIntroMode && !isThematicCard && (
                    <div className={inCardTitle ? styles.bottomRightHeart : styles.topRightHeart} onClick={(e) => e.stopPropagation()}>
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
                        data-tour="play"
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
                allRecipes={allRecipes}
                recipeIndex={recipeIndex}
            />
        </div>
    );
}

function getHashTagColor(index: number) {
    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899'];
    return colors[index % colors.length];
}
