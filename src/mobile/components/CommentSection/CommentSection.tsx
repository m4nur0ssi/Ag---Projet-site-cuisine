'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/mobile/lib/supabase';
import styles from './CommentSection.module.css';

interface Comment {
    id: string;
    pseudo: string;
    content: string;
    created_at: string;
}

interface CommentSectionProps {
    recipeId: string;
}

export default function CommentSection({ recipeId }: CommentSectionProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isAdding, setIsAdding] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [pseudo, setPseudo] = useState('');
    const [user, setUser] = useState<{ id: string; user_metadata?: Record<string, string>; email?: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const init = (session: { user: NonNullable<typeof user> } | null) => {
            const u = session?.user ?? null;
            setUser(u);
            if (u) {
                const name = u.user_metadata?.given_name
                    ?? u.user_metadata?.full_name?.split(' ')[0]
                    ?? u.email?.split('@')[0]
                    ?? 'Anonyme';
                setPseudo(name);
            }
        };
        supabase.auth.getSession().then(({ data: { session } }) => init(session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => init(session));
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from('comments')
                .select('id, pseudo, content, created_at')
                .eq('recipe_id', recipeId)
                .order('created_at', { ascending: false })
                .limit(20);
            if (data) setComments(data);
        };
        load();
    }, [recipeId]);

    useEffect(() => {
        if (isAdding) return;
        if (comments.length <= 1) return;
        const interval = setInterval(() => {
            setActiveIndex(prev => (prev + 1) % comments.length);
        }, 20000);
        return () => clearInterval(interval);
    }, [isAdding, comments.length]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim() || !user) return;
        setLoading(true);

        const { data, error } = await supabase.from('comments').insert({
            user_id: user.id,
            recipe_id: recipeId,
            pseudo: pseudo.trim() || 'Anonyme',
            content: commentText.trim(),
        }).select().single();

        if (!error && data) {
            setComments(prev => [data, ...prev]);
            setActiveIndex(0);
        }

        setCommentText('');
        setIsAdding(false);
        setLoading(false);
    };

    const addEmoji = (emoji: string) => {
        setCommentText(prev => prev + emoji);
        textareaRef.current?.focus();
    };

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    return (
        <div className={styles.section}>
            <div className={styles.header}>
                <h3 className={styles.title}>Commentaires</h3>
                {user && (
                    <button className={styles.addBtn} onClick={() => { setIsAdding(true); setTimeout(() => textareaRef.current?.focus(), 100); }}>
                        <span>+</span> Ajouter
                    </button>
                )}
            </div>

            <AnimatePresence mode="wait">
                {isAdding ? (
                    <motion.div
                        key="form"
                        className={styles.addForm}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                    >
                        <form onSubmit={handleSubmit}>
                            <div className={styles.pseudoDisplay}>💬 {pseudo}</div>
                            <textarea
                                ref={textareaRef}
                                className={styles.textarea}
                                placeholder="Votre commentaire..."
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                            />
                            <div className={styles.emojiPicker}>
                                {['😍', '😋', '👌', '🔥', '👩‍🍳', '👨‍🍳', '🍲', '❤️', '✨'].map(emoji => (
                                    <button type="button" key={emoji} className={styles.emojiBtn} onClick={() => addEmoji(emoji)}>
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                            <div className={styles.formActions}>
                                <button type="button" className={styles.cancelBtn} onClick={() => { setIsAdding(false); setCommentText(''); }}>Annuler</button>
                                <button type="submit" className={styles.submitBtn} disabled={loading}>
                                    {loading ? '...' : 'Publier'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                ) : comments.length === 0 ? (
                    <div
                        className={styles.empty}
                        onClick={() => { if (!user) window.dispatchEvent(new Event('magic-open-auth')); }}
                        style={!user ? { cursor: 'pointer' } : undefined}
                    >
                        {user ? 'Sois le premier à commenter !' : 'Connecte-toi pour commenter.'}
                    </div>
                ) : (
                    <div className={styles.carousel}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={comments[activeIndex]?.id}
                                className={styles.commentCard}
                                initial={{ opacity: 0, x: 50, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, x: -50, filter: 'blur(10px)' }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <div className={styles.avatar}>👤</div>
                                <div className={styles.content}>
                                    <div className={styles.user}>
                                        {comments[activeIndex]?.pseudo}
                                        <span style={{ opacity: 0.4, fontSize: '0.75rem', marginLeft: 8 }}>
                                            {comments[activeIndex] && formatDate(comments[activeIndex].created_at)}
                                        </span>
                                    </div>
                                    <div className={styles.text}>{comments[activeIndex]?.content}</div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                )}
            </AnimatePresence>

            {!isAdding && comments.length > 1 && (
                <div className={styles.dots}>
                    {comments.map((_, i) => (
                        <div
                            key={i}
                            className={`${styles.dot} ${i === activeIndex ? styles.activeDot : ''}`}
                            onClick={() => setActiveIndex(i)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
