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

const FlameIcon = ({ active }: { active: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#ff3b30" : "none"} stroke={active ? "#ff3b30" : "currentColor"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2c0 0-2 4-2 7.5s2 4.5 2 4.5 2-1 2-4.5S12 2 12 2z" />
        <path d="M12 2C12 2 7 8 7 14c0 3 2 5 5 5s5-2 5-5c0-6-5-12-5-12z" />
        <path d="M12 7c0 4-1.5 6-1.5 8 0 1 .5 2 1.5 2s1.5-1 1.5-2c0-2-1.5-4-1.5-8z" opacity={active ? 1 : 0.4} />
    </svg>
);

export default function VoteButton({ recipeId, initialVotes = 0, className, hideCount = false }: VoteButtonProps) {
    const [votes, setVotes] = useState(initialVotes);
    const [hasVoted, setHasVoted] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        const votedRecipes = JSON.parse(localStorage.getItem('voted_recipes') || '[]');
        setHasVoted(votedRecipes.includes(recipeId));

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

        setHasVoted(true);
        setVotes(prev => prev + 1);
        
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 800);

        let votedRecipes = JSON.parse(localStorage.getItem('voted_recipes') || '[]');
        if (!votedRecipes.includes(recipeId)) votedRecipes.push(recipeId);
        localStorage.setItem('voted_recipes', JSON.stringify(votedRecipes));

        // Vibrate for feedback
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([15]);
        }

        try {
            await fetch('/api/votes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipeId, action: 'add' })
            });
        } catch (err) {}
    };

    const hasAnyVotes = votes > 0;

    return (
        <div 
            className={`${className || ''}`}
            onClick={handleVote}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
            <motion.div 
                animate={isAnimating ? { scale: [1, 1.2, 1] } : {}}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
                <FlameIcon active={hasVoted} />
            </motion.div>
            
            <AnimatePresence>
                {hasAnyVotes && !hideCount && (
                    <motion.span
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{ fontSize: '15px', fontWeight: '900', color: '#ff3b30', textShadow: '0 0 12px rgba(255, 59, 48, 0.4)' }}
                    >
                        {votes}
                    </motion.span>
                )}
            </AnimatePresence>
        </div>
    );
}
