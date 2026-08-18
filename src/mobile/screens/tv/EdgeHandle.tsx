'use client';

/**
 * Poignée du volet de navigation — petite flèche accrochée au bord gauche.
 *
 * Elle règle un problème simple : rien n'indiquait qu'un volet se cache à
 * gauche. Elle reste donc toujours visible, centrée verticalement, quel que
 * soit le défilement.
 *
 * Deux gestes :
 *  - une pression ouvre le volet ;
 *  - un tirage vers la droite le fait SUIVRE LE DOIGT (`onPeek`), de plus en
 *    plus visible ; au relâcher, un ressort termine la course — il s'ouvre si
 *    on a assez tiré (ou vite), sinon il repart à gauche.
 *
 * Elle se tient à quelques pixels du bord et non collée dessus : la toute
 * première bande de l'écran est réservée au geste « retour » d'iOS, qui
 * ramènerait à la page précédente.
 */

import { useRef, useState } from 'react';
import styles from './tv.module.css';

/** Largeur du volet, identique à `.navPanel` : sert à convertir le geste en %. */
const panelWidth = () => Math.min(window.innerWidth * 0.84, 330);

/** Au-delà, on considère que l'utilisateur veut vraiment ouvrir. */
const OPEN_RATIO = 0.32;
const FLING = 0.45; // px/ms

export default function EdgeHandle({ onOpen, onPeek, hidden }: {
    onOpen: () => void;
    onPeek: (v: number) => void;
    hidden?: boolean;
}) {
    const [active, setActive] = useState(false);
    const start = useRef<{ x: number; y: number; t: number } | null>(null);
    const last = useRef<{ x: number; t: number } | null>(null);
    const moved = useRef(false);

    const end = (clientX: number) => {
        const s = start.current;
        start.current = null;
        setActive(false);
        onPeek(0);
        if (!s) return;
        const dx = clientX - s.x;
        // Vitesse du dernier segment : un coup sec ouvre même sans aller loin.
        const l = last.current;
        const v = l && l.t > s.t ? (clientX - l.x) / Math.max(1, performance.now() - l.t) : 0;
        // Sans mouvement, c'est une simple pression : on laisse le `click` natif
        // s'en charger (il part aussi au clavier et pour les technologies
        // d'assistance, que des `pointerup` seuls laisseraient sans réponse).
        if (moved.current && (dx > panelWidth() * OPEN_RATIO || v > FLING)) {
            try { navigator.vibrate?.(10); } catch { /* noop */ }
            onOpen();
        }
    };

    return (
        <button
            className={`${styles.edgeHandle} ${active ? styles.edgeHandleOn : ''} ${hidden ? styles.edgeHandleHidden : ''}`}
            aria-label="Ouvrir le menu"
            onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                start.current = { x: e.clientX, y: e.clientY, t: performance.now() };
                last.current = { x: e.clientX, t: performance.now() };
                moved.current = false;
                setActive(true);
            }}
            onPointerMove={(e) => {
                const s = start.current;
                if (!s) return;
                const dx = e.clientX - s.x;
                if (Math.abs(dx) > 6) moved.current = true;
                last.current = { x: e.clientX, t: performance.now() };
                onPeek(Math.max(0, Math.min(1, dx / panelWidth())));
            }}
            onPointerUp={(e) => end(e.clientX)}
            onPointerCancel={(e) => end(e.clientX)}
            /* Le clic qui suit un tirage est ignoré (`moved`) : le relâcher a
               déjà tranché entre ouvrir et repartir à gauche. */
            onClick={() => { if (!moved.current) onOpen(); }}
        >
            <span className={styles.edgeHandleGrip} />
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden>
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </button>
    );
}
