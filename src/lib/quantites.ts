/**
 * Lecture des quantités d'une ligne d'ingrédient.
 * ==============================================
 *
 * « 155 g de farine », « 2 c. à soupe d'huile », « 3 oignons », « Sel » : quatre
 * façons d'écrire une quantité, dont une qui n'en écrit aucune. Ce module les
 * ramène toutes à des GRAMMES, et rien d'autre.
 *
 * POURQUOI IL EXISTE SÉPARÉMENT — deux écrans chiffrent la même recette : le
 * prix (`recipe-price.ts`) et le Nutri-Score (`nutriscore.ts`). S'ils lisaient
 * chacun les lignes à leur façon, la même recette contiendrait 150 g de beurre
 * ici et 15 g là, et personne ne saurait lequel croire. Une seule lecture, deux
 * tables de valeurs : c'est la lecture qui est difficile, pas la table.
 *
 * Le code vient du module de prix, où il a été écrit et éprouvé sur les 666
 * recettes du site ; les commentaires qui racontent les dérapages évités sont
 * d'origine et valent d'être lus avant d'y toucher.
 */
import { normalizeIng } from '@/mobile/lib/ingredients';

/*
 * Contenants et cuillères.
 *
 * L'analyseur de la liste de courses les RETIRE du nom et vide l'unité : « 2
 * cuillères à soupe d'huile » lui donne une quantité de 2 et pas d'unité. Pour
 * mesurer, il faut les retrouver — dans le texte brut, celui-là ne ment pas.
 * Ordre important : les motifs les plus spécifiques d'abord.
 */
export const MESURES: Array<[RegExp, number, 'g' | 'ml']> = [
    /*
     * Les séparateurs varient : « c. à soupe », « c-à-soupe », « 1c.c », « càs ».
     *
     * La forme MI-ABRÉGÉE — « 1 c. à café de sel », de loin la plus courante du
     * corpus — n'était reconnue par aucune des deux branches : la première
     * attendait « cuillère » en toutes lettres, la seconde un « c » final et non
     * « café ». La cuillerée retombait sur le comptage de pièces, et une
     * cuillerée de sel pesait cent grammes. D'où le `(?:s\b|soupe)` : l'abrégé
     * s'accommode d'une fin écrite en entier.
     */
    [/cuill?[eè]res?\s*[-.]?\s*[àa]\s*[-.]?\s*soupe|\bc\s*[-.]?\s*[àa]\s*[-.]?\s*(?:s\b|soupe)|\bc\s*[-.]\s*s\b|\bcas\b|\bcs\b/, 15, 'ml'],
    [/cuill?[eè]res?\s*[-.]?\s*[àa]\s*[-.]?\s*caf[ée]|\bc\s*[-.]?\s*[àa]\s*[-.]?\s*(?:c\b|caf[ée])|\bc\s*[-.]\s*c\b|\bcac\b|\bcc\b/, 5, 'ml'],
    [/pinc[ée]e/, 1, 'g'],
    [/gousse/, 5, 'g'],
    [/poign[ée]e/, 30, 'g'],
    /*
     * Le PLURIEL, sans quoi la moitié de ces motifs ne servent à rien.
     *
     * « 2,5 tasses d'eau » ne contient pas « tasse » suivi d'une frontière de
     * mot : le « s » en tient lieu, et `\btasse\b` échouait. Les contenants
     * s'écrivent pourtant au pluriel dès qu'il y en a deux — c'est-à-dire
     * exactement quand la quantité compte.
     */
    [/\bbottes?\b/, 80, 'g'],
    [/\bb[aâ]tons?\b/, 2, 'g'],
    [/\bbouquets?\b/, 30, 'g'],
    [/\bbrins?\b|\bbranches?\b/, 3, 'g'],
    [/\btranches?\b/, 25, 'g'],
    [/\bsachets?\b/, 10, 'g'],
    [/\bverres?\b|\btasses?\b|\bmugs?\b/, 200, 'ml'],
    [/\bbo[iî]tes?\b|\bconserves?\b|\bboca(?:l|ux)\b/, 400, 'g'],
    [/\bpots?\b/, 200, 'g'],
    [/\bcubes?\b/, 10, 'g'],
    [/\bmorceaux?\b/, 30, 'g'],
    [/cuill?[eè]res?\s*[àa]\s*table/, 15, 'ml'],
    [/\bfeuilles?\b/, 2, 'g'],
    [/\bbouchons?\b/, 20, 'ml'],
    [/\bnoisettes?\s+de\b/, 8, 'g'],
];

