// « Ma cave » — recherche d'un vin chez VINIOU (serveur uniquement).
//
// POURQUOI UNE SECONDE SOURCE
// ---------------------------
// Vivino connaît les vins qui s'exportent et rate les petits domaines
// français : une côte-rôtie de vigneron, un cru bourgeois, une cuvée
// confidentielle n'y sont pas, et le scan renvoyait l'utilisateur à sa propre
// photo, sans appellation ni millésime.
//
// Viniou (viniou.fr) tient le catalogue français au détail — une fiche par vin
// ET par millésime — avec la couleur, l'appellation, le domaine, la cuvée et la
// photo de la bouteille.
//
// COMMENT ON CHERCHE — ON NE CHERCHE PAS, ON NAVIGUE
// --------------------------------------------------
// Le site n'expose ni formulaire de recherche ni API. Passer par un moteur
// extérieur a été essayé et abandonné : DuckDuckGo répond « 202 » (étranglement)
// dès la deuxième requête, et le fera d'autant plus vite depuis un serveur.
//
// On emprunte donc l'arborescence publique, qui est courte :
//     /vins/pays/france                       → la liste des régions
//     …/104_vallee-du-rhone/domaines-et-chateaux → TOUS les domaines (une page)
//     …/domaines-et-chateaux/1610_chante-perdrix → les vins de ce domaine
//     …/95_cote-rotie/526979_chante-perdrix-indiscrete-2009 → la fiche
// Trois pages au plus par scan, et les deux premières sont gardées en mémoire :
// elles ne changent pas d'un jour à l'autre.
//
// Fragile par nature (dépend du HTML) : `findOnViniou` renvoie `null` plutôt
// que de lever, et l'appelant garde alors ce qu'il avait.

import {
    UA_NAVIGATEUR, unescapeHtml, tokens, f1, coverage, motsUtiles, motCommunExact,
    type BouteilleTrouvee,
} from './texte-vin';

const RACINE = 'https://www.viniou.fr';

/** Le mot de couleur de Viniou → celui de la cave. */
const COULEUR: Record<string, BouteilleTrouvee['color']> = {
    rouge: 'rouge', blanc: 'blanc', rose: 'rose', rosé: 'rose',
    'blanc effervescent': 'blanc', 'rosé effervescent': 'rose', effervescent: 'blanc',
    moelleux: 'liqueur', liquoreux: 'liqueur', 'vin doux naturel': 'liqueur',
};

/**
 * Les pages d'arborescence sont lourdes (celle des domaines d'une région tient
 * sept mille entrées) et parfaitement stables. On les garde une demi-journée :
 * sans ça, chaque scan les retéléchargerait.
 */
const CACHE_MS = 12 * 60 * 60 * 1000;
const cache = new Map<string, { t: number; html: string }>();

