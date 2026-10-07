'use client';
import { useEffect, useState } from 'react';

/** Suit le clavier logiciel, y compris sa fermeture sans perte du focus sur iOS. */
export function useKeyboardVisible() {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const viewport = window.visualViewport;
        const touch = window.matchMedia('(any-pointer: coarse)').matches;
        let baseline = Math.max(window.innerHeight, viewport?.height || 0);
        let armed = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const editable = () => {
            const el = document.activeElement;
            return el instanceof HTMLElement && (el.isContentEditable || el.tagName === 'TEXTAREA'
                || (el instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'range', 'submit', 'file', 'color'].includes(el.type)));
        };
        const measure = () => {
            const height = viewport?.height || window.innerHeight;
            baseline = Math.max(baseline, window.innerHeight, height);
            // Le zoom et les barres du navigateur ne doivent pas masquer le menu.
            const reduced = baseline - height > 120;
            setVisible(touch && armed && (!viewport || Math.abs(viewport.scale - 1) < 0.05) && reduced);
            if (!reduced && !editable()) armed = false;
        };
        const focus = () => {
            if (!touch || !editable()) return;
            armed = true;
            setVisible(true); // dès le geste, avant la fin de l'animation du clavier
            clearTimeout(timer);
            timer = setTimeout(measure, 600);
        };
        const blur = () => { clearTimeout(timer); timer = setTimeout(measure, 80); };
        const rotate = () => {
            baseline = window.innerHeight;
            clearTimeout(timer); timer = setTimeout(measure, 300);
        };
        viewport?.addEventListener('resize', measure);
        window.addEventListener('resize', measure);
        window.addEventListener('orientationchange', rotate);
        document.addEventListener('focusin', focus);
        document.addEventListener('focusout', blur);
        measure();
        return () => {
            clearTimeout(timer);
            viewport?.removeEventListener('resize', measure);
            window.removeEventListener('resize', measure);
            window.removeEventListener('orientationchange', rotate);
            document.removeEventListener('focusin', focus);
            document.removeEventListener('focusout', blur);
        };
    }, []);
    return visible;
}
