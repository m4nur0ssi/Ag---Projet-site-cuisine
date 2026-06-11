'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
    // Favoris réservés aux connectés → le cœur n'apparaît QUE si une session existe.
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
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
            } else {
                // Déconnecté : aucun favori (on ignore le localStorage anonyme)
                setIsFavorite(false);
            }
        };

        load();

        const handleChange = () => {
            supabase.auth.getSession().then(({ data: { session } }) => {
                setIsLoggedIn(!!session);
                if (!session) setIsFavorite(false);
            });
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
            setIsLoggedIn(!!session);
            if (!session) setIsFavorite(false);
        });

        window.addEventListener('storage', handleChange);
        window.addEventListener('magic-favorite-change', handleChange);
        return () => {
            subscription.unsubscribe();
            window.removeEventListener('storage', handleChange);
            window.removeEventListener('magic-favorite-change', handleChange);
        };
    }, [recipeId]);

    // Déconnecté → rien (aucun cœur : cartes, fiche, partout)
    if (!isLoggedIn) return null;

    const toggleFavorite = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Les favoris sont réservés aux comptes connectés
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.dispatchEvent(new CustomEvent('magic-toast-notify', { detail: 'Connecte-toi pour enregistrer tes favoris ❤️' }));
            window.dispatchEvent(new CustomEvent('magic-open-auth'));
            return;
        }

        const newState = !isFavorite;
        setIsFavorite(newState);

        // localStorage (cache pour l'utilisateur connecté)
        const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
        if (newState) {
            if (!favs.includes(recipeId)) favs.push(recipeId);
        } else {
            const idx = favs.indexOf(recipeId);
            if (idx > -1) favs.splice(idx, 1);
        }
        localStorage.setItem('favorites', JSON.stringify(favs));

        // Supabase
        {
            if (newState) {
                await supabase.from('favorites').upsert({ user_id: session.user.id, recipe_id: recipeId });
            } else {
                await supabase.from('favorites').delete().eq('user_id', session.user.id).eq('recipe_id', recipeId);
            }
        }

        if (newState && imageUrl) {
            fetch(imageUrl, { mode: 'no-cors' }).catch(() => { });
        }

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
                {isFavorite ? '❤️' : '🤍'}
            </span>
            {showLabel && (
                <span className={styles.label}>
                    {isFavorite ? 'Enregistré' : 'Favori'}
                </span>
            )}
        </div>
    );
}
