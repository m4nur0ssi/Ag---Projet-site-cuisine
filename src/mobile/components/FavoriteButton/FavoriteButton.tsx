'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/mobile/lib/supabase';
import styles from './FavoriteButton.module.css';

interface FavoriteButtonProps {
    recipeId: string;
    initialFavorite?: boolean;
    imageUrl?: string;
    className?: string;
}

const HeartIcon = ({ filled }: { filled: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "#ff3b30" : "none"} stroke={filled ? "#ff3b30" : "#ffffff"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

export default function FavoriteButton({ recipeId, initialFavorite = false, imageUrl, className }: FavoriteButtonProps) {
    const [isFavorite, setIsFavorite] = useState(initialFavorite);
    // Favoris réservés aux connectés → le cœur n'apparaît QUE si une session existe.
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        // Source de vérité = Supabase (suit le compte).
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsLoggedIn(!!session);
            if (session) {
                const { data } = await supabase
                    .from('favorites')
                    .select('recipe_id')
                    .eq('user_id', session.user.id)
                    .eq('recipe_id', recipeId)
                    .maybeSingle();
                setIsFavorite(!!data);
                return;
            }
            // Déconnecté : aucun favori
            setIsFavorite(false);
        };
        load();
        const onChange = () => load();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
            setIsLoggedIn(!!session);
            if (!session) setIsFavorite(false);
        });
        window.addEventListener('storage', onChange);
        window.addEventListener('magic-favorite-change', onChange);
        return () => {
            subscription.unsubscribe();
            window.removeEventListener('storage', onChange);
            window.removeEventListener('magic-favorite-change', onChange);
        };
    }, [recipeId]);

    // Déconnecté → rien (aucun cœur : cartes, fiche, partout)
    if (!isLoggedIn) return null;

    const toggleFavorite = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Favoris réservés aux connectés.
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.dispatchEvent(new CustomEvent('magic-toast-notify', { detail: 'Connecte-toi pour enregistrer tes favoris ❤️' }));
            window.dispatchEvent(new CustomEvent('magic-open-auth'));
            return;
        }

        const newState = !isFavorite;
        setIsFavorite(newState);

        const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
        if (newState) {
            if (!favs.includes(recipeId)) favs.push(recipeId);
        } else {
            const idx = favs.indexOf(recipeId);
            if (idx > -1) favs.splice(idx, 1);
        }
        localStorage.setItem('favorites', JSON.stringify(favs));

        if (newState) {
            await supabase.from('favorites').upsert({ user_id: session.user.id, recipe_id: recipeId });
        } else {
            await supabase.from('favorites').delete().eq('user_id', session.user.id).eq('recipe_id', recipeId);
        }

        if (newState && imageUrl) fetch(imageUrl, { mode: 'no-cors' }).catch(() => {});

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(newState ? [15, 30, 15] : [10]);
        }

        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('magic-favorite-change'));
    };

    return (
        <motion.div
            className={`${styles.favoriteBtn} ${className || ''} ${isFavorite ? styles.isFavorite : ''}`}
            onClick={toggleFavorite}
            whileTap={{ scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            role="button"
            tabIndex={0}
            aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.3s ease' }}
        >
            <HeartIcon filled={isFavorite} />
        </motion.div>
    );
}
