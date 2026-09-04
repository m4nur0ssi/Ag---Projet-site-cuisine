/**
 * Le Nutri-Score d'une recette.
 * =============================
 *
 * Ce que c'est : on pèse chaque ingrédient, on additionne ce qu'il apporte, on
 * divise par le poids total du plat, et on passe les valeurs pour 100 g dans
 * l'algorithme officiel. La lettre qui en sort se lit comme celle d'un produit
 * en rayon, parce que c'est le même calcul.
 *
 * Ce que ce n'est pas : une analyse de laboratoire. Trois approximations
 * demeurent, et il vaut mieux les connaître :
 *
 *   1. LES QUANTITÉS SONT LUES DANS DU TEXTE. « 2 belles courgettes » pèse ce
 *      qu'on a décidé qu'une courgette pèse. Les lignes sans chiffre reçoivent
 *      une portion par défaut ; c'est pour cela que la table des nutriments en
 *      porte une pour chaque condiment.
 *   2. LE POIDS EST CELUI DES INGRÉDIENTS CRUS, additionnés. Un plat mijoté
 *      perd de l'eau au four et se concentre — son vrai score serait un peu
 *      moins bon, une soupe un peu meilleur. On ne modélise pas l'évaporation :
 *      elle dépend du couvercle, pas de la recette.
 *   3. LA TABLE EST GÉNÉRIQUE. « Fromage » vaut un fromage moyen. Le score
 *      n'est donc pas affiché quand la moitié des lignes n'ont pas été
 *      reconnues — mieux vaut pas de lettre qu'une lettre inventée.
 *
 * L'ALGORITHME est celui de la version 2023, en vigueur en France depuis le
 * 1ᵉʳ janvier 2024 : seuils resserrés sur les sucres et le sel, protéines
 * plafonnées pour les viandes rouges, barème séparé pour les boissons.
 * Références : arrêté du 29 décembre 2023 et le rapport du comité scientifique
 * européen du Nutri-Score (2022-2023).
 *
 * AUTOMATIQUE, SANS ÉTAPE DE PLUS : le calcul est une fonction pure des
 * ingrédients. Les 666 recettes déjà en ligne l'obtiennent sans être touchées,
 * et chaque nouvelle recette rapportée de TikTok l'obtient en arrivant — il n'y
 * a pas de champ à remplir ni de script à relancer.
 */
import { parseIngredient, canonicalIng, expandIngredientLines } from '@/mobile/lib/ingredients';
import { cle, quantiteBrute, mesureApres, POIDS_PIECE } from '@/lib/quantites';
import { nutrimentsDe, densiteDe, type Nutriment } from '@/lib/nutriments';

/** Ce que contient le plat, pour 100 g. */
export interface Valeurs100g {
    kcal: number;
    kJ: number;
    proteines: number;
    glucides: number;
    sucres: number;
    lipides: number;
    satures: number;
    fibres: number;
    sel: number;
    /** Part de fruits, légumes, légumineuses et fruits à coque, en %. */
    fln: number;
}

export type Lettre = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ResultatNutriscore {
    lettre: Lettre;
    /** Le score brut : négatif = favorable. Utile pour expliquer la lettre. */
    points: number;
    pour100g: Valeurs100g;
    /** Ce que contient UNE portion, telle que la recette la définit. */
    parPortion: { poids: number; kcal: number; proteines: number; glucides: number; lipides: number };
    /** Poids total du plat, en grammes. */
    poidsTotal: number;
    /** Lignes d'ingrédients prises en compte, et combien étaient dans la table. */
    lignes: number;
    reconnues: number;
    /** Barème appliqué : les boissons ne se jugent pas comme les plats. */
    boisson: boolean;
}

/*
 * Une ligne d'ingrédient, pesée.
 *
 * Même lecture que l'estimation de prix (`quantites.ts`), à une différence
 * près : on veut toujours des GRAMMES, jamais des pièces. Ce qui se compte à
 * l'unité passe par son poids ; ce qui se mesure en volume, par sa densité.
 */
