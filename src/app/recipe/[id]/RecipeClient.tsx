'use client';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Header from '@/components/Header/Header';
import ThemeToggle from '@/components/ThemeToggle/ThemeToggle';
import MagicFilterBar from '@/components/MagicFilterBar/MagicFilterBar';
import FavoriteButton from '@/components/FavoriteButton/FavoriteButton';
import ShareButton from '@/components/ShareButton/ShareButton';
import VoteButton from '@/components/VoteButton/VoteButton';
import VideoSection from '@/components/VideoSection/VideoSection';
import { Recipe } from '@/types';
import { scaleQuantity } from '@/lib/utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useTimer } from '@/components/Timer/TimerContext';
import { parseDuration, stripHtml } from '@/lib/timer-utils';
import SmartText from '@/components/SmartText/SmartText';
import MagicConverter from '@/components/MagicConverter/MagicConverter';
import SplitTitle from '@/components/SplitTitle/SplitTitle';
import CommentSection from '@/components/CommentSection/CommentSection';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './page.module.css';

interface RecipeClientProps {
    recipe: Recipe;
    prevId?: string | null;
    nextId?: string | null;
}

type TabId = 'ingredients' | 'steps' | 'video';

export default function RecipeClient({ recipe, prevId, nextId }: RecipeClientProps) {
    const { startTimer, stopTimer } = useTimer();
    const [servings, setServings] = useState(recipe.servings || 4);
    const [focusMode, setFocusMode] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [isSpeakingTTS, setIsSpeakingTTS] = useState(false);
    const [isInitialMount, setIsInitialMount] = useState(true);
    const [totalListCount, setTotalListCount] = useState(0);

    // Synchronisation du badge de navigation global (Compte total des ingrédients)
    useEffect(() => {
        const updateCount = () => {
            const list = JSON.parse(localStorage.getItem('magic-shopping-list') || '{}');
            let total = 0;
            Object.values(list).forEach((recipe: any) => {
                total += recipe.ingredients?.length || 0;
            });
            setTotalListCount(total);
        };
        updateCount();
        window.addEventListener('shoppingListUpdated', updateCount);
        return () => window.removeEventListener('shoppingListUpdated', updateCount);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            // Seuil de scroll fortement augmenté (400px) pour maximiser le temps de visite de la photo
            setScrolled(window.scrollY > 400);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });

        // Force le scroll tout en haut
        window.scrollTo(0, 0);

        const mountTimer = setTimeout(() => {
            setIsInitialMount(false);
            window.scrollTo(0, 0);
        }, 150); // Réduction du délai initial

        // Force le scroll tout en haut "brutalement" pour contrer la restauration de position du navigateur
        const scrollTimer = setTimeout(() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        }, 150);
        
        return () => {
            window.removeEventListener('scroll', handleScroll);
            clearTimeout(scrollTimer);
            clearTimeout(mountTimer);
        };
    }, [recipe.id]);

    // Swipe navigation state
    const router = useRouter();
    const touchStart = useRef<{ x: number, y: number } | null>(null);
    const touchEnd = useRef<{ x: number, y: number } | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

    // Tabs
    const availableTabs: { id: TabId; label: string; count?: number }[] = [
        { id: 'ingredients', label: 'Ingrédients', count: recipe.ingredients.length },
        { id: 'steps', label: 'Étapes', count: recipe.steps.length },
        ...(recipe.videoHtml ? [{ id: 'video' as TabId, label: 'Vidéo' }] : []),
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
    const [checkedSteps, setCheckedSteps] = useLocalStorage<boolean[]>(`recipe-steps-${recipe.id}`, new Array(recipe.steps.length).fill(false));
    // Par défaut, rien n'est coché pour la liste de courses (Selection unique demandée par le client)
    const [checkedIngredients, setCheckedIngredients] = useLocalStorage<boolean[]>(`recipe-ing-v2-${recipe.id}`, new Array(recipe.ingredients.length).fill(false));

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
                    setCheckedSteps(new Array(recipe.steps.length).fill(false));
                    setCheckedIngredients(new Array(recipe.ingredients.length).fill(false));
                }
            }

            // Enregistre l'heure de sortie
            return () => {
                localStorage.setItem(exitKey, Date.now().toString());
            };
        }
    }, [recipe.id]);

    const ratio = useMemo(() => servings / (recipe.servings || 4), [servings, recipe.servings]);

    // Trend Hashtags Logic (Replicated from Homepage for consistency)
    const trendHashtags = useMemo(() => {
        const meatKeywords = ['viande', 'porc', 'boeuf', 'bœuf', 'poulet', 'agneau', 'veau', 'steak', 'lardons', 'bacon', 'charcuterie', 'chorizo', 'viandard', 'jambon', 'salami', 'merguez', 'saucisse', 'canard', 'dinde', 'pepperoni', 'pancetta', 'cochon', 'guanciale'];
        const tags = (recipe.tags || []).map(t => t.toLowerCase());
        const title = recipe.title.toLowerCase();
        
        const hasMeat = tags.some(t => meatKeywords.some(m => t.includes(m))) || meatKeywords.some(m => title.includes(m));
        const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
        
        const list: { id: string; name: string }[] = [];
        
        // 1. Priorité aux tags stricts (Végé)
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

    // Mount animation & Reset check
    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 50);
        // Réinitialisation des portions quand on change de recette (swipe)
        setServings(recipe.servings || 4);
        return () => clearTimeout(t);
    }, [recipe.id, recipe.servings]);

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

        if (typeof window !== 'undefined') {
            window.localStorage.setItem('active-recipe-id', recipe.id);

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
            return () => window.removeEventListener('shoppingListUpdated', syncWithShoppingList);
        }

        return () => {
            if (wakeLock !== null) wakeLock.release();
        };
    }, [recipe.id]);

    const triggerHaptic = () => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(10);
        }
    };

    const minSwipeDistance = 50;
    const maxVerticalDiff = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        touchEnd.current = null;
        touchStart.current = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };
    };

    const onTouchMove = (e: React.TouchEvent) => {
        touchEnd.current = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };
    };

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
        const wasChecked = newChecked[index];
        newChecked[index] = !newChecked[index];
        setCheckedSteps(newChecked);
        triggerHaptic();

        if (typeof window !== 'undefined') {
            window.localStorage.setItem('active-recipe-id', recipe.id);
        }

        // Si on décoche, on arrête le timer (iOS 26)
        if (wasChecked) {
            stopTimer();
        }

        if (newChecked[index]) {
            const stepText = recipe.steps[index];
            const minutes = parseDuration(stepText);
            if (minutes) {
                const cleanLabel = stripHtml(stepText);
                const shortLabel = cleanLabel.length > 50
                    ? cleanLabel.substring(0, 47) + '...'
                    : cleanLabel;
                startTimer(minutes, shortLabel);
            }

            // Auto-scroll vers l'étape suivante (iOS 26)
            if (index < recipe.steps.length - 1) {
                setTimeout(() => {
                    const nextStepEl = document.getElementById(`step-${index + 1}`);
                    if (nextStepEl) {
                        nextStepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        }
    };

    const toggleIngredient = (index: number) => {
        // Sécurité mobile : si on a bougé de plus de 10px, on considère que c'est un scroll, pas un clic
        if (touchStart.current && touchEnd.current) {
            const dx = Math.abs(touchStart.current.x - touchEnd.current.x);
            const dy = Math.abs(touchStart.current.y - touchEnd.current.y);
            if (dx > 10 || dy > 10) return;
        }

        const newChecked = [...checkedIngredients];
        const isDeselecting = newChecked[index]; // C'était coché, on va décocher
        newChecked[index] = !newChecked[index];
        setCheckedIngredients(newChecked);
        triggerHaptic();

        // SYNC AUTO AVEC LE HEADER (Compte Global)
        // Si on déselectionne, on met à jour la liste globale immédiatement pour le badge
        if (typeof window !== 'undefined' && isDeselecting) {
            const existingData = JSON.parse(window.localStorage.getItem('magic-shopping-list') || '{}');
            if (existingData[recipe.id]) {
                const ingredientName = recipe.ingredients[index].name;
                // On retire cet ingrédient précis de la liste globale
                existingData[recipe.id].ingredients = existingData[recipe.id].ingredients.filter((ing: any) => {
                    // Comparaison souple pour ignorer les quantités scalées
                    return !ing.name.toLowerCase().includes(ingredientName.toLowerCase().replace(/^[\uD83C-\uDBFF\uDC00-\uDFFF\s]+/, '').split(' ')[0]);
                });

                // Si plus d'ingrédients pour cette recette, on supprime la recette de la liste
                if (existingData[recipe.id].ingredients.length === 0) {
                    delete existingData[recipe.id];
                }

                window.localStorage.setItem('magic-shopping-list', JSON.stringify(existingData));
                window.dispatchEvent(new Event('shoppingListUpdated'));
                window.dispatchEvent(new CustomEvent('magic-toast-notify', { 
                    detail: isDeselecting ? 'Ingrédient retiré !' : 'Ingrédient ajouté !' 
                }));
            }
        }
    };

    const copyIngredients = async () => {
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
                    ingredients: ingredientObjects
                };
                window.localStorage.setItem('magic-shopping-list', JSON.stringify(existingData));

                // Notifier le Header immédiatement
                window.dispatchEvent(new Event('shoppingListUpdated'));
                window.dispatchEvent(new CustomEvent('magic-toast-notify', { 
                    detail: `${selectedIngredients.length} ${selectedIngredients.length > 1 ? 'ingrédients ajoutés' : 'ingrédient ajouté'} !` 
                }));
                triggerHaptic();

                // Auto-scroll vers le panier (Capsule d'état)
                setTimeout(() => {
                    const pill = document.getElementById('shopping-list-pill-group');
                    if (pill) {
                        pill.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        pill.classList.add(styles.pillHighlight);
                        setTimeout(() => pill.classList.remove(styles.pillHighlight), 2000);
                    }
                }, 100);
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

    const speak = (text: string) => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(stripHtml(text));
            utterance.lang = 'fr-FR';
            utterance.rate = 1.0;

            utterance.onstart = () => {
                isSpeakingRef.current = true;
                // On stoppe la reconnaissance pour éviter de se détecter soi-même
                if (recognitionRef.current) {
                    try { recognitionRef.current.stop(); } catch (e) { }
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
                startTimer(minutes, shortLabel);
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
                } catch (e) { }
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
                } catch (e) { }
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

    // Silhouettes SVG pour les continents (Afrique)
    const AFRICA_SILHOUETTE = (
        <svg viewBox="0 0 512 512" width="22" height="22" fill="currentColor" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
            <path d="M428.1 143.4c-9.7-21.7-18-24.3-18.7-27.4-.7-3.1 3.5-3.5 3.5-3.5-4.5-5.9-6.9-12.8-11.8-19.1-7.6-9.7-13.2-13.5-23.9-13.2-10.7.3-20.1 7.6-26 12.8s-12.8 13.5-17.7 20.8c-4.8 7.3-10.4 16-10.4 16s-2.1-1.4-8-1.7c-5.9-.3-13.9.3-20.5 1.7-6.6 1.4-14.9 3.8-17.7 6.2-2.8 2.4-7.3 8.3-9.7 13.2s-6.9 14.9-7.6 22.5c-.7 7.6 1.4 19.8 1.4 19.8s-7.6 1.7-13.2 2.4c-5.5.7-14.6 1-20.5-2.1-5.9-3.1-11.8-10.7-14.6-14.2-2.8-3.5-6.2-7.3-14.6-7.3s-15.6 1.7-23.2 6.6c-7.6 4.8-10.4 8.7-16.7 16s-8.7 13.9-8.7 21.5c0 7.6 3.1 20.5 4.5 27.7 1.4 7.3 4.2 16 4.9 22.9.7 6.9-1.4 13.9-.3 22.2s4.8 16.3 8 23.2c3.1 6.9 8 13.9 11.4 20.5 3.5 6.6 7.3 12.1 11.1 19.4 3.8 7.3 6.6 16 9 22.9s4.8 13.9 6.2 22.2c1.4 8.3 3.5 19.8 4.2 28.1s1.7 19.8 4.2 28.4c2.4 8.7 6.9 21.5 9.7 28.8 2.8 7.3 8 16.7 11.4 22.2s7.6 10.7 12.8 14.6c5.2 3.8 12.8 8 18 10.1 5.2 2.1 12.1 3.5 18 3.5s15.9-2.1 21.5-6.2c5.5-4.2 11.1-11.4 14.2-18s5.2-15.6 6.9-23.6c1.7-8 4.2-20.1 4.2-20.1s4.5-3.5 10.7-7c6.2-3.5 12.5-6.2 18.7-10.4 6.2-4.2 12.5-12.8 17-19.1s7.3-14.2 8.7-21.5c1.4-7.3 2.1-18.7 2.1-18.7s4.8-4.5 10.7-9c5.9-4.5 12.5-10.4 17-17 4.5-6.6 7.6-13.9 10.1-22.2s2.8-19.8 2.8-19.8 6.9-7.6 12.1-14.9c5.2-7.3 9.4-16 11.4-23.9s2.8-18.4 2.8-18.4.7-6.2 1.4-13.2c.7-6.9 0-14.6-.3-21.5s-.7-14.2.7-21.2c1.4-6.9 4.2-13.9 5.2-20.8.3-6.9-1.4-15.3-4.5-22.9M143.5 240.2c1.4 0 2.8-.7 3.5-1.7.7-1.1.3-2.4-.7-3.1-1.4-1.1-3.5-1.1-4.9 0l-1.4 1.4c-.7 1.1-.3 2.4.7 3.1.7.3 1.8.3 2.8.3z"/>
        </svg>
    );

    const countryFlags: Record<string, string | React.ReactNode> = {
        france: '🇫🇷', italie: '🇮🇹', espagne: '🇪🇸', grece: '🇬🇷',
        liban: '🇱🇧', usa: '🇺🇸', mexique: '🇲🇽', orient: '🕌',
        asie: '🥢', afrique: AFRICA_SILHOUETTE,
        autre: '🗺️'
    };

    const countryColors: Record<string, string> = {
        france: '#0055A4', italie: '#008C45', espagne: '#F1BF00', grece: '#005BAE',
        liban: '#EE161F', usa: '#3C3B6E', mexique: '#006847', orient: '#C1272D',
        asie: '#dc2626', afrique: '#eab308',
        autre: '#666666'
    };

    const recipeCountryTag = recipe.tags?.find(t => countryFlags[t.toLowerCase()]);
    const flag = recipeCountryTag ? countryFlags[recipeCountryTag.toLowerCase()] : null;
    const countryColor = recipeCountryTag ? countryColors[recipeCountryTag.toLowerCase()] : theme.accent;

    return (
        <>
            {!focusMode && (
                <div className={`${styles.stickyHeaderMenu} ${scrolled ? styles.isScrolled : ''}`}>
                    <Header
                        title={scrolled ? "Les Recettes Magiques" : ""} 
                        showBack={false}
                        backUrl={`/category/${recipe.category}`}
                        large={!scrolled}
                        recipeId={recipe.id}
                        hideMobileIcons={true}
                        className=""
                        rightAction={null} /* Laisse le Header utiliser son action par défaut qui est maintenant synchronisée */
                    />
                    
                    {/* SANDWICH TITLE: Visibilité permanente entre les boutons au scroll */}
                    {scrolled && (
                        <div className={styles.stickyRecipeTitle}>
                            <SplitTitle text={recipe.title} />
                        </div>
                    )}

                    {/* Barre de filtres + bouton retour catégorie au scroll */}
                    <MagicFilterBar
                        activeTags={recipe.tags || []}
                        showBack={true}
                        backUrl={`/category/${recipe.category}`}
                        backLabel={recipe.category === 'aperitifs' ? 'Apéritifs' :
                            recipe.category === 'entrees' ? 'Entrées' :
                            recipe.category === 'plats' ? 'Plats' :
                            recipe.category === 'desserts' ? 'Desserts' :
                            recipe.category === 'patisserie' ? 'Pâtisserie' :
                            recipe.category === 'restaurant' ? 'Restos' : 'Recettes'}
                        onSelect={(tag: string) => {
                            const mainCategories = ['aperitifs', 'entrees', 'plats', 'desserts', 'patisserie', 'restaurant'];
                            if (mainCategories.includes(tag.toLowerCase())) {
                                router.push(`/category/${tag.toLowerCase()}`);
                            } else {
                                router.push(`/?tag=${tag}`);
                            }
                        }}
                        listCount={totalListCount}
                    />
                </div>
            )}
            <div
                className={`${styles.page} ${mounted ? styles.pageVisible : ''} ${isNavigating ? (slideDirection === 'left' ? styles.slideOutLeft : styles.slideOutRight) : ''}`}
                style={{
                    // @ts-ignore
                    '--dynamic-accent': theme.accent,
                    '--dynamic-accent-glow': theme.glow,
                    '--dynamic-accent-bg': theme.bg,
                    '--dynamic-accent-rgb': theme.rgb,
                    '--country-color': countryColor || theme.accent
                } as React.CSSProperties}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >

                {/* Nouveau Hero Split-Screen UX Premium */}
                <div className={`${styles.heroNewLayout} ${scrolled ? styles.isHeroScrolled : ''} ${focusMode ? styles.isFocusMode : ''}`}>
                    {/* Titre dégradé TOUT EN HAUT sur iPhone */}
                    <div className={styles.mobileTitleBlock}>
                        {/* 1. TITRE GÉANT EN HAUT (DÉGRADÉ) */}
                        <h1 className={styles.heroTitleElegant}>
                            <SplitTitle text={recipe.title} large={true} />
                        </h1>

                    </div>
                    
                    <div className={styles.heroGrid}>
                        {/* Colonne GAUCHE : Description (BlaBla) uniquement sur mobile */}
                        <motion.div
                            className={styles.heroTextColumn}
                            initial={{ opacity: 0, x: -70 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <div className={styles.heroMainContent}>
                                {/* ACTION ROW (Moved from Header for premium tactical layout) */}
                                <div className={styles.actionRowPrimary}>
                                    {/* PAYS (AVEC DRAPEAU ANIMÉ) */}
                                    {recipeCountryTag && (
                                        <Link 
                                            href={`/?tag=${recipeCountryTag}`} 
                                            className={`${styles.iosActionBtn} ${styles.withCountryColor}`}
                                        >
                                            <motion.span 
                                                className={styles.iosBtnIcon}
                                                whileHover={{ scale: 1.4, rotate: -12 }}
                                                animate={{ 
                                                    y: [0, -3, 0],
                                                    transition: { duration: 2, repeat: Infinity }
                                                }}
                                            >
                                                {flag}
                                            </motion.span>
                                            <span className={styles.iosBtnLabel}>{recipeCountryTag.toUpperCase()}</span>
                                        </Link>
                                    )}
                                    
                                    {/* CATÉGORIE */}
                                    <Link 
                                        href={`/category/${recipe.category}`} 
                                        className={styles.iosActionBtn}
                                    >
                                        <motion.span 
                                            className={styles.iosBtnIcon}
                                            whileHover={{ scale: 1.4, rotate: 12 }}
                                        >
                                            🥘
                                        </motion.span>
                                        <span className={styles.iosBtnLabel}>
                                            {recipe.category === 'aperitifs' ? 'APÉRITIF' : 
                                             recipe.category === 'entrees' ? 'ENTRÉE' :
                                             recipe.category === 'plats' ? 'PLAT' :
                                             recipe.category === 'desserts' ? 'DESSERT' :
                                             recipe.category === 'patisserie' ? 'PÂTISSERIE' :
                                             recipe.category.toUpperCase()}
                                        </span>
                                    </Link>

                                    {/* HASHTAG (Uniquement le premier si présent) */}
                                    {trendHashtags.length > 0 && (
                                        <Link 
                                            href={`/?tag=${trendHashtags[0].name}`} 
                                            className={styles.iosActionBtn}
                                        >
                                            <span className={styles.iosBtnIcon}>#</span>
                                            <span className={styles.iosBtnLabel}>{trendHashtags[0].name.toUpperCase()}</span>
                                        </Link>
                                    )}
                                </div>
                                {recipe.description && (
                                    <div
                                        className={styles.heroDescription}
                                        dangerouslySetInnerHTML={{ __html: recipe.description }}
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

                                    // On attend un peu que le mode focus s'active
                                    setTimeout(() => {
                                        speak(recipe.steps[0]);
                                    }, 500);
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

                        {/* Colonne DROITE : Photo avec actions comme sur Home */}
                        <div className={styles.heroImageColumn}>
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

                                {/* HEADER ACTIONS (Flag + Interaction Buttons) — Master Container pour alignement parfait */}
                                <div className={styles.cardHeaderActions}>
                                    {/* Drapeau en Haut à Gauche (Style TikTok Home) */}
                                    {flag ? (
                                        <motion.div 
                                            className={styles.topLeftFlag}
                                            whileHover={{ 
                                                scale: 1.25, 
                                                rotate: -12,
                                                filter: 'drop-shadow(0 10px 25px rgba(var(--dynamic-accent-rgb), 0.6))'
                                            }}
                                            animate={{ 
                                                y: [0, -4, 0],
                                                transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                                            }}
                                        >
                                            {flag}
                                        </motion.div>
                                    ) : <div />} {/* Spacer pour flex si pas de flag */}

                                    {/* ACTIONS HAUT DROITE (Style Home) */}
                                    <div className={styles.topActionsOverlayNew}>
                                        <VoteButton 
                                            recipeId={recipe.id}
                                            initialVotes={recipe.votes || 0}
                                            className={styles.persistentVote}
                                        />
                                        <FavoriteButton
                                            recipeId={recipe.id}
                                            imageUrl={recipe.image}
                                            className={styles.cardActionBtn}
                                        />
                                        <ShareButton 
                                            url={`${typeof window !== 'undefined' ? window.location.href : ''}`}
                                            title={recipe.title}
                                            className={styles.cardActionBtn}
                                        />
                                    </div>
                                </div>
                                
                                {/* Hashtags de Tendances (Type Végé / Famille / Express) sur l'Image */}
                                <div className={styles.badgesOverlay}>
                                    {trendHashtags.map((has: { id: string; name: string }) => (
                                        <div 
                                            key={has.id} 
                                            className={`${styles.badge} ${styles[`badge_${has.id}`] || ''}`}
                                        >
                                            <span className={styles.badgeLabel}>#{has.name.toUpperCase()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Metadata strip */}
                <div className={styles.metaStrip}>
                    <div className={styles.metaItem}>
                        <span className={styles.metaIcon}>
                            {recipe.category === 'restaurant' ? '📍' : '👥'}
                        </span>
                        <div>
                            <div className={styles.metaLabel}>
                                {recipe.category === 'restaurant' ? 'Lieu' : 'Portions'}
                            </div>
                            {recipe.category === 'restaurant' ? (
                                <div className={styles.metaValue}>{recipe.address || 'À découvrir'}</div>
                            ) : (
                                <div className={styles.servingsControl}>
                                    <button
                                        className={styles.servingBtn}
                                        onClick={() => setServings(Math.max(1, servings - 1))}
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                        </svg>
                                    </button>
                                    <span className={styles.servingsNumber}>{servings}</span>
                                    <button
                                        className={styles.servingBtn}
                                        onClick={() => setServings(servings + 1)}
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.metaDivider} />

                    <div className={styles.metaItem}>
                        <span className={styles.metaIcon}>
                            {recipe.category === 'restaurant' ? '💰' : '⭐'}
                        </span>
                        <div>
                            <div className={styles.metaLabel}>
                                {recipe.category === 'restaurant' ? 'Gamme' : 'Difficulté'}
                            </div>
                            <div
                                className={styles.metaValue}
                                style={{ color: recipe.category === 'restaurant' ? 'var(--color-accent-gold)' : (difficultyColors as any)[recipe.difficulty] }}
                            >
                                {recipe.category === 'restaurant' ? 'Restaurant' : recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
                            </div>
                        </div>
                    </div>

                    {recipe.category !== 'restaurant' && (recipe.prepTime || recipe.cookTime) && (
                        <>
                            <div className={styles.metaDivider} />
                            <div className={styles.metaItem}>
                                <span className={styles.metaIcon}>⏱️</span>
                                <div>
                                    <div className={styles.metaLabel}>Temps</div>
                                    <div className={styles.metaValue}>{(recipe.prepTime || 0) + (recipe.cookTime || 0)} min</div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Description pour restaurants */}
                {recipe.description && recipe.category === 'restaurant' && (
                    <div className={styles.descriptionSection}>
                        <div
                            className={styles.recipeDescription}
                            dangerouslySetInnerHTML={{ __html: recipe.description }}
                        />
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

                        {/* Header du tab ingrédients (Sorti du tabPanel pour être sticky via CSS) */}
                        {activeTab === 'ingredients' && (
                            <div className={styles.stickyPanelHeader}>
                                <div className={styles.ingredientsActionGrid}>
                                    <button 
                                        className={`${styles.ingredientProgress} ${checkedCount > 0 ? styles.activeSelection : ''}`}
                                        onClick={() => {
                                            const ingredientsSection = document.getElementById('ingredients-grid');
                                            if (ingredientsSection) ingredientsSection.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                    >
                                        <span className={styles.btnIcon}>{checkedCount > 0 ? '✅' : '🛒'}</span>
                                        <span className={styles.ingredientProgressText}>
                                            {checkedCount} <span className={styles.hideMobileText}>Sélectionné{checkedCount > 1 ? 's' : ''}</span>
                                        </span>
                                    </button>
                                    
                                    <MagicConverter />

                                    <button 
                                        className={`${styles.copyBtn} ${checkedCount > 0 ? styles.activeCopy : ''}`} 
                                        onClick={copyIngredients}
                                        disabled={checkedCount === 0}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 5v14M5 12h14" />
                                        </svg>
                                        <span className={styles.hideMobileText}>Ajouter</span>
                                    </button>
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
                                                    {(() => {
                                                        const visual = ing.image;
                                                        if (visual && (visual.startsWith('http') || visual.startsWith('/'))) {
                                                            return <img src={visual} alt="" className={styles.ingImg} />;
                                                        }

                                                        // Nettoyage de l'émoji d'origine (on vire les 🥣 et 🥚)
                                                        const cleanMatch = ing.name.match(/^[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\s]*([\s\S]*)/);
                                                        const nameWithoutEmoji = cleanMatch ? cleanMatch[1].trim() : ing.name;

                                                        // Fallback sur un émoji intelligent si pas de photo
                                                        const smartEmoji = (() => {
                                                            const n = nameWithoutEmoji.toLowerCase();
                                                            if (n.includes('miel')) return '🍯';
                                                            if (n.includes('poivron')) return '🫑';
                                                            if (n.includes('herbe') || n.includes('aneth') || n.includes('ciselé')) return '🌿';
                                                            if (n.includes('fromage') || n.includes('feta')) return '🧀';
                                                            if (n.includes('viande') || n.includes('poulet')) return '🥩';
                                                            if (n.includes('fruit')) return '🍎';
                                                            return '🥗'; // Fallback générique premium au lieu du bol bleu
                                                        })();

                                                        return <span className={styles.ingEmoji}>{smartEmoji}</span>;
                                                    })()}

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

                                                        return (
                                                            <>
                                                                <span className={styles.ingQty} style={{ color: 'var(--country-color, var(--dynamic-accent))' }}>{scaleQuantity(displayQty, ratio)}</span>
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
                                                id={`step-${index}`}
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
                            {activeTab === 'video' && recipe.videoHtml && (
                                <div className={styles.tabPanel}>
                                    <VideoSection videoHtml={recipe.videoHtml} />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Pour les restaurants: description complète */}
                {recipe.category === 'restaurant' && recipe.description && (
                    <div className={styles.tabsWrapper}>
                        <div className={styles.restaurantContent}>
                            <div className={styles.recipeDescription}
                                dangerouslySetInnerHTML={{ __html: recipe.description }}
                            />
                        </div>
                    </div>
                )}

                <CommentSection />

                {/* Focus Mode Overlay */}
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
                {/* Bouton flottant pour revenir à la recette (Optimisé Tablette/iPad) */}
                {activeTab === 'video' && (
                    <motion.button
                        className={styles.floatingRecipeBtn}
                        initial={{ y: 100, x: '-50%', opacity: 0 }}
                        animate={{ y: 0, x: '-50%', opacity: 1 }}
                        whileHover={{ scale: 1.05, y: -5, x: '-50%' }}
                        whileTap={{ scale: 0.95, x: '-50%' }}
                        onClick={() => {
                            switchTab('steps');
                            triggerHaptic();
                            setTimeout(() => {
                                window.scrollTo({ top: 300, behavior: 'smooth' });
                            }, 100);
                        }}
                    >
                        <span className={styles.floatingRecipeBtnIcon}>📖</span>
                        <span className={styles.floatingRecipeBtnText}>Afficher la recette</span>
                    </motion.button>
                )}
            </div>
        </>
    );
}
