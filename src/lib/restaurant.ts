/**
 * restaurant.ts — lecture des fiches « Comme au resto ».
 *
 * Ces fiches ne sont pas des recettes : ce sont des lieux visités. Leur contenu
 * arrive par deux chemins très différents, et c'est tout le problème.
 *
 *  1. Les ANCIENNES fiches (huit d'entre elles) viennent d'un ancien blog et
 *     suivent un gabarit rédigé, toujours dans le même ordre :
 *
 *         …paragraphes de présentation…
 *         « Mon plat préféré : … »
 *         ce que j'ai aimé
 *         ce que j'ai moins aimé      (parfois absent)
 *         ma table                    (parfois absente)
 *         adresse
 *         transports / parking / réservation
 *
 *     Rien n'affichait ces lignes : le bloc d'onglets qui rend `steps` est coupé
 *     pour la catégorie restaurant. Le meilleur contenu du site dormait.
 *
 *  2. Les NOUVELLES fiches viennent du robot TikTok : une seule ligne, la légende
 *     de la vidéo. Certains créateurs y listent le menu avec les prix.
 *
 * Ce module range l'un et l'autre dans la même structure, sans jamais inventer :
 * un champ absent reste absent, et l'interface ne dessine pas la case.
 */

export interface AvisPerso {
    platPrefere?: string;
    aime?: string;
    moinsAime?: string;
    table?: string;
}

export interface PratiqueLieu {
    adresse?: string;
    transports: string[];
    parking?: string;
    reservation?: string;
    lien?: string;
}

export interface PlatCarte {
    nom: string;
    prix: number;
}

export interface Paragraphe {
    titre?: string;
    corps: string;
}

export interface LectureResto {
    presentation: Paragraphe[];
    avis: AvisPerso;
    pratique: PratiqueLieu;
    menu: PlatCarte[];
    total: number;
}

const vide = (s: string) => !s || !s.replace(/[\s ]/g, '').length;

/** Nettoie une ligne : espaces insécables, blancs multiples, puces de tête. */
function propre(s: string): string {
    return String(s || '')
        .replace(/ /g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[\s•·\-–—:]+/, '')
        .trim();
}

/* ─────────────────────────── reconnaissance des lignes ─────────────────────── */

// Une adresse porte un code postal français OU un type de voie suivi d'un numéro.
const RX_ADRESSE = /\b\d{5}\b|\b\d{1,4}(?:\s?bis|\s?ter)?\s*,?\s*(?:rue|avenue|av\.|boulevard|bd|allée|allee|place|quai|chemin|route|impasse|cours|grande rue)\b/i;
// « Metro Bercy (M6, M14) », « M10 - Maubert », « RER E Le Raincy », « Bus 24 ».
const RX_TRANSPORT = /^(?:m[ée]tro|m\s?\d|rer\b|bus\b|tram|ligne\s)|(?:^|\s)m\d{1,2}\s*[-–]/i;
const RX_PARKING = /\bparking\b/i;
const RX_RESERVATION = /\b(thefork|the fork|lafourchette|tripadvisor|trip advisor|resy|opentable)\b/i;
const RX_LIEN = /^https?:\/\//i;
const RX_PLAT_PREFERE = /^mon plat pr[ée]f[ée]r[ée]\s*:?\s*/i;

/**
 * Reconnaît la ligne « ma table ». Elle répond toujours à la question « quelle
 * table ? » et se termine souvent par un clin d'œil. Sans ce test, une fiche sans
 * « j'ai moins aimé » (Il Venezia) verrait sa table étiquetée en reproche.
 */