const poidsLigne = (brut: string): { g: number; valeurs: Nutriment; connu: boolean; chiffree: boolean; cleTable: string | null } | null => {
    const p = parseIngredient(brut);
    if (!p.name) return null;
    const nom = canonicalIng(p.name, p.unit, brut).name;
    const { valeurs, connu, cleTable } = nutrimentsDe(nom);
    const portionDefaut = valeurs[9];
    /*
     * Le poids d'une pièce se cherche sous la clé RETENUE, pas sous le nom brut.
     *
     * « 1 petit oignon » se résout en oignon dans la table des nutriments, mais
     * `POIDS_PIECE['petit oignon']` n'existe pas : l'oignon retombait sur la
     * pièce par défaut de cent grammes, comme la tomate, le poivron, le citron
     * et l'œuf dès qu'un adjectif les accompagnait. On interroge donc la table
     * des poids avec la même clé que celle des nutriments, et le nom brut ne
     * sert plus que de second essai.
     */
    const poidsConnu = (cleTable != null ? POIDS_PIECE[cleTable] : undefined) ?? POIDS_PIECE[cle(nom)];
    const piecePesee = poidsConnu != null;
    const poidsPiece = poidsConnu ?? 100;
    const densite = densiteDe(cleTable);

    const n = cle(brut);
    const q = quantiteBrute(n);
    let g: number;

    if (q && 'g' in q) {
        g = q.g;
    } else if (q && 'ml' in q) {
        g = q.ml * densite;
    } else if (q && 'n' in q) {
        // Un nombre nu : cuillère, contenant, ou décompte.
        /*
         * « Un filet d'huile », « un filet de vinaigre ».
         *
         * Le filet est une mesure — la plus petite qui soit — sauf quand c'est
         * le morceau : un filet de poulet, un filet mignon. Les deux se
         * distinguent à la clé retenue, qui porte le mot dans le second cas.
         * Sans cette lecture, un filet d'huile d'olive pesait cent grammes, soit
         * neuf cents calories versées dans la poêle.
         */
        const filet = /\bfilets?\b/.test(n) && !(cleTable || '').includes('filet');
        const mesure = mesureApres(n);
        if (filet) {
            g = portionDefaut ?? 10;
        } else if (mesure) {
            g = q.n * mesure[1] * (mesure[2] === 'ml' ? densite : 1);
        } else if (piecePesee) {
            /*
             * On ne compte des pièces que si l'on sait ce que pèse une pièce.
             *
             * « 15 crevettes crues » en est quinze, pas quinze grammes ; une
             * crevette pèse douze grammes et la table le dit. La règle « au-delà
             * de douze, c'est un poids » — qui sauve « 200 farfalle » — ne vaut
             * que pour les produits dont on ignore l'unité, sans quoi un plat de
             * quinze crevettes pesait quinze grammes et sa sauce soja le rendait
             * six fois trop salé.
             */
            g = q.n * poidsPiece;
        } else if (q.n > 12) {
            // Douze pommes, oui ; deux cents, non. Un grand nombre sans unité est
            // un poids dont l'unité s'est perdue en route.
            g = q.n;
        } else {
            g = q.n * poidsPiece;
        }
    } else {
        /*
         * Aucune quantité : « Sel », « Huile d'olive », « Basilic ».
         *
         * La portion vient de la table des nutriments, produit par produit —
         * c'est le seul endroit où l'on sait qu'une pincée de sel n'est pas une
         * portion de sel. Sans entrée, on retient 80 g : ni un condiment, ni un
         * plat, ce qu'on met faute de mieux dans une casserole.
         */
        g = portionDefaut ?? 80;
    }

    /*
     * Ni quoi, ni combien : on passe.
     *
     * Le découpage à la virgule laisse des morceaux de phrase derrière lui —
     * « mixées », « à goût », « le dessus », « coupées en tranches de 1/4 pouce ».
     * Leur donner la portion de repli ajoutait quatre-vingts grammes d'aliment
     * moyen par fragment : la moussaka en portait six, soit un demi-kilo de
     * nourriture qui n'existe pas. Quand on ne reconnaît pas le produit ET que
     * la ligne ne porte aucun chiffre, il n'y a rien à peser.
     */
    if (!connu && q == null) return null;

    if (!Number.isFinite(g) || g <= 0) return null;
    // Garde-fou : une ligne mal lue ne doit pas emporter le calcul. Trois kilos
    // d'un même ingrédient, c'est l'analyse qui a dérapé, pas la recette.
    g = Math.min(g, 3000);
    return { g, valeurs, connu, chiffree: q != null, cleTable };
};