/*
 * Lecture de la quantité, sur le texte brut.
 *
 * On ne se sert PAS de celle de l'analyseur de la liste de courses. Sa table
 * d'unités ignore « gr », et « 500gr de farfalle » lui donnait une quantité de
 * 500 sans unité — cinq cents pâtes.  Il lit très bien les NOMS ; pour les
 * quantités, une addition demande plus de rigueur.
 *
 * Trois formes couvrent le corpus : la fourchette (« 400 à 500 g »), le nombre
 * suivi d'une unité (« 40 cl », « 100gr »), et la fraction (« 1/2 c. à café »).
 */
const UNITES: Record<string, { v: number; t: 'g' | 'ml' }> = {
    kg: { v: 1000, t: 'g' }, kilo: { v: 1000, t: 'g' }, kilos: { v: 1000, t: 'g' },
    kilogramme: { v: 1000, t: 'g' }, kilogrammes: { v: 1000, t: 'g' },
    g: { v: 1, t: 'g' }, gr: { v: 1, t: 'g' }, gramme: { v: 1, t: 'g' }, grammes: { v: 1, t: 'g' },
    mg: { v: 0.001, t: 'g' },
    l: { v: 1000, t: 'ml' }, litre: { v: 1000, t: 'ml' }, litres: { v: 1000, t: 'ml' },
    dl: { v: 100, t: 'ml' }, cl: { v: 10, t: 'ml' }, ml: { v: 1, t: 'ml' },
    millilitre: { v: 1, t: 'ml' }, millilitres: { v: 1, t: 'ml' },
    /*
     * L'anglais, parce que le corpus en contient.
     *
     * Les recettes rapportées de TikTok arrivent parfois traduites à moitié :
     * « 5 grams Sel de mer », « 1kg Cream Cheese ». Sans « grams » dans cette
     * table, les cinq grammes de sel devenaient cinq PIÈCES de sel — cinq cents
     * grammes, et un cheesecake à seize grammes de sel pour cent.
     */
    gram: { v: 1, t: 'g' }, grams: { v: 1, t: 'g' },
    kilogram: { v: 1000, t: 'g' }, kilograms: { v: 1000, t: 'g' },
    liter: { v: 1000, t: 'ml' }, liters: { v: 1000, t: 'ml' },
    milliliter: { v: 1, t: 'ml' }, milliliters: { v: 1, t: 'ml' },
};
const UNITES_RE = Object.keys(UNITES).sort((a, b) => b.length - a.length).join('|');
const NOMBRE = '(\\d+(?:[.,]\\d+)?)';
const RE_FOURCHETTE = new RegExp(`^${NOMBRE}\\s*(?:a|-|ou)\\s*${NOMBRE}\\s*(${UNITES_RE})\\b`);
const RE_MESURE = new RegExp(`^${NOMBRE}\\s*(${UNITES_RE})\\b`);
const RE_FRACTION = /^(\d+)\s*\/\s*(\d+)/;
const RE_NOMBRE = new RegExp(`^${NOMBRE}`);
const nb = (s: string) => parseFloat(s.replace(',', '.'));

/** Quantité lue : en grammes, en millilitres, ou en nombre d'unités. */
export type Quantite = { g: number } | { ml: number } | { n: number } | null;

/**
 * La quantité est celle du PREMIER nombre de la ligne, pas la première qu'on
 * trouve d'un format donné.
 *
 * « 2 sachets de thé à la vanille pour 1,5 litre d'eau » : chercher une unité
 * n'importe où livrait « 1,5 litre », et l'on comptait un litre et demi de
 * gousses de vanille. Le nombre qui compte est celui qui ouvre la ligne ; le
 * reste appartient à la phrase, pas au produit.
 */
