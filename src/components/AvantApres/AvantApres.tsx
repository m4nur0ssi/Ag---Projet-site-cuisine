'use client';

import { useState } from 'react';
import styles from './AvantApres.module.css';

interface AvantApresProps {
    /** Photo de l'originale (la fiche). */
    original: string;
    /** Photo de « ma version » (le carnet). */
    maVersion: string;
    /** Date de la cuisson, affichée au verso de « ma version ». */
    date?: string;
    /** Ouvre la carte de partage. */
    onPartager?: () => void;
}

/**
 * « Ma version » contre l'originale : une seule tuile qui se retourne. Recto : ma photo.
 * Verso : la photo de la fiche. Un tap ou la barre d'espace bascule ; le rythme reste
 * celui des autres tuiles de l'appli.
 */
export default function AvantApres({ original, maVersion, date, onPartager }: AvantApresProps) {
    const [verso, setVerso] = useState(false);
    const basculer = () => setVerso((v) => !v);
    return (
        <div className={styles.zone}>
            <div
                className={styles.carte}
                role="button"
                tabIndex={0}
                aria-pressed={verso}
                aria-label={verso ? "Voir ma version" : "Voir l'originale"}
                onClick={basculer}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); basculer(); } }}
            >
                <div className={`${styles.interieur} ${verso ? styles.retourne : ''}`}>
                    <div className={`${styles.face} ${styles.recto}`}>
                        <img src={maVersion} alt="Ma version" className={styles.photo} draggable={false} />
                        <span className={styles.etiquette}>Ma version{date ? ` · ${date}` : ''}</span>
                    </div>
                    <div className={`${styles.face} ${styles.verso}`}>
                        <img src={original} alt="Originale" className={styles.photo} draggable={false} />
                        <span className={styles.etiquette}>Originale</span>
                    </div>
                </div>
            </div>
            <div className={styles.pied}>
                <span className={styles.aide}>Touche la carte pour comparer</span>
                {onPartager && (
                    <button type="button" className={styles.partager} onClick={onPartager}>Partager</button>
                )}
            </div>
        </div>
    );
}