const RX_TABLE = /(?:😉|🙂|😊)|^(?:celle|celui|au fond|le comptoir|la table|en terrasse|pas trop loin|peu importe|n'importe)/i;

/**
 * Une légende TikTok n'est pas un paragraphe : elle porte des hashtags, un pin et
 * parfois la carte entière. On la ramène à sa phrase utile ; s'il n'en reste rien
 * de lisible, elle disparaît plutôt que de meubler.
 */
function nettoyerLegende(ligne: string, nom?: string): string {
    const estLegende = /#|📍/.test(ligne);
    let t = ligne;
    if (estLegende) {
        t = t.replace(/#[^\s#]+/g, ' ').replace(/https?:\/\/\S+/g, ' ');
        // Retire les entrées de carte (« • Ceviche de la casa - 18€ ») déjà listées.
        t = t.replace(/[•·][^•·]*?\d{1,3}(?:[.,]\d{1,2})?\s*€/g, ' ');
        t = t.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}‍️]/gu, ' ').replace(/\s+/g, ' ').trim();
        t = t.replace(/^[\s•·\-–—:,]+|[\s•·\-–—:,]+$/g, '').trim();
        if (t.length < 15) return '';
    }
    // « Santa Carne - Paris » sous le titre « Santa Carne » n'apprend rien ; pas
    // plus que « Le Balthazar » sous « Le Balthazar ».
    if (nom) {
        const sansNom = t.replace(new RegExp(nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ')
            .replace(/[\s•·\-–—:,]+/g, ' ').trim();
        if (sansNom.length < 12) return '';
    }
    return t;
}

/** Un intertitre du gabarit : « UN CADRE ACCUEILLANT - Le Venezia se dévoile… ». */
function couperIntertitre(brut: string, nom?: string): Paragraphe | null {
    const ligne = nettoyerLegende(brut, nom);
    if (!ligne) return null;
    // Une ligne qui porte des prix est une carte, pas un intertitre.
    if (/\d\s*€/.test(ligne)) return { corps: ligne };
    const m = ligne.match(/^([^-–—]{3,60}?)\s+[-–—]\s+(.{20,})$/);
    if (!m) return { corps: ligne };
    const titre = m[1].trim();
    // Un vrai intertitre est court et ne se termine pas par une ponctuation de phrase.
    if (/[.!?;:,]$/.test(titre) || titre.split(' ').length > 7) return { corps: ligne };
    return { titre, corps: m[2].trim() };
}

/* ─────────────────────────────── carte et prix ─────────────────────────────── */

/**
 * Extrait « plat — prix » d'une légende TikTok. Les créateurs listent la carte à
 * la puce : « • Ceviche de la casa - 18€ ». On ne garde que ce qui porte un prix
 * en euros : pas de prix, pas de ligne — mieux vaut rien qu'un plat inventé.
 */
export function menuDeLaLegende(texte: string): PlatCarte[] {
    if (!texte) return [];
    const sansLiens = texte.replace(/https?:\/\/\S+/g, ' ').replace(/#[^\s#]+/g, ' ');
    const morceaux = sansLiens.split(/[•·\n]|(?<=€)\s+(?=[A-ZÉÈÀÂÎÔÛ])/);
    const plats: PlatCarte[] = [];
    for (const brut of morceaux) {
        const m = brut.match(/^(.{2,70}?)\s*[-–—:]\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*€/);
        if (!m) continue;
        const nom = propre(m[1])
            .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}‍️]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
        const prix = parseFloat(m[2].replace(',', '.'));
        if (nom.length < 2 || !isFinite(prix) || prix <= 0 || prix > 500) continue;
        plats.push({ nom, prix });
    }
    return plats;
}

/* ─────────────────────────────── lecture globale ───────────────────────────── */

