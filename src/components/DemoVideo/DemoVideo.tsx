'use client';

/**
 * Une démonstration filmée, qui tourne en boucle.
 * ===============================================
 *
 * Muette, sans commande, sans plein écran : ce n'est pas un film qu'on regarde,
 * c'est un geste qu'on observe. Elle joue quand son étape est à l'écran
 * (`actif`). Hors de l'écran, elle est déchargée : une visite porte plusieurs
 * vidéos, et chacune garde sinon son décodeur ouvert — les derniers venus
 * n'arrivent plus à jouer.
 */

import { useEffect, useRef } from 'react';
import styles from './DemoVideo.module.css';

/* Change à chaque nouveau tournage : le navigateur ne ressert pas une vidéo périmée. */
const VERSION_TOURNAGE = '2';

export default function DemoVideo({ id, accent, actif = true, paysage = false }: { id: string; accent?: string; actif?: boolean; /** Fenêtre de Mac (1280×800) plutôt que téléphone. */ paysage?: boolean }) {
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const src = `/tuto/${id}.webm?v=${VERSION_TOURNAGE}`;
        if (!actif) {
            el.pause();
            el.removeAttribute('src');
            el.load();
            return;
        }
        el.src = src;
        el.load();
        const lancer = () => { const p = el.play(); if (p && typeof p.catch === 'function') p.catch(() => { /* lecture refusée : l'image d'attente reste */ }); };
        lancer();
        // La première lecture peut arriver avant le premier octet : on relance à l'arrivée.
        el.addEventListener('canplay', lancer);
        return () => el.removeEventListener('canplay', lancer);
    }, [id, actif]);

    return (
        <div className={`${styles.cadre} ${paysage ? styles.paysage : ''}`} style={accent ? ({ ['--demo-accent']: accent } as React.CSSProperties) : undefined}>
            <video
                ref={ref}
                className={styles.video}
                poster={`/tuto/${id}.jpg`}
                muted
                loop
                playsInline
                preload="none"
                aria-label="Démonstration filmée"
            />
        </div>
    );
}
