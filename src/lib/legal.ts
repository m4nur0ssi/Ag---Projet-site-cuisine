/*
 * Point unique pour tout ce qui touche aux mentions légales : l'adresse de
 * contact et le délai de retrait sont cités dans plusieurs pages, un seul
 * endroit pour les changer.
 */
export const CONTACT_EMAIL = 'contact@lesrecettesmagiques.fr';

/** Délai d'engagement pour retirer une vidéo à la demande de son auteur. */
export const TAKEDOWN_DELAY = '48 heures';

export const LEGAL_LINKS: { href: string; label: string }[] = [
    { href: '/mentions-legales', label: 'Mentions légales' },
    { href: '/confidentialite', label: 'Confidentialité & cookies' },
    { href: '/cgu', label: "Conditions d'utilisation" },
    { href: '/contact', label: 'Contact & retrait de contenu' },
];

/** Date affichée en tête de chaque page légale. */
export const LEGAL_UPDATED = '20 août 2026';
