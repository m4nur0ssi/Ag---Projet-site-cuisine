'use client';

import { useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { motion, useScroll } from 'framer-motion';
import Link from 'next/link';
import { Recipe } from '@/mobile/types';
import RecipeCardiOS26 from '@/mobile/components/RecipeCard/RecipeCardiOS26';
import styles from './RecipeCarousel.module.css';

interface RecipeCarouselProps {
    recipes: Recipe[];
    title?: string;
    size?: 'large' | 'small';
    compact?: boolean; // true = section "Thématiques du Moment" avec tuiles petites
    hideTitleCard?: boolean; // Pour éviter les doublons avec les tuiles du haut
    onTitleClick?: (title: string) => void;
    onCardClick?: (recipe: Recipe) => void;
}

export default function RecipeCarousel({ recipes, title = "Nouvelles Recettes ✨", size = 'large', compact = false, hideTitleCard = false, onTitleClick, onCardClick }: RecipeCarouselProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset scroll à 0 au montage
    useLayoutEffect(() => {
        if (containerRef.current) containerRef.current.scrollLeft = 0;
    }, []);
    useEffect(() => {
        const t = setTimeout(() => { if (containerRef.current) containerRef.current.scrollLeft = 0; }, 80);
        return () => clearTimeout(t);
    }, []);

    // Broadcast quand CE carousel est scrollé → les autres se remettent à 0
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onHScroll = () => {
            if (el.scrollLeft > 10) window.dispatchEvent(new CustomEvent('carousel-active', { detail: title }));
        };
        el.addEventListener('scroll', onHScroll, { passive: true });
        return () => el.removeEventListener('scroll', onHScroll);
    }, [title]);

    // Quand UN AUTRE carousel est actif → reset celui-ci
    useEffect(() => {
        const onOtherActive = (e: Event) => {
            const activeTitle = (e as CustomEvent).detail;
            if (activeTitle !== title && containerRef.current) containerRef.current.scrollLeft = 0;
        };
        window.addEventListener('carousel-active', onOtherActive);
        return () => window.removeEventListener('carousel-active', onOtherActive);
    }, [title]);

    // En mode compact, on affiche TOUT (pas de limite, sinon "Resto" au position 21 est coupé)
    // En mode normal, on limite à 15 recettes + une carte "Voir Tout"
    const limitedRecipes = useMemo(() => compact ? recipes : recipes.slice(0, 15), [recipes, compact]);
    const category = limitedRecipes[0]?.category || 'all';

    const getCategoryGradient = (cat: string) => {
        const clean = cat.trim().toLowerCase();
        if (clean.includes('apéritif') || clean.includes('aperitif') || clean.includes('apéro')) return 'linear-gradient(135deg, #FF7E5F, #feb47b)';
        if (clean.includes('entrée') || clean.includes('entree')) return 'linear-gradient(135deg, #76B852, #8DC26F)';
        if (clean.includes('plat')) return 'linear-gradient(135deg, #8E2DE2, #4A00E0)';
        if (clean.includes('accompagnement')) return 'linear-gradient(135deg, #00C853, #69F0AE)';
        if (clean.includes('dessert')) return 'linear-gradient(135deg, #F80759, #BC4E9C)';
        if (clean.includes('pâtisserie') || clean.includes('patisserie')) return 'linear-gradient(135deg, #FFB347, #FF7B00)';
        if (clean.includes('thématique') || clean.includes('nouveauté')) return 'linear-gradient(135deg, #4facfe, #00f2fe)';
        if (clean.includes('pâques')) return 'linear-gradient(135deg, #F59E0B, #FFCC33)';
        return 'linear-gradient(135deg, #111111, #333333)';
    };

    const cardGradient = getCategoryGradient(title);

    return (
        <section className={`${styles.section} ${compact ? styles.compactSection : ''} ${size === 'small' ? styles.smallSection : ''}`}>
            <div className={styles.scrollContainer} ref={containerRef}>
                <div className={styles.track}>
                    {/* Première carte : Le Titre de la Thématique (uniquement en mode normal et si non masqué) */}
                    {!compact && !hideTitleCard && (
                        <CategoryTitleCard 
                            title={title} 
                            gradient={cardGradient} 
                            size={size}
                            compact={compact}
                            onClick={() => onTitleClick?.(title)}
                        />
                    )}

                    {limitedRecipes.map((recipe, index) => (
                        <CarouselItem 
                            key={recipe.id} 
                            recipe={recipe} 
                            index={index} 
                            containerRef={containerRef}
                            size={size}
                            compact={compact}
                            parentTitle={title}
                            onCardClick={onCardClick}
                            allRecipes={limitedRecipes}
                        />
                    ))}

                    {/* Carte finale "Voir Tout" */}
                    {recipes.length > 15 && (
                         <ViewAllItem 
                            category={category}
                            containerRef={containerRef}
                            size={size}
                            compact={compact}
                         />
                    )}
                </div>
            </div>
            
            <div className={styles.glassFloor} />
        </section>
    );
}

