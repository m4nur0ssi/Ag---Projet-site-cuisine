'use client';
import React, { useEffect, useState } from 'react';
import styles from './CookieConsent.module.css';

const STORAGE_KEY = 'cookie-consent-v1';
type Choice = 'accepted' | 'refused';

/**
 * Bandeau cookies discret, conforme CNIL :
 * - "Accepter" et "Refuser" au même niveau (pas de dark pattern).
 * - Aucun cookie de mesure/pub déposé avant consentement (Google Consent Mode v2
 *   défini par défaut sur "denied" dans le <head> ; ici on met à jour au clic).
 * - Choix mémorisé en localStorage (pas de cookie tiers pour le bandeau lui-même).
 */
export default function CookieConsent() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved !== 'accepted' && saved !== 'refused') setVisible(true);
            else applyConsent(saved as Choice);
        } catch {
            setVisible(true);
        }
    }, []);

    function applyConsent(choice: Choice) {
        const granted = choice === 'accepted' ? 'granted' : 'denied';
        const w = window as any;
        if (typeof w.gtag === 'function') {
            w.gtag('consent', 'update', {
                ad_storage: granted,
                analytics_storage: granted,
                ad_user_data: granted,
                ad_personalization: granted,
            });
        }
    }

    function choose(choice: Choice) {
        try { localStorage.setItem(STORAGE_KEY, choice); } catch { }
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
