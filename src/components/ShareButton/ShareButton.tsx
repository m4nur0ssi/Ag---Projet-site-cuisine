'use client';

import styles from './ShareButton.module.css';

interface ShareButtonProps {
    url?: string;
    title?: string;
    className?: string;
}

export default function ShareButton({ url, title, className }: ShareButtonProps) {
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
                    await navigator.clipboard.writeText(window.location.href);
                    alert('Lien de la recette copié ! 📋');
                } else {
                    const textArea = document.createElement("textarea");
                    textArea.value = window.location.href;
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
        <button className={`${styles.actionBtn} ${className || ''}`} onClick={handleShare} aria-label="Partager">
            🔗
        </button>
    );
}
