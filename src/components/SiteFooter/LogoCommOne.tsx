'use client';
import { useEffect, useRef, useState } from 'react';
import styles from './logoCommOne.module.css';

/*
 * Signature du pied de page : le logo animé de Comm One (le même dessin que
 * sur comm-one.fr), cliquable vers le site. Les six boules tourbillonnent et
 * se fondent dans le point la première fois que le logo entre à l'écran, puis
 * à chaque survol ; le point, lui, tourne en continu.
 */
const BALLES: [string, number, number, number][] = [
    ['#FFD43B', 18, -17, 11],
    ['#3D5AFE', 46, 15, 12],
    ['#F0507E', 74, -15, 10],
    ['#FFD43B', 100, 16, 11],
    ['#7246F5', 126, -13, 12],
    ['#FF6B3D', 150, 12, 10],
];

export default function LogoCommOne() {
    const ref = useRef<HTMLAnchorElement>(null);
    const [joue, setJoue] = useState(false);

    const jouer = () => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        setJoue(true);
    };

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const io = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setJoue(true);
                io.disconnect();
            }
        }, { threshold: 0.6 });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    return (
        <a
            ref={ref}
            href="https://comm-one.fr"
            target="_blank"
            rel="noopener"
            className={`${styles.logo} ${joue ? styles.show : ''}`}
            aria-label="Comm One — comm-one.fr"
            onMouseEnter={jouer}
            onAnimationEnd={(e) => {
                if (e.animationName.includes('swirl')) setJoue(false);
            }}
        >
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.swarm} aria-hidden="true">
                {BALLES.map(([c, x, y, s], i) => (
                    <i
                        key={i}
                        className={styles.b}
                        style={{ '--c': c, '--x': `${x}px`, '--y': `${y}px`, '--s': `${s}px`, '--i': i } as React.CSSProperties}
                    />
                ))}
            </span>
            <span className={styles.mot} aria-hidden="true">
                COMM<span className={styles.one}>ONE</span>
            </span>
        </a>
    );
}
