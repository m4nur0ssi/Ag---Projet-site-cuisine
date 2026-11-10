'use client';

import { useEffect } from 'react';

type Verrou = { release: () => Promise<void>; addEventListener?: (t: string, f: () => void) => void };

/**
 * Garde l'écran allumé tant que le composant est affiché (cuisine : mains
 * pleines, on ne touche pas l'écran). Le navigateur retire le verrou dès que
 * l'onglet passe en arrière-plan ou que l'écran se verrouille : on le redemande
 * au retour. Le verrou est rendu au démontage. Sans support (ancien navigateur,
 * http non sécurisé) : ne fait rien, sans erreur.
 */
export function useVerrouEcran(actif: boolean = true): void {
    useEffect(() => {
        if (!actif || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
        let verrou: Verrou | null = null;
        let arrete = false;

        const demander = async () => {
            if (arrete || document.visibilityState !== 'visible' || verrou) return;
            try {
                const v: Verrou = await (navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<Verrou> } }).wakeLock.request('screen');
                if (arrete) { void v.release().catch(() => {}); return; }
                verrou = v;
                // Retiré par le système : on oublie le verrou pour pouvoir le redemander.
                v.addEventListener?.('release', () => { if (verrou === v) verrou = null; });
            } catch { /* refusé (économie d'énergie, onglet masqué) : pas grave */ }
        };

        const auRetour = () => { if (document.visibilityState === 'visible') void demander(); };
        void demander();
        document.addEventListener('visibilitychange', auRetour);
        return () => {
            arrete = true;
            document.removeEventListener('visibilitychange', auRetour);
            const v = verrou; verrou = null;
            if (v) void v.release().catch(() => {});
        };
    }, [actif]);
}
