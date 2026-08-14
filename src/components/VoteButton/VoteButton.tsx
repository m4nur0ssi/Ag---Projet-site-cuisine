'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
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
    const [authUser, setAuthUser] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setAuthUser(session?.user ?? null));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setAuthUser(session?.user ?? null));
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const load = async () => {
            // Total likes (public)
            const { count } = await supabase
                .from('recipe_likes')
                .select('*', { count: 'exact', head: true })
                .eq('recipe_id', recipeId);

            const total = count ?? 0;
            setVotes(total);
            if (total > 0) setShowCount(true);

            // Check if current user voted
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data } = await supabase
                    .from('recipe_likes')
                    .select('user_id')
                    .eq('recipe_id', recipeId)
                    .eq('user_id', session.user.id)
                    .maybeSingle();
                setHasVoted(!!data);
                if (!!data) setShowCount(true);
            }
        };
        load();
    }, [recipeId]);

    const handleVote = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isAnimating || !authUser) return;
        setIsAnimating(true);

        const newVotedState = !hasVoted;
        setHasVoted(newVotedState);
        setVotes(prev => newVotedState ? prev + 1 : Math.max(0, prev - 1));
        if (newVotedState) setShowCount(true);

        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(newVotedState ? [10, 30, 10] : 10);
        }

        if (newVotedState) {
            await supabase.from('recipe_likes').upsert({
                user_id: authUser.id,
                recipe_id: recipeId,
            });
        } else {
            await supabase.from('recipe_likes').delete()
                .eq('user_id', authUser.id)
                .eq('recipe_id', recipeId);
            // Hide count if 0
            setVotes(prev => {
                if (prev <= 0) setShowCount(false);
                return prev;
            });
        }

        setTimeout(() => setIsAnimating(false), 800);
    };

    return (
        <div
            className={`${styles.voteWrapper} ${hasVoted ? styles.isVoted : ''} ${showCount ? styles.showCount : ''} ${className || ''}`}
            onClick={handleVote}
            title={!authUser ? 'Connecte-toi pour voter' : undefined}
        >
            <div className={styles.bubblesContainer}>
                <motion.div
                    className={`${styles.bubble} ${styles.flameBubble}`}
                    whileHover={{ scale: authUser ? 1.05 : 1 }}
                    whileTap={{ scale: authUser ? 0.9 : 1 }}
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
                        {/* Flamme dégradée (or → corail → rose) façon Apple TV+. */}
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <defs>
                                <linearGradient id="vbFlame" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0" stopColor="#FFD24B" />
                                    <stop offset=".5" stopColor="#FF6B4A" />
                                    <stop offset="1" stopColor="#FF2E63" />
                                </linearGradient>
                            </defs>
                            <path d="M12 2c1.6 3.2.6 5.2-1 6.9C9.2 10.8 8 12.2 8 14.6A4 4 0 0 0 12 18.6a4 4 0 0 0 4-4c0-1.4-.6-2.4-1.2-3.3 2 .5 2.7 2.4 2.7 4.1A5.5 5.5 0 0 1 12 21a5.5 5.5 0 0 1-5.5-5.5c0-3.3 2.4-5 3.9-7C11.6 5.9 12.3 4.2 12 2z" fill="url(#vbFlame)" />
                        </svg>
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

                <AnimatePresence>
                    {showCount && !hideCount && (
                        <motion.div
                            initial={{ opacity: 0, x: -10, scale: 0, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, x: -10, scale: 0, filter: 'blur(10px)' }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
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
