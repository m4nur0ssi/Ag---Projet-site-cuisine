'use client';
import React, { useCallback, useEffect, useState } from 'react';
import styles from './CookieConsent.module.css';
import { ecrireStock } from '@/lib/stockage';
import { lireConsentement, ROUVRIR_CONSENTEMENT, STORAGE_KEY, type Choice } from '@/lib/consentement';

/**
 * Bandeau cookies discret, conforme CNIL :
 * - "Accepter" et "Refuser" au même niveau (pas de dark pattern).
 * - RIEN n'est chargé chez Google avant le clic : le mode consentement est sur
 *   "denied" dans le <head>, et le script de mesure lui-même n'est téléchargé
 *   qu'ici, à l'acceptation (`window.__chargerMesure`).
 * - Le choix est daté et vaut six mois — la durée annoncée dans la politique de
 *   confidentialité. Passé ce délai, la question est reposée.
 * - Revenir sur son choix doit être aussi simple que l'avoir donné : le lien
 *   « Cookies » du pied de page émet `ROUVRIR_CONSENTEMENT`, qui rouvre ce
 *   bandeau.
 */
export default function CookieConsent() {
    const [visible, setVisible] = useState(false);

    const applyConsent = useCallback((choice: Choice) => {
        const granted = choice === 'accepted' ? 'granted' : 'denied';
        const w = window as unknown as {
            gtag?: (...args: unknown[]) => void;
            __chargerMesure?: () => void;
        };
        w.gtag?.('consent', 'update', {
            ad_storage: granted,
            analytics_storage: granted,
            ad_user_data: granted,
            ad_personalization: granted,
        });
        // Le téléchargement de Google Analytics n'a lieu qu'ici, jamais avant.
        if (choice === 'accepted') w.__chargerMesure?.();
    }, []);

    useEffect(() => {
        const choix = lireConsentement();
        if (choix) applyConsent(choix);
        else setVisible(true);

        const rouvrir = () => setVisible(true);
        window.addEventListener(ROUVRIR_CONSENTEMENT, rouvrir);
        return () => window.removeEventListener(ROUVRIR_CONSENTEMENT, rouvrir);
    }, [applyConsent]);

    function choose(choice: Choice) {
        // Daté : sans la date, impossible de tenir la promesse des six mois.
        ecrireStock(STORAGE_KEY, JSON.stringify({ choix: choice, date: Date.now() }));
        applyConsent(choice);
        setVisible(false);
    }

    if (!visible) return null;

    return (
        <div className={styles.banner} role="dialog" aria-label="Consentement aux cookies">
            <p className={styles.text}>
                Ce site utilise des cookies de mesure d’audience et, à terme, de publicité.
                Vous pouvez accepter ou refuser.{' '}
                <a href="/confidentialite" className={styles.link}>En savoir plus</a>
            </p>
            <div className={styles.actions}>
                <button className={styles.refuse} onClick={() => choose('refused')}>Refuser</button>
                <button className={styles.accept} onClick={() => choose('accepted')}>Accepter</button>
            </div>
        </div>
    );
}
