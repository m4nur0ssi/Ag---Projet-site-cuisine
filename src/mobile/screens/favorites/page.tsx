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
import { listerMesRecettes, versFiche } from '@/mobile/lib/mesRecettes';
import { Recipe } from '@/mobile/types';
import { pullFavorites, pruneOrphanFavorites } from '@/mobile/lib/favorites';
import { precacheFavorites } from '@/lib/pwa';
import { decodeHtml } from '@/mobile/lib/utils';
import styles from './favorites.module.css';
import Tip from '@/components/Tip/Tip';
import RecipeMenu from '@/mobile/components/RecipeMenu/RecipeMenu';
import { useLongPress } from '@/mobile/hooks/useLongPress';
import { useRatingStats } from '@/lib/ratings';

/**
 * `embedded` : rendu DANS le shell desktop TV+ (barre latérale déjà présente).
 * On retire alors le bouton retour, la barre du bas et le fond plein écran, et
 * la fiche s'ouvre en flottant pour ne pas recouvrir le menu — exactement comme
 * « Ma cave ».
 */
/**
 * Une carte de favori. Composant à part parce qu'un appui long, c'est un
 * `useRef` et un minuteur : il en faut un par carte, et les règles des hooks
 * interdisent d'en créer dans une boucle.
 */
function Carte({ recipe, onOpen, onLong }: { recipe: Recipe; onOpen: () => void; onLong: () => void }) {
    const lp = useLongPress(onLong);
    // La note remplace l'ancienne coche verte : on note une recette quand on
    // l'a faite, la coche disait deux fois la même chose.
    const note = useRatingStats()?.get(String(recipe.id));
    return (
        <button
            className={styles.card}
            {...lp.handlers}
            onClick={() => { if (lp.consumed.current) { lp.consumed.current = false; return; } onOpen(); }}
        >
            <div className={styles.poster}>
                <img src={recipe.image} alt="" loading="lazy" />
                {note && note.count > 0 && (
                    <span
                        className={styles.note}
                        aria-label={`Note : ${note.avg.toFixed(1).replace('.', ',')} sur 5`}
                    >
                        <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden>
                            <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95L12 2.6z" fill="currentColor" />
                        </svg>
                        {note.avg.toFixed(1).replace('.', ',')}
                    </span>
                )}
                <span className={styles.heart}>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" /></svg>
                </span>
            </div>
            {/* Titre SOUS l'image, en blanc — comme les cartes de l'accueil.
                Incrusté sur la photo, il devenait illisible dès que le visuel
                était clair. */}
            <span className={styles.cardTitle}>{decodeHtml(recipe.title)}</span>
        </button>
    );
}

export default function FavoritesPage({ embedded = false }: { embedded?: boolean }) {
    const router = useRouter();
    const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    /*
     * Appui long → le MÊME menu que partout ailleurs.
     *
     * Ces cartes montrent des recettes comme celles de l'accueil ; rien ne
     * justifiait qu'elles n'offrent ni partage, ni planificateur, ni « à faire
     * plus tard ». Le menu vit maintenant dans son propre composant, on ne fait
     * que l'appeler.
     */
    const [menu, setMenu] = useState<Recipe | null>(null);

    /*
     * Les recettes tirées de vidéos ne sont PAS dans le catalogue (compilé au
     * build). Sans elles, deux choses cassaient : elles n'apparaissaient jamais
     * ici, et le ménage des favoris orphelins — qui retire ce qu'il ne retrouve
     * pas — les EFFAÇAIT purement et simplement.
     */
    const [perso, setPerso] = useState<any[]>([]);

    useEffect(() => {
        const renderFromCache = (miennes = perso) => {
            const storedIds = JSON.parse(localStorage.getItem('favorites') || '[]');
            setFavoriteRecipes([
                ...miennes.filter((r: any) => storedIds.includes(String(r.id))),
                ...mockRecipes.filter(r => storedIds.includes(r.id)),
            ] as any);
            setLoading(false);
        };
        const init = async () => {
            await pullFavorites();
            const miennes = (await listerMesRecettes()).map(versFiche).filter(Boolean) as any[];
            setPerso(miennes);
            const ids = JSON.parse(localStorage.getItem('favorites') || '[]');
            const resolved = [
                ...mockRecipes.filter(r => ids.includes(r.id)).map(r => r.id),
                ...miennes.filter((r: any) => ids.includes(String(r.id))).map((r: any) => String(r.id)),
            ];
            await pruneOrphanFavorites(resolved);
            renderFromCache(miennes);
        };
        init();
        const surChangement = () => renderFromCache();
        window.addEventListener('storage', surChangement);
        window.addEventListener('magic-favorite-change', surChangement);
        return () => {
            window.removeEventListener('storage', surChangement);
            window.removeEventListener('magic-favorite-change', surChangement);
        };
        // `perso` n'est pas une dépendance : le rappel reçoit la liste fraîche
        // en argument, et se relire à chaque changement relancerait la lecture.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                            <Carte key={r.id} recipe={r} onOpen={() => open(r)} onLong={() => setMenu(r)} />
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

            {menu && <RecipeMenu recipe={menu} onClose={() => setMenu(null)} onOpenRecipe={open} />}

            {!embedded && <BottomNav />}
            <Tip id="favoris" />
        </div>
    );
}
