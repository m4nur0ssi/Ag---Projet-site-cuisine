'use client';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Header from '@/mobile/components/Header/Header';
import MagicFilterBar from '@/mobile/components/MagicFilterBar/MagicFilterBar';
import FavoriteButton from '@/mobile/components/FavoriteButton/FavoriteButton';
import ShareButton from '@/mobile/components/ShareButton/ShareButton';
import VoteButton from '@/mobile/components/VoteButton/VoteButton';
import VideoSection from '@/mobile/components/VideoSection/VideoSection';
import { Recipe } from '@/mobile/types';
import { scaleQuantity } from '@/mobile/lib/utils';
import { useLocalStorage } from '@/mobile/hooks/useLocalStorage';
import { useAuth } from '@/mobile/hooks/useAuth';
import { useTimer } from '@/mobile/components/Timer/TimerContext';
import { parseDuration, stripHtml } from '@/mobile/lib/timer-utils';
import SmartText from '@/mobile/components/SmartText/SmartText';
import MagicConverter from '@/mobile/components/MagicConverter/MagicConverter';
import PortionsControl from '@/components/PortionsControl/PortionsControl';
import DifficultyMeter from '@/components/DifficultyMeter/DifficultyMeter';
import SplitTitle from '@/mobile/components/SplitTitle/SplitTitle';
import { getIngredientVisual, translateIngredientName } from '@/mobile/lib/ingredient-utils';
import StarRating from '@/mobile/components/StarRating/StarRating';
import { estimateRecipeCalories } from '@/mobile/lib/calories';
import { motion, AnimatePresence } from 'framer-motion';
import { mockRecipes } from '@/mobile/data/mockData';
import styles from './page.module.css';

interface RecipeClientProps {
    recipe: Recipe;
    prevId?: string | null;
    nextId?: string | null;
}

type TabId = 'ingredients' | 'steps' | 'video';

