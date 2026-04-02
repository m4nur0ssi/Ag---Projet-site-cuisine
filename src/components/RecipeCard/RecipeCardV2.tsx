'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Recipe } from '@/types';
import FavoriteButton from '@/components/FavoriteButton/FavoriteButton';
import ShareButton from '@/components/ShareButton/ShareButton';
import VoteButton from '@/components/VoteButton/VoteButton';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './RecipeCard.module.css';

interface RecipeCardProps {
    recipe: Recipe;
    activeTags?: string[];
}

const LoadingSpinner = () => (
    <div className={styles.spinnerContainer}>
        <div className={styles.spinner}></div>
    </div>
);

const difficultyColors: Record<string, string> = {
    facile: '#00C853',
    moyen: '#FFD600',
    difficile: '#FF3D00'
};

const categoryGlows: Record<string, string> = {
    aperitifs: 'rgba(16, 185, 129, 0.4)',
    plats: 'rgba(244, 63, 94, 0.4)',
    desserts: 'rgba(217, 70, 239, 0.4)',
    patisserie: 'rgba(245, 158, 11, 0.4)',
    vegetarien: 'rgba(34, 197, 94, 0.4)',
    restaurant: 'rgba(59, 130, 246, 0.4)',
};

const countryColors: Record<string, string> = {
    france: '#0055A4',
    italie: '#008C45',
    espagne: '#EF3340',
    grece: '#005BAE',
    liban: '#00A859',
    usa: '#3C3B6E',
    mexique: '#006847',
    orient: '#C1272D',
    maroc: '#C1272D',
    japon: '#BC002D'
};

const countryFlags: Record<string, string> = {
    france: '🇫🇷', italie: '🇮🇹', espagne: '🇪🇸', grece: '🇬🇷', 
    liban: '🇱🇧', usa: '🇺🇸', mexique: '🇲🇽', orient: '🕌',
    maroc: '🇲🇦', japon: '🇯🇵', autre: '🗺️'
};

const countries = ['france', 'italie', 'espagne', 'grece', 'liban', 'usa', 'mexique', 'orient', 'maroc', 'japon', 'asie'];