/*
 * Les lignes qui ne sont pas des ingrédients.
 *
 * Les listes rapportées de TikTok portent leurs intertitres et leur ponctuation
 * de mise en page : « ** », « (pour la sauce) », « — ». Comptées comme des
 * produits inconnus, elles ajoutaient quatre-vingts grammes de rien du tout au
 * poids du plat, chacune, et diluaient tout le reste.
 */
const LIGNE_VIDE = /^[^\p{L}]*$/u;
const INTERTITRE = /^\(?\s*(?:pour|garniture|assaisonnement|d[ée]coration|topping|marinade|sauce|montage|finition)\b[^)]*\)?\s*:?\s*$/i;

/** Toutes les lignes d'ingrédients d'une recette, brutes — même découpage que la liste de courses. */
const lignesDe = (recette: { ingredients?: Array<{ name?: string; quantity?: string }> }): string[] =>
    (recette.ingredients || [])
        .map((i) => [i.quantity, i.name].filter(Boolean).join(' ').trim())
        .filter(Boolean)
        .flatMap((l) => expandIngredientLines(l))
        .filter((l) => {
            const t = l.replace(/\s+/g, ' ').trim();
            return t.length > 2 && !LIGNE_VIDE.test(t) && !INTERTITRE.test(t);
        });

/* ── Le barème officiel ──────────────────────────────────────────────────────
 *
 * Chaque composante donne un nombre de points selon le palier atteint. Les
 * tableaux se lisent : « au-dessus de ce seuil, ce point de plus ».
 */
const points = (valeur: number, seuils: number[]): number => {
    let p = 0;
    for (const s of seuils) if (valeur > s) p++;
    return p;
};

// Composantes défavorables — plats et aliments solides.
const ENERGIE = [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350];          // kJ
const SUCRES = [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51];       // g
const SATURES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];                                     // g
const SEL = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0,
             2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0];                      // g

// Composantes favorables.
const PROTEINES = [2.4, 4.8, 7.2, 9.6, 12, 14, 17];                                  // g
const FIBRES = [3.0, 4.1, 5.2, 6.3, 7.4];                                            // g
const FLN = [40, 60, 80];                                                            // %

// Boissons : mêmes composantes, seuils propres. L'échelle d'énergie se vérifie
// sur deux repères connus — un cola note E, un pur jus d'orange note C ; une
// échelle plus resserrée faisait tomber le jus en D.
const ENERGIE_BOISSON = [30, 90, 150, 210, 240, 270, 300, 330, 360, 390];            // kJ
const SUCRES_BOISSON = [0.5, 2, 3.5, 5, 6, 7, 8, 9, 10, 11];                         // g
const PROTEINES_BOISSON = [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0];                       // g
const FLN_BOISSON = [40, 60, 80];                                                    // %

/**
 * Le score, puis la lettre.
 *
 * La règle qui surprend : au-delà de dix points défavorables, les protéines ne
 * rachètent plus rien. Sans elle, une charcuterie très salée remonterait par sa
 * teneur en viande — ce que le barème refuse justement de récompenser.
 *
 * Le règlement prévoit deux dérogations à cette règle, qui ne s'appliquent PAS
 * ici : les fromages, dont les protéines comptent toujours, et les viandes
 * rouges, dont elles plafonnent à deux points. L'une et l'autre visent une
 * CATÉGORIE DE PRODUIT en rayon — un camembert, une barquette de steak haché —,
 * pas un plat cuisiné. Un gratin n'est pas un fromage même s'il en contient
 * deux cents grammes, et rien ne permettrait de décider automatiquement qu'une
 * recette « est » un fromage. Les plats sont donc jugés au barème général, celui
 * que le règlement leur destine. C'est aussi pourquoi un camembert passé seul
 * dans cette fonction sortirait en E là où son étiquette porte un D.
 */
