'use client';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { grandePhoto } from '@/lib/recipe-photo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Header from '@/components/Header/Header';
import MagicFilterBar from '@/components/MagicFilterBar/MagicFilterBar';
import FavoriteButton from '@/components/FavoriteButton/FavoriteButton';
import VoteButton from '@/components/VoteButton/VoteButton';
import VideoSection from '@/components/VideoSection/VideoSection';
import CreatorCard from '@/components/CreatorCard/CreatorCard';
import { Recipe } from '@/types';
import { scaleQuantity } from '@/lib/utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useTimer } from '@/components/Timer/TimerContext';
import { parseDuration, stripHtml } from '@/lib/timer-utils';
import { decodeHtml } from '@/lib/utils';
import { useAjusterTitre } from '@/lib/useAjusterTitre';
import PrixMoyen from '@/components/PrixMoyen/PrixMoyen';
import { prixRecette } from '@/lib/recipe-price';
import Portal from '@/components/Portal';
import SmartText from '@/components/SmartText/SmartText';
import MagicConverter from '@/components/MagicConverter/MagicConverter';
import PortionsControl from '@/components/PortionsControl/PortionsControl';
import DifficultyMeter from '@/components/DifficultyMeter/DifficultyMeter';
import { estimateRecipeTiming } from '@/lib/recipe-timing';
import WinePairing from '@/components/WinePairing/WinePairing';
import CaveMatch from '@/components/CaveMatch/CaveMatch';
import SplitTitle from '@/components/SplitTitle/SplitTitle';
import { getIngredientVisual } from '@/lib/ingredient-utils';
import { markCooking } from '@/mobile/screens/tv/progress';
import CookingJournal from '@/components/CookingJournal/CookingJournal';
import FicheResto from '@/components/FicheResto/FicheResto';
import { useAmbianceImage } from '@/lib/useAmbianceImage';
import StarRating from '@/components/StarRating/StarRating';
import RestaurantGallery from '@/components/RestaurantGallery/RestaurantGallery';
import CommentSection from '@/components/CommentSection/CommentSection';
import { supabase } from '@/lib/supabase';
import { estimateRecipeCalories } from '@/lib/calories';
import NutriScore from '@/components/NutriScore/NutriScore';
import { nutriscoreRecette } from '@/lib/nutriscore';
import { mockRecipes } from '@/data/mockData';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
const RecipeShareCard = dynamic(() => import('@/mobile/components/RecipeShareCard/RecipeShareCard'), { ssr: false });
import styles from './RecipeDetails.module.css';
import Tip from '@/components/Tip/Tip';
import { ecrireStock } from '@/lib/stockage';

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
    const [authUser, setAuthUser] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setAuthUser(session?.user ?? null));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setAuthUser(session?.user ?? null));
        return () => subscription.unsubscribe();
    }, []);
    const [isListening, setIsListening] = useState(false);

    // Swipe navigation state
    const router = useRouter();
    const touchStart = useRef<{ x: number, y: number } | null>(null);
    const touchEnd = useRef<{ x: number, y: number } | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [slideDirection, setSlideDirection] = useState<'left'|'right'|null>(null);

    // Tabs
    const availableTabs: { id: TabId; label: string; count?: number }[] = [
        { id: 'ingredients', label: 'Ingrédients', count: recipe?.ingredients?.length ?? 0 },
        { id: 'steps', label: 'Étapes', count: recipe?.steps?.length ?? 0 },
        ...(recipe?.videoHtml ? [{ id: 'video' as TabId, label: 'Vidéo' }] : []),
    ];

    // Default to 'steps' if no ingredients (restaurant), else 'ingredients'
    const defaultTab: TabId = recipe.category === 'restaurant' ? 'steps' : 'ingredients';
    // Le titre vit dans une colonne étroite : on le redescend jusqu'à ce qu'il y
    // tienne, plutôt que de laisser le navigateur le couper en syllabes.
    const titreRef = useAjusterTitre<HTMLHeadingElement>(recipe.title);

    // Estimation du prix des ingrédients (Lidl → Carrefour). Recalculée seulement
    // quand la recette change : elle relit et chiffre toutes ses lignes.
    const prix = useMemo(() => prixRecette(recipe), [recipe]);
    const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
    const [prevTab, setPrevTab] = useState<TabId | null>(null);
    const tabContentRef = useRef<HTMLDivElement>(null);

    // La couleur d'ambiance vient de la PHOTO, plus de la catégorie : deux plats
    // rangés au même rayon n'ont pas la même lumière à l'œil, et c'est l'image
    // que l'on regarde. Les couleurs de catégorie ne servent plus que de repli,
    // le temps que la photo soit lue — sans quoi la fiche s'ouvrirait en gris.
    const ambiance = useAmbianceImage(recipe.image);
    const theme = useMemo(() => {
        const categories: Record<string, { accent: string; glow: string; bg: string; rgb: string }> = {
            aperitifs: { accent: '#10b981', glow: '0 0 20px rgba(16, 185, 129, 0.4)', bg: 'rgba(16, 185, 129, 0.1)', rgb: '16, 185, 129' },
            plats: { accent: '#f43f5e', glow: '0 0 20px rgba(244, 63, 94, 0.4)', bg: 'rgba(244, 63, 94, 0.1)', rgb: '244, 63, 94' },
            desserts: { accent: '#d946ef', glow: '0 0 20px rgba(217, 70, 239, 0.4)', bg: 'rgba(217, 70, 239, 0.1)', rgb: '217, 70, 239' },
            patisserie: { accent: '#f59e0b', glow: '0 0 20px rgba(245, 158, 11, 0.4)', bg: 'rgba(245, 158, 11, 0.1)', rgb: '245, 158, 11' },
            vegetarien: { accent: '#22c55e', glow: '0 0 20px rgba(34, 197, 94, 0.4)', bg: 'rgba(34, 197, 94, 0.1)', rgb: '34, 197, 94' },
            restaurant: { accent: '#3b82f6', glow: '0 0 20px rgba(59, 130, 246, 0.4)', bg: 'rgba(59, 130, 246, 0.1)', rgb: '59, 130, 246' },
        };
        return ambiance || categories[recipe.category] || categories.plats;
    }, [recipe.category, ambiance]);

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
                ecrireStock(exitKey, Date.now().toString());
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

    // Temps prépa/cuisson + difficulté recalculés depuis les étapes (valeurs WP incohérentes).
    const timing = useMemo(() => estimateRecipeTiming(recipe.steps), [recipe.steps]);

    const [personalNote, setPersonalNote] = useLocalStorage<string>(`recipe-note-${recipe.id}`, '');
    const [noteExpanded, setNoteExpanded] = useState(false);
    const [simPage, setSimPage] = useState(0);
    const calorieEstimate = useMemo(() =>
        recipe.category !== 'restaurant' && recipe.ingredients?.length > 0
            ? estimateRecipeCalories(recipe.ingredients, servings)
            : null,
    [recipe, servings]);
    /*
     * Le Nutri-Score ne suit PAS le curseur de portions.
     *
     * Il se lit pour cent grammes de plat : doubler les portions double le poids
     * et les nutriments dans la même proportion, et la lettre ne bouge pas. Le
     * recalculer à chaque cran ferait le même travail pour le même résultat.
     */
    const nutriscore = useMemo(() =>
        recipe.category !== 'restaurant' ? nutriscoreRecette(recipe) : null,
    [recipe]);
    const [showShareCard, setShowShareCard] = useState(false);

    const similarRecipes = useMemo(() => {
        // Fiche restaurant → « Autres restaurants » (mêmes catégorie, subType/tags priorisés).
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
                .slice(0, 20)
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
            .slice(0, 20)
            .map(({ recipe: r }) => r);
    }, [recipe]);

    // Navigation resto suivant/précédent (swipe hors photo sur la galerie).
    const restoNav = useMemo(() => {
        if (recipe.category !== 'restaurant') return null;
        const list = mockRecipes.filter(r => r.category === 'restaurant');
        const idx = list.findIndex(r => String(r.id) === String(recipe.id));
        if (idx < 0 || list.length < 2) return null;
        return { next: list[(idx + 1) % list.length], prev: list[(idx - 1 + list.length) % list.length] };
    }, [recipe]);
    const openResto = (r: any) => window.dispatchEvent(new CustomEvent('openRecipe', { detail: r }));

    // Sauvegarder historique
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

        if (typeof window !== 'undefined') {
            ecrireStock('active-recipe-id', recipe.id);
            
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
        newChecked[index] = !newChecked[index];
        setCheckedSteps(newChecked);
        triggerHaptic();

        if (typeof window !== 'undefined') {
            ecrireStock('active-recipe-id', recipe.id);
            markCooking(recipe.id); // cuisson réellement démarrée
            // Prévient la home « Reprendre la cuisine » que la progression a changé.
            window.dispatchEvent(new Event('tv-progress-change'));
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
        }
    };

    const toggleIngredient = (index: number) => {
        // Sécurité mobile : si on a bougé de plus de 10px, on considère que c'est un scroll, pas un clic
        if (touchStart.current && touchEnd.current) {
            const dx = Math.abs(touchStart.current.x - touchEnd.current.x);
            const dy = Math.abs(touchStart.current.y - touchEnd.current.y);
            if (dx > 10 || dy > 10) return;
        }

        // Liste de courses réservée aux connectés → propose la connexion, ne coche rien.
        if (!authUser) { window.dispatchEvent(new Event('magic-open-auth')); return; }

        const newChecked = [...checkedIngredients];
        newChecked[index] = !newChecked[index];
        setCheckedIngredients(newChecked);
        triggerHaptic();
        syncCartFromChecked(newChecked);
    };

    // Écrit (ou retire) l'entrée « par recette » dans la liste de courses à chaque
    // coche, en direct → la pastille panier et l'onglet « Mes recettes » se
    // mettent à jour immédiatement, sans passer par un bouton d'ajout.
    const syncCartFromChecked = (checked: boolean[]) => {
        if (typeof window === 'undefined') return;
        try {
            const selected = recipe.ingredients
                .filter((_, idx) => checked[idx])
                .map(ing => {
                    const cleanName = ing.name.replace(/^[\uD83C-\uDBFF\uDC00-\uDFFF]+\s*/, '');
                    return ing.quantity
                        ? `${scaleQuantity(ing.quantity, ratio)} ${cleanName}`
                        : `${scaleQuantity(cleanName, ratio)}`;
                });
            const data = JSON.parse(window.localStorage.getItem('magic-shopping-list') || '{}');
            if (selected.length === 0) {
                delete data[recipe.id];
            } else {
                data[recipe.id] = {
                    title: recipe.title,
                    image: recipe.image,
                    ingredients: selected.map(name => ({ name, checked: false })),
                };
            }
            ecrireStock('magic-shopping-list', JSON.stringify(data));
            window.dispatchEvent(new Event('shoppingListUpdated'));
        } catch (e) {
            console.error('syncCartFromChecked', e);
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
                ecrireStock('magic-shopping-list', JSON.stringify(existingData));
                
                // Notifier le Header immédiatement
                window.dispatchEvent(new Event('shoppingListUpdated'));
                triggerHaptic();
            }
        } catch (err) {
            console.error('Erreur lors de la copie/ajout à la liste:', err);
            alert('Impossible de copier la liste automatiquement.');
        }
    };

    // #6 — Ajoute les ingrédients cochés à la liste "recettes individuelles"
    // (clé = recipe.id dans magic-shopping-list). Retourne le nb d'articles ajoutés.
    const addCheckedToCart = (): number => {
        if (typeof window === 'undefined') return 0;
        if (!authUser) { window.dispatchEvent(new Event('magic-open-auth')); return 0; }
        const selectedIngredients = recipe.ingredients
            .filter((_, idx) => checkedIngredients[idx])
            .map(ing => {
                const cleanName = ing.name.replace(/^[\uD83C-\uDBFF\uDC00-\uDFFF]+\s*/, '');
                return ing.quantity
                    ? `${scaleQuantity(ing.quantity, ratio)} ${cleanName}`
                    : `${scaleQuantity(cleanName, ratio)}`;
            });
        if (selectedIngredients.length === 0) return 0;
        try {
            const existingData = JSON.parse(window.localStorage.getItem('magic-shopping-list') || '{}');
            existingData[recipe.id] = {
                title: recipe.title,
                image: recipe.image,
                ingredients: selectedIngredients.map(name => ({ name, checked: false })),
            };
            ecrireStock('magic-shopping-list', JSON.stringify(existingData));
            window.dispatchEvent(new Event('shoppingListUpdated'));
            triggerHaptic();
        } catch (e) {
            console.error('addCheckedToCart', e);
        }
        return selectedIngredients.length;
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
    // `focusMode` capturé dans une closure vaut encore `false` juste après le clic
    // qui l'active : les callbacks vocaux lisent ce ref, jamais l'état.
    const focusModeRef = useRef(false);
    useEffect(() => { focusModeRef.current = focusMode; }, [focusMode]);
    const spokenRef = useRef<number | null>(null); // dernière étape lue à voix haute

    const speak = (text: string) => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            // On n'annule QUE s'il y a de quoi : sur iPhone, un `cancel()` suivi
            // aussitôt d'un `speak()` avale la nouvelle phrase, et on n'entend rien.
            if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
                window.speechSynthesis.cancel();
            }
            const utterance = new SpeechSynthesisUtterance(stripHtml(text));
            utterance.lang = 'fr-FR';
            utterance.rate = 1.0;
            
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
                        if (focusModeRef.current) startRecognitionRef.current();
                    }
                }, 8000);
            };
            
            utterance.onend = () => {
                isSpeakingRef.current = false;
                if (focusModeRef.current) setTimeout(() => startRecognitionRef.current(), 300);
            };

            window.speechSynthesis.speak(utterance);

            // Filet : il arrive que la toute première phrase reste coincée dans la
            // file (l'iPhone met la synthèse en pause de lui-même). Si rien n'a
            // démarré au bout d'une seconde, on la relance une fois.
            setTimeout(() => {
                if (isSpeakingRef.current) return;
                try {
                    window.speechSynthesis.resume();
                    if (!window.speechSynthesis.speaking) window.speechSynthesis.speak(utterance);
                } catch (e) { /* noop */ }
            }, 1000);
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
            if (SpeechRecognition && !recognitionRef.current && focusModeRef.current && !isSpeakingRef.current) {
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
                    if (focusModeRef.current && !isSpeakingRef.current) {
                        setTimeout(() => startRecognitionRef.current(), 250);
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
    }, []);

    // Les callbacks de la reconnaissance se rappellent eux-mêmes : le ref évite
    // la dépendance circulaire.
    const startRecognitionRef = useRef(startRecognition);
    useEffect(() => { startRecognitionRef.current = startRecognition; }, [startRecognition]);

    // Chien de garde : la reconnaissance s'arrête d'elle-même (silence, onglet en
    // arrière-plan, fin de lecture). Tant qu'on est en préparation, on la relance.
    useEffect(() => {
        if (!focusMode) return;
        const id = setInterval(() => {
            if (!recognitionRef.current && !isSpeakingRef.current) startRecognitionRef.current();
        }, 1500);
        return () => clearInterval(id);
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

    // Lecture de l'étape courante. `focusMode` doit être dans les deps : à l'entrée,
    // l'index vaut déjà 0 et ne change pas. `spokenRef` empêche la double lecture
    // quand le clic a déjà lancé l'étape 1.
    useEffect(() => {
        if (!focusMode) { spokenRef.current = null; return; }
        if (spokenRef.current === activeStepIndex) return;
        spokenRef.current = activeStepIndex;
        speak(recipe.steps[activeStepIndex]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeStepIndex, focusMode]);

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
            {/* Panier : pastille avec le nombre d'ingrédients ajoutés depuis cette
                recette. Un clic ouvre la liste de courses (panneau du shell TV+). */}
            {checkedIngredients.filter(Boolean).length > 0 && (
                <button
                    className={styles.cartBadge}
                    onClick={() => window.dispatchEvent(new Event('magic-open-courses'))}
                    aria-label="Voir ma liste de courses"
                >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                    <span className={styles.cartBadgeCount}>{checkedIngredients.filter(Boolean).length}</span>
                </button>
            )}

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
            <div
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
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >

            {/* Nouveau Hero Split-Screen UX Premium */}
            <div className={styles.heroNewLayout}>
                <div className={styles.heroGrid} style={{ alignItems: 'center', zIndex: 2, gap: '20px' }}>
                    {/* Colonne GAUCHE : Blabla (Infos) */}
                    <motion.div 
                        className={styles.heroTextColumn}
                        initial={{ opacity: 0, x: -70 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {/* Barre d'action Catégorie Apple Style */}
                        <div className={styles.categoryCommandCenter}>
                            <FavoriteButton
                                recipeId={recipe.id}
                                initialFavorite={recipe.isFavorite}
                                imageUrl={recipe.image}
                                className={styles['favorite-btn-action']}
                            />

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

                            {/* Un seul partage par surface : la carte image porte le
                                lien, le titre et le QR code. Le bouton « Image » de
                                la rangée d'outils faisait double emploi avec lui. */}
                            <button
                                className={styles['share-btn-action']}
                                onClick={() => setShowShareCard(true)}
                                aria-label="Partager la recette"
                                title="Partager la recette"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 15V3" /><path d="m8 7 4-4 4 4" /><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
                                </svg>
                            </button>
                        </div>

                        <div className={styles.heroMainContent}>
                            <h1 className={styles.heroTitleElegant} ref={titreRef}>
                                <SplitTitle text={decodeHtml(recipe.title)} noAnimation={true} plain />
                            </h1>
                            
                            {recipe.description && (
                                <div 
                                    className={styles.heroDescription}
                                    dangerouslySetInnerHTML={{ __html: decodeHtml(recipe.description) }}
                                />
                            )}
                        </div>

                        {/* Le bouton d'action et le prix vont de pair : ce que le plat
                            demande de gestes, et ce qu'il coûte. */}
                        <div className={styles.heroActionsRow}>
                        {recipe.category !== 'restaurant' && recipe.steps.length > 0 && !focusMode && (
                            <button className={styles.heroFocusBtn} onClick={() => {
                                setFocusMode(true);
                                setActiveStepIndex(0);
                                markCooking(recipe.id);
                                window.dispatchEvent(new Event('tv-progress-change'));
                                triggerHaptic();
                                // Scroll auto vers le focus card (HUD)
                                window.scrollTo({ top: 0, behavior: 'smooth' });

                                // Dans la pile du geste : hors de là, le navigateur
                                // refuse la synthèse ET le micro. `focusModeRef` est
                                // posé à la main, l'état n'arrivant qu'au rendu suivant.
                                focusModeRef.current = true;
                                spokenRef.current = 0;
                                // La VOIX D'ABORD, le micro ensuite (il s'ouvre à la fin
                                // de la lecture) : ouvrir le micro avant met la sortie
                                // audio en mode enregistrement et la voix ne sort pas.
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

                            {/* Ce que le plat coûte à faire, à côté de ce qu'il demande de temps. */}
                            <PrixMoyen prix={prix} />
                        </div>
                    </motion.div>

                    {/* Colonne DROITE : Photo avec Actions interactives */}
                    <div className={styles.heroImageColumn}>
                        {(recipe.category === 'restaurant' && recipe.restaurant?.photos?.length) ? (
                            /* Restaurant : galerie swipeable = photo principale (cadre stylé) + miniatures */
                            <RestaurantGallery
                                photos={recipe.restaurant.photos}
                                alt={recipe.title}
                                initialIndex={(recipe.restaurant.cover || 1) - 1}
                                onNextRestaurant={restoNav ? () => openResto(restoNav.next) : undefined}
                                onPrevRestaurant={restoNav ? () => openResto(restoNav.prev) : undefined}
                            />
                        ) : (
                        /* 1. Carte Image avec bouton Flamme superposé */
                        <div className={styles.imageCardContainer}>
                            {recipe.image ? (
                                <Image
                                    // La fiche montre UNE photo en grand : elle prend
                                    // l'exemplaire 1200 px, pas la vignette des cartes.
                                    src={grandePhoto(recipe.image)}
                                    alt={recipe.title}
                                    fill
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 700px, 800px"
                                    className={styles.imageMain}
                                    style={{ objectFit: 'cover' }}
                                    priority={true}
                                />) : (
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
                    <div className={styles.metaContent}>
                        <div className={styles.metaItem}>
                            <div className={styles.metaLabel}>PRÉPARATION</div>
                            <div className={styles.metaValue}>{(timing.steps > 0 ? timing.prepTime : (recipe.prepTime || 15))} min</div>
                        </div>
                        <div className={styles.metaSeparator} />
                        <div className={styles.metaItem}>
                            <div className={styles.metaLabel}>CUISSON</div>
                            <div className={styles.metaValue}>{timing.cookTime > 0 ? `${timing.cookTime} min` : '—'}</div>
                        </div>
                        <div className={styles.metaSeparator} />
                        <div className={styles.metaItem}>
                            <div className={styles.metaLabel}>DIFFICULTÉ</div>
                            <div className={styles.metaValue}>
                                <DifficultyMeter
                                    prepTime={timing.prepTime}
                                    cookTime={timing.cookTime}
                                    steps={timing.steps}
                                    difficulty={timing.difficulty}
                                />
                            </div>
                        </div>
                        <div className={styles.metaSeparator} />
                        <div className={styles.metaItem}>
                            <div className={styles.metaLabel}>{authUser ? 'MA NOTE' : 'NOTE'}</div>
                            <StarRating recipeId={recipe.id} size="small" />
                        </div>
                        {calorieEstimate && calorieEstimate.confidence !== 'low' && (
                            <>
                                <div className={styles.metaSeparator} />
                                <div className={styles.metaItem}>
                                    <div className={styles.metaLabel}>CALORIES</div>
                                    <div className={styles.metaValue}>{calorieEstimate.perServing} kcal<span style={{fontSize:'0.7rem',opacity:0.5}}>/pers.</span></div>
                                </div>
                            </>
                        )}
                    </div>
                    {/* Le Nutri-Score passe SOUS la rangée : l'échelle A–E et sa
                        phrase ne tiennent pas dans une case de quatre-vingts pixels,
                        et la bande est déjà prévue pour un panneau pleine largeur. */}
                    {nutriscore && (
                        <div className={styles.nutriscoreRangee}>
                            <NutriScore resultat={nutriscore} />
                        </div>
                    )}
                </div>
            )}

            {/* #11 — Carnet de cuisine perso (connectés) */}
            {/* Une adresse et une recette n'appellent pas le même conseil. */}
            <Tip id={recipe.category === 'restaurant' ? 'resto' : 'fiche'} delay={1600} />
            {recipe.category !== 'restaurant' && <CookingJournal recipeId={recipe.id} />}

            {/* Fiche « Comme au resto ». Même composant que sur le téléphone :
                ces deux arbres divergent dès qu'on les laisse faire, et cette
                rubrique-là a du contenu rédigé qu'il serait absurde de traiter
                deux fois. Seules les étoiles diffèrent, donc elles arrivent en
                accessoire. */}
            {recipe.category === 'restaurant' && (
                <div className={styles.restaurantContent}>
                    <FicheResto
                        recipe={recipe}
                        note={<StarRating recipeId={recipe.id} size="small" />}
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
                            <div className={styles.ingredientsActionBlock}>
                                {/* Panier : apparaît dès qu'un ingrédient est coché (connecté).
                                    Un clic ouvre la liste de courses dans le shell TV+. */}
                                {authUser && checkedCount > 0 && (
                                <div className={styles.ingredientProgress}>
                                    <button
                                        type="button"
                                        className={styles.cartPill}
                                        onClick={() => { addCheckedToCart(); window.dispatchEvent(new Event('magic-open-courses')); }}
                                        aria-label={`Voir ma liste de courses (${checkedCount})`}
                                        title={`${checkedCount} ingrédient(s) — voir la liste`}
                                    >
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                        </svg>
                                        <span className={styles.cartPillCount}>{checkedCount}</span>
                                    </button>
                                </div>
                                )}
                                <div className={styles.tabActionsUnified}>
                                    <PortionsControl
                                        value={servings}
                                        base={recipe.servings || 4}
                                        onChange={setServings}
                                    />
                                    <MagicConverter />
                                    <WinePairing
                                        recipeId={recipe.id}
                                        title={recipe.title}
                                        category={recipe.category}
                                        ingredients={recipe.ingredients}
                                    />
                                    <CaveMatch recipe={recipe} />
                                </div>
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
                                            {/* Case ronde à cocher, à gauche (mode liste). */}
                                            <span className={`${styles.ingCheck} ${checkedIngredients[idx] ? styles.ingCheckOn : ''}`}>
                                                {checkedIngredients[idx] && (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4.5 12.5 9.5 17.5 19.5 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                )}
                                            </span>

                                            {/* Photo ingrédient */}
                                            <div className={styles.ingIconWrap}>
                                                {(() => {
                                                    const visual = ing.image || getIngredientVisual(ing.name);
                                                    if (visual) {
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 10px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', opacity: 0.5, textTransform: 'uppercase' }}>
                            {recipe.category === 'restaurant' ? 'Autres restaurants' : 'Recettes similaires'}
                        </span>
                        {similarRecipes.length > 5 && (
                            <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>
                                {simPage * 5 + 1}-{Math.min(simPage * 5 + 5, similarRecipes.length)} / {similarRecipes.length}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px 4px' }}>
                        <div style={{ display: 'flex', gap: 10, flex: 1, overflow: 'hidden' }}>
                            {similarRecipes.slice(simPage * 5, simPage * 5 + 5).map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => {
                                        window.dispatchEvent(new CustomEvent('openRecipe', { detail: r }));
                                        setSimPage(0);
                                    }}
                                    style={{
                                        flexShrink: 0, width: 130, background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
                                        overflow: 'hidden', cursor: 'pointer', padding: 0, textAlign: 'left', display: 'block'
                                    }}
                                >
                                    <img src={r.image} alt={r.title} style={{ width: '100%', height: 85, objectFit: 'cover', display: 'block' }} />
                                    <div style={{ padding: '6px 10px', fontSize: '0.72rem', color: 'white', fontWeight: 600, lineHeight: 1.3,
                                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {r.title}
                                    </div>
                                </button>
                            ))}
                        </div>
                        {/* Bouton page suivante */}
                        {similarRecipes.length > 5 && (simPage + 1) * 5 < similarRecipes.length && (
                            <button
                                onClick={() => setSimPage(p => p + 1)}
                                style={{
                                    flexShrink: 0, width: 40, height: 100, background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14,
                                    cursor: 'pointer', color: 'white', fontSize: '1.4rem', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center'
                                }}
                            >›</button>
                        )}
                        {/* Bouton retour page précédente */}
                        {simPage > 0 && (
                            <button
                                onClick={() => setSimPage(p => p - 1)}
                                style={{
                                    flexShrink: 0, width: 40, height: 100, background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14,
                                    cursor: 'pointer', color: 'white', fontSize: '1.4rem', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', order: -1
                                }}
                            >‹</button>
                        )}
                    </div>
                </div>
            )}

            {/* Commentaires : lisibles par tous. Publier reste réservé aux connectés (géré dans le composant). */}
            {!focusMode && <CommentSection recipeId={String(recipe.id)} />}

            {focusMode && (
                /* Portail vers <body> : la fiche parente porte un `transform`, ce qui
                   en fait le référent des position:fixed — l'overlay « plein écran »
                   héritait de son décalage (bandeau et titre coupés à mi-écran). */
                <Portal>
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
                        {/* Miniature + titre : savoir d'un coup d'œil quelle recette tourne. */}
                        {recipe.image && (
                            <img src={recipe.image} alt="" className={styles.focusThumb} draggable={false} />
                        )}
                        <div className={styles.focusTitle}>{decodeHtml(recipe.title)}</div>
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
                </Portal>
            )}
        </div>

        {showShareCard && <RecipeShareCard recipe={recipe} onClose={() => setShowShareCard(false)} />}
        </>
    );
}
