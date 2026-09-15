/**
 * « Une recette de gâteau notée au moins 4/5 »
 * ===========================================
 *
 * L'assistant ne voyait pas les notes : elles vivent dans Supabase, pas dans le
 * catalogue envoyé au modèle. Il répondait donc « gâteau » et ignorait le
 * « 4/5 » — et le modèle, à qui l'on ne donne aucune note, n'aurait de toute
 * façon rien pu vérifier.
 *
 * On lit donc la contrainte DANS LA DEMANDE, ici, et on écarte les recettes qui
 * n'y répondent pas AVANT d'appeler le modèle. Il ne reçoit plus que des
 * candidates légitimes : impossible pour lui d'en proposer une qui triche.
 *
 * Le reste de la phrase (« une recette de gâteau ») repart, lui, au modèle :
 * c'est ce qui décrit le plat.
 */

export interface ContrainteNote {
    /** Note minimale exigée, sur 5. */
    min: number;
    /** `true` quand la demande dit seulement « les mieux notées ». */
    meilleures: boolean;
    /** La demande débarrassée de sa clause de note. */
    reste: string;
    /** Comment la contrainte se raconte à l'écran. */
    libelle: string;
}

/** Note lisible : 4 et non 4,0 ; 4,5 avec la virgule française. */
export const noteLisible = (n: number) =>
    (Math.round(n * 10) / 10).toString().replace('.', ',');

const norm = (s: string) => String(s || '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Les tournures qui expriment un plancher de note. Chacune capture le nombre.
 * Elles sont essayées dans l'ordre : la plus explicite d'abord.
 */
const PLANCHERS: RegExp[] = [
    // « notée au moins 4/5 », « note minimum 4 étoiles », « à partir de 4 »
    /\b(?:not[ée]e?s?|note|avis|etoiles?)\b[^.]{0,20}?\b(?:au moins|minimum|mini|a partir de|superieure? a|plus de|au dessus de|des)\s*(\d(?:[.,]\d)?)\s*(?:\/\s*5|sur\s*5|etoiles?)?/,
    // « au moins 4/5 », « plus de 4 étoiles » — le repère est ici le « /5 »
    /\b(?:au moins|minimum|mini|a partir de|superieure? a|plus de|au dessus de)\s*(\d(?:[.,]\d)?)\s*(?:\/\s*5|sur\s*5|etoiles?)/,
    // « 4/5 ou plus », « 4 étoiles minimum », « 4/5 et plus »
    /\b(\d(?:[.,]\d)?)\s*(?:\/\s*5|sur\s*5|etoiles?)\s*(?:ou plus|et plus|minimum|mini|au moins|et au dessus)/,
    // « notée 4/5 », « note de 4,5/5 » : on le lit comme un plancher.
    /\b(?:not[ée]e?s?|note|avis)\b[^.]{0,12}?\b(\d(?:[.,]\d)?)\s*(?:\/\s*5|sur\s*5|etoiles?)/,
    // « 4 étoiles », « 4,5/5 » tout court.
    /\b(\d(?:[.,]\d)?)\s*(?:\/\s*5|sur\s*5|etoiles?)\b/,
];

/** « les mieux notées », « bien notée », « les meilleures notes ». */
const MEILLEURES = /\b(?:les? )?(?:mieux|meilleure?s?)\s+not[ée]e?s?\b|\bbien not[ée]e?s?\b|\bmeilleures? notes?\b|\bmieux not[ée]e?s?\b/;

/**
 * Lit la contrainte de note d'une demande. `null` quand il n'y en a pas — c'est
 * le cas courant, et l'assistant garde alors son comportement d'avant.
 */
export function lireContrainteNote(query: string): ContrainteNote | null {
    const q = norm(query);

    for (const motif of PLANCHERS) {
        const m = q.match(motif);
        if (!m) continue;
        const val = parseFloat(m[1].replace(',', '.'));
        // Une note se dit sur 5 : « 200 g » ou « 12 parts » n'en sont pas une.
        if (!(val > 0 && val <= 5)) continue;
        return {
            min: val,
            meilleures: false,
            reste: retirer(query, m[0]),
            libelle: `notées ${noteLisible(val)}/5 ou plus`,
        };
    }

    const mm = q.match(MEILLEURES);
    if (mm) {
        // « les mieux notées » ne fixe pas de plancher : on demande seulement
        // qu'elles aient été notées, et on classe par la note.
        return { min: 0, meilleures: true, reste: retirer(query, mm[0]), libelle: 'les mieux notées du site' };
    }
    return null;
}

/**
 * Retire du texte ORIGINAL la portion repérée sur sa version sans accents.
 * Les deux chaînes ont la même longueur — `normalize('NFD')` ajoute des signes
 * qu'on supprime aussitôt — donc les positions se correspondent.
 */
function retirer(original: string, trouve: string): string {
    const plat = norm(original);
    // Garde-fou : un accent déjà décomposé à la source décalerait les positions.
    if (plat.length !== original.length) return original;
    const i = plat.indexOf(trouve);
    const sans = i < 0 ? original : original.slice(0, i) + ' ' + original.slice(i + trouve.length);
    return sans.replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim();
}

export interface StatNote { avg: number; count: number }

/**
 * Ne garde que les recettes qui tiennent la contrainte, les mieux notées en
 * tête. Une recette que personne n'a notée ne peut pas prétendre à 4/5 : elle
 * sort, sinon « au moins 4/5 » ne voudrait plus rien dire.
 */
export function appliquerContrainteNote<T extends { id: string | number }>(
    recettes: T[],
    stats: Map<string, StatNote>,
    contrainte: ContrainteNote,
): T[] {
    const note = (r: T) => stats.get(String(r.id))?.avg ?? 0;
    return recettes
        .filter((r) => {
            const s = stats.get(String(r.id));
            if (!s || !s.count) return false;
            return s.avg >= contrainte.min;
        })
        .sort((a, b) => note(b) - note(a));
}