const getCategoryData = (t: string) => {
    const c = t.toLowerCase();
    if (c.includes('apéritif') || c.includes('aperitif') || c.includes('apéro')) return { image: '/images/categories/aperitif-theme.png', color: '#FF6B35' };
    if (c.includes('entrée') || c.includes('entree')) return { image: '/images/categories/entree-theme.png', color: '#2DD4BF' };
    if (c.includes('plat')) return { image: '/images/categories/plats-theme.png', color: '#6D28D9' };
    if (c.includes('dessert') || c.includes('douceur')) return { image: '/images/categories/desserts-theme.png', color: '#EC4899' };
    if (c.includes('pâtisserie') || c.includes('patisserie')) return { image: '/images/categories/patisserie-theme.png', color: '#A78BFA' };
    if (c.includes('restaurant') || c.includes('resto')) return { image: '/images/categories/restaurants.jpg', color: '#8b5cf6' };
    if (c.includes('thématiq') || t.includes('Thématiq')) return { image: '/images/categories/thematiques.jpg', color: '#4f46e5' };
    if (c.includes('nouveauté') || c.includes('nouv')) return { image: '/images/categories/nouveautes-theme.png', color: '#F97316' };
    if (c.includes('accompagnement')) return { image: '/images/categories/accompagnements-theme.png', color: '#84CC16' };
    if (c.includes('pâtes') || c.includes('pates') || c.includes('pasta')) return { image: '/images/themes/pates.jpg', color: '#FF8C00' };
    if (c.includes('healthy') || c.includes('sain')) return { image: '/images/categories/entree.jpg', color: '#22c55e' };
    if (c.includes('airfryer')) return { image: '/images/categories/plats.jpg', color: '#f97316' };
    if (c.includes('barbecue') || c.includes('bbq')) return { image: '/images/categories/plats.jpg', color: '#b91c1c' };
    if (c.includes('pas cher')) return { image: '/images/categories/aperitif.jpg', color: '#eab308' };
    if (c.includes('express') || c.includes('rapide')) return { image: '/images/categories/entree.jpg', color: '#3b82f6' };
    if (c.includes('famille')) return { image: '/images/categories/plats.jpg', color: '#ec4899' };
    if (c.includes('pâques')) return { image: '/images/categories/desserts.jpg', color: '#F59E0B' };
    if (c.includes('noël')) return { image: '/images/categories/plats.jpg', color: '#10b981' };
    return { image: '/images/categories/patisserie.jpg', color: '#f59e0b' };
};

// ─── CategoryTitleCard ─────────────────────────────────────────────────────────

function CategoryTitleCard({ title, gradient, size, compact, onClick }: { title: string, gradient: string, size: 'large' | 'small', compact?: boolean, onClick?: () => void }) {
    const cleanTitle = title.trim().toUpperCase();
    const isLongTitle = cleanTitle.length > 12;
    const { image, color } = getCategoryData(title);

    // Mode compact (section "Thématiques du Moment") : tuile petite horizontale
    if (compact) {
        // Pour les thématiques, on utilise les illustrations de catégorie pour la cohérence si c'est une image de thème
        const displayImage = image.includes('themes/') ? getCategoryData(title).image : image;
        
        return (
            <div className={styles.compactItem}>
                <div className={styles.compactCard} onClick={onClick}>
                    <img src={`${displayImage}?v=2`} alt={title} className={styles.compactImage} />
                </div>
            </div>
        );
    }

    // Mode normal
    return (
        <div className={`${styles.itemWrapper} ${size === 'small' ? styles.itemSmall : styles.itemLarge}`}>
            <div 
                className={`${styles.titleCard} ${onClick ? styles.clickable : ''} ${styles.withOffset}`}
                onClick={onClick}
                style={{ '--category-color': color } as React.CSSProperties}
            >
                <div className={styles.fullBleedIcon}>
                    <img src={image} alt={title} className={styles.mainTitleIcon} />
                </div>
                <div className={styles.floatingBanner}>
                    <h2 className={`${styles.categoryMainTitle} ${isLongTitle ? styles.longTitle : ''}`}>
                        {cleanTitle}
                    </h2>
                    <div className={styles.titleSeparator} />
                </div>
            </div>
        </div>
    );
}

