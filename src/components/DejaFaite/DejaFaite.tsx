'use client';

/**
 * La marque « déjà faite », sur la vignette d'une recette.
 * =======================================================
 *
 * Aussi discrète que le « + » d'en face : même pastille de verre sombre, même
 * diamètre, même flou. Seule la coche est colorée — un vert qui dit « c'est
 * fait » sans avoir à l'écrire, et qui reste lisible sur n'importe quelle
 * photo, claire ou sombre.
 *
 * Elle se pose en haut à GAUCHE, à l'opposé du « + » : les deux peuvent
 * cohabiter sur une même carte sans se marcher dessus.
 *
 * Elle ne se clique pas. C'est un constat, pas une commande — on marque une
 * recette comme cuisinée depuis sa fiche, dans le carnet.
 */

import styles from './DejaFaite.module.css';

export default function DejaFaite({ titre = 'Tu as déjà cuisiné cette recette' }: { titre?: string }) {
    return (
        <span className={styles.marque} title={titre} aria-label={titre} role="img">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </span>
    );
}
