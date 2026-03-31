'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './CommentSection.module.css';

interface Comment {
    id: number;
    user: string;
    text: string;
    avatar: string;
}

const MOCK_COMMENTS: Comment[] = [
    { id: 1, user: 'Léa', text: 'Une recette incroyable, j\'ai adoré ! 😍', avatar: '👩‍🍳' },
    { id: 2, user: 'Marc', text: 'Très simple à réaliser, même pour un débutant.', avatar: '👨‍🍳' },
    { id: 3, user: 'Sophie', text: 'Mes enfants en redemandent tous les soirs ! 🍝', avatar: '👧' },
    { id: 4, user: 'Thomas', text: 'Le mélange d\'épices est juste parfait. 👌', avatar: '👨' },
];

export default function CommentSection() {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isAdding, setIsAdding] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [pseudo, setPseudo] = useState('');
    const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!isAdding) {
            const interval = setInterval(() => {
                setActiveIndex(prev => (prev + 1) % comments.length);
            }, 20000);
            return () => clearInterval(interval);
        }
    }, [isAdding, comments.length]);

    const handleAddClick = () => {
        setIsAdding(true);
        setTimeout(() => {
            textareaRef.current?.focus();
        }, 100);
    };

    const handleCancel = () => {
        setIsAdding(false);
        setCommentText('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim()) return;

        const newComment: Comment = {
            id: Date.now(),
            user: pseudo.trim() || 'Anonyme',
            text: commentText,
            avatar: '👤'
        };

        setComments([newComment, ...comments]);
        setCommentText('');
        setPseudo('');
        setIsAdding(false);
        setActiveIndex(0);
    };

    const addEmoji = (emoji: string) => {
        setCommentText(prev => prev + emoji);
        textareaRef.current?.focus();
    };

    return (
        <div className={styles.section}>
            <div className={styles.header}>
                <h3 className={styles.title}>Derniers avis</h3>
                <button className={styles.addBtn} onClick={handleAddClick}>
                    <span>+</span> Ajouter un commentaire
                </button>
            </div>

            <AnimatePresence mode="wait">
                {isAdding ? (
                    <motion.div 
                        key="adding-form"
                        className={styles.addForm}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                    >
                        <form onSubmit={handleSubmit}>
                            <input
                                type="text"
                                className={styles.pseudoInput}
                                placeholder="Votre pseudo..."
                                value={pseudo}
                                onChange={(e) => setPseudo(e.target.value)}
                            />
                            <textarea
                                ref={textareaRef}
                                className={styles.textarea}
                                placeholder="Votre tête en émoji ou votre avis..."
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                            />
                            <div className={styles.emojiPicker}>
                                {['😍', '😋', '👌', '🔥', '👩‍🍳', '👨‍🍳', '🍲', '❤️', '✨'].map(emoji => (
                                    <button 
                                        type="button" 
                                        key={emoji} 
                                        className={styles.emojiBtn}
                                        onClick={() => addEmoji(emoji)}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                            <div className={styles.formActions}>
                                <button type="button" className={styles.cancelBtn} onClick={handleCancel}>Annuler</button>
                                <button type="submit" className={styles.submitBtn}>Publier</button>
                            </div>
                        </form>
                    </motion.div>
                ) : (
                    <div className={styles.carousel}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={comments[activeIndex].id}
                                className={styles.commentCard}
                                initial={{ opacity: 0, x: 50, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, x: -50, filter: 'blur(10px)' }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <div className={styles.avatar}>{comments[activeIndex].avatar}</div>
                                <div className={styles.content}>
                                    <div className={styles.user}>{comments[activeIndex].user}</div>
                                    <div className={styles.text}>{comments[activeIndex].text}</div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                )}
            </AnimatePresence>
            
            {!isAdding && (
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
