'use client';
import React from 'react';
import styles from './BringButton.module.css';

interface BringButtonProps {
    title: string;
    ingredients: { quantity: string; name: string }[];
    url: string;
    mode?: 'all' | 'selection';
}

const BringButton: React.FC<BringButtonProps> = ({ title, ingredients, url, mode = 'all' }) => {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const handleBringImport = () => {
        // Formater les ingrédients pour que Bring! les reconnaisse bien
        const ingredientText = ingredients
            .map(ing => {
                const q = ing.quantity ? ing.quantity.trim() : '';
                const n = ing.name ? ing.name.trim() : '';
                return `- ${q} ${n}`.trim();
            })
            .join('\n');

        const shareText = `🛒 Liste pour "${title}" :\n${ingredientText}`;

        // Sur Mobile (iPhone/Android), on utilise toujours Share ou Clipboard
        // C'est LA méthode la plus fiable car Bring! intercepte le texte partagé 
        // ou permet de coller une liste dans l'app "Maison".
        if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            if (navigator.share) {
                navigator.share({
                    title: `Bring! - ${title}`,
                    text: shareText
                }).catch(() => {
                    copyToClipboard(shareText);
                });
            } else {
                copyToClipboard(shareText);
            }
        } else {
            // Sur Ordinateur : On utilise l'importateur web classique de Bring!
            const bringWebUrl = `https://www.getbring.com/api/import/v1/recipe?url=${encodeURIComponent(url)}`;
            window.open(bringWebUrl, '_blank');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            alert("✅ Liste copiée !\nOuvrez Bring! et collez vos ingrédients.");
        }).catch(() => {
            alert("❌ Erreur lors de la copie de la liste.");
        });
    };

    if (!mounted) return null;

    return (
        <button
            onClick={handleBringImport}
            className={`${styles.bringBtn} ${mode === 'selection' ? styles.selectionMode : ''}`}
            title={mode === 'all' ? "Tout ajouter à Bring!" : "Ajouter la sélection à Bring!"}
        >
            <div className={styles.iconContainer}>
                <svg viewBox="0 0 24 24" className={styles.bringIcon}>
                    <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
            </div>
            <span>{mode === 'all' ? 'Tout ajouter' : 'Ajouter la sélection'}</span>
        </button>
    );
};

export default BringButton;
