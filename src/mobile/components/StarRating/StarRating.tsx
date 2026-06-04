'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/mobile/lib/supabase';
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
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data } = await supabase
                    .from('ratings')
                    .select('stars')
                    .eq('user_id', session.user.id)
                    .eq('recipe_id', recipeId)
                    .maybeSingle();
                if (data) setRating(data.stars);
            } else {
                const saved = localStorage.getItem(`recipe-rating-${recipeId}`);
                if (saved) setRating(parseInt(saved));
            }
        };
        load();
    }, [recipeId]);

    const handleClick = async (val: number) => {
        if (readonly) return;
        const newRating = rating === val ? 0 : val; // toggle off si même valeur
        setRating(newRating);
        localStorage.setItem(`recipe-rating-${recipeId}`, String(newRating));

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            if (newRating === 0) {
                await supabase.from('ratings').delete().eq('user_id', session.user.id).eq('recipe_id', recipeId);
            } else {
                await supabase.from('ratings').upsert({
                    user_id: session.user.id,
                    recipe_id: recipeId,
                    stars: newRating,
                    updated_at: new Date().toISOString(),
                });
            }
        }

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
