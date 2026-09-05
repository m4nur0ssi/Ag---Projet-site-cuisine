/**
 * L'assistant de recherche sait aussi fouiller VOTRE cave.
 * =======================================================
 *
 * « Je veux un vin de ma cave pour du poulet » n'est pas une demande de
 * recette : l'assistant répondait par cinq plats au poulet. La question porte
 * sur les bouteilles qu'on possède, et sur l'accord avec ce qu'on va manger.
 *
 * Ce module ne connaît ni le navigateur ni le réseau : il est partagé tel quel
 * par l'écran de recherche et par la route de l'assistant, pour que la même
 * question reçoive la même lecture des deux côtés.
 */

import type { CaveWine, WineColor } from '@/lib/cave';

const sansAccent = (s: string): string =>
    String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * La demande parle-t-elle de vin ?
 *
 * On exige un mot de vin — pas seulement « cave », qui désigne aussi bien un
 * fromage affiné qu'une cave à légumes dans une recette.
 */
const MOTS_VIN = /\b(vins?|bouteilles?|cave|caves|millesimes?|cepages?|rouges?|blancs?|roses?|champagnes?|cremants?|accord|accords|oenolog\w*)\b/;
const MOTS_MA_CAVE = /\b(ma cave|mes vins|mes bouteilles|ma reserve)\b/;

export function intentionVin(demande: string): boolean {
    const q = sansAccent(demande);
    if (MOTS_MA_CAVE.test(q)) return true;
    // « rouge » seul ne suffit pas (fruits rouges, chou rouge…) : il faut que la
    // phrase parle par ailleurs de vin, de cave ou d'accord.
    if (/\bvins?\b|\bbouteilles?\b|\bcave\b|\bcepages?\b|\bmillesimes?\b|\bchampagnes?\b|\bcremants?\b/.test(q)) return true;
    return /\baccords?\b/.test(q) && MOTS_VIN.test(q);
}

/** Une bouteille, réduite à ce que le modèle a besoin de lire. */
export interface CompactWine {
    id: string;
    n: string;              // nom
    c: WineColor;           // couleur
    g?: string;             // cépage
    y?: string;             // millésime
    r?: string;             // région
    q?: number;             // bouteilles restantes
}

/** La cave, réduite au nécessaire. Les bouteilles bues ne sont pas proposées. */
export function compacterCave(cave: CaveWine[]): CompactWine[] {
    return (cave || [])
        .filter((w) => w && w.shelf !== 'tasted')
        .map((w) => ({
            id: String(w.id),
            n: w.name || '',
            c: w.color,
            g: w.grape || undefined,
            y: w.year || undefined,
            r: w.region || undefined,
            q: w.qty,
        }));
}

/* ── Repli sans intelligence artificielle ────────────────────────────────────
 *
 * Quand le modèle est injoignable (quota, panne, clé absente), on ne renvoie
 * pas une page vide : on applique les accords de base, ceux qu'un serveur
 * récite sans réfléchir. C'est moins fin qu'une vraie recommandation, mais
 * jamais faux.
 */

const COULEUR_ATTENDUE: { plat: RegExp; couleurs: WineColor[] }[] = [
    { plat: /poisson|saumon|thon|cabillaud|colin|merlu|dorade|truite|sardine|crevette|gambas|moule|huitre|coquillage|crustace|fruits de mer|sushi|ceviche/, couleurs: ['blanc'] },
    { plat: /volaille|poulet|dinde|chapon|pintade|veau|porc|lapin/, couleurs: ['blanc', 'rouge'] },
    { plat: /boeuf|bœuf|agneau|mouton|canard|magret|gibier|sanglier|chevreuil|entrecote|cote de|steak|bourguignon|daube|civet/, couleurs: ['rouge'] },
    { plat: /fromage|raclette|fondue|tartiflette|comte|roquefort|chevre/, couleurs: ['blanc', 'rouge'] },
    { plat: /dessert|gateau|tarte|chocolat|patisserie|fraise|sucre/, couleurs: ['liqueur', 'rose'] },
    { plat: /salade|legume|apero|aperitif|barbecue|grillade|ete|estival|pizza|tomate/, couleurs: ['rose', 'blanc'] },
    { plat: /epice|curry|tajine|thai|indien|asiatique|mexicain/, couleurs: ['blanc', 'rose'] },
];

/** Les couleurs qui vont avec ce que la demande décrit. Vide = on ne sait pas. */
export function couleursPour(demande: string): WineColor[] {
    const q = sansAccent(demande);
    const trouvees = COULEUR_ATTENDUE.filter((c) => c.plat.test(q)).flatMap((c) => c.couleurs);
    return [...new Set(trouvees)];
}

/**
 * Choix de repli : les bouteilles de la bonne couleur d'abord, puis celles dont
 * le nom, le cépage ou la région est cité dans la demande.
 */
export function accordLocal(demande: string, cave: CaveWine[], max = 3): CaveWine[] {
    const q = sansAccent(demande);
    const couleurs = couleursPour(demande);
    // Une couleur nommée dans la demande l'emporte sur celle déduite du plat.
    const demandee: WineColor[] = [];
    if (/\brouges?\b/.test(q)) demandee.push('rouge');
    if (/\bblancs?\b/.test(q)) demandee.push('blanc');
    if (/\broses?\b/.test(q)) demandee.push('rose');
    if (/\bliquoreux|moelleux|porto|sauternes\b/.test(q)) demandee.push('liqueur');
    const attendues = demandee.length ? demandee : couleurs;

    const note = (w: CaveWine) => {
        let s = 0;
        if (attendues.length && attendues.includes(w.color)) s += 4;
        const champs = sansAccent(`${w.name} ${w.grape} ${w.region}`);
        for (const mot of q.split(/[^a-z0-9]+/)) {
            if (mot.length >= 4 && champs.includes(mot)) s += 2;
        }
        // À qualité égale, on propose ce qu'on a en plusieurs exemplaires. Ce
        // bonus DÉPARTAGE, il ne qualifie pas : sans lui, un blanc en double
        // remontait dans une demande de rouge.
        if (s > 0 && (w.qty || 1) > 1) s += 0.5;
        return s;
    };

    const classees = (cave || [])
        .filter((w) => w && w.shelf !== 'tasted')
        .map((w) => ({ w, s: note(w) }))
        .sort((a, b) => b.s - a.s);

    const pertinentes = classees.filter((x) => x.s > 0);
    // Rien ne correspond vraiment : on propose UNE bouteille, la moins mauvaise,
    // plutôt qu'une liste au hasard qui donnerait l'illusion d'un choix.
    return (pertinentes.length ? pertinentes.slice(0, max) : classees.slice(0, 1)).map((x) => x.w);
}