const RE_PARENTHESE = new RegExp(`\\(\\s*(?:env(?:iron)?\\.?\\s*)?${NOMBRE}\\s*(${UNITES_RE})\\s*\\)`);

export const quantiteBrute = (n: string): Quantite => {
    const i = n.search(/\d/);
    if (i < 0) return null;

    /*
     * La parenthèse d'abord, quand elle donne une mesure.
     *
     * Les recettes traduites gardent leur unité d'origine et mettent la nôtre
     * entre parenthèses : « 1 pound (600 g) de bœuf haché », « 1/2 tasse (120 g)
     * de fromage râpé ». En lisant le premier nombre on retenait « 1 pound » —
     * une livre de bœuf pesait cent grammes. La parenthèse, elle, est écrite
     * dans une unité qu'on sait convertir : c'est elle qu'il faut croire.
     */
    const par = n.match(RE_PARENTHESE);
    if (par) {
        const u = UNITES[par[2]];
        const q = nb(par[1]) * u.v;
        return u.t === 'g' ? { g: q } : { ml: q };
    }

    const reste = n.slice(i);

    const f = reste.match(RE_FOURCHETTE);
    if (f) {
        const u = UNITES[f[3]];
        const moyenne = ((nb(f[1]) + nb(f[2])) / 2) * u.v;
        return u.t === 'g' ? { g: moyenne } : { ml: moyenne };
    }
    const m = reste.match(RE_MESURE);
    if (m) {
        const u = UNITES[m[2]];
        const q = nb(m[1]) * u.v;
        return u.t === 'g' ? { g: q } : { ml: q };
    }
    const fr = reste.match(RE_FRACTION);
    if (fr) {
        const q = parseInt(fr[1], 10) / parseInt(fr[2], 10);
        return Number.isFinite(q) && q > 0 ? { n: q } : null;
    }
    const d = reste.match(RE_NOMBRE);
    return d ? { n: nb(d[1]) } : null;
};

/**
 * Le contenant ou la cuillère qui suit un nombre nu.
 *
 * Il doit suivre le nombre de PRÈS. « 6 piments chipotles en conserve » compte
 * six piments, pas six conserves — chercher le mot n'importe où dans la ligne
 * comptait 2,4 kg de piment.
 *
 * La fenêtre s'arrête à la PRÉPOSITION, parce que c'est elle qui sépare la
 * mesure du produit : dans « 1 cuillère à café de sel », tout ce qui précède
 * « de » est la mesure, tout ce qui suit est le sel. Une fenêtre de trois mots
 * s'arrêtait à « 1 cuillère à » et n'atteignait jamais « café » — la cuillerée
 * devenait une pièce, et la pincée de sel pesait cent grammes.
 *
 * Faute de préposition — « Sel (environ ½-1 cuillère à café » —, quatre mots :
 * de quoi lire une cuillerée entière, pas assez pour attraper le contenant de
 * « 6 piments chipotles en conserve », qui vient en cinquième position et
 * ferait de six piments 2,4 kg.
 */
export const mesureApres = (ligneNormalisee: string): [RegExp, number, 'g' | 'ml'] | undefined => {
    const i = ligneNormalisee.search(/\d/);
    if (i < 0) return undefined;
    /*
     * « 1c.c de sel » n'a pas d'espace, et « \bc » ne s'amorce pas après un
     * chiffre : la cuillerée était invisible et le sel repassait à cent grammes.
     * On décolle donc le nombre de ce qui le suit avant de regarder.
     */
    const mots = ligneNormalisee.slice(i).replace(/(\d)([a-z])/g, '$1 $2').split(' ');
    const prep = mots.findIndex((m, k) => k > 0 && /^(de|d|du|des)$/.test(m));
    const fenetre = mots.slice(0, prep > 0 ? prep : 4).join(' ');
    return MESURES.find(([re]) => re.test(fenetre));
};

/**
 * Poids d'UNE pièce, en grammes.
 *
 * Sert quand la ligne compte des unités sans le dire : « 2 oignons », « 3
 * pommes ». Sans ça, on ne saurait pas quoi peser.
 */
