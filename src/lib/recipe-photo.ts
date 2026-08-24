/**
 * Deux tailles pour une même photo générée.
 *
 * Les images créées par scripts/generate-recipe-images.js sont écrites en deux
 * exemplaires : `<id>-carte.webp` (760 px, ~110 ko) et `<id>.webp` (1200 px,
 * ~270 ko). Le champ `image` des recettes pointe sur la PETITE, parce que
 * c'est elle qui s'affiche trente fois sur l'accueil — servir la grande
 * partout ajouterait plusieurs mégaoctets à chaque visite.
 *
 * La fiche recette, elle, montre une seule photo en grand : elle appelle donc
 * `grandePhoto()`, qui bascule vers l'exemplaire haute définition.
 */
export function grandePhoto(url?: string | null): string {
    if (!url) return '';
    // Ne concerne que nos images générées ; les photos WordPress n'ont pas de
    // seconde taille et doivent être rendues telles quelles.
    return url.replace(/-carte\.webp$/, '.webp');
}
