'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/mobile/lib/supabase';
import styles from './VoteButtonSheet.module.css';

interface VoteButtonSheetProps {
    recipeId: string;
    initialVotes?: number;
    className?: string;
}

// Flamme Style Feu Réaliste - Version plus généreuse (30px)
const PremiumFlame = ({ active }: { active: boolean }) => (
    <svg width="30" height="30" viewBox="2 2 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="fireGradient" x1="16" y1="30" x2="16" y2="2">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="50%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
        </defs>
        
        {/* Flamme arrière - Agrandie */}
        <motion.path 
            d="M16 2.5C16 2.5 25 10.5 25 19C25 24.5 21 29 16 29C11 29 7 24.5 7 19C7 13.5 9 7 16 2.5Z"
            fill="url(#fireGradient)"
            animate={active ? { 
                scale: [1, 1.08, 1],
                opacity: [0.85, 1, 0.85],
                rotate: [-2, 2, -2]
            } : { scale: 0.95 }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Flamme centrale - Plus présente */}
        <motion.path 
            d="M16 8.5C16 8.5 22 15 22 20.5C22 23.8 19.3 26.5 16 26.5C12.7 26.5 10 23.8 10 20.5C10 17 12.5 11.5 16 8.5Z"
            fill="#FACC15"
            style={{ mixBlendMode: 'overlay' }}
            animate={active ? { 
                scale: [0.98, 1.15, 0.98],
                opacity: [0.6, 0.9, 0.6]
            } : { opacity: 0.4 }}
            transition={{ duration: 0.35, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
        />

        {/* Noyau Ardent */}
        <motion.path 
            d="M16 15C16 15 19 18.5 19 22C19 23.6 17.6 25 16 25C14.4 25 13 23.6 13 22C13 19.5 14.5 17 16 15Z"
            fill="#FFF"
            style={{ opacity: 0.7 }}
            animate={active ? { 
                y: [0, -3, 0],
                opacity: [0.5, 0.85, 0.5]
            } : { opacity: 0.25 }}
            transition={{ duration: 1.0, repeat: Infinity, ease: "easeInOut" }}
        />
    </svg>
);

export default function VoteButtonSheet({ recipeId, initialVotes = 0, className }: VoteButtonSheetProps) {
    const [votes, setVotes] = useState(initialVotes);
    const [hasVoted, setHasVoted] = useState(false);
    const [authUser, setAuthUser] = useState<{ id: string } | null>(null);

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
            setVotes(count ?? 0);

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
            } else {
                setHasVoted(false);
            }
        };
        load();
    }, [recipeId]);

    const handleVoteToggle = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!authUser) { window.dispatchEvent(new Event('magic-open-auth')); return; } // connexion requise pour voter

        const newState = !hasVoted;
        setHasVoted(newState);
        setVotes(prev => newState ? prev + 1 : Math.max(0, prev - 1));

        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(newState ? [20, 40, 20] : [12]);
        }

        if (newState) {
            await supabase.from('recipe_likes').upsert({
                user_id: authUser.id,
                recipe_id: recipeId,
            });
        } else {
            await supabase.from('recipe_likes').delete()
                .eq('user_id', authUser.id)
                .eq('recipe_id', recipeId);
        }
    };

    return (
        <div className={`${styles.voteWrapper} ${className || ''}`}>
            <motion.div 
                className={styles.splitContainer}
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
                {/* Bouton Flamme (Toggle) */}
                <motion.button
                    layout
                    className={`${styles.flameBubble} ${hasVoted ? styles.voted : ''}`}
                    onClick={handleVoteToggle}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.85 }}
                >
                    <PremiumFlame active={hasVoted} />
                </motion.button>

                {/* Bulle Compteur Transparente */}
                <AnimatePresence>
                    {votes > 0 && (
                        <motion.div 
                            layout
                            className={styles.countBubble}
                            initial={{ scale: 0, opacity: 0, x: -10 }}
                            animate={{ scale: 1, opacity: 1, x: 0 }}
                            exit={{ scale: 0, opacity: 0, x: -10 }}
                            transition={{ type: 'spring', stiffness: 600, damping: 25 }}
                        >
                            <motion.span 
                                key={votes}
                                initial={{ y: 12, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className={styles.votesNumber}
                            >
                                {votes}
                            </motion.span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
