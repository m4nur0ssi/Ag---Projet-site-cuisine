import { mockRecipes } from '@/data/mockData';
import { isMainDish, isSideDish, hasSideIncluded } from '@/lib/mealClassify';

/**
 * Menus d'exemple du tutoriel.
 *
 * Le planificateur du tuto tourne en bac à sable (prop `demo` de WeekPlanner) : il ne
 * lit pas le menu réel et n'écrit ni en local ni en base. Ce module ne fournit donc que
 * son contenu de départ.
 */

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Premier plat dont le titre contient l'un des mots, dans l'ORDRE de préférence donné. */
const preferred = (pool: any[], words: string[]) => {
    for (const w of words) { const hit = pool.find(r => norm(r.title).includes(w)); if (hit) return hit; }
    return null;
};

// Un plat dont le TITRE annonce déjà un féculent/légume ne peut pas illustrer le cas
// « plat seul, il lui faut un accompagnement » : afficher des patatas bravas sous une
// salade de pommes de terre donnerait tort à l'explication.
const STARCHY_WORDS = ['patatas', 'pomme de terre', 'pommes de terre', 'frites', 'riz', 'rice', 'pates', 'semoule',
    'gratin', 'puree', 'quinoa', 'boulgour', 'polenta', 'haricot', 'nouilles', 'legumes', 'salade', 'wok', 'poelee'];
const looksSelfSufficient = (r: any) => STARCHY_WORDS.some(w => norm(r.title).includes(w));

/**
 * Deux plats qui montrent la règle des accompagnements côte à côte :
 * - `included` contient déjà son féculent/légume (couscous…) → aucun accompagnement ;
 * - `paired` n'en contient pas (viande) → l'IA lui en a attaché un.
 * Les préférences de titre ne sont qu'un confort : à défaut, n'importe quel plat de la
 * bonne famille fait l'affaire (la démonstration reste juste).
 */
export function buildSideDemoPlan(): { included: any; paired: any } | null {
    const mains = mockRecipes.filter(isMainDish);
    const withSide = mains.filter(hasSideIncluded);
    // Plats dont le titre ne mentionne aucun féculent : l'exemple reste lisible.
    const withoutSide = mains.filter(r => !hasSideIncluded(r) && !looksSelfSufficient(r));
    const included = preferred(withSide, ['couscous', 'tajine', 'paella', 'lasagne', 'risotto', 'chili']) || withSide[0];
    const main = preferred(withoutSide, ['paleron', 'boeuf', 'steak', 'entrecote', 'magret', 'poulet', 'saumon'])
        || withoutSide[0] || mains.find(r => !hasSideIncluded(r));
    const sides = mockRecipes.filter(isSideDish);
    const side = preferred(sides, ['puree', 'riz', 'gratin', 'haricot', 'legumes']) || sides[0];
    if (!included || !main || !side) return null;
    return { included, paired: { ...main, side } };
}
