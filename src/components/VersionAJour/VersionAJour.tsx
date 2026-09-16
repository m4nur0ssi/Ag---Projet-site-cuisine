'use client';
import { useEffect, useRef } from 'react';
import { useTimer } from '@/mobile/components/Timer/TimerContext';

/**
 * Se mettre à jour au RETOUR dans l'app, jamais au milieu d'un geste.
 * ==================================================================
 *
 * Next.js recharge tout le document dès qu'une navigation interne rencontre
 * une version du serveur différente de celle de la page (écran blanc d'une
 * demi-seconde, retour en haut, fiche ouverte perdue). Sur un téléphone, la
 * PWA reste ouverte des heures en arrière-plan ; entre-temps le site a été
 * redéployé, et le rechargement tombait sur le premier bouton touché.
 *
 * On ne peut pas empêcher ce rechargement — l'ancienne version n'existe plus
 * sur le serveur. On peut en choisir le MOMENT : quand l'app revient au premier
 * plan, on demande au serveur sa version ; si elle a changé, on recharge tout
 * de suite. L'utilisateur vient de rouvrir l'app, il ne tenait encore rien.
 *
 * Sauf s'il est occupé : un minuteur de cuisson tourne (il vit en mémoire et
 * serait perdu), une fiche, la recherche ou un volet est ouvert. Dans ce cas
 * on ne touche à rien et on retentera au retour suivant.
 */

const VERSION = process.env.NEXT_PUBLIC_VERSION_APP || '';

/** Absence minimale avant de vérifier : un aller-retour éclair ne compte pas. */
const ABSENCE_MIN_MS = 30 * 1000;

/** Un calque plein écran est-il ouvert ? Tous verrouillent le défilement du corps. */
function calqueOuvert(): boolean {
    const b = document.body;
    if (b.style.overflow === 'hidden' || b.style.position === 'fixed') return true;
    if (b.dataset.recherche === 'ouverte') return true;
    const barre = document.getElementById('bottom-nav');
    return !!barre && barre.style.display === 'none';
}

export default function VersionAJour() {
    const { activeTimer } = useTimer();
    const minuteur = useRef(false);
    minuteur.current = !!activeTimer && activeTimer.remaining > 0;

    useEffect(() => {
        // Développement : la version change à chaque démarrage du serveur.
        if (!VERSION || VERSION.startsWith('local-')) return;

        let cacheLe = document.hidden ? Date.now() : 0;
        let enCours = false;

        const verifier = async () => {
            if (enCours) return;
            enCours = true;
            try {
                const res = await fetch('/api/version', { cache: 'no-store' });
                if (!res.ok) return;
                const { version } = (await res.json()) as { version?: string };
                if (!version || version === VERSION) return;
                // Re-vérifié APRÈS la réponse : un calque a pu s'ouvrir entre-temps.
                if (minuteur.current || calqueOuvert() || document.hidden) return;
                window.location.reload();
            } catch {
                // Hors ligne : rien à faire, on retentera au prochain retour.
            } finally {
                enCours = false;
            }
        };

        const surVisibilite = () => {
            if (document.hidden) { cacheLe = Date.now(); return; }
            const absence = cacheLe ? Date.now() - cacheLe : 0;
            cacheLe = 0;
            if (absence >= ABSENCE_MIN_MS) void verifier();
        };
        // iOS restaure parfois la page depuis sa mémoire au lieu de la réafficher.
        const surPageshow = (e: PageTransitionEvent) => { if (e.persisted) void verifier(); };

        document.addEventListener('visibilitychange', surVisibilite);
        window.addEventListener('pageshow', surPageshow);
        return () => {
            document.removeEventListener('visibilitychange', surVisibilite);
            window.removeEventListener('pageshow', surPageshow);
        };
    }, []);

    return null;
}
