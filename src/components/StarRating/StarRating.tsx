'use client';
import { useState, useEffect } from 'react';
import styles from './StarRating.module.css';

interface StarRatingProps {
    recipeId: string;
    readonly?: boolean;
    size?: 'small' | 'large';
}

export default function StarRating({ recipeId, readonly = false, size = 'large' }: StarRatingProps) {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);

    useEffect(() => {
        const saved = localStorage.getItem(`recipe-rating-${recipeId}`);
        if (saved) setRating(parseInt(saved));
    }, [recipeId]);

    const handleClick = (val: number) => {
        if (readonly) return;
        const newRating = rating === val ? 0 : val; // toggle off si même valeur
        setRating(newRating);
        localStorage.setItem(`recipe-rating-${recipeId}`, String(newRating));
        window.dispatchEvent(new CustomEvent('recipeRated', { detail: { recipeId, rating: newRating } }));
        if (navigator.vibrate) navigator.vibrate(15);
    };

    if (readonly && rating === 0) return null;

    return (
        <div className={`${styles.stars} ${styles[size]}`}>
            {[1, 2, 3, 4, 5].map(val => (
                <button
                    key={val}
                    className={`${styles.star} ${(hover || rating) >= val ? styles.active : ''}`}
                    onClick={() => handleClick(val)}
                    onMouseEnter={() => !readonly && setHover(val)}
                    onMouseLeave={() => setHover(0)}
                    disabled={readonly}
                    aria-label={`${val} étoile${val > 1 ? 's' : ''}`}
                >
                    ★
                </button>
            ))}
        </div>
    );
}