export default function RecipeCard({ recipe, activeTags = [] }: RecipeCardProps) {
    const [showVideo, setShowVideo] = useState(false);
    const [isVideoLoading, setIsVideoLoading] = useState(true);
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    const [isPlayed, setIsPlayed] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const videoRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }, []);

    // Aggressive Autoplay Strategy: TikTok player v1 is often better for autoplay
    const videoIdMatch = recipe.videoHtml?.match(/data-video-id="(\d+)"/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    
    // We use player/v1 which is more "video only" and respects autoplay+muted better
    const embedUrl = videoId ? `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&muted=${isMuted ? 1 : 0}&loop=1` : null;

    const handleVideoLoad = () => {
        setIsVideoLoading(false);
    };

    // Fallback cleanup if iframe extractor fails
    const cleanHtml = recipe.videoHtml?.replace(/<script.*?>.*?<\/script>/gi, '') || '';

    const handleToggleVideo = (e?: React.MouseEvent | React.TouchEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const newShow = !showVideo;
        setShowVideo(newShow);
        if (newShow) {
            setIsPlayed(true);
            setIsVideoLoading(true);
        } else {
            setIsVideoLoading(false);
        }
    };

    // Expertise Hashtag Logic 2026
    const recipeHashtags = useMemo(() => {
        const trendPatterns = [
            { id: 'airfryer', name: 'Airfryer', keywords: ['airfryer', 'air fryer'] },
            { id: 'sous-vide', name: 'Sous-vide', keywords: ['sous-vide', 'basse température'] },
            { id: 'barbecue', name: 'Barbecue', keywords: ['barbecue', 'bbq', 'grill'] },
            { id: 'healthy', name: 'Healthy', keywords: ['healthy', 'santé', 'sain', 'équilibré'] },
            { id: 'rapide', name: 'Rapide', keywords: ['rapide', 'express', 'vite'] },
            { id: 'vege', name: 'Végé', keywords: ['végé', 'vege', 'vegan', 'végan'] },
            { id: 'leger', name: 'Léger', keywords: ['léger', 'leger', 'light', 'minceur'] },
            { id: 'gourmand', name: 'Gourmand', keywords: ['gourmand', 'réconfortant', 'comfort food'] },
            { id: 'astuces', name: 'Astuces', keywords: ['astuce', 'tips', 'technique'] }
        ];

        const recipeTags = (recipe.tags || []).map(t => t.toLowerCase());
        const list: { id: string; name: string }[] = [];

        for (const pattern of trendPatterns) {
            if (recipeTags.some(t => pattern.keywords.some(kw => t.includes(kw)))) {
                list.push({ id: pattern.id, name: pattern.name });
            }
        }
        
        return list.slice(0, 3); 
    }, [recipe]); 

    const handleMouseEnter = () => {
        if (!isTouchDevice && recipe.videoHtml) {
            setShowVideo(true);
            setIsPlayed(true);
            setIsVideoLoading(true);
        }
    };

    const handleMouseLeave = () => {
        if (!isTouchDevice) {
            setShowVideo(false);
        }
    };
    
    // On cherche d'abord si un des pays actifs est dans la recette
    const activeCountryTag = recipe.tags?.find(t => {
        const tLower = t.toLowerCase();
        return activeTags.some(at => at.toLowerCase() === tLower) && countries.includes(tLower);
    });

    // Sinon on prend le premier pays trouvé
    const recipeCountryTag = activeCountryTag || recipe.tags?.find(t => {
        const tLower = t.toLowerCase();
        return countries.includes(tLower);
    });

    const flag = recipeCountryTag ? countryFlags[recipeCountryTag.toLowerCase()] : null;

    return (
        <Link 
            href={`/recipe/${recipe.id}`}
            className={`${styles.card} ${showVideo ? styles.cardWithVideo : ''}`}
            data-recipe-id={recipe.id}
            style={{ '--glow-color': categoryGlows[recipe.category] || 'rgba(127, 13, 242, 0.4)' } as React.CSSProperties}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className={styles.cardHeader}>
                <div className={styles.headerLeft}>
                    {flag && (
                        <div className={styles.headerFlag}>
                            {flag}
                        </div>
                    )}
                </div>
                
                <h3 className={styles.topTitle}>{recipe.title}</h3>
                
                <div className={styles.headerRight} />
            </div>

            <div className={styles.imageOuterContainer}>
                <motion.div className={styles.imageContainer}>
                    <AnimatePresence mode="wait">
                        {!showVideo ? (
                            <motion.div 
                                key="image"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className={styles.fullSize}
                            >
                                {recipe.image ? (
                                    <Image
                                        src={recipe.image}
                                        alt={recipe.title}
                                        fill
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        className={styles.image}
                                        style={{ objectFit: 'cover' }}
                                        priority={false}
                                    />
                                ) : (
                                    <div className={styles.imagePlaceholder}>
                                        {recipe.category === 'aperitifs' ? '🍹' :
                                            recipe.category === 'desserts' ? '🍰' :
                                                recipe.category === 'plats' ? '🍲' : '🥗'}
                                    </div>
                                )}

                                {/* ACTIONS HAUT DROITE SUR PHOTO */}
                                <div className={styles.topActionsOverlay} onClick={(e) => e.stopPropagation()}>
                                    <div className={styles.headerActions}>
                                        <ShareButton 
                                            url={`${typeof window !== 'undefined' ? window.location.origin : ''}/recipe/${recipe.id}`}
                                            title={recipe.title}
                                            className={styles.headerActionBtn}
                                        />
                                        <FavoriteButton
                                            recipeId={recipe.id}
                                            initialFavorite={recipe.isFavorite}
                                            imageUrl={recipe.image}
                                            className={styles.headerActionBtn}
                                        />
                                        <VoteButton 
                                            recipeId={recipe.id}
                                            initialVotes={recipe.votes || 0}
                                            className={styles.headerVote}
                                        />
                                    </div>
                                </div>

                                <div className={styles.badges}>
                                    {recipeHashtags.map((has: { id: string; name: string }) => (
                                         <div 
                                             key={has.id} 
                                             className={`${styles.badge} ${styles.badge_tendances} ${styles[`badge_${has.id}`] || ''}`}
                                         >
                                             <span className={styles.badgeLabel}>#{has.name.toUpperCase()}</span>
                                         </div>
                                    ))}
                                </div>
                                
                                {recipe.videoHtml && (
                                    <div 
                                        className={`${styles.playOverlay} ${isTouchDevice ? styles.touchDevice : ''}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleToggleVideo();
                                        }}
                                    >
                                        <div className={styles.playIconBox}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                                <polygon points="5 3 19 12 5 21 5 3" />
                                            </svg>
                                        </div>
                                        <span className={styles.playText}>VOIR VIDEO</span>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="video"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className={styles.videoEmbedContainer}
                                ref={videoRef}
                            >
                                {isVideoLoading && recipe.image && (
                                    <div className={styles.videoPoster}>
                                        <Image
                                            src={recipe.image}
                                            alt={recipe.title}
                                            fill
                                            style={{ objectFit: 'cover' }}
                                            className={styles.posterBlur}
                                        />
                                        <LoadingSpinner />
                                    </div>
                                )}

                                {isPlayed && embedUrl ? (
                                    <iframe 
                                        src={embedUrl}
                                        className={`${styles.miniVideoIframe} ${isVideoLoading ? styles.hidden : ''}`}
                                        onLoad={handleVideoLoad}
                                        allow="autoplay; encrypted-media; picture-in-picture"
                                        allowFullScreen
                                        title={recipe.title}
                                        style={{ border: 'none', background: '#000' }}
                                    />
                                ) : isPlayed && (
                                    <div 
                                        className={`${styles.miniVideo} ${isVideoLoading ? styles.hidden : ''}`}
                                        dangerouslySetInnerHTML={{ __html: cleanHtml }} 
                                    />
                                )}
                                <button 
                                    className={styles.closeVideoBtn} 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleToggleVideo();
                                    }}
                                >✕</button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>

            <div className={styles.content}>
                <h3 className={styles.title}>{recipe.title}</h3>
                <p className={styles.description}>{recipe.description}</p>
                <div className={styles.meta}>
                    <span className={styles.time}>⏱️ {(recipe.prepTime || 0) + (recipe.cookTime || 0)}min</span>
                    <span
                        className={styles.difficulty}
                        style={{ color: difficultyColors[recipe.difficulty] || '#999' }}
                    >
                        {recipe.difficulty ? recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1) : '?'}
                    </span>
                </div>
            </div>
        </Link>
    );
}