export const POIDS_PIECE: Record<string, number> = {
    'oeuf': 60, 'oignon': 110, 'oignon rouge': 110, 'echalote': 25, 'ail': 5, 'gousse d ail': 5,
    'tomate': 120, 'tomate cerise': 10, 'carotte': 90, 'pomme de terre': 150, 'patate douce': 250,
    'courgette': 250, 'aubergine': 300, 'poivron': 160, 'concombre': 350, 'poireau': 180,
    'citron': 100, 'citron vert': 60, 'orange': 180, 'pomme': 160, 'poire': 170, 'banane': 120,
    'peche': 140, 'abricot': 45, 'kiwi': 80, 'mangue': 350, 'avocat': 180, 'ananas': 1200,
    'melon': 1000, 'pasteque': 3000, 'grenade': 300, 'figue': 50, 'salade': 300,
    'brocoli': 500, 'chou-fleur': 800, 'fenouil': 300, 'betterave': 150, 'navet': 100,
    'blanc de poulet': 160, 'filet de poulet': 160, 'escalope de poulet': 150, 'cuisse de poulet': 200,
    'escalope de dinde': 140, 'steak': 150, 'cotelette': 120, 'saucisse': 80, 'merguez': 60,
    'pave de saumon': 130, 'dorade': 400, 'truite': 250, 'crevette': 12, 'gambas': 25,
    'saint-jacques': 20, 'tranche de jambon': 40, 'jambon': 40, 'bacon': 20,
    'tortilla': 60, 'pita': 70, 'bagel': 90, 'baguette': 250, 'pain': 60, 'pain de mie': 30,
    'feuille de brick': 12, 'biscuit': 10, 'boudoir': 8, 'speculoos': 6,
    'champignon': 20, 'olive': 4, 'cornichon': 10, 'datte': 8, 'noix': 5, 'radis': 10,
    'piment': 15, 'gousse': 5, 'laurier': 0.2, 'oeuf de caille': 10,
    'yaourt': 125, 'mozzarella': 125, 'burrata': 125, 'camembert': 250,
    // Ce qui se compte à l'unité sans qu'on y pense : un jaune d'œuf, un filet
    // d'anchois, un rouleau de pâte. Sans leur poids, chacun valait la pièce par
    // défaut — six anchois pesaient six cents grammes.
    'jaune': 18, 'blanc': 33, 'anchois': 5, 'fruit de la passion': 90,
    'blanc de volaille': 160,
    'pate feuilletee': 250, 'pate brisee': 250, 'pate sablee': 250,
};

/** Nom prêt pour une table : minuscules, sans accent, apostrophes en espaces. */
export const cle = (s: string) => normalizeIng(s).replace(/['’]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * L'entrée de table qui décrit un produit.
 *
 * Exact d'abord, puis la meilleure entrée dont TOUS les mots se suivent dans le
 * nom : « huile d olive vierge extra » trouve « huile d olive » et pas « huile ».
 * On compare des suites de mots, jamais des sous-chaînes — sinon « sel » se
 * reconnaîtrait dans « persil ».
 *
 * Départage : d'abord la position — en français le nom de tête ouvre le groupe,
 * « glace vanille bourbon » est une glace. Chercher l'entrée la plus LONGUE
 * d'abord retenait « vanille ». À position égale, la plus précise l'emporte
 * (« huile d olive » avant « huile »).
 */
export const indexerTable = (cles: string[]) => cles.map((k) => ({ k, mots: k.split(' ') }));

export const chercherEntree = (
    nom: string,
    index: Array<{ k: string; mots: string[] }>,
): string | null => {
    const n = cle(nom);
    const mots = n.split(' ');
    let meilleur: { k: string; pos: number; long: number } | null = null;
    for (const e of index) {
        for (let i = 0; i + e.mots.length <= mots.length; i++) {
            let ok = true;
            for (let j = 0; j < e.mots.length; j++) {
                if (mots[i + j] !== e.mots[j]) { ok = false; break; }
            }
            if (!ok) continue;
            if (!meilleur || i < meilleur.pos || (i === meilleur.pos && e.mots.length > meilleur.long)) {
                meilleur = { k: e.k, pos: i, long: e.mots.length };
            }
            break;   // pour cette entrée, la première position suffit
        }
    }
    return meilleur ? meilleur.k : null;
};