async function page(url: string, signal: AbortSignal, garder = false): Promise<string> {
    const vu = garder ? cache.get(url) : undefined;
    if (vu && Date.now() - vu.t < CACHE_MS) return vu.html;
    const res = await fetch(url, {
        headers: { 'user-agent': UA_NAVIGATEUR, accept: 'text/html', 'accept-language': 'fr-FR,fr;q=0.9' },
        signal,
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(String(res.status));
    const html = await res.text();
    if (garder) {
        // On ne garde qu'une poignée de régions : la mémoire d'une fonction
        // serverless est comptée, et sept mille lignes pèsent.
        if (cache.size > 6) cache.delete(cache.keys().next().value as string);
        cache.set(url, { t: Date.now(), html });
    }
    return html;
}

/** Toutes les adresses d'un gabarit donné, dédoublonnées, en absolu. */
function liens(html: string, motif: RegExp): string[] {
    const out = new Set<string>();
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
        const u = href.startsWith('http') ? href : href.startsWith('/') ? RACINE + href : '';
        if (u && motif.test(u)) out.add(u.trim());
    }
    return [...out];
}

/** Le dernier morceau d'une adresse, sans son identifiant : « chante-perdrix ». */
const slug = (u: string) => decodeURIComponent(u.split('?')[0].split('/').pop() || '').replace(/^\d+_/, '');

/** Le millésime que porte une adresse de fiche, quand elle le dit. */
const anneeDe = (u: string) => (slug(u).match(/-((?:19|20)\d{2})$/) || [])[1] || '';

/**
 * Le pays, lu dans ce que le modèle a écrit (« Côte-rôtie, Vallée du Rhône,
 * France »). Sans indication, on suppose la France : c'est la raison d'être de
 * cette source.
 */
const PAYS = ['france', 'italie', 'espagne', 'portugal', 'allemagne', 'autriche', 'suisse', 'grece', 'hongrie', 'croatie', 'argentine', 'chili', 'australie', 'afrique-du-sud', 'etats-unis', 'liban', 'israel', 'maroc', 'georgie', 'roumanie', 'bulgarie', 'luxembourg', 'belgique'];

function paysDe(region: string): string {
    const t = tokens(region).join('-');
    return PAYS.find((p) => t.includes(p.replace(/-/g, '-'))) || 'france';
}

/**
 * Les mots de remplissage d'un nom de région. « Vallée du Rhône » et « Rhône »
 * désignent la même chose : un modèle écrit l'un ou l'autre selon l'humeur, et
 * exiger les deux faisait échouer la recherche une fois sur deux.
 */
const REGION_VIDES = new Set(['vallee', 'val', 'region', 'pays', 'sud', 'nord', 'est', 'ouest', 'centre', 'de', 'du', 'des', 'la', 'le', 'les', 'et']);

/** La région du catalogue qui correspond le mieux à l'appellation lue. */
async function trouverRegion(region: string, signal: AbortSignal): Promise<string | null> {
    const pays = paysDe(region);
    const html = await page(`${RACINE}/vins/pays/${pays}`, signal, true);
    // Les régions se reconnaissent à leur lien « domaines-et-chateaux » voisin.
    const regions = liens(html, new RegExp(`/vins/pays/${pays}/\\d+_[a-z0-9-]+$`, 'i'));
    if (!regions.length) return null;
    const lus = tokens(region);
    let best: string | null = null, bestScore = 0;
    for (const u of regions) {
        // « vallee-du-rhone » face à « Côte-rôtie, Rhône, France » : c'est la
        // COUVERTURE du nom de région qui compte, pas la ressemblance globale —
        // l'étiquette dit toujours plus que la région.
        const mots = tokens(slug(u)).filter((w) => !REGION_VIDES.has(w));
        if (!mots.length || !motCommunExact(mots, lus)) continue;
        const s = coverage(mots, lus);
        if (s > bestScore) { bestScore = s; best = u; }
    }
    return bestScore >= 0.5 ? best : null;
}

/**
 * Les mots qui désignent le DOMAINE dans l'étiquette lue.
 *
 * Deux nettoyages, chacun payé par une erreur observée :
 *   • « château », « domaine », « clos » sortent (`motsUtiles`), sinon
 *     « Château Margaux » ne ressemblait plus au domaine « chateau-margaux » ;
 *   • les mots de l'APPELLATION sortent aussi — « Domaine Leflaive
 *     Puligny-Montrachet » désignait le domaine nommé « Puligny-Montrachet »
 *     plutôt que Leflaive. Sauf s'il ne reste rien : certains domaines portent
 *     bel et bien le nom de leur appellation (Château Margaux, à Margaux).
 */
function motsDomaine(nom: string, region: string): string[] {
    const base = motsUtiles(nom);
    const lieux = new Set(tokens(region));
    const sansLieu = base.filter((w) => !lieux.has(w));
    return sansLieu.length ? sansLieu : base;
}

/** Le domaine de cette région dont le nom colle le mieux à l'étiquette lue. */
async function trouverDomaine(regionUrl: string, attendu: string[], nomLu: string, signal: AbortSignal): Promise<string | null> {
    const html = await page(`${regionUrl}/domaines-et-chateaux`, signal, true);
    const domaines = liens(html, /\/domaines-et-chateaux\/\d+_[a-z0-9-]+$/i);
    const motsLus = tokens(nomLu);
    let best: string | null = null, bestScore = 0;
    for (const u of domaines) {
        const mots = motsUtiles(slug(u));
        // Le domaine doit être RETROUVÉ DANS l'étiquette : « Chante-Perdrix »
        // dans « Côte-rôtie Chante-Perdrix Indiscrète ». L'inverse serait faux —
        // l'étiquette porte aussi la cuvée et l'appellation.
        //
        // Et il faut un mot qui tombe EXACTEMENT juste : sur sept mille
        // domaines, la tolérance orthographique seule faisait passer
        // « Montfrin » pour « Montmain ».
        if (!motCommunExact(mots, attendu)) continue;
        // À couverture égale (« m-margaux » et « chateau-margaux » couvrent tous
        // deux « margaux »), c'est la ressemblance au nom COMPLET qui tranche.
        const s = coverage(mots, attendu) * (1 + Math.min(mots.length, 3) / 10)
            + 0.5 * f1(motsLus, tokens(slug(u)));
        if (s > bestScore) { bestScore = s; best = u; }
    }
    return bestScore >= 0.8 ? best : null;
}

/** Le texte d'une cellule, balises et entités enlevées. */
const cellule = (h: string) => unescapeHtml(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Les lignes « intitulé → valeur » du tableau d'information d'une fiche. */
function tableau(html: string): Record<string, string> {
    const bloc = html.match(/<table[^>]*tableInformationWine[^>]*>([\s\S]*?)<\/table>/i);
    if (!bloc) return {};
    const out: Record<string, string> = {};
    for (const [, th, td] of bloc[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)) {
        const clef = cellule(th).toLowerCase();
        if (clef) out[clef] = cellule(td);
    }
    return out;
}

function versBouteille(url: string, html: string): BouteilleTrouvee | null {
    const t = tableau(html);
    const domaine = t['château / domaine'] || t['chateau / domaine'] || t['domaine'] || '';
    const cuvee = t['cuvée'] || t['cuvee'] || '';
    const appellation = t['appellation'] || '';
    const region = t['région'] || t['region'] || '';
    const pays = t['pays'] || '';
    const annee = (t['millésime'] || t['millesime'] || anneeDe(url)).match(/(19|20)\d{2}/)?.[0] || '';
    const nom = [domaine, cuvee].filter(Boolean).join(' ').trim() || appellation;
    if (!nom) return null;
    // Les visuels de Viniou sont hébergés à part ; sans photo, la fiche ne vaut
    // pas la peine d'être préférée à celle de Vivino.
    const photo = (html.match(/https:\/\/media-viniou\.com\/wine-info\/\d+\/[^"'\s>]+/) || [''])[0];
    return {
        name: nom,
        winery: domaine,
        year: annee,
        // Viniou range par appellation, pas par cépage : le champ est rare.
        grape: t['cépage'] || t['cepage'] || t['cépages'] || '',
        region: [appellation || region, pays].filter(Boolean).join(', '),
        color: COULEUR[(t['couleur'] || '').toLowerCase()] || 'rouge',
        note: '',
        photo,
        // Viniou ne publie pas de note de dégustateurs : mieux vaut zéro que
        // d'inventer un chiffre.
        rating: 0,
        ratingsCount: 0,
        url,
        source: 'viniou',
        confident: false,          // tranché plus bas, en connaissance de l'étiquette
    };
}

/**
 * La fiche Viniou la plus proche de l'étiquette lue.
 *
 * `region` est ce que le modèle a lu de l'appellation — c'est la clé d'entrée
 * dans l'arborescence, sans elle on ne sait pas par où commencer.
 * `hintYear` est le millésime lu SUR LA BOUTEILLE : Viniou publie une fiche par
 * année, et la photo change avec elle.
 */
export async function findOnViniou(
    query: string, hintYear?: string, region?: string, timeoutMs = 8000,
): Promise<BouteilleTrouvee | null> {
    const q = query.trim();
    if (!q || !region?.trim()) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const regionUrl = await trouverRegion(region, ctrl.signal);
        if (!regionUrl) return null;

        const attendu = motsUtiles(`${q} ${region}`);
        const domaineUrl = await trouverDomaine(regionUrl, motsDomaine(q, region), q, ctrl.signal);
        if (!domaineUrl) return null;

        // Les vins du domaine : peu nombreux, et leur adresse porte déjà la
        // cuvée et le millésime. On choisit AVANT d'ouvrir quoi que ce soit.
        const html = await page(domaineUrl, ctrl.signal);
        const vins = liens(html, /\/vins\/pays\/[a-z-]+\/\d+_[a-z0-9-]+\/\d+_[a-z0-9-]+\/\d+_[a-z0-9-]+$/i)
            .filter((u) => !u.includes('/domaines-et-chateaux/'));
        if (!vins.length) return null;

        const note = (u: string) => {
            const mots = tokens(slug(u));
            let s = 4 * f1(attendu, mots) + 3 * coverage(mots, attendu);
            const an = anneeDe(u);
            // Le millésime de la bouteille en main tranche : le même vin est
            // publié en vingt années, avec vingt photos différentes.
            if (hintYear) s += an === hintYear ? 5 : an ? -2 : -0.5;
            return s;
        };
        const meilleur = [...vins].sort((a, b) => note(b) - note(a))[0];
        if (note(meilleur) < 1) return null;

        const fiche = versBouteille(meilleur, await page(meilleur, ctrl.signal));
        if (!fiche || !fiche.photo) return null;

        // « Sûr » : le domaine de la fiche se retrouve dans ce qu'on a lu, et le
        // millésime ne contredit pas la bouteille. Même exigence que pour
        // Vivino — une bouteille voisine ne doit jamais passer pour la sienne.
        const domaineLu = motsUtiles(fiche.winery);
        const sur = coverage(domaineLu, attendu) >= 0.7
            && motCommunExact(domaineLu, attendu)
            && (!hintYear || !fiche.year || fiche.year === hintYear);
        return { ...fiche, confident: sur };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}
