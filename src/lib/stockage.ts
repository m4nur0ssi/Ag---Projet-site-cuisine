/**
 * Écrire dans le stockage local sans faire tomber l'application.
 * =============================================================
 *
 * `localStorage.setItem` LÈVE une exception quand le quota est atteint —
 * environ cinq mégaoctets sur Safari, et la cave y range des photos en base64.
 * Appelée depuis un gestionnaire de clic, cette exception n'est rattrapée par
 * personne : React démonte l'arbre et l'écran devient noir, avec le message
 * d'exception de Next.js. C'est intermittent par nature : tout va bien jusqu'au
 * jour où le stockage est plein.
 *
 * Cocher un ingrédient ne doit pas pouvoir casser l'application. On écrit donc
 * par ici : en cas d'échec, la valeur n'est pas gardée, un événement part pour
 * qui veut le dire à l'utilisateur, et le geste se termine normalement.
 */

/** Émis quand une écriture a échoué faute de place. */
export const STOCKAGE_PLEIN = 'magic-stockage-plein';

let deja = false;

/** Écrit une valeur. Renvoie `false` si le stockage n'en a pas voulu. */
export function ecrireStock(cle: string, valeur: string): boolean {
    try {
        localStorage.setItem(cle, valeur);
        deja = false;
        return true;
    } catch {
        // Une seule alerte par épisode : le même geste peut écrire trois clés
        // d'affilée, et trois messages pour un seul problème n'aident personne.
        if (!deja && typeof window !== 'undefined') {
            deja = true;
            window.dispatchEvent(new CustomEvent(STOCKAGE_PLEIN, { detail: { cle } }));
        }
        return false;
    }
}

/** Lit une valeur. Renvoie `defaut` si la clé manque ou si la lecture échoue. */
export function lireStock(cle: string, defaut = ''): string {
    try {
        return localStorage.getItem(cle) ?? defaut;
    } catch {
        return defaut;
    }
}
