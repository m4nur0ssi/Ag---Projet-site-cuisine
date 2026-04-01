'use client';

import { useState, useEffect } from 'react';
import styles from './FavoriteButton.module.css';

interface FavoriteButtonProps {
    recipeId: string;
    initialFavorite?: boolean;
    imageUrl?: string;
    className?: string;
    showLabel?: boolean;
}

export default function FavoriteButton({ recipeId, initialFavorite = false, imageUrl, className, showLabel = false }: FavoriteButtonProps) {
    const [isFavorite, setIsFavorite] = useState(initialFavorite);

    useEffect(() => {
        // Au montage, on vérifie le vrai état dans localStorage
        const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        setIsFavorite(favorites.includes(recipeId));
    }, [recipeId]);

    const toggleFavorite = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const newState = !isFavorite;
        setIsFavorite(newState);

        // Sauvegarder dans localStorage
        const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        if (newState) {
            if (!favorites.includes(recipeId)) {
                favorites.push(recipeId);
            }
        } else {
            const index = favorites.indexOf(recipeId);
            if (index > -1) favorites.splice(index, 1);
        }
        localStorage.setItem('favorites', JSON.stringify(favorites));

        // Total Offline: If favorited, try to pre-cache image
        if (newState && imageUrl) {
            fetch(imageUrl, { mode: 'no-cors' }).catch(() => { });
        }

        // Déclencher un événement storage pour mettre à jour les autres composants
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('magic-favorite-change'));
    };

    return (
        <div
            className={`${styles.favoriteBtn} ${isFavorite ? styles.isFavorite : ''} ${className || ''}`}
            onClick={toggleFavorite}
            role="button"
            tabIndex={0}
            aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
            <span className={styles.icon}>
                🤍
            </span>
            {showLabel && (
                <span className={styles.label}>
                    {isFavorite ? 'Enregistré' : 'Favori'}
                </span>
            )}
        </div>
    );
}