export function lireFicheResto(steps: string[] | undefined, nom?: string): LectureResto {
    const lignes = (steps || []).map(propre).filter((l) => !vide(l));
    const res: LectureResto = {
        presentation: [],
        avis: {},
        pratique: { transports: [] },
        menu: [],
        total: 0,
    };
    if (!lignes.length) return res;

    // La carte peut être n'importe où : une seule ligne (légende TikTok) ou noyée
    // dans un paragraphe. On la cherche partout avant de classer.
    for (const l of lignes) {
        const plats = menuDeLaLegende(l);
        if (plats.length >= 2) res.menu.push(...plats);
    }
    res.total = res.menu.reduce((s, p) => s + p.prix, 0);

    // Les lignes « pratiques » se reconnaissent à leur forme, où qu'elles soient.
    const reste: string[] = [];
    for (const l of lignes) {
        if (RX_LIEN.test(l)) { res.pratique.lien = res.pratique.lien || l; continue; }
        if (RX_RESERVATION.test(l) && l.length < 90) { res.pratique.reservation = res.pratique.reservation || l; continue; }
        if (RX_PARKING.test(l) && l.length < 90) { res.pratique.parking = res.pratique.parking || l; continue; }
        if (RX_TRANSPORT.test(l) && l.length < 120) { res.pratique.transports.push(l); continue; }
        // Une adresse est courte : un paragraphe qui cite une rue n'en est pas une.
        if (RX_ADRESSE.test(l) && l.length < 110) { res.pratique.adresse = res.pratique.adresse || l; continue; }
        reste.push(l);
    }

    // Ancre du gabarit. Sans elle, tout le reste est de la présentation.
    const iPlat = reste.findIndex((l) => RX_PLAT_PREFERE.test(l));
    if (iPlat === -1) {
        res.presentation = reste.map((l) => couperIntertitre(l, nom)).filter(Boolean) as Paragraphe[];
        return res;
    }

    res.presentation = reste.slice(0, iPlat).map((l) => couperIntertitre(l, nom)).filter(Boolean) as Paragraphe[];
    res.avis.platPrefere = reste[iPlat].replace(RX_PLAT_PREFERE, '').trim() || undefined;

    const suite = reste.slice(iPlat + 1);
    // La table sort de la file en premier : sinon une fiche sans reproche
    // (Il Venezia) verrait sa table classée en « j'ai moins aimé ».
    const iTable = suite.findIndex((l) => RX_TABLE.test(l) && l.length < 120);
    if (iTable !== -1) {
        res.avis.table = suite[iTable];
        suite.splice(iTable, 1);
    }
    if (suite[0]) res.avis.aime = suite[0];
    if (suite[1]) res.avis.moinsAime = suite[1];
    // Ce qui dépasse le gabarit reste de la présentation plutôt que d'être perdu.
    if (suite.length > 2) res.presentation.push(...(suite.slice(2).map((l) => couperIntertitre(l, nom)).filter(Boolean) as Paragraphe[]));

    return res;
}

/* ────────────────────────────────── horaires ───────────────────────────────── */

const JOURS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
// Index par jour de la semaine JS (0 = dimanche), tel que l'écrivent les fiches.
const JOURS_FR = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const RX_JOUR_FR = /\b(lun|mar|mer|jeu|ven|sam|dim)[a-zéû]*\b/gi;
// Le drapeau `g` rend `.test()` dépendant de l'appel précédent : version dédiée.
const RX_A_UN_JOUR_FR = /\b(lun|mar|mer|jeu|ven|sam|dim)[a-zéû]*\b/i;

/**
 * Dit si le lieu est ouvert maintenant. Deux formats coexistent : celui d'OSM
 * (« Mo-Fr 12:00-15:00 »), machine, et celui saisi à la main
 * (« 7j/7 12h30–14h30 & 19h30–23h »), humain.
 *
 * On ne répond que si on est SÛR : un format non compris renvoie `ouvert: null`,
 * et l'interface se contente d'afficher les horaires sans pastille. Annoncer
 * « ouvert » à tort ferait faire le déplacement pour rien.
 */
export function horairesLisibles(
    hours?: string,
    maintenant: Date = new Date()
): { texte: string; ouvert: boolean | null } | null {
    if (!hours || !hours.trim()) return null;
    const texte = hours.trim();

    const creneaux = lireCreneauxDuJour(texte, maintenant);
    if (!creneaux) return { texte, ouvert: null };

    const min = maintenant.getHours() * 60 + maintenant.getMinutes();
    const ouvert = creneaux.some(([d, f]) => min >= d && min < f);
    return { texte, ouvert };
}

