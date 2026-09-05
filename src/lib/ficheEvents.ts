/**
 * Les messages que s'échangent les écrans à propos de la fiche flottante.
 *
 * Une constante, dans un module qui ne dépend de rien : le composant qui
 * demande la fermeture (le volet « Ajouter au planificateur », par exemple)
 * n'a pas à importer l'hôte de la fiche — donc pas à traîner avec lui le
 * catalogue des recettes que cet hôte transporte.
 */

/** Demande la fermeture de la fiche recette flottante, d'où qu'elle vienne. */
export const FERMER_FICHE = 'magic-close-recipe-sheet';
