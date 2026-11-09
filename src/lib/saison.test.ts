import { describe, it, expect } from 'vitest';
import {
    analyserSaison,
    identifierLegume,
    minimumRequis,
    moisCourantParis,
    normaliserIngredient,
} from './saison';

describe('minimumRequis — deux tiers arrondis à l’entier supérieur', () => {
    it.each([
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 2],
        [4, 3],
        [5, 4],
        [6, 4],
    ])('%i légume(s) → %i requis', (n, attendu) => {
        expect(minimumRequis(n)).toBe(attendu);
    });
});

describe('identifierLegume — classification', () => {
    it('reconnaît les légumes avec quantité ou article', () => {
        expect(identifierLegume('2 courgettes')?.id).toBe('courgette');
        expect(identifierLegume('1 poivron rouge')?.id).toBe('poivron');
        expect(identifierLegume('des haricots verts')?.id).toBe('haricot-vert');
    });

    it('ne compte pas l’ail, l’oignon, l’échalote, les herbes et les épices', () => {
        expect(identifierLegume('ail')).toBeNull();
        expect(identifierLegume('2 gousses d’ail')).toBeNull();
        expect(identifierLegume('oignon rouge')).toBeNull();
        expect(identifierLegume('échalote')).toBeNull();
        expect(identifierLegume('persil frais')).toBeNull();
        expect(identifierLegume('thym')).toBeNull();
        expect(identifierLegume('poivre noir')).toBeNull();
    });

    it('ne compte pas les féculents, légumineuses sèches ni protéines', () => {
        expect(identifierLegume('pommes de terre')).toBeNull();
        expect(identifierLegume('riz basmati')).toBeNull();
        expect(identifierLegume('haricots blancs')).toBeNull();
        expect(identifierLegume('poulet')).toBeNull();
        expect(identifierLegume('lardons')).toBeNull();
    });

    it('ne compte pas les produits transformés ni les formes non fraîches', () => {
        expect(identifierLegume('concentré de tomate')).toBeNull();
        expect(identifierLegume('sauce tomate')).toBeNull();
        expect(identifierLegume('purée de tomates')).toBeNull();
        expect(identifierLegume('tomates séchées')).toBeNull();
        expect(identifierLegume('pâte à choux')).toBeNull();
        expect(identifierLegume('carottes surgelées')).toBeNull();
    });

    it('distingue chou-fleur et chou', () => {
        expect(identifierLegume('chou-fleur')?.id).toBe('chou-fleur');
        expect(identifierLegume('chou rouge')?.id).toBe('chou');
    });

    it('normalise accents, casse et ponctuation', () => {
        expect(normaliserIngredient('  Épinards  !')).toBe('epinards');
        expect(identifierLegume('ÉPINARDS')?.id).toBe('epinard');
    });
});

describe('analyserSaison — règle des deux tiers', () => {
    it('aucun légume principal → jamais éligible', () => {
        const r = analyserSaison(['ail', 'oignon', 'poulet', 'riz'], 8);
        expect(r.total).toBe(0);
        expect(r.eligible).toBe(false);
    });

    it('un seul légume, de saison → éligible', () => {
        expect(analyserSaison(['courgette', 'riz'], 8).eligible).toBe(true);
    });

    it('un seul légume, hors saison → non éligible', () => {
        expect(analyserSaison(['poireau'], 8).eligible).toBe(false);
    });

    it('deux légumes : les DEUX doivent être de saison', () => {
        // août : courgette et poivron de saison, poireau non.
        expect(analyserSaison(['courgette', 'poivron'], 8).eligible).toBe(true);
        expect(analyserSaison(['courgette', 'poireau'], 8).eligible).toBe(false);
    });

    it('trois légumes : au moins deux de saison', () => {
        expect(analyserSaison(['courgette', 'poivron', 'poireau'], 8).eligible).toBe(true);
        expect(analyserSaison(['courgette', 'poireau', 'navet'], 8).eligible).toBe(false);
    });

    it('quatre légumes : au moins trois de saison', () => {
        // août : courgette, poivron, tomate de saison ; poireau non.
        expect(analyserSaison(['courgette', 'poivron', 'tomate', 'poireau'], 8).eligible).toBe(true);
        expect(analyserSaison(['courgette', 'poivron', 'poireau', 'navet'], 8).eligible).toBe(false);
    });

    it('synonymes : un même légume n’est compté qu’une fois', () => {
        const r = analyserSaison(['tomates', 'tomates cerises', 'poivron'], 8);
        expect(r.total).toBe(2);
        expect(r.legumes).toEqual(['tomate', 'poivron']);
    });

    it('les ingrédients non reconnus ne sont jamais comptés comme de saison', () => {
        // Un légume reconnu hors saison + un ingrédient inconnu : pas éligible.
        const r = analyserSaison(['poireau', 'xyzzy-inconnu'], 8);
        expect(r.total).toBe(1);
        expect(r.eligible).toBe(false);
    });

    it('carotte, disponible toute l’année, reste éligible en janvier et en juillet', () => {
        expect(analyserSaison(['carottes'], 1).eligible).toBe(true);
        expect(analyserSaison(['carottes'], 7).eligible).toBe(true);
    });

    it('la saison dépend du mois : poireau de saison en janvier, pas en juillet', () => {
        expect(analyserSaison(['poireau'], 1).eligible).toBe(true);
        expect(analyserSaison(['poireau'], 7).eligible).toBe(false);
    });
});

describe('moisCourantParis — fuseau Europe/Paris', () => {
    it('le passage à minuit à Paris compte pour le nouveau mois', () => {
        // 2026-11-30 23:30 UTC = 2026-12-01 00:30 à Paris (CET, UTC+1).
        expect(moisCourantParis(new Date('2026-11-30T23:30:00Z'))).toBe(12);
    });

    it('en été (CEST, UTC+2) aussi', () => {
        // 2026-06-30 22:30 UTC = 2026-07-01 00:30 à Paris.
        expect(moisCourantParis(new Date('2026-06-30T22:30:00Z'))).toBe(7);
    });
});
