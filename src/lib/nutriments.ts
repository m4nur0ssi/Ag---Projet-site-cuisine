/**
 * Ce que contiennent les ingrédients.
 * ===================================
 *
 * Une ligne par produit, pour 100 g, dans l'ordre :
 *
 *     [kcal, protéines, glucides, sucres, lipides, saturés, fibres, sel, f/l/n, portion?]
 *
 * Les sept premiers champs sont des grammes ; `sel` aussi (sel = sodium × 2,5) ;
 * `f/l/n` est le pourcentage de fruits, légumes, légumineuses et fruits à coque
 * du produit — la seule composante du Nutri-Score qui ne se lise pas sur une
 * étiquette. `portion` est ce qu'on retient quand la ligne ne chiffre rien
 * (« Sel », « Huile d'olive ») ; sans elle, une pincée de sel pèserait cent
 * grammes et aucun plat du site n'obtiendrait mieux qu'un E.
 *
 * D'OÙ VIENNENT CES CHIFFRES
 * --------------------------
 * De la table Ciqual de l'ANSES (composition nutritionnelle des aliments,
 * référence française), complétée par l'USDA FoodData Central pour ce que
 * Ciqual ne couvre pas, et arrondie : au gramme sous 10, à la dizaine au-delà.
 * Cette précision-là est déjà supérieure à celle de la lecture des lignes.
 *
 * Les VIANDES ET POISSONS sont donnés CRUS, comme on les achète et comme les
 * recettes les pèsent. Les FÉCULENTS aussi (pâtes, riz, lentilles sèches) : une
 * recette qui dit « 200 g de riz » parle du paquet, pas de la casserole.
 *
 * CE QUI COMPTE COMME FRUIT OU LÉGUME
 * -----------------------------------
 * Le règlement du Nutri-Score, pas le bon sens. En sont EXCLUS les tubercules
 * — pomme de terre, patate douce, manioc — parce qu'ils se comportent comme des
 * féculents ; en font partie les champignons, les légumineuses, les fruits à
 * coque, et l'huile d'olive, de colza et de noix. C'est pour cela que la purée
 * n'est pas un plat de légumes et que la ratatouille l'est.
 */
import { cle, indexerTable, chercherEntree } from '@/lib/quantites';

/** [kcal, protéines, glucides, sucres, lipides, saturés, fibres, sel, f/l/n %, portion g] */
export type Nutriment = [number, number, number, number, number, number, number, number, number, number?];