// ─── CarouselItem ──────────────────────────────────────────────────────────────

function CarouselItem({ recipe, index, containerRef, size, compact, parentTitle, onCardClick, allRecipes }: { recipe: Recipe, index: number, containerRef: React.RefObject<HTMLDivElement>, size: 'large' | 'small', compact?: boolean, parentTitle?: string, onCardClick?: (recipe: Recipe) => void, allRecipes: Recipe[] }) {
    const itemRef = useRef<HTMLDivElement>(null);
    const { scrollXProgress } = useScroll({ target: itemRef, container: containerRef, offset: ["start end", "end start"] });

    // Mode compact : toutes les tuiles de la section "Thématiques" sont petites
    if (compact) {
        // En mode compact, on utilise l'image fournie par la recette (illustration thématique)
        const displayImage = recipe.image || getCategoryData(recipe.title).image;

        return (
            <div ref={itemRef} className={styles.compactItem}>
                <div className={styles.compactCard} onClick={() => onCardClick?.(recipe)}>
                    <img
                        src={`${displayImage}${displayImage.includes('?') ? '&' : '?'}v=6`}
                        alt={recipe.title}
                        className={styles.compactImage}
                    />
                </div>
            </div>
        );
    }

    // Mode normal : carte recette pleine hauteur
    const getRecipeGradient = (pTitle: string) => {
        const clean = pTitle.replace(/[^\w\s]/gi, '').trim().toLowerCase();
        switch (clean) {
            case 'thématiques du moment':
            case 'les thématiques du moment': return 'linear-gradient(90deg, #10b981, #3b82f6)';
            case 'les nouveautés': return 'linear-gradient(90deg, #10b981, #3b82f6)';
            case 'nouveautés spéciales pâques':
            case 'spécial pâques': return 'linear-gradient(90deg, #F59E0B, #FFCC33)';
            case 'coups de cœur simplissimes': return 'linear-gradient(90deg, #4facfe, #00f2fe)';
            case 'apéro gourmand': return 'linear-gradient(90deg, #F59E0B, #EA580C)';
            case 'entrées fraîches': return 'linear-gradient(90deg, #10B981, #059669)';
            case 'plats de chef': return 'linear-gradient(90deg, #3B82F6, #4F46E5)';
            case 'douceurs sucrées': return 'linear-gradient(90deg, #EC4899, #9333EA)';
            default: return undefined;
        }
    };

    const customGradient = parentTitle ? getRecipeGradient(parentTitle) : undefined;

    return (
        <motion.div
            ref={itemRef}
            className={`${styles.itemWrapper} ${size === 'small' ? styles.itemSmall : styles.itemLarge}`}
            style={{ opacity: 1 }}
        >
            <RecipeCardiOS26 
                recipe={recipe} 
                size={size} 
                customGradient={customGradient} 
                customOnClick={onCardClick ? () => onCardClick(recipe) : undefined}
                allRecipes={allRecipes}
                recipeIndex={index}
            />
        </motion.div>
    );
}

// ─── ViewAllItem ───────────────────────────────────────────────────────────────

function ViewAllItem({ category, containerRef, size, compact }: { category: string, containerRef: React.RefObject<HTMLDivElement>, size: 'large' | 'small', compact?: boolean }) {
    const itemRef = useRef<HTMLDivElement>(null);

    if (compact) {
        return (
            <div ref={itemRef} className={styles.compactItem}>
                <Link href={`/category/${category}`} className={styles.compactCard}>
                    <div className={styles.viewAllCompactContent}>
                        <h3 className={styles.compactTitle}>VOIR TOUT</h3>
                    </div>
                </Link>
            </div>
        );
    }

    return (
        <motion.div
            ref={itemRef}
            className={`${styles.itemWrapper} ${size === 'small' ? styles.itemSmall : styles.itemLarge}`}
        >
            <Link href={`/category/${category}`} className={styles.viewAllCard}>
                <div className={styles.viewAllContent}>
                    <h3 className={styles.viewAllText}>VOIR TOUT</h3>
                    <div className={styles.viewAllGlass} />
                </div>
            </Link>
        </motion.div>
    );
}
