'use client';
import { ROUVRIR_CONSENTEMENT } from '@/lib/consentement';

/*
 * « Retirer son consentement doit être aussi simple que de le donner » (RGPD,
 * art. 7-3). Sans ce lien, la seule façon de revenir sur son choix était
 * d'effacer les données du site à la main. Il rouvre le bandeau, là où il a été
 * donné.
 */
export default function BoutonCookies({ className }: { className?: string }) {
    return (
        <button
            type="button"
            className={className}
            onClick={() => window.dispatchEvent(new Event(ROUVRIR_CONSENTEMENT))}
        >
            Cookies
        </button>
    );
}