export const NUTRIMENTS: Record<string, Nutriment> = {
    // ── Viandes ────────────────────────────────────────────────────────────
    'poulet': [121, 22.5, 0, 0, 3.5, 1.1, 0, 0.15, 0],
    'blanc de poulet': [111, 23, 0, 0, 1.7, 0.5, 0, 0.15, 0],
    'filet de poulet': [111, 23, 0, 0, 1.7, 0.5, 0, 0.15, 0],
    'escalope de poulet': [111, 23, 0, 0, 1.7, 0.5, 0, 0.15, 0],
    'aiguillette de poulet': [111, 23, 0, 0, 1.7, 0.5, 0, 0.15, 0],
    'cuisse de poulet': [158, 19, 0, 0, 9, 2.5, 0, 0.2, 0],
    'dinde': [112, 23.5, 0, 0, 1.8, 0.6, 0, 0.15, 0],
    'escalope de dinde': [106, 23, 0, 0, 1.2, 0.4, 0, 0.15, 0],
    'boeuf': [175, 21, 0, 0, 10, 4.2, 0, 0.16, 0],
    'viande hachee': [217, 19, 0, 0, 15, 6.5, 0, 0.17, 0],
    'boeuf hache': [217, 19, 0, 0, 15, 6.5, 0, 0.17, 0],
    'steak hache': [217, 19, 0, 0, 15, 6.5, 0, 0.17, 0],
    'steak': [145, 22, 0, 0, 6, 2.5, 0, 0.16, 0],
    'straccetti': [145, 22, 0, 0, 6, 2.5, 0, 0.16, 0],
    'entrecote': [250, 19, 0, 0, 19, 8, 0, 0.15, 0],
    'bavette': [175, 21, 0, 0, 10, 4.2, 0, 0.15, 0],
    'rumsteck': [135, 22, 0, 0, 5, 2, 0, 0.15, 0],
    'paleron': [160, 20, 0, 0, 9, 3.6, 0, 0.15, 0],
    'bourguignon': [170, 20, 0, 0, 10, 4, 0, 0.15, 0],
    'veau': [120, 21, 0, 0, 4, 1.4, 0, 0.15, 0],
    'agneau': [230, 18, 0, 0, 17, 8, 0, 0.15, 0],
    'gigot': [190, 19, 0, 0, 12, 5.5, 0, 0.15, 0],
    'cotelette': [240, 18, 0, 0, 18, 8, 0, 0.15, 0],
    'porc': [195, 20, 0, 0, 12, 4.5, 0, 0.15, 0],
    'filet mignon': [130, 22, 0, 0, 4.5, 1.6, 0, 0.15, 0],
    'echine': [220, 18, 0, 0, 16, 6, 0, 0.15, 0],
    'travers de porc': [280, 17, 0, 0, 23, 9, 0, 0.4, 0],
    'lardon': [320, 15, 0.5, 0.5, 29, 11, 0, 2.5, 0],
    'poitrine fumee': [320, 15, 0.5, 0.5, 29, 11, 0, 2.5, 0],
    'bacon': [250, 20, 0.5, 0.5, 19, 7, 0, 3.0, 0],
    'jambon': [110, 20, 1, 1, 3, 1, 0, 2.2, 0],
    'jambon cru': [240, 27, 0.5, 0.5, 14, 5, 0, 5.0, 0],
    'chorizo': [380, 22, 2, 1, 31, 12, 0, 3.8, 0],
    'saucisse': [290, 15, 2, 1, 25, 9.5, 0, 1.8, 0],
    'merguez': [300, 14, 1.5, 1, 27, 11, 0, 1.9, 0],
    'merguez de boeuf': [300, 14, 1.5, 1, 27, 11, 0, 1.9, 0],
    'saucisson': [420, 24, 2, 1.5, 35, 13, 0, 4.5, 0],
    'canard': [200, 19, 0, 0, 14, 5, 0, 0.15, 0],
    'magret': [210, 19, 0, 0, 15, 5.5, 0, 0.15, 0],
    'confit de canard': [290, 22, 0, 0, 22, 8, 0, 1.2, 0],
    'lapin': [140, 21, 0, 0, 6, 2, 0, 0.15, 0],
    'foie gras': [460, 8, 3, 2, 46, 17, 0, 1.5, 0, 40],
    'seitan': [140, 25, 5, 0.5, 2, 0.3, 1, 1.0, 0],
    'tofu': [120, 12, 2, 0.5, 7, 1.2, 1, 0.02, 0],

    // ── Poissons et fruits de mer ──────────────────────────────────────────
    'saumon': [200, 20, 0, 0, 13, 2.5, 0, 0.1, 0],
    'pave de saumon': [200, 20, 0, 0, 13, 2.5, 0, 0.1, 0],
    'saumon fume': [200, 22, 0, 0, 12, 2.5, 0, 3.0, 0],
    'cabillaud': [80, 18, 0, 0, 0.7, 0.15, 0, 0.2, 0],
    'colin': [82, 17, 0, 0, 1, 0.2, 0, 0.2, 0],
    'lieu': [80, 18, 0, 0, 0.8, 0.2, 0, 0.2, 0],
    'merlu': [85, 17, 0, 0, 1.5, 0.3, 0, 0.2, 0],
    'dorade': [105, 20, 0, 0, 3, 0.8, 0, 0.2, 0],
    'bar': [100, 19, 0, 0, 2.5, 0.6, 0, 0.2, 0],
    'truite': [130, 20, 0, 0, 5.5, 1.2, 0, 0.1, 0],
    'sole': [85, 17, 0, 0, 1.5, 0.4, 0, 0.25, 0],
    'thon': [145, 24, 0, 0, 5, 1.5, 0, 0.3, 0],
    'sardine': [200, 22, 0, 0, 12, 3, 0, 0.5, 0],
    'maquereau': [200, 19, 0, 0, 14, 3.3, 0, 0.3, 0],
    'anchois': [200, 22, 0, 0, 12, 3, 0, 8.0, 0, 10],
    'crevette': [100, 21, 0.5, 0, 1.2, 0.3, 0, 1.2, 0],
    'gambas': [100, 21, 0.5, 0, 1.2, 0.3, 0, 1.2, 0],
    'moule': [85, 14, 3, 0, 2, 0.4, 0, 1.0, 0],
    'palourde': [80, 14, 2.5, 0, 1, 0.2, 0, 1.2, 0],
    'calamar': [90, 16, 1, 0, 1.5, 0.4, 0, 0.4, 0],
    'poulpe': [85, 16, 2, 0, 1, 0.3, 0, 0.6, 0],
    'saint-jacques': [85, 17, 2, 0, 0.8, 0.2, 0, 0.5, 0],
    'crabe': [90, 19, 0, 0, 1.5, 0.3, 0, 1.5, 0],
    'surimi': [100, 9, 14, 5, 1, 0.2, 0, 2.0, 0],
    'poisson': [100, 19, 0, 0, 3, 0.8, 0, 0.25, 0],

    // ── Légumes ────────────────────────────────────────────────────────────
    // Les tubercules ne comptent PAS comme légumes au Nutri-Score : f/l/n = 0.
    'pomme de terre': [80, 2, 17, 0.8, 0.2, 0.05, 2, 0.01, 0],
    'patate douce': [90, 1.6, 20, 5.5, 0.15, 0.05, 3, 0.02, 0],
    'carotte': [36, 0.8, 6.5, 5.5, 0.2, 0.05, 2.8, 0.06, 100],
    'oignon': [40, 1.2, 7, 5, 0.2, 0.05, 1.8, 0.01, 100],
    'oignon rouge': [40, 1.2, 7, 5, 0.2, 0.05, 1.8, 0.01, 100],
    'oignon en poudre': [340, 10, 65, 25, 1, 0.2, 15, 0.07, 100, 2],
    'echalote': [55, 1.8, 11, 6, 0.2, 0.05, 2, 0.02, 100],
    'ail': [130, 6, 23, 1, 0.5, 0.1, 4, 0.02, 100, 5],
    'ail en poudre': [330, 16, 60, 2, 1, 0.2, 9, 0.06, 100, 2],
    'poireau': [30, 1.5, 4, 2.5, 0.3, 0.05, 2.5, 0.03, 100],
    'tomate': [18, 0.8, 2.8, 2.5, 0.2, 0.05, 1.2, 0.01, 100],
    'tomate cerise': [20, 0.9, 3, 2.8, 0.2, 0.05, 1.2, 0.01, 100],
    'tomate concassee': [25, 1.2, 3.5, 3, 0.2, 0.05, 1.2, 0.1, 100],
    'coulis de tomate': [35, 1.4, 5.5, 5, 0.3, 0.06, 1.4, 0.15, 100],
    'concentre de tomate': [90, 4.5, 13, 12, 0.6, 0.1, 4, 0.2, 100, 30],
    'sauce tomate': [55, 1.5, 7, 6, 2, 0.3, 1.5, 0.8, 90],
    'courgette': [17, 1.2, 2, 1.8, 0.3, 0.08, 1.1, 0.01, 100],
    'aubergine': [22, 0.9, 3, 2.5, 0.2, 0.05, 2.5, 0.01, 100],
    'poivron': [26, 1, 4, 3.5, 0.3, 0.05, 1.8, 0.01, 100],
    'poivron grille': [40, 1, 4, 3.5, 2, 0.3, 1.8, 0.8, 100],
    'champignon': [22, 3, 1.5, 1, 0.3, 0.05, 1.8, 0.01, 100],
    'champignon de paris': [22, 3, 1.5, 1, 0.3, 0.05, 1.8, 0.01, 100],
    'cepe': [30, 3.5, 2, 1, 0.5, 0.1, 3, 0.01, 100],
    'brocoli': [32, 3, 2.5, 1.5, 0.4, 0.08, 3, 0.03, 100],
    'chou-fleur': [25, 2, 2.5, 2, 0.3, 0.07, 2.2, 0.03, 100],
    'chou': [25, 1.5, 3.5, 3, 0.2, 0.05, 2.5, 0.02, 100],
    'chou rouge': [28, 1.5, 4, 3.5, 0.2, 0.05, 2.5, 0.02, 100],
    'epinard': [22, 2.7, 1, 0.5, 0.4, 0.06, 2.5, 0.1, 100],
    'haricot vert': [30, 1.8, 3.5, 1.8, 0.2, 0.05, 3, 0.01, 100],
    'petit pois': [78, 5.5, 10, 3.5, 0.5, 0.1, 5.5, 0.02, 100],
    'concombre': [12, 0.6, 1.7, 1.5, 0.1, 0.02, 0.7, 0.01, 100],
    'salade': [15, 1.2, 1.5, 1, 0.2, 0.04, 1.5, 0.02, 100],
    'roquette': [25, 2.6, 2, 2, 0.7, 0.09, 1.6, 0.07, 100],
    'mache': [20, 2, 1.5, 1, 0.4, 0.05, 1.5, 0.02, 100],
    'celeri': [18, 1, 2, 1.8, 0.2, 0.04, 1.6, 0.1, 100],
    'fenouil': [25, 1.2, 3, 2.5, 0.3, 0.05, 3, 0.05, 100],
    'navet': [25, 1, 4, 3.5, 0.15, 0.02, 2, 0.05, 100],
    'betterave': [40, 1.6, 7, 6.5, 0.15, 0.03, 2.5, 0.2, 100],
    'potiron': [25, 1, 4.5, 3, 0.2, 0.05, 1.5, 0.01, 100],
    'courge': [30, 1, 6, 3, 0.2, 0.05, 1.5, 0.01, 100],
    'butternut': [40, 1, 8, 3.5, 0.2, 0.04, 2, 0.01, 100],
    'radis': [15, 0.8, 2, 1.8, 0.1, 0.02, 1.5, 0.05, 100],
    'endive': [17, 1, 2, 1.5, 0.2, 0.04, 2, 0.02, 100],
    'asperge': [22, 2.4, 2, 1.5, 0.2, 0.05, 2, 0.01, 100],
    'artichaut': [45, 3, 5, 1, 0.2, 0.05, 5, 0.1, 100],
    'mais': [95, 3, 17, 4, 1.2, 0.2, 2.5, 0.3, 100],
    'olive': [150, 1, 1, 0, 15, 2.2, 3, 3.5, 100, 40],
    'cornichon': [15, 0.8, 1.5, 1, 0.2, 0.03, 1.2, 2.5, 100, 30],
    'gingembre': [80, 1.8, 15, 1.7, 0.8, 0.2, 2, 0.03, 100, 10],
    'gingembre en poudre': [335, 9, 58, 3.4, 4, 2, 14, 0.07, 100, 2],
    'citronnelle': [100, 1.8, 25, 0, 0.5, 0.1, 5, 0.01, 100, 5],
    'piment': [40, 2, 6, 4, 0.4, 0.05, 1.5, 0.02, 100, 15],
    'piment d espelette': [300, 12, 50, 10, 12, 2, 28, 0.1, 100, 1],
    'harissa': [90, 3, 8, 4, 5, 0.7, 5, 4.0, 60, 15],

    // ── Légumineuses (comptées comme légumes au Nutri-Score) ───────────────
    'lentille': [340, 25, 50, 2, 1.5, 0.2, 15, 0.02, 100],
    'lentille corail': [350, 24, 55, 2, 1.5, 0.2, 10, 0.02, 100],
    'pois chiche': [350, 20, 50, 4, 6, 0.6, 15, 0.02, 100],
    'haricot blanc': [330, 22, 48, 2.5, 1.5, 0.3, 16, 0.02, 100],
    'haricot rouge': [330, 23, 48, 2.5, 1.5, 0.2, 15, 0.02, 100],

    // ── Fruits ─────────────────────────────────────────────────────────────
    'citron': [30, 1, 3, 2.5, 0.3, 0.04, 2, 0.01, 100],
    'jus de citron': [22, 0.4, 2, 2, 0.2, 0.03, 0.2, 0.01, 100, 15],
    'citron vert': [30, 0.7, 3, 1.7, 0.2, 0.02, 2.8, 0.01, 100],
    'orange': [45, 1, 9, 8.5, 0.2, 0.03, 2, 0.01, 100],
    'jus d orange': [45, 0.7, 10, 9, 0.2, 0.03, 0.3, 0.01, 100],
    'pomme': [52, 0.3, 12, 10, 0.2, 0.03, 2.4, 0.01, 100],
    'poire': [57, 0.4, 13, 10, 0.2, 0.02, 3, 0.01, 100],
    'banane': [90, 1.1, 20, 15, 0.3, 0.1, 2.6, 0.01, 100],
    'peche': [40, 0.9, 8, 8, 0.2, 0.02, 1.5, 0.01, 100],
    'nectarine': [44, 1, 9, 8, 0.3, 0.03, 1.7, 0.01, 100],
    'abricot': [45, 0.9, 9, 8.5, 0.3, 0.02, 2, 0.01, 100],
    'abricot sec': [240, 3.4, 53, 48, 0.5, 0.03, 7, 0.02, 100],
    'kiwi': [58, 1.1, 11, 9, 0.5, 0.05, 2.5, 0.01, 100],
    'mangue': [60, 0.8, 14, 13, 0.3, 0.07, 1.8, 0.01, 100],
    'avocat': [165, 2, 1, 0.5, 16, 2.3, 6.5, 0.01, 100],
    'ananas': [50, 0.5, 12, 10, 0.2, 0.02, 1.4, 0.01, 100],
    'melon': [35, 0.8, 8, 7.5, 0.2, 0.05, 0.9, 0.02, 100],
    'pasteque': [30, 0.6, 7, 6, 0.2, 0.02, 0.4, 0.01, 100],
    'grenade': [83, 1.7, 17, 14, 1.2, 0.1, 4, 0.01, 100],
    'figue': [70, 0.8, 16, 14, 0.3, 0.06, 2.5, 0.01, 100],
    'fraise': [32, 0.7, 6, 5, 0.3, 0.02, 2, 0.01, 100],
    'framboise': [45, 1.2, 8, 4.5, 0.6, 0.02, 6.5, 0.01, 100],
    'mure': [43, 1.4, 6, 5, 0.5, 0.02, 5, 0.01, 100],
    'myrtille': [57, 0.7, 12, 10, 0.3, 0.03, 2.4, 0.01, 100],
    'cerise': [63, 1, 14, 13, 0.3, 0.04, 2.1, 0.01, 100],
    'prune': [46, 0.7, 10, 10, 0.3, 0.02, 1.5, 0.01, 100],
    'raisin': [70, 0.7, 16, 16, 0.2, 0.05, 1, 0.01, 100],
    'raisin sec': [300, 3, 70, 65, 0.5, 0.1, 4, 0.02, 100],
    'datte': [280, 2.5, 68, 62, 0.4, 0.03, 8, 0.01, 100],
    'fruit rouge': [45, 1, 8, 6, 0.4, 0.03, 4, 0.01, 100],
    'fruit de la passion': [97, 2.2, 11, 11, 0.7, 0.06, 10, 0.02, 100],
    'noix de coco': [350, 3.3, 6, 6, 33, 30, 9, 0.05, 100],
    'compote': [60, 0.3, 13, 12, 0.2, 0.03, 1.5, 0.01, 100],
    'confiture': [260, 0.4, 63, 60, 0.2, 0.03, 1, 0.02, 30, 30],

    // ── Fruits à coque et graines (comptés au Nutri-Score) ─────────────────
    'amande': [620, 21, 9, 4, 53, 4, 12, 0.01, 100, 30],
    'poudre d amande': [620, 21, 9, 4, 53, 4, 12, 0.01, 100],
    'amande amere': [10, 0, 1, 1, 0, 0, 0, 0, 0, 2],
    'noisette': [630, 15, 7, 4, 61, 4.5, 10, 0.01, 100, 30],
    'noix': [690, 15, 4, 2.6, 65, 6, 6.7, 0.01, 100, 30],
    'noix de cajou': [580, 18, 27, 6, 44, 8, 3, 0.02, 100, 30],
    'noix de pecan': [690, 9, 4, 4, 72, 6, 10, 0.01, 100, 30],
    'pistache': [570, 20, 17, 8, 45, 5.5, 10, 0.5, 100, 30],
    'pignon de pin': [670, 14, 4, 3.6, 68, 5, 3.7, 0.01, 100, 20],
    'cacahuete': [570, 26, 10, 4, 46, 7, 8.5, 0.5, 100, 30],
    'beurre de cacahuete': [600, 25, 12, 6, 50, 10, 6, 0.5, 100, 20],
    'graine de sesame': [570, 18, 12, 0.3, 50, 7, 12, 0.02, 100, 10],
    'graine de courge': [560, 30, 11, 1.4, 45, 8, 6, 0.02, 100, 20],
    'graine de tournesol': [580, 21, 12, 2.6, 50, 4.5, 8.6, 0.02, 100, 20],
    'graine de chia': [490, 17, 8, 0, 31, 3.3, 34, 0.04, 100, 15],
    'tahini': [600, 17, 10, 0.5, 54, 7.6, 9, 0.1, 100, 20],
    'praline': [520, 8, 45, 42, 33, 4, 5, 0.05, 30, 30],

    // ── Produits laitiers et œufs ──────────────────────────────────────────
    'lait': [46, 3.2, 4.8, 4.8, 1.5, 1, 0, 0.1, 0],
    'lait entier': [64, 3.2, 4.8, 4.8, 3.6, 2.3, 0, 0.1, 0],
    'lait d amande': [22, 0.5, 2.4, 2.4, 1.1, 0.1, 0.3, 0.1, 0],
    'lait de soja': [40, 3.3, 1.5, 1, 1.9, 0.3, 0.5, 0.1, 0],
    'lait de coco': [190, 2, 3, 2.5, 19, 17, 0.5, 0.03, 0],
    'creme de coco': [230, 2, 4, 3, 23, 21, 1, 0.03, 0],
    'lait concentre': [130, 6.5, 10, 10, 7, 4.5, 0, 0.2, 0],
    'lait concentre sucre': [320, 8, 55, 55, 8, 5, 0, 0.15, 0],
    'creme fraiche': [300, 2.4, 3, 3, 30, 20, 0, 0.05, 0],
    'creme liquide': [300, 2.4, 3, 3, 30, 20, 0, 0.05, 0],
    'creme epaisse': [300, 2.4, 3, 3, 30, 20, 0, 0.06, 0],
    'creme speciale cuisson': [200, 2.5, 4, 3.5, 19, 13, 0, 0.15, 0],
    'chantilly': [330, 2, 10, 10, 31, 21, 0, 0.05, 0],
    'beurre': [750, 0.7, 0.6, 0.6, 82, 52, 0, 0.02, 0, 20],
    'margarine': [700, 0.2, 0.5, 0.5, 78, 22, 0, 0.8, 0, 20],
    'mascarpone': [420, 4.5, 3.5, 3.5, 43, 29, 0, 0.05, 0],
    'ricotta': [150, 8, 3.5, 3, 11, 7, 0, 0.15, 0],
    'fromage blanc': [75, 8, 4, 4, 3, 2, 0, 0.1, 0],
    'skyr': [60, 11, 4, 4, 0.2, 0.1, 0, 0.1, 0],
    'yaourt': [60, 4, 5, 5, 3, 2, 0, 0.1, 0],
    'yaourt grec': [115, 6, 4, 4, 9, 6, 0, 0.1, 0],
    'philadelphia': [250, 6, 4, 4, 24, 16, 0, 0.9, 0],
    'boursin': [400, 7, 3, 2, 40, 27, 0, 1.3, 0],
    'mozzarella': [250, 18, 1.5, 1, 19, 13, 0, 0.6, 0],
    'burrata': [280, 13, 2, 1.5, 25, 17, 0, 0.6, 0],
    'feta': [265, 14, 1.5, 1, 22, 15, 0, 3.0, 0],
    'chevre': [290, 18, 2, 1.5, 23, 16, 0, 1.5, 0],
    'parmesan': [400, 33, 1, 0.9, 29, 19, 0, 1.6, 0],
    'gruyere': [390, 27, 0.5, 0.5, 31, 20, 0, 1.1, 0],
    'emmental': [380, 28, 0.5, 0.5, 29, 19, 0, 0.6, 0],
    'comte': [410, 27, 1, 1, 33, 21, 0, 0.9, 0],
    'cheddar': [410, 25, 1.5, 0.5, 34, 21, 0, 1.8, 0],
    'fromage': [350, 23, 1.5, 1, 28, 18, 0, 1.5, 0],
    'fromage rape': [380, 27, 1.5, 0.5, 29, 19, 0, 1.5, 0],
    'bleu': [355, 21, 1, 0.5, 29, 20, 0, 3.5, 0],
    'roquefort': [370, 20, 1, 0.5, 32, 22, 0, 3.8, 0],
    'camembert': [300, 20, 0.5, 0.5, 24, 16, 0, 1.6, 0],
    'reblochon': [330, 20, 1, 1, 27, 18, 0, 1.3, 0],
    'raclette': [355, 23, 1, 1, 29, 19, 0, 1.5, 0],
    'oeuf': [145, 12.5, 0.7, 0.7, 10, 3, 0, 0.35, 0],
    'oeuf de caille': [155, 13, 0.4, 0.4, 11, 3.5, 0, 0.3, 0],
    'glace': [200, 3.5, 25, 23, 10, 6.5, 0.5, 0.12, 0],
    'glace vanille': [200, 3.5, 25, 23, 10, 6.5, 0.5, 0.12, 0],

    // ── Farines, céréales et pains ─────────────────────────────────────────
    'farine': [350, 10, 72, 1.5, 1.2, 0.2, 3, 0.01, 0],
    'fecule de mais': [350, 0.3, 86, 0, 0.3, 0.05, 0.9, 0.01, 0],
    'maizena': [350, 0.3, 86, 0, 0.3, 0.05, 0.9, 0.01, 0],
    'chapelure': [370, 12, 70, 4, 4, 0.8, 4, 1.2, 0],
    'semoule': [350, 12, 70, 1, 1.5, 0.2, 4, 0.01, 0],
    'boulgour': [340, 12, 65, 1, 1.5, 0.2, 9, 0.01, 0],
    'quinoa': [370, 14, 60, 3, 6, 0.7, 7, 0.01, 0],
    'riz': [350, 7, 78, 0.3, 1, 0.25, 1.5, 0.01, 0],
    'riz basmati': [350, 8, 77, 0.3, 1, 0.25, 1.5, 0.01, 0],
    'riz arborio': [350, 7, 78, 0.3, 1, 0.25, 1.5, 0.01, 0],
    'pate': [355, 12, 71, 3, 1.5, 0.3, 3, 0.01, 0],
    'spaghetti': [355, 12, 71, 3, 1.5, 0.3, 3, 0.01, 0],
    'tagliatelle': [355, 12, 71, 3, 1.5, 0.3, 3, 0.01, 0],
    'lasagne': [355, 12, 71, 3, 1.5, 0.3, 3, 0.01, 0],
    'nouille': [355, 12, 71, 3, 1.5, 0.3, 3, 0.01, 0],
    'flocon d avoine': [370, 13, 60, 1, 7, 1.3, 10, 0.01, 0],
    'pain': [265, 8, 50, 3, 1.5, 0.3, 3, 1.2, 0],
    'pain de mie': [280, 8, 48, 5, 5, 1, 3, 1.1, 0],
    'baguette': [265, 8, 52, 2.5, 1.3, 0.3, 2.7, 1.3, 0],
    'tortilla': [300, 8, 50, 2, 7, 2, 3, 1.2, 0],
    'pita': [275, 9, 55, 2, 1.5, 0.3, 3, 1.2, 0],
    'bagel': [280, 10, 53, 4, 2, 0.4, 3, 1.1, 0],
    'feuille de brick': [300, 9, 60, 1, 2, 0.4, 2, 1.0, 0],
    'pate feuilletee': [400, 6, 40, 1.5, 24, 13, 2, 1.0, 0],
    'pate brisee': [420, 6, 45, 2, 24, 12, 2, 1.0, 0],
    'pate sablee': [460, 6, 52, 15, 25, 13, 2, 0.6, 0],
    'pate a pizza': [270, 8, 48, 2, 4, 1, 2.5, 1.2, 0],
    'biscuit': [470, 6, 65, 25, 20, 11, 2, 0.6, 0],
    'petit-beurre': [450, 7, 72, 22, 15, 8, 2, 0.8, 0],
    'boudoir': [390, 8, 75, 40, 5, 1.5, 1.5, 0.3, 0],
    'speculoos': [480, 5.5, 70, 35, 20, 9, 2, 0.9, 0],

    // ── Matières grasses ───────────────────────────────────────────────────
    // L'huile d'olive compte comme « fruit/légume » au Nutri-Score, au même titre
    // que celles de colza et de noix. Les autres huiles, non.
    'huile': [900, 0, 0, 0, 100, 13, 0, 0, 0, 15],
    'huile d olive': [900, 0, 0, 0, 100, 14, 0, 0, 100, 15],
    'huile de tournesol': [900, 0, 0, 0, 100, 11, 0, 0, 0, 15],
    'huile de coco': [900, 0, 0, 0, 100, 87, 0, 0, 0, 15],
    'huile de sesame': [900, 0, 0, 0, 100, 14, 0, 0, 0, 10],

    // ── Sucres et chocolats ────────────────────────────────────────────────
    'sucre': [400, 0, 100, 100, 0, 0, 0, 0, 0, 50],
    'sucre glace': [400, 0, 100, 100, 0, 0, 0, 0, 0, 30],
    'cassonade': [390, 0, 98, 97, 0, 0, 0, 0.02, 0, 50],
    'sucre de coco': [380, 1, 92, 90, 0, 0, 0, 0.1, 0, 50],
    'sucre vanille': [400, 0, 99, 98, 0, 0, 0, 0, 0, 8],
    'miel': [320, 0.4, 80, 79, 0, 0, 0.2, 0.01, 0, 20],
    'sirop': [300, 0, 75, 70, 0, 0, 0, 0.02, 0, 20],
    'sirop d erable': [260, 0, 67, 60, 0, 0, 0, 0.03, 0, 20],
    'caramel': [380, 1, 80, 70, 6, 4, 0, 0.3, 0, 30],
    'chocolat': [540, 6, 55, 50, 32, 19, 7, 0.02, 0],
    'chocolat noir': [550, 8, 45, 35, 38, 23, 11, 0.02, 0],
    'chocolat au lait': [540, 7, 57, 55, 31, 19, 3, 0.15, 0],
    'chocolat blanc': [560, 6, 59, 58, 32, 20, 0.2, 0.15, 0],
    'pepite de chocolat': [500, 5, 60, 55, 27, 16, 5, 0.05, 0],
    'cacao': [350, 20, 15, 1, 22, 13, 30, 0.05, 0, 20],
    'nutella': [540, 6, 57, 56, 31, 11, 3, 0.1, 0, 30],

    // ── Condiments, épices, herbes ─────────────────────────────────────────
    // Les portions par défaut comptent ici plus que les valeurs : une ligne
    // « Sel » sans quantité pèse 3 g, pas cent.
    'sel': [0, 0, 0, 0, 0, 0, 0, 100, 0, 3],
    'fleur de sel': [0, 0, 0, 0, 0, 0, 0, 100, 0, 2],
    'poivre': [250, 10, 45, 1, 3, 1, 25, 0.05, 0, 1],
    'muscade': [525, 6, 50, 28, 36, 25, 20, 0.05, 0, 0.5],
    'cannelle': [250, 4, 55, 2, 1.2, 0.3, 53, 0.03, 0, 2],
    'cannelle en poudre': [250, 4, 55, 2, 1.2, 0.3, 53, 0.03, 0, 2],
    'paprika': [280, 14, 34, 10, 13, 2, 35, 0.07, 0, 2],
    'curry': [325, 14, 40, 3, 14, 2, 33, 0.1, 0, 3],
    'curcuma': [310, 10, 44, 3, 3, 1.8, 21, 0.07, 0, 2],
    'cumin': [375, 18, 33, 2, 22, 1.5, 11, 0.4, 0, 2],
    'coriandre en poudre': [300, 12, 40, 0, 18, 1, 42, 0.1, 0, 2],
    'safran': [310, 11, 61, 0, 6, 1.6, 4, 0.1, 0, 0.2],
    'herbe de provence': [280, 9, 45, 0, 7, 2, 35, 0.1, 0, 2],
    'origan': [265, 9, 45, 0, 7, 2, 40, 0.1, 0, 2],
    'thym': [265, 9, 45, 0, 7, 2, 40, 0.1, 0, 2],
    'romarin': [265, 9, 45, 0, 7, 2, 40, 0.1, 0, 2],
    'laurier': [265, 9, 45, 0, 7, 2, 40, 0.1, 0, 1],
    'sauge': [265, 9, 45, 0, 7, 2, 40, 0.1, 0, 2],
    'estragon': [265, 9, 45, 0, 7, 2, 40, 0.1, 0, 2],
    'aneth': [45, 3.5, 4, 0.5, 1, 0.1, 2, 0.15, 100, 5],
    'basilic': [30, 3, 3, 0.5, 0.6, 0.1, 3, 0.05, 100, 10],
    'persil': [35, 3, 3, 0.9, 0.8, 0.1, 3.3, 0.14, 100, 10],
    'ciboulette': [30, 3, 3, 1.8, 0.7, 0.1, 2.5, 0.01, 100, 8],
    'menthe': [45, 3.3, 5, 0.5, 0.7, 0.2, 4, 0.07, 100, 8],
    'coriandre': [25, 2, 2, 0.9, 0.5, 0.01, 2.8, 0.11, 100, 10],
    'vanille': [290, 0.1, 65, 60, 0.1, 0, 0, 0.02, 0, 2],
    'extrait de vanille': [290, 0.1, 13, 13, 0, 0, 0, 0.01, 0, 5],
    'arome vanille': [290, 0.1, 13, 13, 0, 0, 0, 0.01, 0, 5],
    'moutarde': [150, 7, 5, 2, 11, 0.7, 4, 5.5, 0, 15],
    'ketchup': [110, 1.2, 25, 22, 0.2, 0.03, 1, 2.0, 0, 20],
    'mayonnaise': [700, 1, 2, 1.5, 76, 6, 0, 1.3, 0, 20],
    'sauce soja': [60, 6, 6, 1.5, 0.1, 0.02, 0.8, 16, 0, 15],
    'sauce worcestershire': [80, 0.5, 19, 15, 0, 0, 0, 4.5, 0, 5],
    'vinaigre': [20, 0.1, 0.5, 0.4, 0, 0, 0, 0.02, 0, 15],
    'vinaigre balsamique': [90, 0.5, 17, 15, 0, 0, 0, 0.1, 0, 15],
    'creme de balsamique': [220, 0.5, 52, 45, 0, 0, 0, 0.2, 0, 15],
    'pesto': [450, 5, 6, 3, 45, 7, 2, 2.5, 30, 30],
    'tapenade': [350, 2, 4, 1, 35, 5, 4, 3.5, 80, 25],
    /*
     * Le bouillon est pris PRÊT À L'EMPLOI, pas en cube.
     *
     * Une ligne sur deux dit « 50 cl de bouillon », l'autre « 1 cube ». Si la
     * table décrivait le concentré, le demi-litre pesait cinq cents grammes de
     * cube — cent grammes de sel dans une soupe. On préfère sous-estimer le
     * cube que rendre le litre absurde.
     */
    'bouillon': [5, 0.4, 0.5, 0.2, 0.2, 0.05, 0, 0.9, 0, 200],
    // Les fonds suivent le bouillon, et pour la même raison : « 150 ml de fond de
    // volaille » est du fond reconstitué. Décrits comme le concentré qu'on achète,
    // ces cent cinquante millilitres pesaient trente-sept grammes de sel.
    'fond de veau': [8, 0.8, 0.8, 0.3, 0.3, 0.1, 0, 1.0, 0, 150],
    'fond de volaille': [8, 0.8, 0.8, 0.3, 0.3, 0.1, 0, 1.0, 0, 150],
    'levure': [350, 40, 35, 3, 6, 1, 20, 0.1, 0, 8],
    'levure chimique': [100, 0, 25, 0, 0, 0, 0, 25, 0, 10],
    'levure de boulanger': [350, 40, 35, 3, 6, 1, 20, 0.1, 0, 8],
    'levure seche': [350, 40, 35, 3, 6, 1, 20, 0.1, 0, 8],
    'levure maltee': [350, 45, 35, 3, 5, 0.8, 25, 0.1, 0, 10],
    'bicarbonate': [0, 0, 0, 0, 0, 0, 0, 68, 0, 3],
    'gelatine': [340, 85, 0, 0, 0.1, 0, 0, 0.5, 0, 8],
    'agar-agar': [300, 5, 80, 0, 0.1, 0, 75, 0.1, 0, 4],

    // ── Boissons ───────────────────────────────────────────────────────────
    'eau': [0, 0, 0, 0, 0, 0, 0, 0, 0, 200],
    'eau gazeuse': [0, 0, 0, 0, 0, 0, 0, 0.05, 0, 200],
    'glacon': [0, 0, 0, 0, 0, 0, 0, 0, 0, 50],
    'the': [1, 0, 0, 0, 0, 0, 0, 0.01, 0, 200],
    'cafe': [2, 0.2, 0, 0, 0, 0, 0, 0.01, 0, 100],
    'jus de fruit': [45, 0.5, 10, 9, 0.1, 0.02, 0.2, 0.01, 100, 200],
    'limonade': [40, 0, 10, 10, 0, 0, 0, 0.02, 0, 200],
    'tonic': [35, 0, 9, 9, 0, 0, 0, 0.02, 0, 150],
    'vin blanc': [80, 0.1, 2.6, 1, 0, 0, 0, 0.01, 0, 100],
    'vin rouge': [85, 0.1, 2.6, 0.6, 0, 0, 0, 0.01, 0, 100],
    'champagne': [85, 0.2, 3, 1.5, 0, 0, 0, 0.01, 0, 100],
    'prosecco': [85, 0.2, 3, 1.5, 0, 0, 0, 0.01, 0, 100],
    'biere': [45, 0.5, 3.5, 0.3, 0, 0, 0, 0.01, 0, 250],
    'cidre': [45, 0.1, 4, 3.5, 0, 0, 0, 0.01, 0, 200],
    'rhum': [230, 0, 0.1, 0, 0, 0, 0, 0, 0, 40],
    'vodka': [230, 0, 0.1, 0, 0, 0, 0, 0, 0, 40],
    'gin': [230, 0, 0.1, 0, 0, 0, 0, 0, 0, 40],
    'whisky': [230, 0, 0.1, 0, 0, 0, 0, 0, 0, 40],
    'tequila': [230, 0, 0.1, 0, 0, 0, 0, 0, 0, 40],
    'cognac': [230, 0, 0.1, 0, 0, 0, 0, 0, 0, 40],
    'porto': [160, 0.1, 12, 10, 0, 0, 0, 0.01, 0, 60],
    'aperol': [220, 0, 25, 25, 0, 0, 0, 0, 0, 40],
    'campari': [220, 0, 25, 25, 0, 0, 0, 0, 0, 40],
    'cointreau': [320, 0, 30, 30, 0, 0, 0, 0, 0, 30],
    'limoncello': [320, 0, 30, 30, 0, 0, 0, 0, 0, 30],

    /*
     * ── Les formes que produit vraiment l'analyseur ─────────────────────────
     *
     * `canonicalIng` met les noms au SINGULIER en retirant la dernière lettre :
     * « noix » devient « noi », « radis » « radi », « spéculoos » « speculoo ».
     * Une table écrite en français correct ne rencontre donc jamais ces
     * produits-là — les noix étaient comptées comme un ingrédient inconnu, à
     * 150 kcal au lieu de 690. Les clés ci-dessous sont écrites dans la langue
     * de l'analyseur, pas dans la nôtre.
     */
    'noi': [690, 15, 4, 2.6, 65, 6, 6.7, 0.01, 100, 30],
    'noi de coco': [350, 3.3, 6, 6, 33, 30, 9, 0.05, 100],
    'noi de cajou': [580, 18, 27, 6, 44, 8, 3, 0.02, 100, 30],
    'noi de pecan': [690, 9, 4, 4, 72, 6, 10, 0.01, 100, 30],
    'radi': [15, 0.8, 2, 1.8, 0.1, 0.02, 1.5, 0.05, 100],
    'speculoo': [480, 5.5, 70, 35, 20, 9, 2, 0.9, 0],
    'gamba': [100, 21, 0.5, 0, 1.2, 0.3, 0, 1.2, 0],
    'saint-jacque': [85, 17, 2, 0, 0.8, 0.2, 0, 0.5, 0],
    'foie gra': [460, 8, 3, 2, 46, 17, 0, 1.5, 0, 40],
    'capre': [25, 2, 5, 1, 0.9, 0.1, 3, 6, 100, 15],
    'traver de porc': [280, 17, 0, 0, 23, 9, 0, 0.4, 0],
    'couli de tomate': [35, 1.4, 5.5, 5, 0.3, 0.06, 1.4, 0.15, 100],
    'champignon de pari': [22, 3, 1.5, 1, 0.3, 0.05, 1.8, 0.01, 100],
    // « Viande hachée » perd son adjectif et ne reste que « viande ». C'est le
    // deuxième ingrédient inconnu du site : sans cette ligne, quatre cents
    // grammes de bœuf ne pesaient rien dans le calcul.
    'viande': [200, 19, 0, 0, 14, 5.5, 0, 0.16, 0],
    'fruit': [55, 0.8, 12, 10, 0.3, 0.05, 2, 0.01, 100],
    'jaune': [320, 16, 0.6, 0.6, 27, 10, 0, 0.1, 0, 18],
    'patate': [80, 2, 17, 0.8, 0.2, 0.05, 2, 0.01, 0],
    'mozza': [250, 18, 1.5, 1, 19, 13, 0, 0.6, 0],
    'demi-citron': [30, 1, 3, 2.5, 0.3, 0.04, 2, 0.01, 100, 50],
    'demi-citron vert': [30, 0.7, 3, 1.7, 0.2, 0.02, 2.8, 0.01, 100, 30],
    'demi-orange': [45, 1, 9, 8.5, 0.2, 0.03, 2, 0.01, 100, 90],

    // ── Ce que les recettes du site emploient et qui manquait ──────────────
    'sumac': [330, 5, 60, 0, 7, 1, 20, 1.0, 0, 2],
    'zaatar': [350, 14, 25, 0, 20, 3, 25, 3.0, 0, 5],
    'ras el hanout': [330, 12, 45, 3, 12, 2, 25, 0.5, 0, 5],
    'baharat': [330, 12, 45, 3, 12, 2, 25, 0.5, 0, 5],
    'epice': [300, 11, 45, 3, 10, 2, 25, 0.5, 0, 2],
    'epices': [300, 11, 45, 3, 10, 2, 25, 0.5, 0, 2],
    'poudre de chili': [280, 13, 50, 8, 12, 2, 30, 1.5, 0, 3],
    'persillade': [80, 3, 4, 1, 6, 1, 3, 0.5, 100, 10],
    'laitue': [15, 1.2, 1.5, 1, 0.2, 0.04, 1.5, 0.02, 100],
    'cebette': [32, 1.8, 4, 2.3, 0.2, 0.03, 2.6, 0.02, 100],
    'jalapeno': [30, 1, 5, 3, 0.4, 0.05, 2.5, 0.02, 100, 15],
    'cranberrie': [310, 0.2, 80, 70, 1.4, 0.1, 5.5, 0.01, 100, 30],
    'sesame': [570, 18, 12, 0.3, 50, 7, 12, 0.02, 100, 10],
    'pecorino': [400, 28, 1, 0.9, 32, 21, 0, 1.8, 0],
    'speck': [240, 27, 0.5, 0.5, 14, 5, 0, 4.5, 0],
    'gnocchi': [160, 4, 32, 1, 1, 0.2, 2, 1.0, 0],
    'orzo': [355, 12, 71, 3, 1.5, 0.3, 3, 0.01, 0],
    'corn flake': [380, 7, 84, 8, 1, 0.2, 3, 1.8, 0],
    'frite': [280, 3.5, 35, 0.5, 14, 1.5, 3, 0.6, 0],
    'guacamole': [170, 2, 4, 1, 16, 2.5, 4, 0.8, 80, 50],
    'creme aigre': [190, 3, 4, 4, 18, 11, 0, 0.1, 0],
    'creme fouettee': [330, 2, 10, 10, 31, 21, 0, 0.05, 0],
    'creme legere': [160, 3, 4, 4, 15, 10, 0, 0.1, 0],
    'creme double': [340, 2, 3, 3, 36, 24, 0, 0.05, 0],
    'creme balsamique': [220, 0.5, 52, 45, 0, 0, 0, 0.2, 0, 15],
    'st moret': [180, 7, 4, 4, 15, 10, 0, 0.8, 0],
    'cream cheese': [250, 6, 4, 4, 24, 16, 0, 0.9, 0],
    'volaille': [121, 22.5, 0, 0, 3.5, 1.1, 0, 0.15, 0],
    'blanc de volaille': [111, 23, 0, 0, 1.7, 0.5, 0, 0.15, 0],
    'panure': [370, 12, 70, 4, 4, 0.8, 4, 1.2, 0, 40],
    'soja': [60, 6, 6, 1.5, 0.1, 0.02, 0.8, 16, 0, 15],
    'sriracha': [100, 1.5, 20, 17, 0.5, 0.1, 1.5, 6.0, 0, 10],
    'sauce sriracha': [100, 1.5, 20, 17, 0.5, 0.1, 1.5, 6.0, 0, 10],
    'sauce huitre': [110, 2, 25, 20, 0.3, 0.05, 0.3, 9.0, 0, 15],
    'sauce barbecue': [160, 1, 35, 30, 0.5, 0.1, 1, 2.5, 0, 20],
    'sauce yakitori': [180, 3, 38, 32, 0.2, 0, 0.3, 4.0, 0, 20],
    'kecap mani': [230, 3, 50, 45, 0.1, 0, 0.5, 8.0, 0, 15],
    'mirin': [230, 0.2, 43, 35, 0, 0, 0, 0.1, 0, 15],
    'pectine': [340, 0, 90, 0, 0, 0, 85, 0.1, 0, 5],
    'nappage neutre': [250, 0, 62, 55, 0, 0, 0, 0.05, 0, 20],
    'vergeoise': [390, 0, 98, 97, 0, 0, 0, 0.02, 0, 50],
    'fleur d oranger': [5, 0, 1, 1, 0, 0, 0, 0, 0, 5],
    'angostura': [400, 0, 10, 5, 0, 0, 0, 0, 0, 1],
};

