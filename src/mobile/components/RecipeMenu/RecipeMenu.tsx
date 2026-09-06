'use client';

/**
 * Le menu d'appui long sur une recette.
 * =====================================
 *
 * Il est né dans l'accueil TV, écrit à même l'écran. Résultat : les favoris —
 * qui montrent pourtant des recettes, en cartes, exactement comme l'accueil —
 * n'avaient aucun menu. Ni partage, ni planificateur, rien.
 *
 * Le voici en un seul endroit. Un écran lui passe la recette ; il se charge du
 * reste. Les actions qui dépendent de l'écran hôte (ouvrir la fiche, aller à
 * une catégorie) ont un comportement PAR DÉFAUT qui marche partout : l'hôte ne
 * les fournit que s'il sait faire mieux chez lui.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Recipe } from '@/mobile/types';
import { mockRecipes } from '@/mobile/data/mockData';
import PlanPicker from '@/mobile/components/PlanPicker/PlanPicker';
import { planifiable } from '@/mobile/screens/tv/plan';
import { inProgressRecipes, clearProgress } from '@/mobile/screens/tv/progress';
import {
    catLabel, titreDe, toggleFavorite, toggleLater, readIds, photosDe,
    COLLECTION_LABEL, LATER_KEY, type Coll,
} from '@/mobile/screens/tv/actions';
import styles from '@/mobile/screens/tv/tv.module.css';

const RecipeShareCard = dynamic(() => import('@/mobile/components/RecipeShareCard/RecipeShareCard'), { ssr: false });

const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* noop */ } };

export interface RecipeMenuProps {
    recipe: Recipe;
    onClose: () => void;
    /** La collection d'où l'on vient (rangée, thème) ; sinon la catégorie de la recette. */
    coll?: Coll;
    /** Ouvrir la fiche. Par défaut : la feuille flottante globale. */
    onOpenRecipe?: (r: Recipe) => void;
    /** Aller à la catégorie. Par défaut : l'accueil filtré sur cette catégorie. */
    onOpenCategory?: (cat: string, nom: string) => void;
}

/** Icône du menu : un seul tracé, comme les symboles système. */
const MI = ({ d }: { d: string }) => (
    <svg className={styles.menuIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default function RecipeMenu({ recipe, onClose, coll, onOpenRecipe, onOpenCategory }: RecipeMenuProps) {
    const router = useRouter();
    const [planFor, setPlanFor] = useState<Recipe | null>(null);
    const [shareCard, setShareCard] = useState<{ recipe: Recipe; category?: Coll } | null>(null);
    const [fav, setFav] = useState(false);
    const [lat, setLat] = useState(false);
    const [enCours, setEnCours] = useState(false);

    const id = String(recipe.id);

    useEffect(() => {
        setFav(readIds('favorites').includes(id));
        setLat(readIds(LATER_KEY).includes(id));
        setEnCours(inProgressRecipes(mockRecipes as Recipe[]).some((x) => String(x.recipe.id) === id));
    }, [id]);

    const cat = (recipe.category || '').toLowerCase();
    const catName = catLabel(recipe);

    /* Sans contexte de rangée, la collection est la catégorie de la recette,
       nommée au pluriel — c'est ce qu'on lit sur l'affiche de partage. */
    const memeCat = mockRecipes.filter((x) => (x.category || '').toLowerCase() === cat) as Recipe[];
    const collection: Coll = coll || {
        label: COLLECTION_LABEL[cat] || catName,
        tag: cat,
        count: memeCat.length,
        photos: photosDe(memeCat, recipe.image),
    };

    const ouvrirFiche = () => {
        if (onOpenRecipe) onOpenRecipe(recipe);
        else window.dispatchEvent(new CustomEvent('openRecipeFromPlanner', { detail: recipe }));
    };

    const ouvrirCategorie = () => {
        if (onOpenCategory) onOpenCategory(cat, catName);
        else router.push(`/?tag=${encodeURIComponent(cat)}`);
    };

    /* La carte de partage et le volet de planification survivent à la fermeture
       du menu : c'est le menu qui s'efface pour les laisser la place. */
    if (planFor) {
        return <PlanPicker recipe={planFor} open={true} onClose={() => { setPlanFor(null); onClose(); }} />;
    }
    if (shareCard) {
        return (
            <RecipeShareCard
                recipe={shareCard.recipe}
                category={shareCard.category}
                onClose={() => { setShareCard(null); onClose(); }}
            />
        );
    }

    return (
        <AnimatePresence>
            <motion.div
                className={styles.menuBackdrop}
                onClick={onClose}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
            >
                <motion.div
                    className={styles.menuCard}
                    onClick={(e) => e.stopPropagation()}
                    initial={{ scale: 0.88, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    transition={{ type: 'spring', damping: 26, stiffness: 360 }}
                >
                    <img className={styles.menuPreview} src={recipe.image} alt="" draggable={false} />
                    <div className={styles.menuTitle}>{titreDe(recipe)}</div>
                    <div className={styles.menuActions}>
                        <button className={styles.menuAction} onClick={() => { haptic(8); onClose(); ouvrirFiche(); }}>
                            <MI d="M8 5v14l11-7z" /><span>Voir la recette</span>
                        </button>

                        {/* Une recette qui n'entre dans aucun créneau (restaurant,
                            sauce…) n'a rien à faire dans le planificateur : on ne
                            propose pas une porte qui ne mène nulle part. */}
                        {planifiable(recipe) && (
                            <button className={styles.menuAction} onClick={() => { haptic(8); setPlanFor(recipe); }}>
                                <MI d="M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM12 12v5M9.5 14.5h5" /><span>Ajouter au planificateur</span>
                            </button>
                        )}

                        <button className={`${styles.menuAction} ${fav ? styles.menuDanger : ''}`} onClick={() => { haptic(12); onClose(); toggleFavorite(id); }}>
                            <MI d="M20.8 6.6a4.6 4.6 0 0 0-6.5 0L12 8.9 9.7 6.6a4.6 4.6 0 1 0-6.5 6.5l1 1L12 21l7.8-6.9 1-1a4.6 4.6 0 0 0 0-6.5z" /><span>{fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
                        </button>

                        <button className={styles.menuAction} onClick={() => { haptic(8); onClose(); ouvrirCategorie(); }}>
                            <MI d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8h.01M11 12h1v4h1" /><span>Accéder à {catName}</span>
                        </button>

                        <button className={styles.menuAction} onClick={() => { haptic(8); setShareCard({ recipe, category: collection }); }}>
                            <MI d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" /><span>Partager « {collection.label} »</span>
                        </button>

                        {/* Une seule entrée : la carte image porte déjà le lien, le
                            titre et le QR code. */}
                        <button className={styles.menuAction} onClick={() => { haptic(8); setShareCard({ recipe }); }}>
                            <MI d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" /><span>Partager la recette</span>
                        </button>

                        <button className={`${styles.menuAction} ${lat ? styles.menuDanger : ''}`} onClick={() => { haptic(12); onClose(); toggleLater(id); }}>
                            {lat ? <MI d="M5 12h14" /> : <MI d="M12 5v14M5 12h14" />}
                            <span>{lat ? 'Retirer de la liste' : 'À faire plus tard'}</span>
                        </button>

                        {enCours && (
                            <button className={`${styles.menuAction} ${styles.menuDanger}`} onClick={() => { haptic(8); onClose(); clearProgress(id); }}>
                                <MI d="M5 12h14" /><span>Retirer de « Reprendre la cuisine »</span>
                            </button>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
