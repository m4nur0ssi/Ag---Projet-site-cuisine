'use client';

/**
 * Appui long (≈ 0,5 s) → menu contextuel, façon « appui fort » iOS.
 *
 * Extrait de l'accueil TV : le même geste doit exister partout où l'on croise
 * une recette. `consumed` empêche le clic de fin de geste d'ouvrir la fiche
 * par-dessus le menu qui vient de s'afficher.
 */

import { useEffect, useRef } from 'react';

export function useLongPress(onLong: () => void) {
    const timer = useRef<ReturnType<typeof setTimeout>>();
    const consumed = useRef(false);
    const longRef = useRef(onLong);
    longRef.current = onLong;

    const start = () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            consumed.current = true;
            navigator.vibrate?.(12);
            longRef.current();
        }, 480);
    };
    const cancel = () => clearTimeout(timer.current);

    useEffect(() => () => clearTimeout(timer.current), []);

    return {
        consumed,
        handlers: {
            onTouchStart: start,
            onTouchMove: cancel,
            onTouchEnd: cancel,
            onTouchCancel: cancel,
            onPointerDown: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') start(); },
            onPointerUp: cancel,
            onPointerLeave: cancel,
            onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); consumed.current = true; longRef.current(); },
        },
    };
}

export default useLongPress;