export const scoreDepuisValeurs = (v: Valeurs100g, boisson: boolean): { points: number; lettre: Lettre } => {
    if (boisson) {
        const negatifs = points(v.kJ, ENERGIE_BOISSON)
            + points(v.sucres, SUCRES_BOISSON)
            + points(v.satures, SATURES)
            + points(v.sel, SEL);
        const positifs = points(v.proteines, PROTEINES_BOISSON)
            + points(v.fln, FLN_BOISSON) * 2;
        const total = negatifs - positifs;
        // Seule l'eau obtient un A ; les autres boissons commencent à B.
        const eau = v.kcal < 1 && v.sucres < 0.5;
        const lettre: Lettre = eau ? 'A'
            : total <= 2 ? 'B'
            : total <= 6 ? 'C'
            : total <= 9 ? 'D' : 'E';
        return { points: total, lettre };
    }

    const negatifs = points(v.kJ, ENERGIE)
        + points(v.sucres, SUCRES)
        + points(v.satures, SATURES)
        + points(v.sel, SEL);
    const pProteines = points(v.proteines, PROTEINES);
    const pFibres = points(v.fibres, FIBRES);
    const pFln = points(v.fln, FLN) === 3 ? 5 : points(v.fln, FLN);   // > 80 % vaut 5, pas 3

    const positifs = negatifs >= 11 ? pFibres + pFln : pProteines + pFibres + pFln;
    const total = negatifs - positifs;

    const lettre: Lettre = total <= -1 ? 'A'
        : total <= 2 ? 'B'
        : total <= 10 ? 'C'
        : total <= 18 ? 'D' : 'E';
    return { points: total, lettre };
};

/** Les catégories du site qui se jugent au barème des boissons. */
const CATEGORIES_BOISSON = new Set(['boissons', 'rafraichissements']);

/*
 * Les boissons alcoolisées n'ont pas de Nutri-Score, et c'est voulu.
 *
 * Le règlement les exclut du dispositif — au-dessus de 1,2 % vol., aucune
 * boisson n'en porte, précisément pour qu'un logo nutritionnel ne serve pas
 * d'argument à leur sujet. Un cocktail se voyait attribuer un E : la lettre
 * était cohérente avec le calcul, mais elle n'existe pas pour ce produit-là.
 *
 * L'exclusion ne vaut que pour les BOISSONS : le rhum d'un tiramisu ou le vin
 * blanc d'une sauce ne retirent pas son score au plat, comme dans le barème
 * officiel où seule la catégorie du produit fini compte.
 */
const ALCOOLS = new Set([
    'vin blanc', 'vin rouge', 'champagne', 'prosecco', 'biere', 'cidre', 'porto',
    'rhum', 'vodka', 'gin', 'whisky', 'tequila', 'cognac',
    'aperol', 'campari', 'cointreau', 'limoncello',
]);

/**
 * Le Nutri-Score d'une recette. `null` quand il n'y a pas de quoi le calculer.
 *
 * Le seuil de renoncement est celui du prix : sous trois lignes lisibles, ou
 * quand la moitié échappe à la table, on n'affiche rien. Une fiche « ingrédients
 * dans la vidéo » ne mérite pas une lettre.
 */
