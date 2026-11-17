/**
 * Intitulés du classement « Top N » : N est le nombre EXACT de recettes notées
 * (20 notées → Top 20, 32 → Top 32), jamais un chiffre figé.
 */
export const libelleTop = (n: number) => `Top ${n}`;
export const titreTop = (n: number) => `Top ${n} : les mieux notées`;
