'use client';

import styles from './ShareButton.module.css';

interface ShareButtonProps {
    url?: string;
    title?: string;
    className?: string;
    /** Style clair : pastille blanche, icône sombre (sur photo/carte thème). */
    light?: boolean;
}

export default function ShareButton({ url, title, className, light }: ShareButtonProps) {
    const handleShare = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const finalUrl = url || window.location.href;
        const finalTitle = title || document.title;
        
        const shareData = {
            title: finalTitle,
            text: 'Découvrez cette recette magique !',
            url: finalUrl,
        };

        if (navigator.share && window.isSecureContext) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Partage annulé');
            }
        } else {
            // Fallback : copier le lien avec la méthode robuste
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(finalUrl);
                    alert('Lien de la recette copié ! 📋');
                } else {
                    const textArea = document.createElement("textarea");
                    textArea.value = finalUrl;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    alert('Lien de la recette copié ! 📋');
                }
            } catch (err) {
                alert('Impossible de copier le lien automatiquement.');
            }
        }
    };

    return (
        <button
            className={`${styles.actionBtn} ${className || ''}`}
            onClick={handleShare}
            aria-label="Partager"
            style={light ? {
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(255,255,255,0.7)',
                color: '#1a1a1a',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            } : undefined}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
        </button>
    );
}
