/**
 * Le choix cookies du visiteur : un seul endroit pour l'écrire et le lire.
 *
 * Le bandeau, le pied de page et les lecteurs TikTok posent tous la même
 * question ; ils la posent désormais au même endroit.
 */
export const STORAGE_KEY = 'cookie-consent-v1';

/** Événement émis par le lien « Cookies » du pied de page pour rouvrir le bandeau. */
export const ROUVRIR_CONSENTEMENT = 'consentement-rouvrir';

export type Choice = 'accepted' | 'refused';

/*
 * Six mois, la durée annoncée dans la politique de confidentialité et la
 * recommandation de la CNIL. Passé ce délai, on repose la question.
 */
const VALIDITE = 6 * 30 * 24 * 3600 * 1000;

/**
 * Le choix en cours, ou `null` s'il n'y en a pas (ou plus).
 *
 * Accepte l'ancien format — la valeur était la chaîne « accepted » ou
 * « refused », sans date — pour ne pas reposer la question à ceux qui ont déjà
 * répondu. Faute de date, ce choix-là est traité comme frais.
 */
export function lireConsentement(): Choice | null {
    if (typeof window === 'undefined') return null;
    let brut: string | null;
    try { brut = localStorage.getItem(STORAGE_KEY); } catch { return null; }
    if (!brut) return null;

    if (brut === 'accepted' || brut === 'refused') return brut;

    try {
        const { choix, date } = JSON.parse(brut) as { choix?: string; date?: number };
        if (choix !== 'accepted' && choix !== 'refused') return null;
        if (typeof date === 'number' && Date.now() - date > VALIDITE) return null;
        return choix;
    } catch {
        return null;
    }
}

/** Vrai quand le visiteur a accepté les traceurs (mesure, lecteurs tiers). */
export function consentementAccepte(): boolean {
    return lireConsentement() === 'accepted';
}
