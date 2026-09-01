'use client';
/**
 * Favoris — refonte « Apple TV+ » : fond cinématique sombre, en-tête incliné,
 * grille de posters. Un tap ouvre la fiche via la feuille globale (comme le reste
 * de l'app TV). Remplace l'ancien écran (Header + MagicFilterBar + grille iOS26).
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/mobile/components/BottomNav/BottomNav';
/*
 * Le catalogue ALLÉGÉ : on ne fait ici que retrouver des recettes par
 * identifiant et les afficher en cartes. Cette page est PRÉCHARGÉE par la barre
 * du bas — lui faire tirer le catalogue complet, c'était 1,5 Mo de JavaScript
 * téléchargés en fond sur un écran qu'on n'ouvrira peut-être jamais.
 */
import { homeRecipes as mockRecipes } from '@/mobile/data/home-recipes';
import { Recipe } from '@/mobile/types';
import { pullFavorites, pruneOrphanFavorites } from '@/mobile/lib/favorites';
import { precacheFavorites } from '@/lib/pwa';
import { decodeHtml } from '@/mobile/lib/utils';
import styles from './favorites.module.css';
import Tip from '@/components/Tip/Tip';

/**
 * `embedded` : rendu DANS le shell desktop TV+ (barre latérale déjà présente).
 * On retire alors le bouton retour, la barre du bas et le fond plein écran, et
 * la fiche s'ouvre en flottant pour ne pas recouvrir le menu — exactement comme
 * « Ma cave ».
 */
export default function FavoritesPage({ embedded = false }: { embedded?: boolean }) {
    const router = useRouter();
    const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const renderFromCache = () => {
            const storedIds = JSON.parse(localStorage.getItem('favorites') || '[]');
            setFavoriteRecipes(mockRecipes.filter(r => storedIds.includes(r.id)));
            setLoading(false);
        };
        const init = async () => {
            await pullFavorites();
            const ids = JSON.parse(localStorage.getItem('favorites') || '[]');
            const resolved = mockRecipes.filter(r => ids.includes(r.id)).map(r => r.id);
            await pruneOrphanFavorites(resolved);
            renderFromCache();
        };
        init();
        window.addEventListener('storage', renderFromCache);
        window.addEventListener('magic-favorite-change', renderFromCache);
        return () => {
            window.removeEventListener('storage', renderFromCache);
            window.removeEventListener('magic-favorite-change', renderFromCache);
        };
    }, []);

    useEffect(() => { if (favoriteRecipes.length) precacheFavorites(favoriteRecipes); }, [favoriteRecipes]);

    /**
     * Toujours `openRecipeFromPlanner` : c'est l'hôte GLOBAL (monté par le shell)
     * qui ouvre une fiche depuis un écran. `openRecipe` ne sert qu'à empiler une
     * recette DANS une fiche déjà ouverte — depuis les favoris, personne ne
     * l'écoutait, et toucher une carte ne faisait rien du tout.
     */
    const open = (r: Recipe) => window.dispatchEvent(
        new CustomEvent('openRecipeFromPlanner', { detail: r }));

    return (
        <div className={`${styles.page} ${embedded ? styles.emb : ''}`}>
            <header className={styles.head}>
                {!embedded && (
                    <button className={styles.back} onClick={() => router.push('/')} aria-label="Retour">
                        <svg viewBox="0 0 8 14" width="13" height="13" fill="none"><path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                )}
                {/* Même en-tête partout (encastré ou plein écran) : gros titre,
                    sous-titre en dessous — le moule commun aux panneaux TV+. */}
                <div>
                    <h1 className={styles.title}>Favoris</h1>
                    <p className={styles.sub}>Mes préférés</p>
                </div>
                {!loading && favoriteRecipes.length > 0 && (
                    <span className={styles.count}>{favoriteRecipes.length}</span>
                )}
            </header>

            <main className={styles.main}>
                {loading ? (
                    <div className={styles.skelGrid}>
                        {Array.from({ length: 6 }).map((_, i) => <div key={i} className={styles.skel} />)}
                    </div>
                ) : favoriteRecipes.length > 0 ? (
                    <div className={styles.grid}>
                        {favoriteRecipes.map((r) => (
                            <button key={r.id} className={styles.card} onClick={() => open(r)}>
                                <div className={styles.poster}>
                                    <img src={r.image} alt="" loading="lazy" />
                                    <span className={styles.heart}>
                                        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" /></svg>
                                    </span>
                                </div>
                                {/* Titre SOUS l'image, en blanc — comme les cartes de
                                    l'accueil. Incrusté sur la photo, il devenait
                                    illisible dès que le visuel était clair. */}
                                <span className={styles.cardTitle}>{decodeHtml(r.title)}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className={styles.empty}>
                        <div className={styles.emptyIc}>
                            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" /></svg>
                        </div>
                        <h2>Aucun favori</h2>
                        <p>Touche le cœur sur une recette pour la retrouver ici.</p>
                        <button className={styles.explore} onClick={() => router.push('/')}>Explorer les recettes</button>
                    </div>
                )}
            </main>

            {!embedded && <BottomNav />}
            <Tip id="favoris" />
        </div>
    );
}
