'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Recipe } from '@/mobile/types';
import { scaleQuantity } from '@/mobile/lib/utils';
import { getIngredientVisual } from '@/mobile/lib/ingredient-utils';
import { parseIngredient } from '@/mobile/lib/ingredient-parser';
import { useLocalStorage } from '@/mobile/hooks/useLocalStorage';
import { useTimer } from '@/mobile/components/Timer/TimerContext';
import { parseDuration, stripHtml } from '@/mobile/lib/timer-utils';
import SmartText from '@/mobile/components/SmartText/SmartText';
import MagicConverter from '@/mobile/components/MagicConverter/MagicConverter';
import VideoSection from '@/mobile/components/VideoSection/VideoSection';
import styles from './RecipeDetail.module.css';

interface RecipeDetailProps {
    recipe: Recipe;
    onClose: () => void;
}

type TabId = 'ingredients' | 'steps' | 'video';

export default function RecipeDetail({ recipe, onClose }: RecipeDetailProps) {
    const { startTimer } = useTimer();
    const [servings, setServings] = useState(recipe.servings || 4);
    const [focusMode, setFocusMode] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('ingredients');
    const tabContentRef = useRef<HTMLDivElement>(null);
    const isSpeakingRef = useRef(false);
    const recognitionRef = useRef<any>(null);

    // Persistence
    const [checkedSteps, setCheckedSteps] = useLocalStorage<boolean[]>(`recipe-steps-${recipe.id}`, new Array(recipe.steps.length).fill(false));
    const [checkedIngredients, setCheckedIngredients] = useLocalStorage<boolean[]>(`recipe-ing-v2-${recipe.id}`, new Array(recipe.ingredients.length).fill(false));

    useEffect(() => {
        setMounted(true);
        // On force le défilement du body au début pour iPhone
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    // Listener pour le reset du chrono (X cliqué ou fin du temps)
    useEffect(() => {
        const handleReset = (e: any) => {
            if (String(e.detail?.recipeId) === String(recipe.id)) {
                setCheckedSteps(new Array(recipe.steps.length).fill(false));
                setCheckedIngredients(new Array(recipe.ingredients.length).fill(false));
                if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([10, 30, 10]);
            }
        };
        window.addEventListener('timerReset', handleReset);
        return () => window.removeEventListener('timerReset', handleReset);
    }, [recipe.id, recipe.steps.length, recipe.ingredients.length, setCheckedSteps, setCheckedIngredients]);

    const ratio = useMemo(() => servings / (recipe.servings || 4), [servings, recipe.servings]);

    const triggerHaptic = () => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(10);
        }
    };

    const toggleStep = (index: number) => {
        const newChecked = [...checkedSteps];
        newChecked[index] = !newChecked[index];
        setCheckedSteps(newChecked);
        triggerHaptic();

        if (newChecked[index]) {
            const stepText = recipe.steps[index];
            const minutes = parseDuration(stepText);
            if (minutes) {
                const cleanLabel = stripHtml(stepText);
                const shortLabel = cleanLabel.length > 50 ? cleanLabel.substring(0, 47) + '...' : cleanLabel;
                startTimer(minutes, shortLabel, recipe.id);
            }
        }
    };

    const toggleIngredient = (index: number) => {
        const newChecked = [...checkedIngredients];
        newChecked[index] = !newChecked[index];
        setCheckedIngredients(newChecked);
        triggerHaptic();
    };

    const copyIngredients = async () => {
        try {
            const selectedIngredients = recipe.ingredients
                .filter((_, idx) => checkedIngredients[idx])
                .map(ing => {
                    const parsed = parseIngredient(ing.name);
                    const qty = parsed.quantity ? scaleQuantity(parsed.quantity, ratio) : '';
                    const unit = parsed.unit ? `${parsed.unit} ` : '';
                    const name = parsed.name;
                    return `- ${qty} ${unit}${name}`.trim();
                });

            if (selectedIngredients.length === 0) {
                alert('Veuillez cocher au moins un ingrédient ! 🛒');
                return;
            }

            const text = selectedIngredients.join('\n');
            const fullText = `🛒 Liste de courses : ${recipe.title}\n\n${text}`;

            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(fullText);
            }

            const existingData = JSON.parse(localStorage.getItem('magic-shopping-list') || '{}');
            existingData[recipe.id] = {
                title: recipe.title,
                ingredients: selectedIngredients.map(name => ({ name, checked: false }))
            };
            localStorage.setItem('magic-shopping-list', JSON.stringify(existingData));
            window.dispatchEvent(new Event('shoppingListUpdated'));
            triggerHaptic();
            alert('Ajouté au panier ! 🛒');
        } catch (err) {
            console.error('Erreur panier:', err);
        }
    };

    const speak = (text: string) => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(stripHtml(text));
            utterance.lang = 'fr-FR';
            utterance.onstart = () => { isSpeakingRef.current = true; };
            utterance.onend = () => {
                isSpeakingRef.current = false;
                if (focusMode) setTimeout(startRecognition, 300);
            };
            window.speechSynthesis.speak(utterance);
        }
    };

    const startRecognition = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition && !recognitionRef.current && focusMode && !isSpeakingRef.current) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'fr-FR';
            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => {
                setIsListening(false);
                recognitionRef.current = null;
                if (focusMode && !isSpeakingRef.current) setTimeout(startRecognition, 250);
            };
            recognition.onresult = (event: any) => {
                const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
                if (/suivant|prochain|go/.test(transcript)) handleNextStep();
                else if (/précédent|retour/.test(transcript)) handlePrevStep();
                else if (/répète|encore/.test(transcript)) speak(recipe.steps[activeStepIndex]);
            };
            recognition.start();
            recognitionRef.current = recognition;
        }
    }, [focusMode, activeStepIndex]);

    const handleNextStep = () => {
        if (activeStepIndex < recipe.steps.length - 1) {
            setActiveStepIndex(prev => prev + 1);
        } else {
            setFocusMode(false);
            alert('Recette terminée ! 🥂');
        }
    };

    const handlePrevStep = () => {
        if (activeStepIndex > 0) setActiveStepIndex(prev => prev - 1);
    };

    useEffect(() => {
        if (focusMode) {
            startRecognition();
            speak(recipe.steps[activeStepIndex]);
        }
        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
            window.speechSynthesis.cancel();
        };
    }, [focusMode, activeStepIndex]);

    const progress = (checkedSteps.filter(Boolean).length / recipe.steps.length) * 100;

    return (
        <motion.div 
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div 
                className={styles.page}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 40, stiffness: 450, mass: 0.8 }}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={0.05}
                dragMomentum={false}
                onDragEnd={(_, info) => {
                    if (info.offset.y > 100 || info.velocity.y > 500) onClose();
                }}
            >
                <div className={styles.heroDragArea}>
                    <div className={styles.grabHandle} />
                    <div className={styles.headerActions}>
                        <button className={styles.closeBtn} onClick={onClose}>✕</button>
                    </div>
                </div>

                <div className={styles.scrollableContent}>
                    <div className={styles.heroWrapper}>
                        <Image 
                            src={recipe.image || "/placeholder-recipe.jpg"} 
                            alt={recipe.title}
                            fill
                            className={styles.recipeImage}
                            priority
                        />
                        <div className={styles.overlay} />
                    </div>

                    <div className={styles.contentHeaderPad}>
                        <motion.span className={styles.categoryBadge}>{recipe.category.toUpperCase()}</motion.span>
                        <h1 className={styles.title}>{recipe.title}</h1>
                    </div>

                    <div className={styles.metaStrip}>
                        <div className={styles.metaItem}>
                            <span className={styles.metaIcon}>👥</span>
                            <div className={styles.servingsControl}>
                                <button onClick={() => setServings(Math.max(1, servings - 1))}>-</button>
                                <span>{servings}</span>
                                <button onClick={() => setServings(servings + 1)}>+</button>
                            </div>
                        </div>
                        <div className={styles.metaItem}>
                            <span className={styles.metaIcon}>⏱️</span>
                            <span>{(recipe.prepTime || 0) + (recipe.cookTime || 0)} min</span>
                        </div>
                    </div>

                    <div className={styles.tabsBar}>
                        <div 
                            className={styles.tabIndicator} 
                            style={{ 
                                left: `${(activeTab === 'ingredients' ? 0 : activeTab === 'steps' ? 1 : 2) * 33.33}%`,
                                width: '33.33%'
                            }} 
                        />
                        <button className={`${styles.tabBtn} ${activeTab === 'ingredients' ? styles.tabActive : ''}`} onClick={() => setActiveTab('ingredients')}>Ingrédients</button>
                        <button className={`${styles.tabBtn} ${activeTab === 'steps' ? styles.tabActive : ''}`} onClick={() => setActiveTab('steps')}>Étapes</button>
                        <button className={`${styles.tabBtn} ${activeTab === 'video' ? styles.tabActive : ''}`} onClick={() => setActiveTab('video')}>Vidéo</button>
                    </div>

                    <div className={styles.contentPad}>
                        {activeTab === 'ingredients' && (
                            <div className={styles.ingredientsSection}>
                                <div className={styles.sectionHeader}>
                                    <MagicConverter />
                                </div>
                                <div className={styles.ingredientsGrid}>
                                    {recipe.ingredients.map((ing, idx) => {
                                        const parsed = parseIngredient(ing.name);
                                        const visual = ing.image || getIngredientVisual(parsed.name);
                                        
                                        return (
                                        <div key={idx} className={`${styles.ingredientCard} ${checkedIngredients[idx] ? styles.ingredientChecked : ''}`} onClick={() => toggleIngredient(idx)}>
                                            <div className={styles.ingIcon}>
                                                {visual ? <img src={visual} alt={parsed.name} className={styles.ingImg} /> : <span className={styles.ingEmoji}>{parsed.emoji || '🥗'}</span>}
                                                {checkedIngredients[idx] && <div className={styles.checkBadge}>✓</div>}
                                            </div>
                                            <div className={styles.ingText}>
                                                <span className={styles.ingQty}>{parsed.quantity ? scaleQuantity(parsed.quantity, ratio) : ''} {parsed.unit || ''}</span>
                                                <span className={styles.ingName}>{parsed.name}</span>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                        )}

                        {activeTab === 'steps' && (
                            <div className={styles.stepsSection}>
                                <div className={styles.focusTrigger}>
                                    <button className={styles.lancerBtn} onClick={() => setFocusMode(true)}>🚀 Lancer la préparation vocale</button>
                                </div>
                                {recipe.steps.map((step, idx) => (
                                    <div key={idx} className={`${styles.stepItem} ${checkedSteps[idx] ? styles.stepChecked : ''}`} onClick={() => toggleStep(idx)}>
                                        <div className={styles.stepNum}>{idx + 1}</div>
                                        <div className={styles.stepText}><SmartText text={step} /></div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'video' && (
                            <div className={styles.videoSection}>
                                <VideoSection videoHtml={recipe.videoHtml || ""} />
                            </div>
                        )}
                    </div>
                </div>

                <AnimatePresence>
                    {focusMode && (
                        <motion.div className={styles.focusOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <div className={styles.focusHeader}>
                                <h2>{recipe.title}</h2>
                                <button onClick={() => setFocusMode(false)}>✕</button>
                            </div>
                            <div className={styles.focusMain}>
                                <div className={styles.focusStepCard}>
                                    <h3>Étape {activeStepIndex + 1} / {recipe.steps.length}</h3>
                                    <p><SmartText text={recipe.steps[activeStepIndex]} /></p>
                                    {isListening && <div className={styles.listeningIcon}>🎤 À l&apos;écoute...</div>}
                                </div>
                            </div>
                            <div className={styles.focusControls}>
                                <button onClick={handlePrevStep} disabled={activeStepIndex === 0}>◀</button>
                                <button onClick={() => speak(recipe.steps[activeStepIndex])}>🔊 Répéter</button>
                                <button onClick={handleNextStep}>▶ {activeStepIndex === recipe.steps.length - 1 ? 'Terminer' : 'Suivant'}</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
}
