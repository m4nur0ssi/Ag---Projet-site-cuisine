'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Hôte de portail optionnel. Par défaut tout sort dans `document.body` ; le tutoriel
 * l'aiguille vers sa tuile de démonstration, pour que la fiche ouverte depuis l'exemple
 * s'affiche DANS la tuile au lieu de recouvrir tout l'écran.
 *
 * L'hôte doit créer un bloc conteneur (`transform`) : sinon les enfants en
 * `position: fixed` se recaleraient sur la fenêtre et déborderaient de la tuile.
 */
let portalHost: HTMLElement | null = null;
export const setPortalHost = (el: HTMLElement | null) => { portalHost = el; };

export default function Portal({ children }: { children: ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    return createPortal(children, portalHost || document.body);
}
