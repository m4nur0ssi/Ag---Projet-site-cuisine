import { describe, it, expect } from 'vitest';
import { estRecetteDeSaison, estEligibleIds, legumesDeIngredients, TAG_SAISON } from './saison';

describe('chemin pré-calculé (accueil, sans ingrédients)', () => {
    it('legumesDeIngredients : ids canoniques, dédoublonnés, aromates exclus', () => {
        expect(legumesDeIngredients(['2 courgettes', 'tomates cerises', 'ail', 'courgette', 'riz'])).toEqual(['courgette', 'tomate']);
        expect(legumesDeIngredients([])).toEqual([]);
    });

    it('estEligibleIds applique la règle des deux tiers sur des ids', () => {
        expect(estEligibleIds(['courgette', 'poivron'], 8)).toBe(true);
        expect(estEligibleIds(['courgette', 'poireau'], 8)).toBe(false);
        expect(estEligibleIds([], 8)).toBe(false);
        expect(estEligibleIds(['inconnu'], 8)).toBe(false);
    });

    it('legumes pré-calculés prioritaires sur les ingrédients bruts', () => {
        expect(estRecetteDeSaison({ legumes: ['poireau'], ingredients: [{ name: 'courgette' }] }, 8)).toBe(false);
        expect(estRecetteDeSaison({ legumes: ['courgette'] }, 8)).toBe(true);
        expect(estRecetteDeSaison({ legumes: [] , ingredients: [{ name: 'courgette' }] }, 8)).toBe(false);
    });
});

const recette = (...noms: string[]) => ({ ingredients: noms.map((name) => ({ name })) });

describe('estRecetteDeSaison — prédicat du filtre recherche', () => {
    it('expose un tag stable pour le filtre', () => {
        expect(TAG_SAISON).toBe('saison-100');
    });

    it('recette sans ingrédients → non de saison', () => {
        expect(estRecetteDeSaison({ ingredients: [] }, 8)).toBe(false);
        expect(estRecetteDeSaison({}, 8)).toBe(false);
        expect(estRecetteDeSaison({ ingredients: null }, 8)).toBe(false);
    });

    it('quantités et emojis dans les lignes d’ingrédients ne gênent pas', () => {
        expect(estRecetteDeSaison(recette('🥣\n  2 courgettes', '🥣\n  1 cuillère à soupe d’huile d’olive'), 8)).toBe(true);
    });

    it('la même recette change selon le mois', () => {
        const r = recette('poireau', 'pommes de terre', 'crème fraîche');
        expect(estRecetteDeSaison(r, 1)).toBe(true);
        expect(estRecetteDeSaison(r, 7)).toBe(false);
    });

    it('un ingrédient de saison sans autre légume suffit si la recette n’en a qu’un', () => {
        expect(estRecetteDeSaison(recette('courgette', 'riz', 'poulet'), 8)).toBe(true);
    });

    it('recette à deux légumes, un hors saison → non', () => {
        expect(estRecetteDeSaison(recette('courgette', 'poireau'), 8)).toBe(false);
    });

    it('recette sans légume principal (ail, oignon, herbes seuls) → non', () => {
        expect(estRecetteDeSaison(recette('ail', 'oignon', 'persil', 'sel'), 8)).toBe(false);
    });
});
