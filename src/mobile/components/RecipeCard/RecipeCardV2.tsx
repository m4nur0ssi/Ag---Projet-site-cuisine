'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Recipe } from '@/mobile/types';
import FavoriteButton from '@/mobile/components/FavoriteButton/FavoriteButton';
import ShareButton from '@/mobile/components/ShareButton/ShareButton';
import VoteButton from '@/mobile/components/VoteButton/VoteButton';
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

export default function RecipeCard({ recipe, activeTags = [] }: RecipeCardProps) {
    const [showVideo, setShowVideo] = useState(false);
    const [isVideoLoading, setIsVideoLoading] = useState(true);
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    const [isPlayed, setIsPlayed] = useState(false);
    const videoRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const categoryGlows: Record<string, string> = {
        aperitifs: 'rgba(16, 185, 129, 0.4)',
        plats: 'rgba(244, 63, 94, 0.4)',
        desserts: 'rgba(217, 70, 239, 0.4)',
        patisserie: 'rgba(245, 158, 11, 0.4)',
        vegetarien: 'rgba(34, 197, 94, 0.4)',
        restaurant: 'rgba(59, 130, 246, 0.4)',
    };

    const difficultyColors: Record<string, string> = {
        facile: '#10b981',
        moyen: '#f59e0b',
        difficile: '#ef4444'
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

    useEffect(() => {
        setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }, []);

    // Aggressive Autoplay Strategy: TikTok player v1 is often better for autoplay
    const videoIdMatch = recipe.videoHtml?.match(/data-video-id="(\d+)"/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    
    // We use player/v1 which is more "video only" and respects autoplay+muted better
    const embedUrl = videoId ? `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&muted=1&controls=0&loop=1` : null;

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
        const meatKeywords = ['viande', 'porc', 'boeuf', 'bœuf', 'poulet', 'agneau', 'veau', 'steak', 'lardons', 'bacon', 'charcuterie', 'chorizo', 'viandard', 'jambon', 'salami', 'merguez', 'saucisse', 'canard', 'dinde', 'pepperoni', 'pancetta', 'cochon', 'guanciale'];
        const tags = (recipe.tags || []).map(t => t.toLowerCase());
        const title = recipe.title.toLowerCase();
        
        const hasMeat = tags.some(t => meatKeywords.some(m => t.includes(m))) || meatKeywords.some(m => title.includes(m));
        const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
        
        const list: { id: string; name: string }[] = [];
        
        // 1. Priorité aux tags stricts demandés
        if (!hasMeat && (tags.some(t => t.includes('végé') || t.includes('veget')) || recipe.category === 'vegetarien')) {
            list.push({ id: 'vege', name: 'Végé' });
        }

        if (totalTime > 0 && totalTime <= 30) {
            list.push({ id: 'express', name: 'Express' });
        }

        // 2. Compléter si on a moins de 2 hashtags
        if (list.length < 2) {
            const others = [
                { id: 'airfryer', name: 'Airfryer', match: ['airfryer'] },
                { id: 'famille', name: 'Famille', match: ['famille', 'enfant', 'kids'] },
                { id: 'healthy', name: 'Healthy', match: ['healthy', 'léger', 'light'] },
                { id: 'epice', name: 'Epicé', match: ['épicé', 'spicy'] },
            ];
            
            for (const other of others) {
                if (list.length >= 2) break;
                if (list.some(l => l.id === other.id)) continue;
                if (tags.some(t => other.match.some(m => t.includes(m)))) {
                    list.push({ id: other.id, name: other.name });
                }
            }
        }
        
        return list.slice(0, 2);
    }, [recipe]); 

    const handleCardClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        
        // 1. Skip if clicking specialized action buttons or specific buttons/links
        if (
            target.closest(`.${styles.topActions}`) || 
            target.closest(`.${styles.persistentVote}`) ||
            target.closest('button') ||
            target.closest('a')
        ) {
            return;
        }

        // 2. If clicking on the image area, handle video/navigation logic
        if (target.closest(`.${styles.imageContainer}`)) {
            if (isTouchDevice && recipe.videoHtml) {
                handleToggleVideo();
            } else {
                router.push(`/recipe/${recipe.id}`);
            }
            return;
        }

        // 3. Fallback for clicking anywhere else on the card (like the gap between text)
        router.push(`/recipe/${recipe.id}`);
    };

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

    const countryFlags: Record<string, string> = {
        france: '🇫🇷', italie: '🇮🇹', espagne: '🇪🇸', grece: '🇬🇷', 
        liban: '🇱🇧', usa: '🇺🇸', mexique: '🇲🇽', orient: '🕌',
        maroc: '🇲🇦', japon: '🇯🇵', autre: '🗺️'
    };
    
    const countries = ['france', 'italie', 'espagne', 'grece', 'liban', 'usa', 'mexique', 'orient', 'maroc', 'japon'];
    
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
        <div 
            className={`${styles.card} ${showVideo ? styles.cardWithVideo : ''}`}
            data-recipe-id={recipe.id}
            style={{ '--glow-color': categoryGlows[recipe.category] || 'rgba(127, 13, 242, 0.4)' } as React.CSSProperties}
            onClick={handleCardClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
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

                                <div className={styles.badges}>
                                    {recipeHashtags.map((has: { id: string; name: string }) => (
                                        <div 
                                            key={has.id} 
                                            className={`${styles.badge} ${styles[`badge_${has.id}`] || ''}`}
                                        >
                                            <span className={styles.badgeLabel}>#{has.name.toUpperCase()}</span>
                                        </div>
                                    ))}
                                </div>
                                
                                {recipe.videoHtml && (
                                    <div 
                                        className={`${styles.playOverlay} ${isTouchDevice ? styles.touchDevice : ''}`}
                                        onClick={(e) => {
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
                                onClick={(e) => e.stopPropagation()}
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
                                <button className={styles.closeVideoBtn} onClick={handleToggleVideo}>✕</button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* NEW ACTION WELL DESIGN 2026 */}
                    <div className={styles.actionWell} onClick={(e) => e.stopPropagation()}>
                        <ShareButton 
                            url={`${typeof window !== 'undefined' ? window.location.origin : ''}/recipe/${recipe.id}`}
                            title={recipe.title}
                            className={styles.wellBtn}
                        />
                        <div className={styles.wellDivider} />
                        <VoteButton 
                            recipeId={recipe.id}
                            initialVotes={recipe.votes || 0}
                            className={styles.wellVote}
                        />
                        <div className={styles.wellDivider} />
                        <FavoriteButton
                            recipeId={recipe.id}
                            initialFavorite={recipe.isFavorite}
                            imageUrl={recipe.image}
                            className={styles.wellBtn}
                        />
                    </div>
                </motion.div>
            </div>

            <Link href={`/recipe/${recipe.id}`} className={styles.contentLink}>
                <div className={styles.content}>
                    <h3 className={styles.title}>{recipe.title}</h3>
                    
                    <div className={styles.subHeader}>
                        {flag && <span className={styles.inlineFlag}>{flag}</span>}
                        <span className={styles.inlineTime}>⏱️ {(recipe.prepTime || 0) + (recipe.cookTime || 0)}min</span>
                        <div className={styles.dotSeparator} />
                        <span
                            className={styles.inlineDifficulty}
                            style={{ color: difficultyColors[recipe.difficulty] || '#999' }}
                        >
                            {recipe.difficulty ? recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1) : '?'}
                        </span>
                    </div>

                    <p className={styles.description}>{recipe.description}</p>
                </div>
            </Link>
        </div>
    );
}
