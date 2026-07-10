'use client';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Image from 'next/image';
import Header from '@/mobile/components/Header/Header';
import MagicFilterBar from '@/mobile/components/MagicFilterBar/MagicFilterBar';
import FavoriteButton from '@/mobile/components/FavoriteButton/FavoriteButton';
import ShareButton from '@/mobile/components/ShareButton/ShareButton';
import VoteButton from '@/mobile/components/VoteButton/VoteButtonSheet';
import VideoSection from '@/mobile/components/VideoSection/VideoSection';
import CreatorCard from '@/components/CreatorCard/CreatorCard';
import { Recipe } from '@/mobile/types';
import { scaleQuantity } from '@/mobile/lib/utils';
import { useLocalStorage } from '@/mobile/hooks/useLocalStorage';
import { useTimer } from '@/mobile/components/Timer/TimerContext';
import { parseDuration, stripHtml } from '@/mobile/lib/timer-utils';
import { decodeHtml } from '@/mobile/lib/utils';
import SmartText from '@/mobile/components/SmartText/SmartText';
import MagicConverter from '@/mobile/components/MagicConverter/MagicConverter';
import PortionsControl from '@/components/PortionsControl/PortionsControl';
import DifficultyMeter from '@/components/DifficultyMeter/DifficultyMeter';
import WinePairing from '@/components/WinePairing/WinePairing';
import SplitTitle from '@/mobile/components/SplitTitle/SplitTitle';
import { getIngredientVisual, translateIngredientName } from '@/mobile/lib/ingredient-utils';
import StarRating from '@/mobile/components/StarRating/StarRating';
import RestaurantGallery from '@/components/RestaurantGallery/RestaurantGallery';
import CommentSection from '@/mobile/components/CommentSection/CommentSection';
import CookingJournal from '@/components/CookingJournal/CookingJournal';
import { estimateRecipeCalories } from '@/mobile/lib/calories';
import { mockRecipes } from '@/mobile/data/mockData';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './RecipeDetails.module.css';

interface RecipeDetailsProps {
    recipe: Recipe;
    prevId?: string | null;
    nextId?: string | null;
    isModal?: boolean;
}

type TabId = 'ingredients' | 'steps' | 'video';