export default function RecipeClient({ recipe, prevId, nextId }: RecipeClientProps) {
    const { startTimer } = useTimer();
    const { user: authUser } = useAuth();
    const [servings, setServings] = useState(recipe.servings || 4);
    const [focusMode, setFocusMode] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [isListening, setIsListening] = useState(false);

    const router = useRouter();

    // Pull-to-close + swipe horizontal — tout en manipulation directe DOM (zéro re-render)
    const pageRef = useRef<HTMLDivElement>(null);
    const dragYRef = useRef(0);
    const isDraggingSheet = useRef(false);

    // Preview cards pour le swipe entre recettes
    const nextPreviewRef = useRef<HTMLDivElement>(null);
    const prevPreviewRef = useRef<HTMLDivElement>(null);

    // Recettes prev/next (pour les cartes preview)
    const nextRecipeData = useMemo(() =>
        nextId ? mockRecipes.find(r => String(r.id) === String(nextId)) || null : null
    , [nextId]);
    const prevRecipeData = useMemo(() =>
        prevId ? mockRecipes.find(r => String(r.id) === String(prevId)) || null : null
    , [prevId]);

    // Tabs
    const availableTabs: { id: TabId; label: string; count?: number }[] = [
        { id: 'ingredients', label: 'Ingrédients', count: recipe?.ingredients?.length || 0 },
        { id: 'steps', label: 'Étapes', count: recipe?.steps?.length || 0 },
        ...(recipe?.videoHtml ? [{ id: 'video' as TabId, label: 'Vidéo' }] : []),
    ];

    // Default to 'steps' if no ingredients (restaurant), else 'ingredients'
    const defaultTab: TabId = recipe.category === 'restaurant' ? 'steps' : 'ingredients';
    const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
    const [prevTab, setPrevTab] = useState<TabId | null>(null);
    const tabContentRef = useRef<HTMLDivElement>(null);

    // Dynamic Colors based on category
    const theme = useMemo(() => {
        const categories: Record<string, { accent: string; glow: string; bg: string; rgb: string }> = {
            aperitifs: { accent: '#10b981', glow: '0 0 20px rgba(16, 185, 129, 0.4)', bg: 'rgba(16, 185, 129, 0.1)', rgb: '16, 185, 129' },
            plats: { accent: '#f43f5e', glow: '0 0 20px rgba(244, 63, 94, 0.4)', bg: 'rgba(244, 63, 94, 0.1)', rgb: '244, 63, 94' },
            desserts: { accent: '#d946ef', glow: '0 0 20px rgba(217, 70, 239, 0.4)', bg: 'rgba(217, 70, 239, 0.1)', rgb: '217, 70, 239' },
            patisserie: { accent: '#f59e0b', glow: '0 0 20px rgba(245, 158, 11, 0.4)', bg: 'rgba(245, 158, 11, 0.1)', rgb: '245, 158, 11' },
            vegetarien: { accent: '#22c55e', glow: '0 0 20px rgba(34, 197, 94, 0.4)', bg: 'rgba(34, 197, 94, 0.1)', rgb: '34, 197, 94' },
            restaurant: { accent: '#3b82f6', glow: '0 0 20px rgba(59, 130, 246, 0.4)', bg: 'rgba(59, 130, 246, 0.1)', rgb: '59, 130, 246' },
        };
        return categories[recipe.category] || categories.plats;
    }, [recipe.category]);

    // Persistence
    const [checkedSteps, setCheckedSteps] = useLocalStorage<boolean[]>(`recipe-steps-${recipe.id}`, new Array(recipe?.steps?.length || 0).fill(false));
    const [checkedIngredients, setCheckedIngredients] = useLocalStorage<boolean[]>(`recipe-ing-v2-${recipe.id}`, new Array(recipe?.ingredients?.length || 0).fill(false));

    // Reset logic
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const exitKey = `recipe-exit-${recipe.id}`;
            const lastExit = localStorage.getItem(exitKey);
            const RESET_DELAY = 5 * 60 * 60 * 1000;

            if (lastExit) {
                const timeSinceExit = Date.now() - parseInt(lastExit);
                if (timeSinceExit > RESET_DELAY) {
                    setCheckedSteps(new Array(recipe?.steps?.length || 0).fill(false));
                    setCheckedIngredients(new Array(recipe?.ingredients?.length || 0).fill(false));
                }
            }
            return () => localStorage.setItem(exitKey, Date.now().toString());
        }
    }, [recipe.id]);

    // Listener pour le reset du chrono (X cliqué ou fin du temps)
    useEffect(() => {
        const handleReset = (e: any) => {
            if (String(e.detail?.recipeId) === String(recipe.id)) {
                setCheckedSteps(new Array(recipe?.steps?.length || 0).fill(false));
                setCheckedIngredients(new Array(recipe?.ingredients?.length || 0).fill(false));
                if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([10, 30, 10]);
            }
        };
        window.addEventListener('timerReset', handleReset);
        return () => window.removeEventListener('timerReset', handleReset);
    }, [recipe.id, recipe.steps?.length, recipe.ingredients?.length, setCheckedSteps, setCheckedIngredients]);

    const ratio = useMemo(() => servings / (recipe.servings || 4), [servings, recipe.servings]);

    // Note personnelle
    const [personalNote, setPersonalNote] = useLocalStorage<string>(`recipe-note-${recipe.id}`, '');
    const [noteExpanded, setNoteExpanded] = useState(false);

    // Estimation calorique
    const calorieEstimate = useMemo(() =>
        recipe.category !== 'restaurant' && recipe.ingredients?.length > 0
            ? estimateRecipeCalories(recipe.ingredients, servings)
            : null,
    [recipe, servings]);

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 50);
        setServings(recipe.servings || 4);
        return () => clearTimeout(t);
    }, [recipe.id, recipe.servings]);

    useEffect(() => {
        if (recipe.category) {
            const event = new CustomEvent('magic-category-change', { detail: recipe.category });
            window.dispatchEvent(event);
        }
    }, [recipe.category]);

    // Track last-viewed recipe for BottomNav mini mode
    useEffect(() => {
        if (typeof window !== 'undefined' && recipe.id) {
            try {
                localStorage.setItem('magic-last-viewed', JSON.stringify({
                    id: recipe.id,
                    title: recipe.title,
                    image: recipe.image || '',
                }));
                window.dispatchEvent(new Event('recipeViewed'));
            } catch {}
        }
    }, [recipe.id, recipe.title, recipe.image]);

    useEffect(() => {
        let wakeLock: any = null;
        const requestWakeLock = async () => {
            try { if ('wakeLock' in navigator) wakeLock = await (navigator as any).wakeLock.request('screen'); }
            catch (err) {}
        };
        requestWakeLock();
        return () => { if (wakeLock !== null) wakeLock.release(); };
    }, []);

    const triggerHaptic = () => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
    };

    const DISMISS_THRESHOLD = 110;

    // ── DOM helpers pour pull-to-close (vertical)
    const applyDragDOM = (damped: number) => {
        if (!pageRef.current) return;
        const el = pageRef.current;
        el.style.transform = `translateY(${damped}px) scale(${Math.max(0.96, 1 - damped * 0.0006)})`;
        el.style.opacity = String(Math.max(0.72, 1 - damped * 0.0025));
        el.style.borderRadius = damped > 10 ? `${Math.min(damped * 0.25, 28)}px` : '';
        el.style.transition = 'none';
    };

    const resetDragDOM = () => {
        if (!pageRef.current) return;
        const el = pageRef.current;
        el.style.transform = '';
        el.style.opacity = '';
        el.style.borderRadius = '';
        el.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease';
    };

    // ── Native touch listeners — iOS-style finger-driven swipe entre recettes
    useEffect(() => {
        const el = pageRef.current;
        if (!el) return;

        type GestureType = 'none' | 'horizontal' | 'vertical-close' | 'scroll';
        let startX = 0, startY = 0;
        let gestureType: GestureType = 'none';
        let deltaX = 0;
        let vw = 0;

        const resetPreviews = (instant = false) => {
            const t = instant ? 'none' : 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)';
            if (nextPreviewRef.current) {
                nextPreviewRef.current.style.transition = t;
                nextPreviewRef.current.style.transform = `translateX(${window.innerWidth}px)`;
            }
            if (prevPreviewRef.current) {
                prevPreviewRef.current.style.transition = t;
                prevPreviewRef.current.style.transform = `translateX(${-window.innerWidth}px)`;
            }
        };

        const onStart = (e: TouchEvent) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            deltaX = 0;
            gestureType = 'none';
            vw = window.innerWidth;
            // Position previews off-screen instantly
            resetPreviews(true);
        };

        const onMove = (e: TouchEvent) => {
            const cx = e.touches[0].clientX;
            const cy = e.touches[0].clientY;
            const dx = cx - startX;
            const dy = cy - startY;

            // Determine gesture type after minimum movement
            if (gestureType === 'none') {
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
                if (Math.abs(dx) > Math.abs(dy) * 1.4) {
                    const canLeft = dx < 0 && !!nextId;
                    const canRight = dx > 0 && !!prevId;
                    gestureType = (canLeft || canRight) ? 'horizontal' : 'scroll';
                } else if (dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.4 && window.scrollY === 0) {
                    gestureType = 'vertical-close';
                } else {
                    gestureType = 'scroll';
                }
            }

            if (gestureType === 'horizontal') {
                e.preventDefault();
                // Resistance when no recipe in that direction
                let eff = dx;
                if (dx < 0 && !nextId) eff = dx * 0.15;
                if (dx > 0 && !prevId) eff = dx * 0.15;
                deltaX = eff;

                el.style.transition = 'none';
                el.style.transform = `translateX(${eff}px)`;

                // Move the relevant preview card into view
                if (eff < 0 && nextPreviewRef.current) {
                    nextPreviewRef.current.style.transition = 'none';
                    nextPreviewRef.current.style.transform = `translateX(${vw + eff}px)`;
                } else if (eff > 0 && prevPreviewRef.current) {
                    prevPreviewRef.current.style.transition = 'none';
                    prevPreviewRef.current.style.transform = `translateX(${-vw + eff}px)`;
                }
            } else if (gestureType === 'vertical-close') {
                if (dy > 0) {
                    isDraggingSheet.current = true;
                    const damped = Math.pow(dy, 0.75) * 2.8;
                    dragYRef.current = damped;
                    applyDragDOM(damped);
                }
            }
        };

        const onEnd = () => {
            const type = gestureType;
            gestureType = 'none';

            if (type === 'horizontal') {
                const threshold = vw * 0.32;

                if (deltaX < -threshold && nextId) {
                    // Complete swipe → next recipe
                    // Slide current page off — new page appears instantly at x:0 via swipe-no-entry
                    // (no preview-card-to-center animation, avoids layout mismatch visual jump)
                    triggerHaptic();
                    el.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                    el.style.transform = `translateX(${-vw}px)`;
                    setTimeout(() => {
                        try {
                            // Window global first (synchronous, survives concurrent rendering)
                            (window as any).__swipeNoEntry = true;
                            sessionStorage.setItem('swipe-no-entry', '1');
                        } catch {}
                        router.push(`/recipe/${nextId}`);
                    }, 180);

                } else if (deltaX > threshold && prevId) {
                    // Complete swipe → prev recipe
                    triggerHaptic();
                    el.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                    el.style.transform = `translateX(${vw}px)`;
                    setTimeout(() => {
                        try {
                            (window as any).__swipeNoEntry = true;
                            sessionStorage.setItem('swipe-no-entry', '1');
                        } catch {}
                        router.push(`/recipe/${prevId}`);
                    }, 180);

                } else {
                    // Snap back — retire le style inline pour restaurer le scroll iOS
                    el.style.transition = 'none';
                    el.style.transform = '';
                    resetPreviews(true);
                }

            } else if (type === 'vertical-close') {
                isDraggingSheet.current = false;
                if (dragYRef.current >= DISMISS_THRESHOLD) {
                    triggerHaptic();
                    router.back();
                } else {
                    dragYRef.current = 0;
                    resetDragDOM();
                }
            }
        };

        el.addEventListener('touchstart', onStart, { passive: true });
        el.addEventListener('touchmove', onMove, { passive: false }); // non-passive pour preventDefault
        el.addEventListener('touchend', onEnd, { passive: true });

        return () => {
            el.removeEventListener('touchstart', onStart);
            el.removeEventListener('touchmove', onMove);
            el.removeEventListener('touchend', onEnd);
        };
    }, [nextId, prevId, recipe.id, router]);

    const switchTab = (tab: TabId) => {
        setPrevTab(activeTab);
        setActiveTab(tab);
        // On remonte un peu pour voir le début du contenu si on est déjà descendu
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const toggleStep = (index: number) => {
        const newChecked = [...checkedSteps];
        newChecked[index] = !newChecked[index];
        setCheckedSteps(newChecked);
        triggerHaptic();
        if (newChecked[index]) {
            const minutes = parseDuration(recipe.steps[index]);
            if (minutes) startTimer(minutes, stripHtml(recipe.steps[index]).substring(0, 50), recipe.id);
        }
    };

    const toggleIngredient = (index: number) => {
        const newChecked = [...checkedIngredients];
        newChecked[index] = !newChecked[index];
        setCheckedIngredients(newChecked);
        triggerHaptic();
    };

    const copyIngredients = async () => {
        const selected = recipe.ingredients
            .filter((_, idx) => checkedIngredients[idx])
            .map(ing => `- ${scaleQuantity(ing.quantity || ing.name, ratio)} ${ing.quantity ? ing.name : ''}`);
        
        if (selected.length === 0) return alert('Sélectionnez des ingrédients !');
        
        const fullText = `🛒 ${recipe.title}\n\n${selected.join('\n')}`;
        await navigator.clipboard.writeText(fullText);
        
        const existing = JSON.parse(localStorage.getItem('magic-shopping-list') || '{}');
        existing[recipe.id] = { title: recipe.title, ingredients: selected.map(n => ({ name: n, checked: false })) };
        localStorage.setItem('magic-shopping-list', JSON.stringify(existing));
        window.dispatchEvent(new Event('shoppingListUpdated'));
        triggerHaptic();
    };

    const speak = (text: string) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(stripHtml(text));
        utterance.lang = 'fr-FR';
        utterance.onstart = () => { setIsListening(false); };
        utterance.onend = () => { if (focusMode) setTimeout(startRecognition, 300); };
        window.speechSynthesis.speak(utterance);
    };

    const recognitionRef = useRef<any>(null);
    const startRecognition = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition || !focusMode) return;
        const recognition = new SpeechRecognition();
        recognition.lang = 'fr-FR';
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => { setIsListening(false); if (focusMode) setTimeout(startRecognition, 300); };
        recognition.onresult = (e: any) => {
            const transcript = e.results[e.results.length - 1][0].transcript.toLowerCase();
            if (/suivant|prochain/.test(transcript)) handleNextStep();
            else if (/précédent|retour/.test(transcript)) handlePrevStep();
            else if (/répète/.test(transcript)) speak(recipe.steps[activeStepIndex]);
        };
        recognition.start();
        recognitionRef.current = recognition;
    }, [focusMode, activeStepIndex]);

    const handleNextStep = () => {
        if (activeStepIndex < recipe.steps.length - 1) setActiveStepIndex(activeStepIndex + 1);
        else setFocusMode(false);
    };

    const handlePrevStep = () => { if (activeStepIndex > 0) setActiveStepIndex(activeStepIndex - 1); };

    useEffect(() => {
        if (focusMode) { speak(recipe.steps[activeStepIndex]); startRecognition(); }
        return () => { window.speechSynthesis.cancel(); if (recognitionRef.current) recognitionRef.current.stop(); };
    }, [focusMode, activeStepIndex, startRecognition]);

    const progress = (checkedSteps.filter(Boolean).length / (recipe?.steps?.length || 1)) * 100;

    const countryFlags: Record<string, string> = { france: '🇫🇷', italie: '🇮🇹', espagne: '🇪🇸', grece: '🇬🇷', liban: '🇱🇧', usa: '🇺🇸', mexique: '🇲🇽', orient: '🕌', autre: '🗺️' };
    const recipeCountryTag = recipe.tags?.find(t => countryFlags[t.toLowerCase()]);
    const flag = recipeCountryTag ? countryFlags[recipeCountryTag.toLowerCase()] : null;

    return (
        <>
            {/* Preview cards pour le swipe — toujours présentes mais hors écran */}
            <div
                ref={nextPreviewRef}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 0,
                    pointerEvents: 'none',
                    transform: `translateX(${typeof window !== 'undefined' ? window.innerWidth : 9999}px)`,
                    willChange: 'transform',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundImage: nextRecipeData?.image ? `url(${nextRecipeData.image})` : 'none',
                    background: nextRecipeData?.image ? undefined : '#1c1c1e',
                }}
            >
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
                {nextRecipeData && (
                    <div style={{ position: 'absolute', bottom: 120, left: 24, right: 24, color: '#fff', fontSize: 22, fontWeight: 900, lineHeight: 1.2, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
                        {nextRecipeData.title}
                    </div>
                )}
            </div>
            <div
                ref={prevPreviewRef}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 0,
                    pointerEvents: 'none',
                    transform: `translateX(${typeof window !== 'undefined' ? -window.innerWidth : -9999}px)`,
                    willChange: 'transform',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundImage: prevRecipeData?.image ? `url(${prevRecipeData.image})` : 'none',
                    background: prevRecipeData?.image ? undefined : '#1c1c1e',
                }}
            >
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
                {prevRecipeData && (
                    <div style={{ position: 'absolute', bottom: 120, left: 24, right: 24, color: '#fff', fontSize: 22, fontWeight: 900, lineHeight: 1.2, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
                        {prevRecipeData.title}
                    </div>
                )}
            </div>

            {!focusMode && (
                <div className={styles.stickyHeaderMenu}>
                    <Header title={recipe.title} showBack={false} backUrl={`/category/${recipe.category}`} large={true} recipeId={recipe.id} />
                    <MagicFilterBar activeTags={recipe.tags || []} onSelect={(tag) => router.push(tag === '' ? '/' : `/?tag=${tag}`)} />
                </div>
            )}
            <div
                ref={pageRef}
                className={`${styles.page} ${mounted ? styles.pageVisible : ''}`}
                style={{
                    '--dynamic-accent': theme.accent,
                    '--dynamic-accent-glow': theme.glow,
                    '--dynamic-accent-bg': theme.bg,
                    '--dynamic-accent-rgb': theme.rgb,
                    position: 'relative',
                    zIndex: 1,
                } as any}
            >
                <div className={styles.heroNewLayout}>
                    <div className={styles.heroGrid}>
                        <div className={styles.heroTextColumn}>
                            <div className={styles.categoryCommandCenter}>
                                <FavoriteButton recipeId={recipe.id} initialFavorite={recipe.isFavorite} imageUrl={recipe.image} className={styles['favorite-btn-action']} />
                                <div className={styles.categoryTag} style={{ background: theme.bg, color: theme.accent } as any}>
                                    <span>{recipe.category.toUpperCase()}</span>
                                    {flag && <span className={styles.categoryFlag}>{flag}</span>}
                                </div>
                                <ShareButton title={recipe.title} url={typeof window !== 'undefined' ? window.location.href : ''} className={styles['share-btn-action']} />
                            </div>
                            <div className={styles.heroMainContent}>
                                <h1 className={styles.heroTitleElegant}><SplitTitle text={recipe.title} noAnimation={true} /></h1>
                                {recipe.description && <div className={styles.heroDescription} dangerouslySetInnerHTML={{ __html: recipe.description }} />}
                            </div>
                            {recipe.category !== 'restaurant' && recipe.steps.length > 0 && (
                                <button className={styles.heroFocusBtn} onClick={() => { setFocusMode(true); triggerHaptic(); }}>
                                    <span>Lancer la préparation</span>
                                </button>
                            )}
                        </div>
                        <div className={styles.heroImageColumn}>
                            <div className={styles.imageCardContainer}>
                                {recipe.image ? <Image src={recipe.image} alt={recipe.title} fill className={styles.imageMain} priority /> : <div className={styles.imagePlaceholderLarge}>🍽️</div>}
                                <div className={styles.imageGlassOverlay} />
                                <div className={styles.flameOverlay}>
                                    <VoteButton recipeId={recipe.id} initialVotes={recipe.votes || 0} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.metaStrip}>
                    <div className={styles.metaItem}>
                        <span>{recipe.category === 'restaurant' ? '📍' : '👥'}</span>
                        <div>
                            <div className={styles.metaLabel}>{recipe.category === 'restaurant' ? 'Lieu' : 'Portions'}</div>
                            <div className={styles.metaValue}>{recipe.category === 'restaurant' ? (recipe.address || 'À découvrir') : servings}</div>
                        </div>
                    </div>
                    <div className={styles.metaDivider} />
                    <div className={styles.metaItem}>
                        <span>{recipe.category === 'restaurant' ? '💰' : '⭐'}</span>
                        <div>
                            <div className={styles.metaLabel}>{recipe.category === 'restaurant' ? 'Gamme' : 'Difficulté'}</div>
                            <div className={styles.metaValue}>{recipe.category === 'restaurant' ? 'Restaurant' : (
                                <DifficultyMeter prepTime={recipe.prepTime} cookTime={recipe.cookTime} steps={recipe.steps?.length} difficulty={recipe.difficulty} showCaption={false} />
                            )}</div>
                        </div>
                    </div>
                    {recipe.category !== 'restaurant' && recipe.prepTime > 0 && (
                        <>
                            <div className={styles.metaDivider} />
                            <div className={styles.metaItem}>
                                <span>🔪</span>
                                <div>
                                    <div className={styles.metaLabel}>Préparation</div>
                                    <div className={styles.metaValue}>{recipe.prepTime} min</div>
                                </div>
                            </div>
                        </>
                    )}
                    {recipe.category !== 'restaurant' && recipe.cookTime > 0 && (
                        <>
                            <div className={styles.metaDivider} />
                            <div className={styles.metaItem}>
                                <span>🍳</span>
                                <div>
                                    <div className={styles.metaLabel}>Cuisson</div>
                                    <div className={styles.metaValue}>{recipe.cookTime} min</div>
                                </div>
                            </div>
                        </>
                    )}
                    {recipe.category !== 'restaurant' && (
                        <>
                            <div className={styles.metaDivider} />
                            <div className={styles.metaItem}>
                                <span>⭐</span>
                                <div>
                                    <div className={styles.metaLabel}>{authUser ? 'Ma note' : 'Note'}</div>
                                    <StarRating recipeId={recipe.id} size="small" />
                                </div>
                            </div>
                        </>
                    )}
                    {calorieEstimate && calorieEstimate.confidence !== 'low' && (
                        <>
                            <div className={styles.metaDivider} />
                            <div className={styles.metaItem}>
                                <span>🔥</span>
                                <div>
                                    <div className={styles.metaLabel}>~Calories</div>
                                    <div className={styles.metaValue}>{calorieEstimate.perServing} kcal<span style={{ fontSize: '0.7rem', opacity: 0.5 }}>/pers.</span></div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {recipe.category === 'restaurant' && (
                    <div className={styles.practicalInfoSection}>
                        <div className={styles.addressCard}>
                            <span className={styles.metallicLabel}>ADRESSE POSTALE</span>
                            <div className={styles.addressDisplay}>
                                <div className={styles.addressIconWrap}>📍</div>
                                <div className={styles.addressValueLarge}>{recipe.address}</div>
                            </div>
                        </div>
                        {recipe.ingredients && (
                            <div className={styles.servicesGrid}>
                                {recipe.ingredients.map((s, i) => (
                                    <div key={i} className={styles.serviceCard}>✨ {s.name}</div>
                                ))}
                            </div>
                        )}
                        <div className={styles.actionButtonsGrid}>
                            <a href={`https://maps.google.com/?q=${encodeURIComponent(recipe.address || '')}`} target="_blank" className={styles.primaryActionBtn}>Google Maps</a>
                            <a href={`http://maps.apple.com/?q=${encodeURIComponent(recipe.address || '')}`} target="_blank" className={styles.primaryActionBtn}>Apple Plans</a>
                            {recipe.website && <a href={recipe.website} target="_blank" className={styles.primaryActionBtn}>Site Officiel</a>}
                        </div>
                    </div>
                )}

                {recipe.category !== 'restaurant' && (
                    <div className={styles.tabsWrapper}>
                        <div className={styles.tabsBar}>
                            {availableTabs.map(tab => (
                                <button key={tab.id} onClick={() => switchTab(tab.id)} className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}>
                                    {tab.label} {tab.count !== undefined && <span className={styles.tabCount}>{tab.count}</span>}
                                </button>
                            ))}
                        </div>
                        <div className={styles.tabContent} ref={tabContentRef}>
                            {activeTab === 'ingredients' && (
                                <div className={styles.ingredientsGrid}>
                                    {recipe.ingredients.map((ing, i) => {
                                        const visual = ing.image || getIngredientVisual(ing.name);
                                        const displayName = translateIngredientName(ing.name);
                                        const displayQty = translateIngredientName(scaleQuantity(ing.quantity || '', ratio));
                                        return (
                                            <div key={i} className={`${styles.ingredientCard} ${checkedIngredients[i] ? styles.ingredientDone : ''}`} onClick={() => toggleIngredient(i)}>
                                                <div className={styles.ingIconWrap}>
                                                    <IngredientImg src={visual} name={ing.name} />
                                                </div>
                                                <div className={styles.ingInfo}>
                                                    <span className={styles.ingQty}>{displayQty}</span>
                                                    <span className={styles.ingName}>{displayName}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div className={styles.converterCentered}>
                                        <PortionsControl value={servings} base={recipe.servings || 4} onChange={setServings} compact />
                                        <MagicConverter />
                                    </div>
                                </div>
                            )}
                            {activeTab === 'steps' && (
                                <div className={styles.stepsList}>
                                    {recipe.steps.map((step, i) => (
                                        <div key={i} className={`${styles.stepCard} ${checkedSteps[i] ? styles.stepDone : ''}`} onClick={() => toggleStep(i)}>
                                            <div className={styles.stepBubble}>{checkedSteps[i] ? '✓' : i + 1}</div>
                                            <div className={styles.stepBody}><SmartText text={step} /></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {activeTab === 'video' && recipe.videoHtml && <VideoSection videoHtml={recipe.videoHtml} />}
                        </div>
                    </div>
                )}
            </div>

            {/* Note personnelle */}
            {!focusMode && (
                <div style={{ padding: '12px 20px 20px' }}>
                    <button
                        onClick={() => setNoteExpanded(v => !v)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '14px 18px', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'left' }}
                    >
                        <span>{personalNote ? 'Ma note' : 'Ajouter une note'}</span>
                        {personalNote && <span style={{ flex: 1, fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{personalNote.slice(0, 35)}{personalNote.length > 35 ? '…' : ''}</span>}
                        <span style={{ fontSize: '0.7rem', opacity: 0.5, marginLeft: 'auto' }}>{noteExpanded ? '▲' : '▼'}</span>
                    </button>
                    {noteExpanded && (
                        <textarea
                            style={{ width: '100%', marginTop: 10, padding: 16, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.92rem', lineHeight: 1.6, resize: 'vertical', minHeight: 100, boxSizing: 'border-box' }}
                            placeholder="Ex: j'ai ajouté du citron, c'était meilleur !"
                            value={personalNote}
                            onChange={e => setPersonalNote(e.target.value)}
                            rows={4}
                            autoFocus
                        />
                    )}
                </div>
            )}

            <AnimatePresence>
                {focusMode && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={styles.focusOverlay} style={{ '--dynamic-accent': theme.accent } as any}>
                        <div className={styles.focusHeader}>
                            <h2 className={styles.focusTitle}>{recipe.title}</h2>
                            <button onClick={() => setFocusMode(false)}>Quitter</button>
                        </div>
                        <div className={styles.focusContent}>
                            <div className={styles.focusStepCard}>
                                <div className={styles.focusStepNumber}>Étape {activeStepIndex + 1}</div>
                                <div className={styles.focusStepText}><SmartText text={recipe.steps[activeStepIndex]} /></div>
                            </div>
                        </div>
                        <div className={styles.focusHud}>
                            <button onClick={handlePrevStep} disabled={activeStepIndex === 0}>Précédent</button>
                            <button onClick={() => speak(recipe.steps[activeStepIndex])}>Répéter</button>
                            <button onClick={handleNextStep}>Suivant</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

/**
 * Affiche une image d'ingrédient avec fallback emoji si erreur
 */
function IngredientImg({ src, name }: { src: string | null; name: string }) {
    const [errored, setErrored] = useState(false);

    // Pick a smart fallback emoji based on the name
    const fallbackEmoji = (() => {
        const n = (name || '').toLowerCase();
        if (n.includes('miel') || n.includes('honey')) return '🍯';
        if (n.includes('poivron') || n.includes('pepper bell')) return '🫑';
        if (n.includes('herbe') || n.includes('aneth') || n.includes('basilic') || n.includes('basil') || n.includes('persil') || n.includes('parsley')) return '🌿';
        if (n.includes('fromage') || n.includes('cheese') || n.includes('mascarpone') || n.includes('feta') || n.includes('comté')) return '🧀';
        if (n.includes('viande') || n.includes('boeuf') || n.includes('beef') || n.includes('steak') || n.includes('rumsteck') || n.includes('bavette')) return '🥩';
        if (n.includes('poulet') || n.includes('chicken')) return '🍗';
        if (n.includes('poisson') || n.includes('saumon') || n.includes('salmon') || n.includes('thon') || n.includes('tuna')) return '🐟';
        if (n.includes('fruit') || n.includes('pomme') || n.includes('apple')) return '🍎';
        if (n.includes('fraise') || n.includes('strawberry')) return '🍓';
        if (n.includes('citron') || n.includes('lemon')) return '🍋';
        if (n.includes('orange')) return '🍊';
        if (n.includes('chocolat') || n.includes('chocolate')) return '🍫';
        if (n.includes('cake') || n.includes('gâteau') || n.includes('pâtisserie')) return '🍰';
        if (n.includes('oeuf') || n.includes('œuf') || n.includes('egg')) return '🥚';
        if (n.includes('lait') || n.includes('milk')) return '🥛';
        if (n.includes('sucre') || n.includes('sugar') || n.includes('cassonade')) return '🍬';
        if (n.includes('sel') || n.includes('salt') || n.includes('poivre')) return '🧂';
        if (n.includes('beurre') || n.includes('butter')) return '🧈';
        if (n.includes('huile') || n.includes('oil')) return '🫒';
        if (n.includes('vanille') || n.includes('vanilla')) return '🌼';
        if (n.includes('farine') || n.includes('flour')) return '🌾';
        if (n.includes('crème') || n.includes('cream')) return '🍦';
        if (n.includes('vin') || n.includes('wine')) return '🍷';
        if (n.includes('colorant') || n.includes('coloring') || n.includes('couleur')) return '🎨';
        if (n.includes('pistache') || n.includes('pistachio') || n.includes('noix') || n.includes('amande') || n.includes('nut')) return '🥜';
        if (n.includes('riz') || n.includes('rice')) return '🍚';
        if (n.includes('pâte') || n.includes('pasta')) return '🍝';
        if (n.includes('pain') || n.includes('bread')) return '🍞';
        if (n.includes('ail') || n.includes('garlic')) return '🧄';
        if (n.includes('oignon') || n.includes('onion')) return '🧅';
        if (n.includes('tomate') || n.includes('tomato')) return '🍅';
        if (n.includes('carotte') || n.includes('carrot')) return '🥕';
        if (n.includes('salade') || n.includes('lettuce') || n.includes('épinard') || n.includes('spinach')) return '🥬';
        if (n.includes('vinaigre') || n.includes('vinegar') || n.includes('sauce')) return '🥫';
        return '🥗';
    })();

    if (!src || errored) {
        return <span style={{ fontSize: '2.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>{fallbackEmoji}</span>;
    }

    return (
        <img
            src={src}
            alt=""
            className={styles.ingImg}
            onError={() => setErrored(true)}
        />
    );
}