/** Renvoie les créneaux du jour en minutes, ou null si le format échappe. */
function lireCreneauxDuJour(texte: string, quand: Date): [number, number][] | null {
    const jourOsm = JOURS[quand.getDay()];
    const jourFr = JOURS_FR[quand.getDay()];

    // Format OSM (« Mo-Fr 12:00-15:00 ») : une règle par point-virgule.
    if (/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/.test(texte) && !RX_A_UN_JOUR_FR.test(texte)) {
        const regles = texte.split(';').map((r) => r.trim());
        const trouvee = regles.find((r) => regleCouvreJour(r, jourOsm));
        if (!trouvee) return [];
        if (/off|closed/i.test(trouvee)) return [];
        return plagesHoraires(trouvee);
    }

    // Format saisi à la main : segments séparés par « · », jours en français.
    const segments = texte.split(/[·;]/).map((t) => t.trim()).filter(Boolean);
    const toutLesJours = /7\s?j\s?\/\s?7|tous les jours/i.test(texte);
    let vu = false;
    for (const seg of segments) {
        const jours = joursDuSegment(seg);
        if (!jours.length) continue;
        vu = true;
        if (!jours.includes(jourFr)) continue;
        if (/ferm/i.test(seg)) return [];
        return plagesHoraires(seg);
    }
    if (vu) return [];              // des jours étaient nommés, aucun n'est aujourd'hui
    if (toutLesJours) return plagesHoraires(texte);
    return null;                    // format inconnu : on n'affirme rien
}

/** Jours couverts par un segment, plages « lun–sam » et listes « sam & dim » comprises. */
function joursDuSegment(seg: string): string[] {
    const trouves = seg.toLowerCase().match(RX_JOUR_FR);
    if (!trouves) return [];
    const codes = trouves.map((t) => t.slice(0, 3));
    // Une plage s'écrit avec un tiret entre deux jours : « Lun–Sam ».
    const plage = seg.toLowerCase().match(/(lun|mar|mer|jeu|ven|sam|dim)[a-zéû]*\s*[-–—]\s*(lun|mar|mer|jeu|ven|sam|dim)[a-zéû]*/i);
    if (plage) {
        const a = JOURS_FR.indexOf(plage[1].slice(0, 3));
        const b = JOURS_FR.indexOf(plage[2].slice(0, 3));
        // La semaine des fiches commence lundi : dimanche (index 0) ferme la marche.
        const ordre = [1, 2, 3, 4, 5, 6, 0];
        const ia = ordre.indexOf(a), ib = ordre.indexOf(b);
        for (let i = 0; i < ordre.length; i++) {
            const dans = ia <= ib ? i >= ia && i <= ib : i >= ia || i <= ib;
            if (dans) codes.push(JOURS_FR[ordre[i]]);
        }
    }
    return Array.from(new Set(codes));
}

/** Toutes les plages « 12h30–14h30 » d'un texte, en minutes depuis minuit. */
function plagesHoraires(portee: string): [number, number][] | null {
    const plages: [number, number][] = [];
    const rx = /(\d{1,2})\s*[h:.]\s*(\d{2})?\s*[-–—àa]+\s*(\d{1,2})\s*[h:.]?\s*(\d{2})?/gi;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(portee))) {
        const d = parseInt(m[1], 10) * 60 + parseInt(m[2] || '0', 10);
        let f = parseInt(m[3], 10) * 60 + parseInt(m[4] || '0', 10);
        if (f <= d) f += 24 * 60;          // service qui passe minuit
        plages.push([d, f]);
    }
    return plages.length ? plages : null;
}

function regleCouvreJour(regle: string, jour: string): boolean {
    const m = regle.match(/\b(Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(Mo|Tu|We|Th|Fr|Sa|Su))?/g);
    if (!m) return false;
    for (const bloc of m) {
        const [a, b] = bloc.split(/\s*-\s*/);
        const ia = JOURS.indexOf(a);
        const ij = JOURS.indexOf(jour);
        if (!b) { if (ia === ij) return true; continue; }
        const ib = JOURS.indexOf(b);
        // La semaine OSM commence lundi : on tourne pour gérer « Sa-Mo ».
        const dans = ia <= ib ? ij >= ia && ij <= ib : ij >= ia || ij <= ib;
        if (dans) return true;
    }
    return false;
}

/**
 * Fourchette de prix lisible. Le site affiche déjà un prix moyen chiffré sur les
 * recettes ; trois symboles « € » à côté seraient une régression. Ces bornes sont
 * celles d'un repas complet en France (entrée ou dessert + plat + un verre).
 */
export function fourchetteResto(niveau?: 1 | 2 | 3): string | null {
    if (niveau === 1) return '15 – 25 €';
    if (niveau === 2) return '25 – 45 €';
    if (niveau === 3) return '60 € et plus';
    return null;
}
