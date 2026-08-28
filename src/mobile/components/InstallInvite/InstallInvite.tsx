'use client';

import { useEffect, useState } from 'react';
import styles from './InstallInvite.module.css';
import { ecrireStock } from '@/lib/stockage';

/**
 * L'invitation à installer l'application.
 * ======================================
 *
 * Une bannière « installez-nous » au premier écran est le réflexe de tout le
 * monde, et le plus mauvais : elle coûte une interruption à CHAQUE visiteur
 * pour convertir une poignée. Celle-ci se mérite — elle n'apparaît qu'à
 * quelqu'un qui revient (troisième visite), une seule fois, et se refuse
 * définitivement.
 *
 * Les deux systèmes n'offrent pas la même chose :
 *
 *   • Android expose `beforeinstallprompt`. On garde l'événement de côté et on
 *     déclenche la VRAIE fenêtre du système au moment choisi : une tape suffit.
 *   • iOS n'expose rien. Apple ne fournit aucune invite d'installation ; aucun
 *     site ne peut s'installer seul. Tout ce qu'on peut faire, c'est montrer le
 *     geste — Partager, puis « Sur l'écran d'accueil ».
 */
const CLE_REFUS = 'magic-install-refus-v1';
const CLE_VISITES = 'magic-visites-v1';
const VISITES_AVANT_INVITATION = 3;

type Invite = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Déjà installée : lancée depuis l'écran d'accueil, il n'y a rien à proposer. */
const dejaInstallee = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const surIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS se fait passer pour un Mac, mais il a un écran tactile.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export default function InstallInvite() {
    const [visible, setVisible] = useState(false);
    const [ios, setIos] = useState(false);
    const [invite, setInvite] = useState<Invite | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined' || dejaInstallee()) return;
        let refuse = false;
        let visites = 0;
        try {
            refuse = localStorage.getItem(CLE_REFUS) === 'oui';
            visites = Number(localStorage.getItem(CLE_VISITES) || 0) + 1;
            localStorage.setItem(CLE_VISITES, String(visites));
        } catch { return; /* stockage refusé : on n'insiste pas */ }
        if (refuse || visites < VISITES_AVANT_INVITATION) return;

        setIos(surIOS());

        /** Le bas de l'écran est-il libre de toute autre sollicitation ? */
        const placeLibre = () => !document.querySelector(
            '[class*="CookieConsent_banner"], [class*="Tip_wrap"]',
        );

        // Android : on capte l'invite du système et on la garde pour plus tard.
        const capter = (e: Event) => {
            e.preventDefault();
            setInvite(e as Invite);
            // Android : on n'affiche que lorsque le bas de l'écran est libre.
            if (placeLibre()) setVisible(true);
        };
        window.addEventListener('beforeinstallprompt', capter);

        /*
         * Une seule sollicitation à la fois.
         *
         * Le bandeau cookies et la bulle d'astuce occupent déjà le bas de
         * l'écran ; trois cartes empilées, c'est un couloir de notifications et
         * plus personne ne lit rien. On attend donc que la place soit libre, et
         * on renonce au bout de trente secondes — l'invitation reviendra à la
         * prochaine visite, elle n'a rien d'urgent.
         */
        let essais = 0;
        const guetter = window.setInterval(() => {
            if (placeLibre()) {
                window.clearInterval(guetter);
                // iOS n'émettra jamais `beforeinstallprompt` : on montre le geste.
                if (surIOS()) setVisible(true);
            } else if (++essais > 30) window.clearInterval(guetter);
        }, 1000);

        return () => { window.removeEventListener('beforeinstallprompt', capter); clearInterval(guetter); };
    }, []);

    const refuser = () => {
        try { ecrireStock(CLE_REFUS, 'oui'); } catch { /* noop */ }
        setVisible(false);
    };

    const installer = async () => {
        if (!invite) return;
        await invite.prompt();
        const { outcome } = await invite.userChoice;
        // Accepté ou non, on ne repropose pas : le choix a été fait en conscience.
        try { ecrireStock(CLE_REFUS, 'oui'); } catch { /* noop */ }
        setVisible(false);
        if (outcome === 'accepted') setInvite(null);
    };

    if (!visible) return null;

    return (
        <div className={styles.carte} role="dialog" aria-label="Installer l'application">
            <button className={styles.fermer} onClick={refuser} aria-label="Non merci">✕</button>

            <p className={styles.sur}>SUR TON ÉCRAN D{'\u2019'}ACCUEIL</p>
            <p className={styles.titre}>Les Recettes Magiques, en plein écran</p>

            {ios ? (
                <>
                    <p className={styles.texte}>
                        Touche <span className={styles.geste}>Partager</span> en bas de Safari,
                        puis <span className={styles.geste}>{'Sur l\u2019écran d\u2019accueil'}</span>.
                        {' Plus de barre d\u2019adresse, l\u2019app s\u2019ouvre d\u2019une icône.'}
                    </p>
                    <button className={styles.principal} onClick={refuser}>{'J\u2019ai compris'}</button>
                </>
            ) : (
                <>
                    <p className={styles.texte}>
                        {'Une icône sur ton téléphone, l\u2019ouverture en plein écran, et ta liste de courses disponible même sans réseau.'}
                    </p>
                    <div className={styles.actions}>
                        <button className={styles.secondaire} onClick={refuser}>Plus tard</button>
                        <button className={styles.principal} onClick={installer}>Installer</button>
                    </div>
                </>
            )}
        </div>
    );
}