export function nutriscoreRecette(recette: {
    ingredients?: Array<{ name?: string; quantity?: string }>;
    servings?: number;
    category?: string;
}): ResultatNutriscore | null {
    const lignes = lignesDe(recette);
    if (!lignes.length) return null;

    let poids = 0, kcal = 0, prot = 0, gluc = 0, sucres = 0, lip = 0, sat = 0, fib = 0, sel = 0, fln = 0;
    let comptees = 0, reconnues = 0, poidsDeviné = 0;

    const boisson = CATEGORIES_BOISSON.has(recette.category || '');

    for (const l of lignes) {
        const p = poidsLigne(l);
        if (!p) continue;
        if (boisson && p.cleTable && ALCOOLS.has(p.cleTable)) return null;
        const [k, pr, gl, su, li, sa, fi, se, fl] = p.valeurs;
        const r = p.g / 100;             // la table est pour 100 g
        poids += p.g;
        kcal += k * r; prot += pr * r; gluc += gl * r; sucres += su * r;
        lip += li * r; sat += sa * r; fib += fi * r; sel += se * r;
        fln += (fl / 100) * p.g;         // en grammes de fruits/légumes, pas en %
        comptees++;
        if (p.connu) reconnues++;
        if (!p.chiffree) poidsDeviné += p.g;
    }

    /*
     * Pas de lettre sans quantités — mais on compte des GRAMMES, pas des lignes.
     *
     * Une fiche qui dit « Œufs / Huile / Sel / Poivre » se voyait attribuer un E :
     * quatre portions par défaut, dont trois grammes de sel pour cent grammes de
     * plat. Le score n'y mesurait plus la recette, seulement nos valeurs de repli.
     *
     * Exiger que la moitié des LIGNES portent un chiffre écartait aussi les
     * bonnes recettes : un tajine pèse ses quinze ingrédients et laisse le sel,
     * le poivre et les quatre épices sans quantité — onze lignes muettes sur
     * quinze, pour trente grammes sur mille cinq cents. Ce qui compte est la
     * part du poids que l'on a devinée, pas le nombre de fois qu'on a deviné.
     */
    if (comptees < 3 || poids <= 0) return null;
    if (reconnues / comptees < 0.5 || poidsDeviné / poids > 0.5) return null;

    const c = 100 / poids;
    const pour100g: Valeurs100g = {
        kcal: kcal * c,
        kJ: kcal * c * 4.184,
        proteines: prot * c,
        glucides: gluc * c,
        sucres: sucres * c,
        lipides: lip * c,
        satures: sat * c,
        fibres: fib * c,
        sel: sel * c,
        fln: Math.min(100, (fln / poids) * 100),
    };

    const { points: pts, lettre } = scoreDepuisValeurs(pour100g, boisson);

    const parts = recette.servings && recette.servings > 0 ? recette.servings : 4;
    const poidsPortion = poids / parts;

    return {
        lettre,
        points: pts,
        pour100g,
        parPortion: {
            poids: Math.round(poidsPortion),
            kcal: Math.round(kcal / parts),
            proteines: Math.round(prot / parts),
            glucides: Math.round(gluc / parts),
            lipides: Math.round(lip / parts),
        },
        poidsTotal: Math.round(poids),
        lignes: comptees,
        reconnues,
        boisson,
    };
}

/**
 * Le détail ligne par ligne, pour vérifier.
 *
 * Ce que le calcul a cru lire dans chaque ingrédient : le produit reconnu, et
 * ce qu'il pèse. Sert au script de contrôle (`scripts/verifier-nutriscore.js`)
 * — c'est en lisant ces lignes qu'on découvre qu'une cuillerée de sel pesait
 * cent grammes. N'est pas affiché dans l'application.
 */
export function detaillerRecette(recette: { ingredients?: Array<{ name?: string; quantity?: string }> }) {
    return lignesDe(recette).map((l) => {
        const p = poidsLigne(l);
        return {
            brut: l,
            g: p ? Math.round(p.g) : 0,
            connu: !!p?.connu,
            produit: p ? nutrimentsDe(canonicalIng(parseIngredient(l).name, parseIngredient(l).unit, l).name).cleTable : null,
            sel: p ? (p.valeurs[7] * p.g) / 100 : 0,
            kcal: p ? (p.valeurs[0] * p.g) / 100 : 0,
        };
    });
}

/** La couleur officielle de chaque lettre — celle du logo, pas une approximation. */
export const COULEURS_NUTRISCORE: Record<Lettre, string> = {
    A: '#038141',
    B: '#85BB2F',
    C: '#FECB02',
    D: '#EE8100',
    E: '#E63E11',
};

/** Ce que la lettre veut dire, en une ligne. */
export const LEGENDES_NUTRISCORE: Record<Lettre, string> = {
    A: 'Excellente qualité nutritionnelle',
    B: 'Bonne qualité nutritionnelle',
    C: 'Qualité nutritionnelle moyenne',
    D: 'Qualité nutritionnelle limitée',
    E: 'Faible qualité nutritionnelle',
};
