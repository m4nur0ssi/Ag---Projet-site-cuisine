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
