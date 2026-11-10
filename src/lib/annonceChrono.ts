'use client';

import { direNaturel, pourLaVoix } from '@/lib/voixCuisine';

/** « Cuire 10 min les carottes... » → texte propre pour la phrase annoncée. */
function proprement(label: string): string {
    return label.replace(/\.{3}$|…$/, '').replace(/\s+/g, ' ').trim();
}

/**
 * Un minuteur arrive à zéro : vibration, puis phrase dite à voix haute
 * (voix naturelle, sinon voix de l'appareil). Remplace le `alert()` qui
 * bloquait la page et restait muet.
 */
export async function annoncerFinChrono(label: string, titreRecette?: string, nom?: string | null): Promise<void> {
    if (typeof window === 'undefined') return;
    try { if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 400]); } catch { /* noop */ }
    const quoi = proprement(label);
    // Avec un nom d'ingrédient : « carottes : c'est prêt ». Sinon, la phrase de l'étape.
    const phrase = nom
        ? `${nom.charAt(0).toUpperCase() + nom.slice(1)} : c'est prêt.`
        : `Minuteur terminé${titreRecette ? ` pour ${titreRecette}` : ''}. ${quoi}`.slice(0, 220);
    const dit = pourLaVoix(phrase);
    let ok = false;
    try { ok = await direNaturel(dit); } catch { ok = false; }
    if (ok) return;
    try {
        if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(dit);
            u.lang = 'fr-FR';
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
        }
    } catch { /* noop */ }
}
