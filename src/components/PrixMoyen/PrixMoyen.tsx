'use client';

import { Fourchette, formatFourchette } from '@/lib/recipe-price';
import styles from './PrixMoyen.module.css';

/**
 * Le prix d'une recette, d'une journée ou d'une semaine.
 *
 * Une FOURCHETTE, jamais un chiffre : entre le hard-discount et la grande
 * surface, le même panier varie de moitié. Afficher « 17,40 € » laisserait
 * croire à une précision qui n'existe pas ; « 13 – 22 € » dit la vérité, y
 * compris sur ce qu'on ignore.
 *
 * L'intitulé change selon ce qu'on additionne (une recette, un jour, une
 * semaine) mais la pastille reste la même partout : c'est à ça qu'on la
 * reconnaît d'un écran à l'autre.
 */
export default function PrixMoyen({ prix, libelle = 'Prix moyen', taille = 'normale', className = '', sombre = false }: {
    prix: Fourchette | null;
    libelle?: string;
    /** `grande` pour un total de semaine, `petite` pour une ligne de planning. */
    taille?: 'normale' | 'grande' | 'petite';
    className?: string;
    /**
     * Posée sur un fond noir quel que soit le thème.
     *
     * Les écrans « Apple TV+ » (planificateur, liste) restent sombres même
     * quand le téléphone est en clair : la pastille y suivait le thème et
     * écrivait son chiffre en noir sur du noir.
     */
    sombre?: boolean;
}) {
    if (!prix || (!prix.bas && !prix.haut)) return null;
    return (
        <div className={`${styles.pastille} ${styles[taille]} ${sombre ? styles.sombre : ''} ${className}`}>
            <span className={styles.libelle}>{libelle}</span>
            <span className={styles.valeur}>{formatFourchette(prix)}</span>
        </div>
    );
}
