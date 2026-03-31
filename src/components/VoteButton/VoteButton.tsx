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
    const [justVoted, setJustVoted] = useState(false);

    useEffect(() => {
        // Récupérer les votes réels depuis l'API
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

        // Optimistic UI : +1 à chaque clic
        setVotes(prev => prev + 1);
        setIsAnimating(true);
        setJustVoted(true);
        setTimeout(() => setIsAnimating(false), 800);
        setTimeout(() => setJustVoted(false), 1500);

        // Envoyer à l'API (+1 à chaque fois)
        try {
            await fetch('/api/votes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    recipeId, 
                    action: 'add'
                })
            });
        } catch (err) {
            console.error('Erreur vote:', err);
        }
    };

    const hasAnyVotes = votes > 0;

    return (
        <div 
            className={`${styles.voteWrapper} ${justVoted ? styles.hasVoted : ''} ${hasAnyVotes ? styles.hasAnyVotes : ''} ${className || ''}`}
            onClick={handleVote}
        >
            <div className={styles.bubblesContainer}>
                {/* Main Flame Bubble */}
                <motion.div 
                    className={styles.bubble}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    <div className={styles.liquidReflect} />
                    <motion.span 
                        className={styles.flameIcon}
                        animate={isAnimating ? { 
                            scale: [1, 1.5, 1],
                            rotate: [0, -15, 15, 0]
                        } : {}}
                    >
                        🔥
                    </motion.span>
                    
                    <AnimatePresence>
                        {isAnimating && (
                            <motion.span
                                key={votes}
                                initial={{ opacity: 1, scale: 0.5, y: 0 }}
                                animate={{ opacity: 0, scale: 1.8, y: -55 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.7 }}
                                className={styles.floatingFlame}
                            >
                                🔥
                            </motion.span>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Count Bubble - Pops out to the right */}
                <AnimatePresence>
                    {hasAnyVotes && !hideCount && (
                        <motion.div
                            initial={{ opacity: 0, x: -20, scale: 0.5 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -20, scale: 0.5 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className={`${styles.bubble} ${styles.countBubble}`}
                        >
                            <div className={styles.liquidReflect} />
                            <span className={styles.countText}>{votes}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
