'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import styles from './ShareButton.module.css';

interface ShareButtonProps {
    url?: string;
    title?: string;
    className?: string;
}

const ShareIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
);

export default function ShareButton({ url, title, className }: ShareButtonProps) {
    const handleShare = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const finalUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
        const finalTitle = title || (typeof document !== 'undefined' ? document.title : 'Les Recettes Magiques');
        
        const shareData = {
            title: finalTitle,
            text: `Regarde cette incroyable recette : ${finalTitle} ! ✨`,
            url: finalUrl,
        };

        // Vibrate for feedback
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([15]);
        }

        if (typeof navigator !== 'undefined' && navigator.share) {
            navigator.share(shareData)
                .then(() => console.log('Shared successfully'))
                .catch((err) => {
                    if (err.name !== 'AbortError') {
                        console.error('Share failed:', err);
                        copyToClipboard(finalUrl);
                    }
                });
        } else {
            copyToClipboard(finalUrl);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                alert('Lien copié dans le presse-papier ! 📋');
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('Lien copié dans le presse-papier ! 📋');
            }
        } catch (err) {
            console.error('Clipboard failed:', err);
        }
    };

    return (
        <motion.button 
            className={`${styles.actionBtn} ${className || ''}`} 
            onClick={handleShare} 
            whileTap={{ scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            aria-label="Partager" 
        >
            <ShareIcon />
        </motion.button>
    );
}
