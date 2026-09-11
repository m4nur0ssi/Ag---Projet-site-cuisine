/**
 * « Pour les bébés » — reconnaître une recette de bébé, et lire son âge minimum.
 *
 * L'âge ne vit pas dans un champ à part : il voyage dans les TAGS, comme tout
 * le reste du catalogue (« Bébé », « Dès 6 mois »). C'est le seul chemin qui
 * traverse WordPress sans rien casser — le bot pose les tags, la synchro les
 * recopie, l'accueil les lit. Un champ nouveau aurait demandé une colonne à
 * WordPress, une ligne à la synchro et une migration du catalogue.
 *
 * Une recette de bébé SANS âge n'existe pas côté site : le bot pose « Dès 6
 * mois » par défaut quand l'IA n'a rien su dire (voir tiktok-bot/recipe-processor.js).
 * Ici, on ne devine rien : pas d'âge lisible, pas de pastille.
 */

interface RecetteLisible {
    title?: string;
    description?: string;
    tags?: string[];
    steps?: string[];
}

const sansAccents = (s: string) =>
    (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * « Épinards bébé », « bébé calamars », « pousses bébé » : le mot désigne la
 * TAILLE du légume, pas le convive. Sans ce filtre, une salade de jeunes
 * pousses atterrissait au rayon des purées.
 */
const LEGUME_BEBE = new RegExp(
    '\\b(?:bebes?[- ](?:epinards?|carottes?|poireaux?|mais|salades?|pousses?|courgettes?|betteraves?'
    + '|navets?|artichauts?|patissons?|calamars?|poulpes?|seiches?|fenouils?|blettes?)'
    + '|(?:epinards?|carottes?|poireaux?|salades?|pousses?|courgettes?|betteraves?|navets?'
    + '|artichauts?|patissons?|calamars?|poulpes?|seiches?|fenouils?|blettes?)\\s+bebes?)\\b',
    'g'
);

/** L'âge, écrit noir sur blanc : « dès 6 mois », « à partir de 8 mois », « 6 mois ». */
const AGE_EXPLICITE = /(?:des|a partir de|apres)\s*(\d{1,2})\s*mois/;
/** Un tag qui ne dit QUE l'âge : « 6 mois », « Dès 6 mois ». */
const TAG_AGE = /^(?:des\s*)?(\d{1,2})\s*mois$/;

/** Ce que dit la recette, sans les « bébé légume ». */
function texteBebe(recipe: RecetteLisible): string {
    const brut = `${recipe.title || ''} ${recipe.description || ''} ${(recipe.steps || []).join(' ')}`;
    return sansAccents(brut).replace(LEGUME_BEBE, ' ');
}

/**
 * Recette destinée à un bébé ? Il faut qu'elle le dise : un tag « Bébé », le
 * mot dans le titre ou la description, ou un âge en mois annoncé.
 *
 * La réponse décide de TOUT l'affichage : une recette de bébé ne vit que dans
 * « Pour les bébés », jamais dans Plats, Healthy, Italie ni le Top — on ne sert
 * pas une purée « dès 6 mois » à qui cherche son dîner. Elle est donc demandée
 * des milliers de fois par écran : mise en cache par recette, et lue telle
 * quelle quand le build l'a déjà calculée (champ `bebe` des données de
 * l'accueil, qui n'ont plus les étapes pour la recalculer).
 */
const cacheBebe = new WeakMap<object, boolean>();
export function estRecetteBebe(recipe: RecetteLisible & { bebe?: boolean }): boolean {
    if (typeof recipe.bebe === 'boolean') return recipe.bebe;
    const deja = cacheBebe.get(recipe);
    if (deja !== undefined) return deja;
    const oui = detecterBebe(recipe);
    cacheBebe.set(recipe, oui);
    return oui;
}

/** Recette pour tout le monde — l'inverse, commode dans un `filter`. */
export const pourAdultes = (recipe: RecetteLisible & { bebe?: boolean }) => !estRecetteBebe(recipe);

function detecterBebe(recipe: RecetteLisible): boolean {
    const tags = (recipe.tags || []).map(sansAccents);
    if (tags.some((t) => t.includes('bebe') || t.includes('diversification') || TAG_AGE.test(t.trim()))) return true;
    const texte = texteBebe(recipe);
    if (/\bbebes?\b/.test(texte)) return true;
    return /diversification alimentaire|\bnourrissons?\b/.test(texte);
}

/**
 * L'âge minimum, en mois — `null` si la recette ne l'annonce nulle part.
 * Les tags priment : c'est le bot qui les pose, et il a lu la vidéo en entier.
 */
export function ageBebeMois(recipe: RecetteLisible): number | null {
    for (const tag of recipe.tags || []) {
        const t = sansAccents(tag).trim();
        const seul = t.match(TAG_AGE);
        if (seul) return Number(seul[1]);
        const dedans = t.match(AGE_EXPLICITE);
        if (dedans) return Number(dedans[1]);
    }
    const texte = texteBebe(recipe);
    const trouve = texte.match(AGE_EXPLICITE) || texte.match(/\b(\d{1,2})\s*mois\b/);
    if (!trouve) return null;
    const mois = Number(trouve[1]);
    // Au-delà de 36 mois on ne parle plus en mois : c'est autre chose (une
    // conservation « 12 mois », un fromage affiné).
    return mois >= 3 && mois <= 36 ? mois : null;
}

/** Le texte de la pastille, tel qu'il s'affiche sur la photo. */
export function libelleAgeBebe(mois: number): string {
    return `À partir de ${mois} mois`;
}

/**
 * L'âge à afficher sur une carte : seulement pour une recette de bébé, et
 * seulement s'il est écrit quelque part.
 */
export function ageAAfficher(recipe: RecetteLisible): string | null {
    if (!estRecetteBebe(recipe)) return null;
    const mois = ageBebeMois(recipe);
    return mois === null ? null : libelleAgeBebe(mois);
}
