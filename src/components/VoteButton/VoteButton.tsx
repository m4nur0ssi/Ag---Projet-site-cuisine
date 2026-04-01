'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './VoteButton.module.css';

interface VoteButtonProps {
    recipeId: string;
    initialVotes?: number;
    className?: string;
    hideCount?: boolean;
}

export default function VoteButton({ recipeId, initialVotes = 0, className, hideCount = false }: VoteButtonProps) {
    const [votes, setVotes] = useState(initialVotes);
    const [isAnimating, setIsAnimating] = useState(false);
    const [hasVoted, setHasVoted] = useState(false);
    const [showCount, setShowCount] = useState(false);

    useEffect(() => {
        // 1. Check if user already voted on this device
        const voted = localStorage.getItem(`magic-voted-${recipeId}`) === 'true';
        setHasVoted(voted);
        if (voted) setShowCount(true);

        // 2. Fetch real-time global votes from API
        fetch(`/api/votes?recipeId=${recipeId}`)
            .then(res => res.json())
            .then(data => {
                if (data.votes !== undefined) setVotes(data.votes);
            })
            .catch(() => {});
    }, [recipeId]);

    const handleVote = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isAnimating) return;
        setIsAnimating(true);

        const newVotedState = !hasVoted;
        const action = newVotedState ? 'add' : 'remove';

        // Optimistic UI updates
        setHasVoted(newVotedState);
        setVotes(prev => newVotedState ? prev + 1 : Math.max(0, prev - 1));
        
        if (newVotedState) {
            setShowCount(true);
            localStorage.setItem(`magic-voted-${recipeId}`, 'true');
        } else {
            localStorage.removeItem(`magic-voted-${recipeId}`);
            // Wait for animation before hiding count bubble
            setTimeout(() => {
                if (!localStorage.getItem(`magic-voted-${recipeId}`)) {
                    setShowCount(false);
                }
            }, 1000);
        }

        // Trigger Haptic
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(newVotedState ? [10, 30, 10] : 10);
        }

        // Global Sync (API handles Firestore/Supabase)
        try {
            await fetch('/api/votes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    recipeId, 
                    action
                })
            });
        } catch (err) {
            console.error('Erreur vote:', err);
        }

        setTimeout(() => setIsAnimating(false), 800);
    };

    return (
        <div 
            className={`${styles.voteWrapper} ${hasVoted ? styles.isVoted : ''} ${showCount ? styles.showCount : ''} ${className || ''}`}
            onClick={handleVote}
        >
            <div className={styles.bubblesContainer}>
                {/* Main Flame Bubble */}
                <motion.div 
                    className={`${styles.bubble} ${styles.flameBubble}`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                    <div className={styles.liquidReflect} />
                    <motion.span 
                        className={styles.flameIcon}
                        animate={isAnimating ? { 
                            scale: [1, 1.4, 1],
                            rotate: hasVoted ? [0, 15, -15, 0] : [0, -15, 15, 0]
                        } : {}}
                    >
                        🔥
                    </motion.span>
                    
                    <AnimatePresence>
                        {isAnimating && (
                            <motion.span
                                key={votes + (hasVoted ? '-add' : '-rem')}
                                initial={{ opacity: 1, scale: 0.5, y: 0 }}
                                animate={{ 
                                    opacity: 0, 
                                    scale: hasVoted ? 2 : 0, 
                                    y: hasVoted ? -60 : 40 
                                }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.6 }}
                                className={styles.floatingFlame}
                            >
                                🔥
                            </motion.span>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Count Bubble - Pops out from the "belly" of the flame */}
                <AnimatePresence>
                    {showCount && !hideCount && (
                        <motion.div
                            initial={{ opacity: 0, x: -10, scale: 0, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, x: -10, scale: 0, filter: 'blur(10px)' }}
                            transition={{ 
                                type: 'spring', 
                                stiffness: 500, 
                                damping: 30,
                                mass: 0.8
                            }}
                            className={`${styles.bubble} ${styles.countBubble}`}
                        >
                            <div className={styles.liquidReflect} />
                            <motion.span 
                                key={votes}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={styles.countText}
                            >
                                {votes}
                            </motion.span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
