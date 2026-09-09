'use client';

/**
 * Une démonstration filmée, qui tourne en boucle.
 * ===============================================
 *
 * Muette, sans commande, sans plein écran : ce n'est pas un film qu'on regarde,
 * c'est un geste qu'on observe. Elle ne se lance que lorsqu'elle est à l'écran
 * (une visite guidée porte plusieurs vidéos ; les charger toutes d'un coup pour
 * n'en voir qu'une serait payer plusieurs fois le voyage).
 */

import { useEffect, useRef, useState } from 'react';
import styles from './DemoVideo.module.css';

export default function DemoVideo({ id, accent, actif = true }: { id: string; accent?: string; actif?: boolean }) {
    const ref = useRef<HTMLVideoElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
        const o = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting && e.intersectionRatio > 0.35) setVisible(true); else setVisible(false); },
            { threshold: [0, 0.35, 0.75] },
        );
        o.observe(el);
        /*
         * Filet : dans un onglet caché, ou derrière un calque qui vient de
         * s'ouvrir, l'observateur annonce parfois « rien à l'écran » et ne se
         * ravise jamais — la démonstration restait alors sur son image fixe.
         * Au bout d'une seconde, on considère qu'elle est là.
         */
        const filet = setTimeout(() => setVisible((v) => v || true), 900);
        return () => { o.disconnect(); clearTimeout(filet); };
    }, []);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (visible && actif) {
            const lancer = () => el.play().catch(() => { /* lecture refusée : l'image d'attente reste */ });
            lancer();
            // La première lecture peut arriver avant le premier octet.
            el.addEventListener('canplay', lancer, { once: true });
            return () => el.removeEventListener('canplay', lancer);
        }
        el.pause();
    }, [visible, actif]);

    return (
        <div className={styles.cadre} style={accent ? ({ ['--demo-accent']: accent } as React.CSSProperties) : undefined}>
            <video
                ref={ref}
                className={styles.video}
                src={`/tuto/${id}.webm`}
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