export default function RecipeDetails({ recipe, prevId, nextId, isModal = false }: RecipeDetailsProps) {
    const { startTimer } = useTimer();
    const [servings, setServings] = useState(recipe.servings || 4);
    const [focusMode, setFocusMode] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [isListening, setIsListening] = useState(false);

    // Swipe navigation state
    const router = useRouter();
    const { user: authUser } = useAuth();
    const touchStart = useRef<{ x: number, y: number } | null>(null);
    const touchEnd = useRef<{ x: number, y: number } | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [slideDirection, setSlideDirection] = useState<'left'|'right'|null>(null);
    const pageRef = useRef<HTMLDivElement>(null);

    // Toast notification pour le panier
    const [toast, setToast] = useState<string | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const showToast = (msg: string) => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast(msg);
        toastTimer.current = setTimeout(() => setToast(null), 2200);
    };

    // Tabs
    const availableTabs: { id: TabId; label: string; count?: number }[] = [
        { id: 'ingredients', label: 'Ingrédients', count: recipe?.ingredients?.length ?? 0 },
        { id: 'steps', label: 'Étapes', count: recipe?.steps?.length ?? 0 },
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
    // Par défaut, rien n'est coché pour la liste de courses (Selection unique demandée par le client)
    const [checkedIngredients, setCheckedIngredients] = useLocalStorage<boolean[]>(`recipe-ing-v2-${recipe.id}`, new Array(recipe?.ingredients?.length || 0).fill(false));

    // Logic d'auto-reset après 5h d'absence (Mémoire Courte Design 2026)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const exitKey = `recipe-exit-${recipe.id}`;
            const lastExit = localStorage.getItem(exitKey);
            const RESET_DELAY = 5 * 60 * 60 * 1000; // 5 heures

            if (lastExit) {
                const timeSinceExit = Date.now() - parseInt(lastExit);
                if (timeSinceExit > RESET_DELAY) {
                    // On force le reset des données
                    setCheckedSteps(new Array(recipe?.steps?.length || 0).fill(false));
                    setCheckedIngredients(new Array(recipe?.ingredients?.length || 0).fill(false));
                }
            }

            // Enregistre l'heure de sortie
            return () => {
                localStorage.setItem(exitKey, Date.now().toString());
            };
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

    const calorieEstimate = useMemo(() =>
        recipe.category !== 'restaurant' && recipe.ingredients?.length > 0
            ? estimateRecipeCalories(recipe.ingredients, servings)
            : null,
    [recipe, servings]);

    const similarRecipes = useMemo(() => {
        // Fiche restaurant → « Autres restaurants ».
        if (recipe.category === 'restaurant') {
            return mockRecipes
                .filter(r => String(r.id) !== String(recipe.id) && r.category === 'restaurant')
                .map(r => {
                    let score = 1;
                    if (r.restaurant?.subType && r.restaurant.subType === recipe.restaurant?.subType) score += 3;
                    const rTags = (r.tags || []).map(t => t.toLowerCase());
                    const myTags = (recipe.tags || []).map(t => t.toLowerCase());
                    score += rTags.filter(t => myTags.includes(t)).length * 2;
                    return { recipe: r, score };
                })
                .sort((a, b) => b.score - a.score)
                .slice(0, 12)
                .map(({ recipe: r }) => r);
        }
        return mockRecipes
            .filter(r => String(r.id) !== String(recipe.id) && r.category !== 'restaurant')
            .map(r => {
                let score = 0;
                if (r.category === recipe.category) score += 3;
                const rTags = (r.tags || []).map(t => t.toLowerCase());
                const myTags = (recipe.tags || []).map(t => t.toLowerCase());
                score += rTags.filter(t => myTags.includes(t)).length * 2;
                const myIngNames = (recipe.ingredients || []).map(i => i.name.toLowerCase());
                const rIngNames = (r.ingredients || []).map(i => i.name.toLowerCase());
                score += myIngNames.filter(n => rIngNames.some(rn => rn.includes(n) || n.includes(rn))).length;
                return { recipe: r, score };
            })
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 12)
            .map(({ recipe: r }) => r);
    }, [recipe]);

    // Navigation resto suivant/précédent (swipe hors photo).
    const restoNav = useMemo(() => {
        if (recipe.category !== 'restaurant') return null;
        const list = mockRecipes.filter(r => r.category === 'restaurant');
        const idx = list.findIndex(r => String(r.id) === String(recipe.id));
        if (idx < 0 || list.length < 2) return null;
        return { next: list[(idx + 1) % list.length], prev: list[(idx - 1 + list.length) % list.length] };
    }, [recipe]);
    const openResto = (r: any) => window.dispatchEvent(new CustomEvent('openRecipe', { detail: r }));

    // Sauvegarder dans l'historique
    useEffect(() => {
        try {
            const prev: string[] = JSON.parse(localStorage.getItem('recently-viewed') || '[]').map((r: any) => r.id || r);
            const updated = [String(recipe.id), ...prev.filter(id => id !== String(recipe.id))].slice(0, 20);
            localStorage.setItem('recently-viewed', JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('recentlyViewedUpdated'));
        } catch {}
    }, [recipe.id]);

    // Mount animation & Reset check
    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 50);
        // Réinitialisation des portions quand on change de recette (swipe)
        setServings(recipe.servings || 4); 
        return () => clearTimeout(t);
    }, [recipe.id, recipe.servings]);

    const formatDuration = (totalMinutes: number) => {
        if (!totalMinutes) return '';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        if (hours > 0) {
            return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
        }
        return `${totalMinutes} min`;
    };

    // Synchronisation de la couleur du dock au montage
    useEffect(() => {
        if (recipe.category) {
            const event = new CustomEvent('magic-category-change', { detail: recipe.category });
            window.dispatchEvent(event);
        }
    }, [recipe.category]);

    // Wake Lock
    useEffect(() => {
        let wakeLock: any = null;
        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await (navigator as any).wakeLock.request('screen');
                }
            } catch (err: any) {
                console.error(`${err.name}, ${err.message}`);
            }
        };

        requestWakeLock();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                requestWakeLock();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        if (typeof window !== 'undefined') {
            window.localStorage.setItem('active-recipe-id', recipe.id);
            
            const lastViewedData = {
                id: recipe.id,
                title: recipe.title,
                image: recipe.image,
                category: recipe.category
            };
            window.localStorage.setItem('magic-last-viewed', JSON.stringify(lastViewedData));
            window.dispatchEvent(new CustomEvent('recipeViewed', { detail: lastViewedData }));
            
            // Sync initial state with shopping list
            const syncWithShoppingList = () => {
                const listData = JSON.parse(window.localStorage.getItem('magic-shopping-list') || '{}');
                if (!listData[recipe.id]) {
                    // Si la recette n'est plus dans la liste, on décoche tout (demande client)
                    setCheckedIngredients(new Array(recipe.ingredients.length).fill(false));
                }
            };
            
            syncWithShoppingList();
            window.addEventListener('shoppingListUpdated', syncWithShoppingList);
            return () => {
                window.removeEventListener('shoppingListUpdated', syncWithShoppingList);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                if (wakeLock !== null) wakeLock.release();
            };
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (wakeLock !== null) wakeLock.release();
        };
    }, [recipe.id]);

    const triggerHaptic = () => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(10);
        }
    };

    const minSwipeDistance = 60;
    const maxVerticalDiff = 35;

    const onTouchStart = (e: React.TouchEvent) => {
        touchEnd.current = null;
        touchStart.current = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };
    };

    // onTouchMove est géré via un listener natif passif (useEffect ci-dessous)
    // pour ne jamais bloquer le scroll natif du navigateur

    const onTouchEnd = () => {
        if (!touchStart.current || !touchEnd.current) return;

        const distanceX = touchStart.current.x - touchEnd.current.x;
        const distanceY = Math.abs(touchStart.current.y - touchEnd.current.y);

        if (distanceY > maxVerticalDiff || Math.abs(distanceX) < minSwipeDistance) return;

        const isLeftSwipe = distanceX > minSwipeDistance;
        const isRightSwipe = distanceX < -minSwipeDistance;

        if (isLeftSwipe && nextId) {
            triggerHaptic();
            setSlideDirection('left');
            setIsNavigating(true);
            setTimeout(() => router.push(`/recipe/${nextId}`), 250);
        } else if (isRightSwipe && prevId) {
            triggerHaptic();
            setSlideDirection('right');
            setIsNavigating(true);
            setTimeout(() => router.push(`/recipe/${prevId}`), 250);
        }
    };

    // Listener passif pour onTouchMove — ne bloque jamais le scroll natif
    useEffect(() => {
        const el = pageRef.current;
        if (!el) return;
        const handleMove = (e: TouchEvent) => {
            touchEnd.current = {
                x: e.targetTouches[0].clientX,
                y: e.targetTouches[0].clientY
            };
        };
        el.addEventListener('touchmove', handleMove, { passive: true });
        return () => el.removeEventListener('touchmove', handleMove);
    }, []);

    const switchTab = (tab: TabId) => {
        setPrevTab(activeTab);
        setActiveTab(tab);
        // Scroll to top of tab content
        if (tabContentRef.current) {
            tabContentRef.current.scrollTop = 0;
        }
    };

    const toggleStep = (index: number) => {
        // Sécurité mobile : si on a bougé de plus de 10px, on considère que c'est un scroll, pas un clic
        if (touchStart.current && touchEnd.current) {
            const dx = Math.abs(touchStart.current.x - touchEnd.current.x);
            const dy = Math.abs(touchStart.current.y - touchEnd.current.y);
            if (dx > 10 || dy > 10) return;
        }

        const newChecked = [...checkedSteps];
        newChecked[index] = !newChecked[index];
        setCheckedSteps(newChecked);
        triggerHaptic();

        if (typeof window !== 'undefined') {
            window.localStorage.setItem('active-recipe-id', recipe.id);
        }

        if (newChecked[index]) {
            const stepText = recipe.steps[index];
            const minutes = parseDuration(stepText);
            if (minutes) {
                const cleanLabel = stripHtml(stepText);
                const shortLabel = cleanLabel.length > 50
                    ? cleanLabel.substring(0, 47) + '...'
                    : cleanLabel;
                startTimer(minutes, shortLabel, recipe.id);
            }
        }
    };

    const toggleIngredient = (index: number) => {
        // Sécurité mobile : si on a bougé de plus de 10px → scroll, pas un clic
        if (touchStart.current && touchEnd.current) {
            const dx = Math.abs(touchStart.current.x - touchEnd.current.x);
            const dy = Math.abs(touchStart.current.y - touchEnd.current.y);
            if (dx > 10 || dy > 10) return;
        }

        // Liste de courses réservée aux connectés → propose la connexion, n'ajoute rien.
        if (!authUser) { window.dispatchEvent(new Event('magic-open-auth')); return; }

        const ing = recipe.ingredients[index];
        const newChecked = [...checkedIngredients];
        const isNowChecked = !newChecked[index];
        newChecked[index] = isNowChecked;
        setCheckedIngredients(newChecked);
        triggerHaptic();

        // Ajout / retrait direct du panier localStorage
        const cleanName = ing.name
            .replace(/^[\uD83C-􏰀-\uDFFF☀-➿\s]+/, '')
            .trim();
        const displayQty = ing.quantity ? scaleQuantity(ing.quantity, ratio) : '';
        const entry = `- ${displayQty ? displayQty + ' ' : ''}${cleanName}`.trim();

        if (typeof window !== 'undefined') {
            const cart = JSON.parse(window.localStorage.getItem('magic-shopping-list') || '{}');
            const recipeCart = cart[recipe.id] || { title: recipe.title, image: recipe.image, ingredients: [] };

            if (isNowChecked) {
                const alreadyIn = recipeCart.ingredients.some((i: any) => i.name === entry);
                if (!alreadyIn) recipeCart.ingredients.push({ name: entry, checked: false });
                showToast(`${cleanName} ajouté !`);
            } else {
                recipeCart.ingredients = recipeCart.ingredients.filter((i: any) => i.name !== entry);
            }

            if (recipeCart.ingredients.length > 0) {
                cart[recipe.id] = recipeCart;
            } else {
                delete cart[recipe.id];
            }

            window.localStorage.setItem('magic-shopping-list', JSON.stringify(cart));
            window.dispatchEvent(new Event('shoppingListUpdated'));
        }
    };

    const copyIngredients = async () => {
        // Liste de courses réservée aux connectés.
        if (!authUser) { window.dispatchEvent(new Event('magic-open-auth')); return; }
        try {
            const selectedIngredients = recipe.ingredients
                .filter((_, idx) => checkedIngredients[idx]) // On ne prend que les COCHÉS (demande client)
                .map(ing => {
                    if (ing.quantity) {
                        return `- ${scaleQuantity(ing.quantity, ratio)} ${ing.name.replace(/^[\uD83C-\uDBFF\uDC00-\uDFFF]+\s*/, '')}`;
                    } else {
                        // On nettoie l'émoji éventuel avant de scaler le nom complet
                        const cleanName = ing.name.replace(/^[\uD83C-\uDBFF\uDC00-\uDFFF]+\s*/, '');
                        return `- ${scaleQuantity(cleanName, ratio)}`;
                    }
                });

            if (selectedIngredients.length === 0) {
                alert('Veuillez cocher au moins un ingrédient à mettre dans votre panier ! 🛒');
                return;
            }

            const text = selectedIngredients.join('\n');
            const fullText = `🛒 Liste de courses : ${recipe.title}\n\n${text}`;

            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(fullText);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = fullText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }

            if (typeof window !== 'undefined') {
                const existingData = JSON.parse(window.localStorage.getItem('magic-shopping-list') || '{}');
                
                // On transforme les strings en objets pour gérer le "coché"
                const ingredientObjects = selectedIngredients.map(name => ({
                    name,
                    checked: false
                }));

                existingData[recipe.id] = {
                    title: recipe.title,
                    image: recipe.image,
                    ingredients: ingredientObjects
                };
                window.localStorage.setItem('magic-shopping-list', JSON.stringify(existingData));
                
                // Notifier le Header immédiatement
                window.dispatchEvent(new Event('shoppingListUpdated'));
                triggerHaptic();
            }
        } catch (err) {
            console.error('Erreur lors de la copie/ajout à la liste:', err);
            alert('Impossible de copier la liste automatiquement.');
        }
    };

    const difficultyColors = {
        facile: '#10b981',
        moyen: '#f59e0b',
        difficile: '#ef4444'
    };

    // Animation for progression
    const progress = useMemo(() => {
        const checkedCount = checkedSteps.filter(Boolean).length;
        return recipe.steps.length > 0 ? (checkedCount / recipe.steps.length) * 100 : 0;
    }, [checkedSteps, recipe.steps.length]);

    const isSpeakingRef = useRef(false);

    // iOS/Chrome : précharge la liste des voix (getVoices() est vide au 1er accès
    // tant que 'voiceschanged' n'a pas été émis) → 1er speak() a une voix FR dispo.
    useEffect(() => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.getVoices();
            window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };
        } catch (e) { /* noop */ }
    }, []);

    const speak = (text: string) => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(stripHtml(text));
            utterance.lang = 'fr-FR';
            utterance.rate = 1.0;
            // iOS : forcer une voix française si dispo (sinon l'utterance peut rester muet
            // tant que les voix ne sont pas chargées).
            try {
                const voices = window.speechSynthesis.getVoices();
                const frVoice = voices.find(v => (v.lang || '').toLowerCase().startsWith('fr'));
                if (frVoice) utterance.voice = frVoice;
            } catch (e) { /* noop */ }
            
            utterance.onstart = () => {
                isSpeakingRef.current = true;
                // On stoppe la reconnaissance pour éviter de se détecter soi-même
                if (recognitionRef.current) {
                    try { recognitionRef.current.stop(); } catch(e) {}
                }
                // Sécurité : si onend ne se déclenche jamais
                setTimeout(() => {
                    if (isSpeakingRef.current) {
                        isSpeakingRef.current = false;
                        if (focusMode) startRecognition();
                    }
                }, 8000);
            };
            
            utterance.onend = () => {
                isSpeakingRef.current = false;
                if (focusMode) {
                    setTimeout(startRecognition, 300);
                }
            };

            window.speechSynthesis.speak(utterance);
        }
    };

    const recognitionRef = useRef<any>(null);

    const handleNextStep = () => {
        if (!checkedSteps[activeStepIndex]) toggleStep(activeStepIndex);
        if (activeStepIndex < recipe.steps.length - 1) {
            const nextIdx = activeStepIndex + 1;
            setActiveStepIndex(nextIdx);
            
            // Lancer le timer de l'étape suivante si elle contient un temps
            const nextStep = recipe.steps[nextIdx];
            const minutes = parseDuration(nextStep);
            if (minutes) {
                const cleanLabel = stripHtml(nextStep);
                const shortLabel = cleanLabel.length > 50
                    ? cleanLabel.substring(0, 47) + '...'
                    : cleanLabel;
                startTimer(minutes, shortLabel, recipe.id);
            }
        } else {
            setFocusMode(false);
            if (typeof window !== 'undefined') {
                alert('Félicitations ! Recette terminée ! 🥂');
            }
        }
    };

    const handlePrevStep = () => {
        if (activeStepIndex > 0) {
            setActiveStepIndex(prev => prev - 1);
        }
    };

    const handleRepeatStep = () => {
        speak(recipe.steps[activeStepIndex]);
    };

    // Refs pour accéder aux handlers frais dans les closures de l'écoute vocale
    const handlersRef = useRef({ handleNextStep, handlePrevStep, handleRepeatStep });
    useEffect(() => {
        handlersRef.current = { handleNextStep, handlePrevStep, handleRepeatStep };
    }, [handleNextStep, handlePrevStep, handleRepeatStep]);

    // Voice recognition logic moved to stable scope
    const startRecognition = useCallback(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition && !recognitionRef.current && focusMode && !isSpeakingRef.current) {
                const recognition = new SpeechRecognition();
                recognition.lang = 'fr-FR';
                recognition.continuous = true;
                recognition.interimResults = false;
                
                recognition.onstart = () => {
                    setIsListening(true);
                    console.log('🎤 Micro activé');
                };
                recognition.onend = () => {
                    setIsListening(false);
                    recognitionRef.current = null;
                    if (focusMode && !isSpeakingRef.current) {
                        setTimeout(startRecognition, 250);
                    }
                };
                
                recognition.onresult = (event: any) => {
                    if (isSpeakingRef.current) return;

                    const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
                    console.log('🗣️ Commande reçue:', transcript);
                    
                    if (/suivant|prochain|allez|aller|go|on y va|prêt|c'est bon/.test(transcript)) {
                        handlersRef.current.handleNextStep();
                    } 
                    else if (/précédent|retour|avant|revenir|reviens/.test(transcript)) {
                        handlersRef.current.handlePrevStep();
                    } 
                    else if (/répète|répéter|encore|qu'est-ce|pardon|comment|redis/.test(transcript)) {
                        handlersRef.current.handleRepeatStep();
                    }
                    else if (/quitter|stop|terminer|fin|fermer/.test(transcript)) {
                        setFocusMode(false);
                    }
                };

                recognition.onerror = (err: any) => {
                    if (err.error !== 'no-speech' && err.error !== 'aborted') {
                        console.error('❌ Erreur Micro:', err.error);
                    }
                };
                
                try {
                    recognition.start();
                    recognitionRef.current = recognition;
                } catch (e) {
                    recognitionRef.current = null;
                }
            }
        }
    }, [focusMode]);

    // Voice recognition & TTS effect
    useEffect(() => {
        if (focusMode) {
            startRecognition();
        } else {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {}
                recognitionRef.current = null;
            }
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        }
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {}
                recognitionRef.current = null;
            }
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, [focusMode, startRecognition]);

    // Speak when changing step in focus mode
    useEffect(() => {
        if (focusMode) {
            speak(recipe.steps[activeStepIndex]);
        }
    }, [activeStepIndex]);

    const checkedCount = checkedIngredients.filter(Boolean).length;

    const countryFlags: Record<string, string> = {
        france: '🇫🇷', italie: '🇮🇹', espagne: '🇪🇸', grece: '🇬🇷', 
        liban: '🇱🇧', usa: '🇺🇸', mexique: '🇲🇽', orient: '🕌',
        autre: '🗺️'
    };

    const countryColors: Record<string, string> = {
        france: '#0055A4', italie: '#008C45', espagne: '#F1BF00', grece: '#005BAE',
        liban: '#EE161F', usa: '#3C3B6E', mexique: '#006847', orient: '#C1272D',
        autre: '#666666'
    };
    
    const recipeCountryTag = recipe.tags?.find(t => countryFlags[t.toLowerCase()]);
    const flag = recipeCountryTag ? countryFlags[recipeCountryTag.toLowerCase()] : null;
    const countryColor = recipeCountryTag ? countryColors[recipeCountryTag.toLowerCase()] : theme.accent;

    return (
        <>
            {!focusMode && !isModal && (
                <div className={styles.stickyHeaderMenu}>
                    <Header 
                        title={decodeHtml(recipe.title)} 
                        showBack={false} 
                        backUrl={`/category/${recipe.category}`}
                        large={true}
                        recipeId={recipe.id}
                    />
                    <MagicFilterBar 
                        activeTags={recipe.tags || []} 
                        onSelect={(tag: string) => {
                            if (tag === '') router.push('/');
                            else router.push(`/?tag=${tag}`);
                        }} 
                    />
                </div>
            )}
            {/* Toast panier */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        className={styles.toastCart}
                        initial={{ opacity: 0, y: 60, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    >
                        🛒 {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            <div
                ref={pageRef}
                className={`${styles.page} ${mounted ? styles.pageVisible : ''} ${isNavigating ? (slideDirection === 'left' ? styles.slideOutLeft : styles.slideOutRight) : ''} ${isModal ? styles.modalMode : ''}`}
                style={{
                    // @ts-ignore
                    '--dynamic-accent': theme.accent,
                    '--dynamic-accent-glow': theme.glow,
                    '--dynamic-accent-bg': theme.bg,
                    '--dynamic-accent-rgb': theme.rgb,
                    '--country-color': countryColor || theme.accent
                } as React.CSSProperties}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >

            {/* Nouveau Hero Split-Screen UX Premium */}
            <div className={styles.heroNewLayout}>
                <div className={styles.heroGrid} style={{ alignItems: 'center', zIndex: 2, gap: '20px' }}>
                    {/* Colonne GAUCHE : Blabla (Infos) */}
                    <motion.div
                        className={styles.heroTextColumn}
                        // En sheet (swipe entre recettes) : pas d'anim d'entrée → sinon "rebond" à chaque remontage.
                        initial={isModal ? false : { opacity: 0, x: -70 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={isModal ? { duration: 0 } : { duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {/* Barre d'action Catégorie Apple Style */}
                        <div className={styles.categoryCommandCenter}>
                            <div className={styles.commandSlot}>
                                <FavoriteButton
                                    recipeId={recipe.id}
                                    initialFavorite={recipe.isFavorite}
                                    imageUrl={recipe.image}
                                    className={styles['favorite-btn-action']}
                                    alwaysShow
                                />
                            </div>

                            <motion.div
                                className={styles.categoryTag} 
                                style={{ 
                                    background: theme.bg, 
                                    color: theme.accent,
                                    '--country-color': countryColor 
                                } as React.CSSProperties}
                            >
                                <span>
                                    {(() => {
                                        const tags = recipe.tags?.map(t => t.toLowerCase()) || [];
                                        if (recipe.category === 'vegetarien' || tags.some(t => t.includes('végé') || t.includes('vege') || t.includes('vegetarien'))) {
                                            return 'VÉGÉTARIEN';
                                        }
                                        return recipe.category === 'aperitifs' ? 'APÉRITIFS' : recipe.category.toUpperCase();
                                    })()}
                                </span>
                                {flag && <span className={styles.categoryFlag}>{flag}</span>}
                            </motion.div>

                            <ShareButton 
                                url={`${typeof window !== 'undefined' ? window.location.origin : ''}/recipe/${recipe.id}`} 
                                title={recipe.title} 
                                className={styles['share-btn-action']}
                            />
                        </div>

                        <div className={styles.heroMainContent}>
                            <h1 className={styles.heroTitleElegant}>
                                <SplitTitle text={decodeHtml(recipe.title)} noAnimation={true} />
                            </h1>
                            
                            {recipe.description && (
                                <div 
                                    className={styles.heroDescription}
                                    dangerouslySetInnerHTML={{ __html: decodeHtml(recipe.description) }}
                                />
                            )}
                        </div>

                        {/* Bouton Lancer cuisine dans le Hero pour mobile & desktop */}
                        {recipe.category !== 'restaurant' && recipe.steps.length > 0 && !focusMode && (
                            <button className={styles.heroFocusBtn} onClick={() => {
                                setFocusMode(true);
                                setActiveStepIndex(0);
                                triggerHaptic();
                                // Scroll auto vers le focus card (HUD)
                                window.scrollTo({ top: 0, behavior: 'smooth' });

                                // IMPORTANT iOS : speechSynthesis.speak() doit être appelé
                                // SYNCHRONEMENT dans le geste utilisateur pour débloquer le TTS.
                                // Un setTimeout casse la chaîne du geste → aucune voix.
                                speak(recipe.steps[0]);
                            }}>
                                <span className={styles.focusBtnIcon}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                                    </svg>
                                </span>
                                <span className={styles.focusBtnText}>Lancer la préparation</span>
                            </button>
                        )}
                    </motion.div>

                    {/* Colonne DROITE : Photo avec Actions interactives */}
                    <div className={styles.heroImageColumn}>
                        {(recipe.category === 'restaurant' && recipe.restaurant?.photos?.length) ? (
                            /* Restaurant : galerie swipeable = photo principale + miniatures */
                            <RestaurantGallery
                                photos={recipe.restaurant.photos}
                                alt={recipe.title}
                                onNextRestaurant={restoNav ? () => openResto(restoNav.next) : undefined}
                                onPrevRestaurant={restoNav ? () => openResto(restoNav.prev) : undefined}
                            />
                        ) : (
                        /* 1. Carte Image avec bouton Flamme superposé */
                        <div className={styles.imageCardContainer}>
                            {recipe.image ? (
                                <Image
                                    src={recipe.image}
                                    alt={recipe.title}
                                    fill
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 700px, 800px"
                                    className={styles.imageMain}
                                    style={{ objectFit: 'cover' }}
                                    priority={true}
                                />
                            ) : (
                                <div className={styles.imagePlaceholderLarge}>
                                    {recipe.category === 'aperitifs' ? '🍹' :
                                        recipe.category === 'desserts' ? '🍰' :
                                            recipe.category === 'plats' ? '🍲' : '🥗'}
                                </div>
                                )}
                            <div className={styles.imageGlassOverlay} />

                            {/* Superposition du bouton flamme (Vote) en haut à droite */}
                            <div className={styles.flameOverlay}>
                                <VoteButton
                                    recipeId={recipe.id}
                                    initialVotes={recipe.votes || 0}
                                />
                            </div>
                        </div>
                        )}

                        {/* 2. Hashtags centrés sous la photo */}
                        <div className={styles.detailsHashtags}>
                            {recipe.tags?.filter(t => !countryFlags[t.toLowerCase()]).slice(0, 3).map(tag => (
                                <span key={tag} className={styles.detailTag}>
                                    #{tag.toUpperCase()}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Meta Strip - Hidden for restaurants as they are not recipes */}
            {recipe.category !== 'restaurant' && (
                <div className={styles.metaStrip}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                        {/* Ligne 1 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                            <div className={styles.metaItem} style={{ flex: 1 }}>
                                <div className={styles.metaLabel}>PRÉPARATION</div>
                                <div className={styles.metaValue}>{recipe.prepTime || 15} min</div>
                            </div>
                            <div className={styles.metaSeparator} />
                            <div className={styles.metaItem} style={{ flex: 1 }}>
                                <div className={styles.metaLabel}>CUISSON</div>
                                <div className={styles.metaValue}>{recipe.cookTime || 20} min</div>
                            </div>
                            <div className={styles.metaSeparator} />
                            <div className={styles.metaItem} style={{ flex: 1 }}>
                                <div className={styles.metaLabel}>DIFFICULTÉ</div>
                                <div className={styles.metaValue}>
                                    <DifficultyMeter
                                        prepTime={recipe.prepTime}
                                        cookTime={recipe.cookTime}
                                        steps={recipe.steps?.length}
                                        difficulty={recipe.difficulty}
                                        showCaption={false}
                                    />
                                </div>
                            </div>
                        </div>
                        {/* Ligne 2 : Note + Calories réunis dans un seul cadre pleine largeur */}
                        <div className={styles.metaWideItem}>
                            <div className={styles.metaWideSection}>
                                <div className={styles.metaLabel}>{authUser ? 'MA NOTE' : 'NOTE'}</div>
                                <StarRating recipeId={recipe.id} size="small" />
                            </div>
                            {calorieEstimate && calorieEstimate.confidence !== 'low' && (
                                <div className={styles.metaWideSectionCal}>
                                    <div className={styles.metaLabel}>CALORIES</div>
                                    <div className={styles.metaValue}>{calorieEstimate.perServing} kcal<span style={{fontSize:'0.7rem',opacity:0.5}}>/pers.</span></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Enhanced UI pour restaurants: Badges, Adresse, Boutons Maps et Avis */}
            {recipe.category === 'restaurant' && (
                <div className={styles.restaurantContent}>
                    {/* ── Infos réelles vérifiées (fiche restaurant) ── */}
                    {recipe.restaurant && (() => {
                        const r = recipe.restaurant!;
                        return (
                            <>
                                <div className={styles.restoTiles}>
                                    {r.priceLevel && (
                                        <div className={styles.restoTile}>
                                            <span className={styles.restoTileValue}>
                                                {'€'.repeat(r.priceLevel)}<span className={styles.restoTileMuted}>{'€'.repeat(3 - r.priceLevel)}</span>
                                            </span>
                                            <span className={styles.restoTileLabel}>Prix moyen</span>
                                        </div>
                                    )}
                                    {typeof r.rating === 'number' && (
                                        <a className={`${styles.restoTile} ${styles.restoTileLink}`} href={r.tripAdvisorUrl || '#'} target="_blank" rel="noopener noreferrer">
                                            <span className={styles.restoTileValue}>{r.rating.toFixed(1)} ★</span>
                                            <span className={styles.restoTileLabel}>{r.reviewsCount ? `${r.reviewsCount} avis` : 'Tripadvisor'}</span>
                                        </a>
                                    )}
                                    {r.parking && (
                                        <div className={styles.restoTile}>
                                            <span className={styles.restoTileIcon}>🅿️</span>
                                            <span className={styles.restoTileValue}>Oui</span>
                                            <span className={styles.restoTileLabel}>Parking facile</span>
                                        </div>
                                    )}
                                    {r.terrace && (
                                        <div className={styles.restoTile}>
                                            <span className={styles.restoTileIcon}>☀️</span>
                                            <span className={styles.restoTileValue}>Oui</span>
                                            <span className={styles.restoTileLabel}>Terrasse</span>
                                        </div>
                                    )}
                                </div>

                                <div className={styles.restoCoords}>
                                    {r.phone && (
                                        <a className={styles.restoCoordRow} href={`tel:${r.phone.replace(/\s/g, '')}`}>
                                            <span className={styles.restoCoordIcon}>📞</span><span>{r.phone}</span>
                                        </a>
                                    )}
                                    {r.hours && (
                                        <div className={styles.restoCoordRow}>
                                            <span className={styles.restoCoordIcon}>🕒</span><span>{r.hours}</span>
                                        </div>
                                    )}
                                    {(r.address || recipe.address) && (
                                        <a className={styles.restoCoordRow} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address || recipe.address || recipe.title)}`} target="_blank" rel="noopener noreferrer">
                                            <span className={styles.restoCoordIcon}>📍</span><span>{r.address || recipe.address}</span>
                                        </a>
                                    )}
                                </div>

                                {/* La galerie photos est désormais la photo principale (en haut de la fiche). */}

                                {/* Note perso + globale (comme les recettes) */}
                                <div className={styles.restoRating}>
                                    <span className={styles.restoRatingLabel}>{authUser ? 'Ma note' : 'Note'}</span>
                                    <StarRating recipeId={recipe.id} size="small" />
                                </div>

                                <div className={styles.restoLinks}>
                                    {r.website && (
                                        <a className={styles.restoLinkBtn} href={r.website} target="_blank" rel="noopener noreferrer">Site officiel</a>
                                    )}
                                    {r.tripAdvisorUrl && (
                                        <a className={styles.restoLinkBtn} href={r.tripAdvisorUrl} target="_blank" rel="noopener noreferrer">Tripadvisor</a>
                                    )}
                                </div>

                                {/* Pilule « J'ai testé ce restaurant » + commentaire perso */}
                                <CookingJournal recipeId={recipe.id} variant="restaurant" />
                            </>
                        );
                    })()}

                    {/* Informations Pratiques - Style iOS 26 Pro - Adresse Upsized */}
                    {!recipe.restaurant && recipe.address && (
                        <div className={styles.addressDisplayLarge}>
                            <span className={styles.addressIconLarge}>📍</span>
                            <div className={styles.addressContent}>
                                <div className={styles.addressLabel}>ADRESSE</div>
                                <div className={styles.addressTextLarge}>
                                    {recipe.address}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Badges de services (ancien mode — seulement si pas d'infos structurées) */}
                    {!recipe.restaurant && (
                    <div className={styles.restaurantFeatures}>
                        {(() => {
                            const stepsText = recipe.steps.join(' ').toLowerCase();
                            const features = [];
                            if (stepsText.includes('parking')) features.push({ icon: '🚗', label: 'Parking' });
                            if (stepsText.includes('terrasse')) features.push({ icon: '☀️', label: 'Terrasse' });
                            if (stepsText.includes('match') || stepsText.includes('foot')) features.push({ icon: '⚽', label: 'Matchs Foot' });
                            if (stepsText.includes('pas cher')) features.push({ icon: '🏷️', label: '€' });
                            else if (stepsText.includes('cher')) features.push({ icon: '💰', label: '€€€' });
                            else features.push({ icon: '⚖️', label: '€€' });
                            
                            return features.map((f, i) => (
                                <div key={i} className={styles.featureBadge}>
                                    <span className={styles.featureIcon}>{f.icon}</span>
                                    <span>{f.label}</span>
                                </div>
                            ));
                        })()}
                    </div>
                    )}

                    {/* Boutons Maps / Plans / Website */}
                    <div className={styles.restaurantActions}>
                        <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(recipe.address || recipe.steps[2] || recipe.steps[3] || recipe.title)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.mapBtn} ${styles.googleMaps}`}
                        >
                            <svg className={styles.mapBtnIcon} viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                            <span>Google Maps</span>
                        </a>
                        <a 
                            href={`https://maps.apple.com/?q=${encodeURIComponent(recipe.address || recipe.steps[2] || recipe.steps[3] || recipe.title)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.mapBtn} ${styles.appleMaps}`}
                        >
                            <svg className={styles.mapBtnIcon} viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                            </svg>
                            <span>Apple Plans</span>
                        </a>
                        {recipe.website && (
                            <a 
                                href={recipe.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`${styles.mapBtn} ${styles.websiteBtn}`}
                            >
                                <svg className={styles.mapBtnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                </svg>
                                <span>Site Officiel</span>
                            </a>
                        )}
                    </div>

                    {/* Avis Google Section - iOS 26 Design (Fallback sur avis Joji si vide pour garder le design) */}
                    {recipe.category !== 'restaurant' && recipe.reviews && (
                        <div className={styles.reviewsSection}>
                            <div className={styles.sectionHeader}>
                                <h3 className={styles.sectionTitle}>Derniers avis Google</h3>
                                <div className={styles.overallRating}>
                                    <span className={styles.ratingValue}>4.9/5</span>
                                    <div className={styles.ratingStars}>
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <span key={s} style={{ color: 'var(--color-accent-gold)' }}>★</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            <div className={styles.reviewsList}>
                                {(recipe.reviews || [
                                    { "author": "Manu R.", "rating": 5, "content": "Une expérience incroyable, déco chaleureuse et service au top !", "date": "Il y a 2 jours" },
                                    { "author": "Sophie M.", "rating": 5, "content": "Le meilleur du quartier. Authentique et personnel aux petits soins.", "date": "Il y a 1 semaine" },
                                    { "author": "Thomas L.", "rating": 4, "content": "Très bonne cuisine. Un peu d'attente mais ça vaut le coup.", "date": "Il y a 2 semaines" }
                                ]).map((review, idx) => (
                                    <div key={idx} className={styles.reviewCard}>
                                        <div className={styles.reviewHeader}>
                                            <div className={styles.authorInfo}>
                                                <div className={styles.authorAvatar}>
                                                    {review.author[0]}
                                                </div>
                                                <div>
                                                    <div className={styles.authorName}>{review.author}</div>
                                                    <div className={styles.reviewDate}>{review.date}</div>
                                                </div>
                                            </div>
                                            <div className={styles.reviewRating}>
                                                {Array.from({ length: review.rating }).map((_, i) => (
                                                    <span key={i} className={styles.starSmall}>★</span>
                                                ))}
                                            </div>
                                        </div>
                                        <p className={styles.reviewContent}>&quot;{review.content}&quot;</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TABS */}
            {recipe.category !== 'restaurant' && (
                <div className={styles.tabsWrapper}>
                    <div className={styles.tabsBar}>
                        {availableTabs.map((tab) => (
                            <button
                                key={tab.id}
                                className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
                                onClick={() => switchTab(tab.id)}
                            >
                                <span>{tab.label}</span>
                                {tab.count !== undefined && (
                                    <span className={`${styles.tabCount} ${activeTab === tab.id ? styles.tabCountActive : ''}`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                        {/* Indicateur glissant */}
                        <div
                            className={styles.tabIndicator}
                            style={{
                                left: `calc(4px + ${availableTabs.findIndex(t => t.id === activeTab)} * ((100% - 8px) / ${availableTabs.length}))`,
                                width: `calc((100% - 8px) / ${availableTabs.length})`
                            }}
                        />
                    </div>

                    {activeTab === 'ingredients' && (
                        <div className={styles.stickyPanelHeader}>
                            <div className={styles.converterCentered}>
                                <PortionsControl value={servings} base={recipe.servings || 4} onChange={setServings} compact />
                                <MagicConverter />
                                <WinePairing recipeId={recipe.id} title={recipe.title} category={recipe.category} ingredients={recipe.ingredients} compact />
                            </div>
                        </div>
                    )}

                    {/* Contenu des tabs - scrollable individuellement */}
                    <div className={styles.tabContent} ref={tabContentRef} key={activeTab}>

                        {/* TAB: Ingrédients */}
                        {activeTab === 'ingredients' && (
                            <div className={styles.tabPanel}>

                                <div className={styles.ingredientsGrid}>
                                    {recipe.ingredients.map((ing, idx) => (
                                        <div
                                            key={idx}
                                            className={`${styles.ingredientCard} ${checkedIngredients[idx] ? styles.ingredientDone : ''}`}
                                            style={{ animationDelay: `${idx * 40}ms` }}
                                            onClick={() => toggleIngredient(idx)}
                                        >
                                            <div className={styles.hiddenCheck}>
                                                <input
                                                    type="checkbox"
                                                    checked={checkedIngredients[idx]}
                                                    readOnly
                                                />
                                            </div>

                                            {/* Icône ingrédient */}
                                            <div className={styles.ingIconWrap}>
                                                <IngredientImage name={ing.name} imageSrc={ing.image || getIngredientVisual(ing.name)} imgClassName={styles.ingImg} emojiClassName={styles.ingEmoji} />

                                                {/* Checkmark overlay */}
                                                <div className={`${styles.ingCheckOverlay} ${checkedIngredients[idx] ? styles.ingCheckVisible : ''}`}>
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                </div>
                                            </div>

                                            <div className={styles.ingInfo}>
                                                {(() => {
                                                    let displayQty = ing.quantity;
                                                    // Nettoyage STRICT du nom pour l'affichage (Plus d'émojis, plus de Bowl)
                                                    // Nettoyage du nom pour l'affichage sans détruire les lignes
                                                    let displayName = ing.name
                                                        // .replace(/\n/g, ' ') // On garde les retours à la ligne
                                                        // .replace(/\s+/g, ' ')
                                                        // Supprime TOUS les caractères spéciaux / émojis du début
                                                        .replace(/^[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\s]+/, '')
                                                        .trim();
                                                    
                                                    if (!displayQty) {
                                                        const qtyRegex = /^(\d+(?:[.,]\d+)?\s*(?:g|kg|ml|cl|l|cas|cac|c\.à\.s|c\.à\.c|c\.\s*à\s*(?:soupe|café)|verre|pincée|grammes?|millilitres?|centilitres?|boîtes?|boite|sachets?|pots?|bottes?|tasses?|filets?|tranches?|gousses?|morceaux?|cuillères?|pincées?)?)(?:\s+(.*))?$/i;
                                                        const match = displayName.match(qtyRegex);
                                                        if (match) {
                                                            displayQty = match[1].trim();
                                                            displayName = (match[2] || '').trim();
                                                        }
                                                    }

                                                    if (!displayQty && displayName) {
                                                         const wordQtyRegex = /^(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(.*)/i;
                                                         const match = displayName.match(wordQtyRegex);
                                                         if (match) {
                                                             displayQty = match[1];
                                                             displayName = match[2];
                                                         }
                                                    }

                                                    // Protection finale : si le nom commence encore par "De ", "D'"
                                                    displayName = displayName.replace(/^(?:de\s+|d'|du\s+|des\s+)/i, '').trim();
                                                    displayName = translateIngredientName(displayName);

                                                    return (
                                                        <>
                                                            <span className={styles.ingQty} style={{ color: 'var(--country-color, var(--dynamic-accent))' }}>{translateIngredientName(scaleQuantity(displayQty, ratio))}</span>
                                                            <span className={styles.ingName}>
                                                                {displayName.charAt(0).toUpperCase() + displayName.slice(1)}
                                                            </span>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TAB: Étapes */}
                        {activeTab === 'steps' && (
                            <div className={styles.tabPanel}>
                                <div className={styles.stepsProgressBar}>
                                    <div className={styles.stepsProgressHeader}>
                                        <span className={styles.stepsProgressLabel}>Progression</span>
                                        <span className={styles.progressBadge}>{Math.round(progress)}%</span>
                                    </div>
                                    <div className={styles.progressTrack}>
                                        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                                    </div>
                                </div>

                                <div className={styles.stepsList}>
                                    {recipe.steps.map((step, index) => (
                                        <div
                                            key={index}
                                            className={`${styles.stepCard} ${checkedSteps[index] ? styles.stepDone : ''}`}
                                            onClick={() => toggleStep(index)}
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            <div className={styles.stepBubble}>
                                                {checkedSteps[index] ? (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                ) : (
                                                    <span>{index + 1}</span>
                                                )}
                                            </div>
                                            <div className={styles.stepBody}>
                                                <SmartText text={step} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TAB: Vidéo */}
                        {activeTab === 'video' && (
                            <div className={styles.tabPanel}>
                                <VideoSection videoHtml={recipe.videoHtml || ''} />
                                <CreatorCard
                                    videoHtml={recipe.videoHtml}
                                    tiktokHandle={recipe.tiktokHandle}
                                    tiktokAuthorUrl={recipe.tiktokAuthorUrl}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Recettes similaires */}
            {!focusMode && similarRecipes.length > 0 && (
                <div style={{ padding: '0 0 8px' }}>
                    <div style={{ padding: '0 20px 10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', opacity: 0.5, textTransform: 'uppercase' }}>
                        {recipe.category === 'restaurant' ? 'Autres restaurants' : 'Recettes similaires'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 20px 4px', maxHeight: 360, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        {similarRecipes.map(r => (
                            <button
                                key={r.id}
                                onClick={() => window.dispatchEvent(new CustomEvent('openRecipe', { detail: r }))}
                                style={{
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
                                    overflow: 'hidden', cursor: 'pointer', padding: 0, textAlign: 'left'
                                }}
                            >
                                <img src={r.image} alt={r.title} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                                <div style={{ padding: '6px 8px', fontSize: '0.72rem', color: 'white', fontWeight: 600, lineHeight: 1.3,
                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {r.title}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {focusMode && (
                <div
                    className={styles.focusOverlay}
                    style={{
                        // @ts-ignore
                        '--dynamic-accent': theme.accent,
                        '--dynamic-accent-glow': theme.glow,
                        '--dynamic-accent-bg': theme.bg
                    }}
                >
                    <div className={styles.focusHeader}>
                        <div className={styles.focusTitle}>
                            <SplitTitle text={recipe.title} noAnimation={true} />
                        </div>
                        <button className={styles.focusClose} onClick={() => {
                            setFocusMode(false);
                            triggerHaptic();
                        }}>✕ Quitter</button>
                    </div>

                    {/* Progress dans focus mode : on utilise le même calcul de progression que la vue habituelle */}
                    <div className={styles.focusProgress}>
                        <div className={styles.focusProgressFill} style={{ width: `${progress}%` }} />
                    </div>

                    <div className={styles.focusContent}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeStepIndex}
                                className={styles.focusStepCard}
                                initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                onClick={() => {
                                    handleNextStep();
                                    triggerHaptic();
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className={styles.focusStepHeader}>
                                    <div className={styles.focusStepNumber}>Étape {activeStepIndex + 1} / {recipe.steps.length}</div>
                                    {isListening && (
                                        <div className={styles.listeningHud}>
                                            <div className={styles.listeningDot} />
                                            <span>Assistant Actif</span>
                                        </div>
                                    )}
                                </div>
                                <h2 className={styles.focusStepText}>
                                    <SmartText text={recipe.steps[activeStepIndex]} />
                                </h2>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* CONTRÔLES TACTILES ET VOCAUX (HUD FLOTTANT) */}
                    <div className={styles.focusHudWrapper}>
                        <motion.div 
                            className={styles.focusHud}
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.8 }}
                        >
                            <button
                                className={`${styles.hudBtn} ${styles.hudBtnPrev}`}
                                disabled={activeStepIndex === 0}
                                onClick={() => {
                                    handlePrevStep();
                                    triggerHaptic();
                                }}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M15 18l-6-6 6-6" />
                                </svg>
                                <span>Précédent</span>
                            </button>

                            <button
                                className={`${styles.hudBtn} ${styles.hudBtnRepeat}`}
                                onClick={() => {
                                    handleRepeatStep();
                                    triggerHaptic();
                                }}
                            >
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 4v6h6" />
                                    <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                                </svg>
                            </button>

                            <button
                                className={`${styles.hudBtn} ${styles.hudBtnNext}`}
                                onClick={() => {
                                    handleNextStep();
                                    triggerHaptic();
                                }}
                            >
                                {activeStepIndex === recipe.steps.length - 1 ? (
                                    <>
                                        <span>Terminer</span>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </>
                                ) : (
                                    <>
                                        <span>Suivant</span>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9 18l6-6-6-6" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </motion.div>
                        
                        {/* Indicateur vocal basique */}
                        <div className={styles.voiceCommandsHint}>
                            &quot;Suivant&quot; • &quot;Précédent&quot; • &quot;Répète&quot;
                        </div>
                    </div>
                </div>
            )}

            {/* Carnet "J'ai cuisiné" + note perso : connectés uniquement (composant auto-gaté). */}
            {!focusMode && recipe.category !== 'restaurant' && <CookingJournal recipeId={recipe.id} />}

            {/* Commentaires : lisibles par tous. Publier reste réservé aux connectés (géré dans le composant). */}
            {!focusMode && <CommentSection recipeId={String(recipe.id)} />}
        </div>
        </>
    );
}

function IngredientImage({ name, imageSrc, imgClassName, emojiClassName }: {
    name: string; imageSrc: string | null; imgClassName: string; emojiClassName: string;
}) {
    const [errored, setErrored] = useState(false);
    const n = (name || '').toLowerCase();
    const emoji = n.includes('miel') || n.includes('honey') ? '🍯'
        : n.includes('poivron') ? '🫑'
        : n.includes('herbe') || n.includes('aneth') || n.includes('basilic') || n.includes('persil') ? '🌿'
        : n.includes('fromage') || n.includes('cheese') || n.includes('mascarpone') || n.includes('feta') || n.includes('comté') ? '🧀'
        : n.includes('viande') || n.includes('boeuf') || n.includes('beef') || n.includes('bavette') || n.includes('rumsteck') ? '🥩'
        : n.includes('poulet') || n.includes('chicken') ? '🍗'
        : n.includes('poisson') || n.includes('saumon') || n.includes('thon') ? '🐟'
        : n.includes('fraise') || n.includes('strawberry') ? '🍓'
        : n.includes('myrtille') || n.includes('blueberry') ? '🫐'
        : n.includes('citron') || n.includes('lemon') ? '🍋'
        : n.includes('chocolat') || n.includes('chocolate') ? '🍫'
        : n.includes('cake') || n.includes('gâteau') ? '🍰'
        : n.includes('oeuf') || n.includes('œuf') || n.includes('egg') || n.includes('jaune') ? '🥚'
        : n.includes('lait') || n.includes('milk') ? '🥛'
        : n.includes('sucre') || n.includes('sugar') || n.includes('cassonade') ? '🍬'
        : n.includes('beurre') || n.includes('butter') ? '🧈'
        : n.includes('huile') || n.includes('oil') ? '🫒'
        : n.includes('vanille') || n.includes('vanilla') ? '🌼'
        : n.includes('farine') || n.includes('flour') ? '🌾'
        : n.includes('crème') || n.includes('cream') ? '🍦'
        : n.includes('colorant') || n.includes('coloring') ? '🎨'
        : n.includes('pistache') || n.includes('pistachio') || n.includes('noix') || n.includes('amande') ? '🥜'
        : n.includes('tomate') || n.includes('tomato') ? '🍅'
        : n.includes('carotte') || n.includes('carrot') ? '🥕'
        : n.includes('ail') || n.includes('garlic') ? '🧄'
        : n.includes('oignon') || n.includes('onion') ? '🧅'
        : n.includes('piment') || n.includes('chili') ? '🌶️'
        : n.includes('riz') || n.includes('rice') ? '🍚'
        : n.includes('pâte') || n.includes('pasta') ? '🍝'
        : n.includes('pain') || n.includes('bread') ? '🍞'
        : n.includes('fruit') || n.includes('pomme') || n.includes('apple') ? '🍎'
        : '🥗';

    if (!imageSrc || errored) {
        return <span className={emojiClassName} style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>{emoji}</span>;
    }
    return <img src={imageSrc} alt="" className={imgClassName} onError={() => setErrored(true)} />;
}