/**
 * Densités, pour les lignes qui mesurent un volume.
 *
 * « 10 cl de crème » se pèse à 100 g, « 10 cl d'huile » à 92 g, « 2 c. à soupe
 * de miel » à 42 g et non 30. Hors de cette table, un millilitre vaut un gramme
 * — l'eau, le lait, le vin et le bouillon s'en accommodent au pour cent près.
 */
const DENSITES: Record<string, number> = {
    'huile': 0.92, 'huile d olive': 0.92, 'huile de tournesol': 0.92,
    'huile de coco': 0.92, 'huile de sesame': 0.92,
    'miel': 1.42, 'sirop': 1.32, 'sirop d erable': 1.32, 'creme de balsamique': 1.3,
    'lait concentre sucre': 1.28, 'nutella': 1.2, 'confiture': 1.3,
    'creme fraiche': 1.0, 'creme liquide': 1.0, 'creme epaisse': 1.0,
    'farine': 0.55, 'sucre': 0.85, 'sucre glace': 0.56, 'cacao': 0.5,
    'chapelure': 0.4, 'flocon d avoine': 0.4, 'noix de coco': 0.35,
};

const INDEX = indexerTable(Object.keys(NUTRIMENTS));

/** Ce qu'on retient d'un produit absent de la table : un plat moyen, sans plus. */
export const NUTRIMENT_INCONNU: Nutriment = [150, 6, 15, 4, 7, 2.5, 1.5, 0.4, 0, 80];

/**
 * Les valeurs d'un produit, et si on les connaît vraiment.
 *
 * `connu` sert à ne rien afficher quand la moitié de la recette a été devinée :
 * un Nutri-Score fondé sur des valeurs moyennes n'est pas un Nutri-Score, c'est
 * une lettre tirée au sort.
 */
export const nutrimentsDe = (nom: string): { valeurs: Nutriment; connu: boolean; cleTable: string | null } => {
    const n = cle(nom);
    if (NUTRIMENTS[n]) return { valeurs: NUTRIMENTS[n], connu: true, cleTable: n };
    const k = chercherEntree(nom, INDEX);
    return k
        ? { valeurs: NUTRIMENTS[k], connu: true, cleTable: k }
        : { valeurs: NUTRIMENT_INCONNU, connu: false, cleTable: null };
};

/** Combien pèse un millilitre de ce produit. */
export const densiteDe = (cleTable: string | null): number =>
    (cleTable && DENSITES[cleTable]) || 1;
