#!/usr/bin/env node
/**
 * Photos de recettes générées, à partir du TEXTE de la recette.
 *
 * Pourquoi ce script existe
 * -------------------------
 * Les photos du site ont été trouvées sur le web et réhébergées : ce n'est pas
 * tenable. Ce script les remplace par des images créées pour le site.
 *
 * Le point juridique, qui a dicté toute la conception : on ne donne JAMAIS la
 * photo d'origine au modèle. Partir d'une image protégée pour en produire une
 * variante donne une œuvre dérivée, et l'auteur d'origine garde des droits
 * dessus — passer par une IA n'y change rien. On part donc du titre, de la
 * catégorie et des ingrédients, qui ne sont pas protégés dans leur substance.
 * Rien n'est copié, il n'y a pas de dérivation possible.
 *
 * Fournisseur : fal.ai (modèle FLUX). Gemini a été écarté — le projet Google
 * du compte est signalé, sa clé revient « suspended » quoi qu'on fasse.
 *
 * Usage
 * -----
 *   node scripts/generate-recipe-images.js --ids 7297,6608
 *   node scripts/generate-recipe-images.js --recent 5
 *   node scripts/generate-recipe-images.js --oldest 20
 *   node scripts/generate-recipe-images.js --all --dry-run
 *
 * La clé se lit dans .env.local (FAL_KEY), inutile de la passer en variable.
 *
 * Options
 *   --ids a,b,c   recettes visées, par identifiant
 *   --recent N    les N recettes les plus récentes
 *   --oldest N    les N plus anciennes (c'est par là qu'on commence : ce sont
 *                 les images en ligne depuis le plus longtemps, donc les plus
 *                 exposées et les plus susceptibles d'avoir été repérées)
 *   --all         tout le catalogue (long : voir --dry-run d'abord)
 *   --dry-run     n'appelle rien, montre seulement les consignes qui partiraient
 *   --force       régénère même si l'image existe déjà
 *   --relier      ne génère RIEN : refait seulement pointer mockData vers les
 *                 images déjà présentes. Indispensable après une synchro
 *                 WordPress, qui réécrit mockData et efface les pointeurs.
 *
 * Deux fichiers par recette dans public/recipes-ia :
 *   <id>.webp        1400 px — la fiche recette, les grands écrans
 *   <id>-carte.webp   700 px — les cartes, le héros, les vignettes
 * mockData pointe sur la petite (les deux copies, bureau et mobile).
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RACINE = path.join(__dirname, '..');
const DOSSIER = path.join(RACINE, 'public', 'recipes-ia');
const MOCKS = [
    path.join(RACINE, 'src', 'data', 'mockData.ts'),
    path.join(RACINE, 'src', 'mobile', 'data', 'mockData.ts'),
];

/**
 * Le modèle. « ultra » est le seul à rendre du portrait en haute définition
 * (1792×2368) : les autres plafonnent à 1024, ce qui suffit aux petites cartes
 * mais pas au héros ni à la photo de la fiche recette. FAL_MODEL permet de
 * revenir à un modèle d'essai (fal-ai/flux/schnell) pour caler un style sans
 * dépenser.
 */
const MODELE = process.env.FAL_MODEL || 'fal-ai/flux-pro/v1.1-ultra';

/**
 * DEUX TAILLES, et pourquoi.
 *
 * Servir la grande image partout mettrait trente photos de 300 ko sur
 * l'accueil. Servir la petite partout donnerait une fiche recette floue sur
 * écran Retina. On écrit donc les deux, en WebP : le PNG rendu par le modèle
 * pèse plus de 4 Mo, ce qui est hors de question sur un téléphone.
 */
const TAILLES = [
    // 1200 px couvre la fiche sur ordinateur (1200 CSS) comme sur téléphone
    // Retina (375 × 3 = 1125). Au-delà, on paie des octets que personne ne voit.
    { suffixe: '', largeur: 1200, qualite: 78 },       // ~270 ko
    // 760 px couvre la plus grande carte (vitrine : 300 CSS × 3 = 900, on
    // accepte un léger sous-échantillonnage) et l'affiche du héros (780).
    { suffixe: '-carte', largeur: 760, qualite: 75 },  // ~110 ko
];

/** Lit .env.local sans dépendance : le script tourne hors de Next. */
function chargerEnv() {
    const fichier = path.join(RACINE, '.env.local');
    if (!fs.existsSync(fichier)) return;
    for (const ligne of fs.readFileSync(fichier, 'utf8').split('\n')) {
        const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
}
chargerEnv();

// ── Lecture des arguments ────────────────────────────────────────────────
const args = process.argv.slice(2);
const aOption = (nom) => args.includes(nom);
const valeur = (nom) => {
    const i = args.indexOf(nom);
    return i >= 0 ? args[i + 1] : null;
};

/**
 * LE STYLE DE LA MAISON
 * =====================
 *
 * Une seule composition, déclinée sur tout le catalogue : vue du dessus, le
 * plat entamé, une part prélevée, un couvert qui en emporte une bouchée, et
 * autour la vaisselle et les ustensiles qui ont servi. Riche, mais lisible.
 *
 * La règle qui fait tenir l'ensemble : **la composition ne change pas, les
 * couleurs et les matières changent**. Deux recettes voisines ne doivent pas
 * donner deux photos jumelles — c'est ce qui trahirait la fabrique — mais on
 * doit sentir que toutes viennent du même endroit.
 *
 * La variation est TIRÉE DE L'IDENTIFIANT de la recette, donc stable : la même
 * recette régénérée donne la même table et la même vaisselle. Sans ça, chaque
 * passage du script rebattrait les cartes et le site changerait de visage à
 * chaque synchronisation.
 *
 * Les consignes sont en anglais : les modèles d'image y sont nettement plus
 * fidèles qu'en français, en particulier sur les interdits.
 */

/**
 * Les surfaces, rangées par valeur.
 *
 * Le tirage au hasard ne suffisait pas : un houmous pâle tombait sur un
 * carrelage crème et disparaissait, un brookie brun sur un bois gris ne
 * ressortait pas davantage. On choisit donc la surface CONTRE le plat — clair
 * sous un plat sombre, sombre sous un plat pâle — et on ne tire au sort qu'à
 * l'intérieur du groupe retenu.
 */
const TABLES_CLAIRES = [
    'a white carrara marble slab with grey veining',
    'a pale oak table with visible grain',
    'a soft cream linen tablecloth',
    'a bright white painted wood surface',
    'a pale grey terrazzo surface',
    'a warm ivory ceramic tiled surface',
];

const TABLES_SOMBRES = [
    'a dark walnut table, rich brown grain',
    'a black slate surface',
    'a deep forest green painted wood surface',
    'a dark navy blue matte surface',
    'a charcoal grey stone surface',
    'a burnished copper surface',
];

/** Quand le plat n'a pas de valeur tranchée, tout est permis. */
const TABLES = [...TABLES_CLAIRES, ...TABLES_SOMBRES];

/**
 * La valeur attendue du plat, devinée au titre et aux ingrédients.
 *
 * Approximatif par nature — on ne sait pas de quelle couleur sortira l'image —
 * mais suffisant pour éviter les deux cas qui ratent vraiment : le très pâle
 * sur pâle et le très sombre sur sombre.
 */
function valeurDuPlat(recette) {
    const texte = `${recette.title || ''} ${(recette.ingredients || []).map((i) => i.name).join(' ')}`.toLowerCase();
    const sombre = /chocolat|caf[ée]|caramel|b[œoe]uf|agneau|mijot|bourguignon|curry|champignon|soja|balsamique|brownie|cacao|ch[âa]taigne/;
    const pale = /houmous|pur[ée]e|ricotta|mozzarella|chantilly|riz\b|semoule|poisson blanc|cabillaud|colin|blanc de poulet|feta|yaourt|panna|coco|vanille|meringue/;
    if (sombre.test(texte)) return 'sombre';
    if (pale.test(texte)) return 'pale';
    return 'neutre';
}

/**
 * L'agencement. La grammaire ne change pas — vue du dessus, plat entamé, part
 * prélevée — mais la place des éléments, si. Sans ça, dix-neuf images donnaient
 * dix-neuf fois le même plan, et l'ensemble sentait la fabrique.
 */
const CADRAGES = [
    'The dish sits centred, everything else arranged loosely around it.',
    'The dish sits off-centre to the left, the served portion and cutlery filling the right third.',
    'The dish sits in the lower half, clean plates and ingredients spread across the top.',
    'The dish is pushed to the upper right, a folded cloth and the served portion anchoring the lower left.',
    'Tight crop: the dish fills most of the frame, only the edge of a plate and a fork visible.',
    'The dish sits centred but seen slightly wider, with generous empty surface around it.',
];

/** La vaisselle : c'est elle qui donne la couleur dominante de l'image. */
const VAISSELLES = [
    'matte white stoneware',
    'glazed sage green ceramic',
    'dusty pink glazed ceramic',
    'deep blue speckled stoneware',
    'plain cream earthenware',
    'warm terracotta clay dishes',
    'pale grey matte ceramic',
    'soft yellow glazed pottery',
    'black matte stoneware',
    'ivory porcelain with a thin rim',
];

/** Les couverts, et le linge qui traîne dans le cadre. */
const COUVERTS = [
    'brushed brass cutlery and a rumpled ecru linen napkin',
    'matte black cutlery and a folded grey linen cloth',
    'polished silver cutlery and a white waffle-weave towel',
    'vintage worn silver cutlery and a striped blue linen napkin',
    'warm gold cutlery and a soft terracotta napkin',
    'plain stainless cutlery and an olive green linen cloth',
];

/**
 * Les contenants. La première série alignait les plats ronds : tartes, poêlées
 * et gratins se ressemblaient tous en vignette carrée. On impose donc une forme
 * de contenant, tirée elle aussi de l'identifiant — sauf quand le titre annonce
 * déjà la sienne (une tarte reste ronde).
 */
const CONTENANTS = [
    'a round shallow dish',
    'a rectangular baking dish',
    'an oval gratin dish',
    'a wide shallow bowl',
    'a cast-iron skillet',
    'a wooden serving board',
    'a square ceramic dish',
    'a deep round casserole with handles',
];

/** Toujours le même angle, mais la lumière respire. */
const LUMIERES = [
    'soft diffused daylight from the left, gentle shadows',
    'warm late-afternoon light from the right, long soft shadows',
    'bright even overcast daylight, very soft shadows',
    'soft window light from the top left, delicate highlights',
];

/**
 * Certains plats ont une FORME que le titre annonce et que le modèle invente
 * s'il ne la connaît pas — « fagots d'aubergines » lui a donné une poêlée.
 * Quand le mot est là, on décrit la forme au lieu de l'espérer.
 */
const FORMES = [
    [/\bfagots?\b/i, 'bundles of vegetable slices wrapped around a filling, each tied like a small parcel'],
    [/\brouleaux?\b|\brroul[ée]s?\b|\brol+s?\b/i, 'tight rolled cylinders, sliced to reveal the spiral inside'],
    [/\bbrochettes?\b/i, 'pieces threaded onto wooden skewers, laid side by side'],
    [/\bpapillotes?\b/i, 'parcels of baking paper, one opened to show the contents steaming'],
    [/\bverrines?\b/i, 'clear glass verrines showing distinct layers'],
    [/\btartelettes?\b/i, 'individual small tarts with fluted edges'],
    [/\bmille-?feuilles?\b/i, 'rectangular layered pastry, visible thin crisp layers'],
    [/\bboulettes?\b/i, 'small round balls, several stacked'],
    [/\bwraps?\b|\bburritos?\b/i, 'rolled flatbread wraps, one cut across to show the filling'],
    [/\bb[âa]tonnets?\b|\bsticks?\b/i, 'finger-shaped sticks, arranged in a loose pile'],
    [/\bgratin\b/i, 'a browned baked gratin in its dish, a portion scooped out'],
    [/\bterrine\b|\bp[âa]t[ée]\b/i, 'a rectangular terrine, several slices cut and fanned out'],
    [/\bcake\b|\bg[âa]teau\b/i, 'a round or loaf cake, one slice cut and lifted away'],
    [/\bsandwichs?\b|\bcroque\b/i, 'a sandwich cut in half diagonally, the filling visible'],
    [/\bsoupe\b|\bvelout[ée]\b|\bpotage\b/i, 'a bowl of soup seen from above, a spoon resting in it'],
    [/\bsalade\b/i, 'a loose tossed salad in a wide shallow bowl'],
    // Ajoutés après la première série : le pita était devenu une focaccia, et la
    // salade de pommes de terre une salade de tomates.
    [/\bpita\b/i, 'round flat pita breads, puffed and lightly charred, one torn open'],
    [/\bnaan\b/i, 'teardrop-shaped naan breads, blistered, brushed with butter'],
    [/\bfocaccia\b/i, 'a thick dimpled focaccia on a baking tray, cut into squares'],
    [/\bflammekueche\b|\btarte flamb[ée]e\b/i, 'a very thin rectangular tart, cut into rectangles'],
    [/\bpizza\b/i, 'a round thin-crust pizza, one slice pulled away'],
    [/\bcroquetas?\b|\bcroquettes?\b/i, 'small breadcrumbed cylinders, golden fried, piled up'],
    [/\bpolpette\b|\bmeatballs?\b/i, 'round meatballs in sauce, one cut in half'],
    [/\btajine\b|\btagine\b/i, 'a conical clay tagine, lid set aside, the stew visible inside'],
    [/\bcurry\b/i, 'a thick curry in a bowl, rice served alongside'],
    [/\bp[âa]tes\b|\bpasta\b|\bfarfalle\b|\bpenne\b|\bspaghetti\b/i, 'pasta tossed in sauce, served in a wide bowl, a fork twirling a portion'],
    [/\bfrites\b|\bfries\b/i, 'a heap of fries in a shallow tray, toppings scattered over them'],
    [/\bquiche\b|\btarte sal[ée]e\b/i, 'a round quiche with a fluted crust, one wedge removed'],
    [/\bescalopes?\b/i, 'flat pan-fried cutlets overlapping in a pan, sauce spooned over'],
    [/\bpommes? de terre\b.*\br[ôo]ties?\b|\br[ôo]ties?\b.*\bpommes? de terre\b/i,
     'roasted potato chunks with crisp golden edges, tumbled in a roasting tray'],
];

/** La forme annoncée par le titre, s'il en annonce une. */
function formeDuTitre(titre) {
    for (const [motif, description] of FORMES) {
        if (motif.test(titre || '')) return description;
    }
    return '';
}

/**
 * Certains plats ne se « coupent » pas : le template par défaut (plat entamé,
 * part prélevée, pile d'assiettes) transforme une crème dessert en gâteau tranché
 * et des beignets fourrés en tarte. Ces plats imposent leur propre mise en scène,
 * qui REMPLACE entièrement la scène générique. {T} = titre de la recette.
 */
const SCENES_SPECIALES = [
    [/cr[èe]me dessert|mousse|pot de cr[èe]me|panna ?cotta|pudding|cr[èe]me chocolat|tiramisu|yaourt|fromage blanc|flan\b/i,
     'several individual small glass pots and ramekins of {T}, smooth glossy spoonable surface, '
     + 'one topped with a garnish, a small spoon dipping into one pot, no cutting and no slices, '
     + 'the pots grouped together with the ingredients scattered loosely around'],
    [/samboussek|sambousek|samosas?|b[öo]rek|beignets? (de|[àa] la|au|aux) viande|chaussons? [àa] la viande|empanadas?/i,
     'a generous pile of golden deep-fried stuffed pastry parcels of {T}, half-moon and triangle shapes, '
     + 'crisp blistered golden crust, one broken open to reveal the spiced minced-meat filling steaming inside, '
     + 'a small bowl of dipping sauce and fresh herbs alongside'],
];

/** La scène spéciale imposée par le titre, s'il y en a une. */
function sceneSpeciale(titre) {
    for (const [motif, description] of SCENES_SPECIALES) {
        if (motif.test(titre || '')) return description;
    }
    return '';
}

/**
 * Choisit dans une liste à partir de l'identifiant : stable d'une exécution à
 * l'autre, et deux recettes voisines ne tombent pas sur la même entrée.
 */
function tirage(liste, id, sel) {
    // FNV-1a puis brassage final. La version précédente (h * 31 + code) donnait
    // des restes voisins pour des identifiants voisins : sur vingt recettes, un
    // cadrage sortait neuf fois et trois autres jamais.
    let h = (2166136261 ^ sel) >>> 0;
    const texte = String(id);
    for (let i = 0; i < texte.length; i++) {
        h = (h ^ texte.charCodeAt(i)) >>> 0;
        h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
    h ^= h >>> 16;
    return liste[(h >>> 0) % liste.length];
}

function consigne(recette) {
    // Les noms venus de WordPress arrivent avec un emoji de rayon et une rafale
    // d'espaces : « 🍅              3 tomates mûres ». On rend le texte nu, sinon
    // la consigne part polluée et le modèle peut dessiner les pictogrammes.
    const propre = (nom) => String(nom || '')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const ingredients = (recette.ingredients || [])
        .map((i) => propre(i.name))
        .filter(Boolean)
        .slice(0, 7)
        .join(', ');

    const id = recette.id;

    // Un plat sombre appelle une surface claire, et l'inverse : c'est ce qui
    // manquait au houmous, invisible sur son carrelage crème.
    const valeur = valeurDuPlat(recette);
    const table = tirage(
        valeur === 'sombre' ? TABLES_CLAIRES : valeur === 'pale' ? TABLES_SOMBRES : TABLES,
        id, 7,
    );
    const vaisselle = tirage(VAISSELLES, id, 13);
    const couverts = tirage(COUVERTS, id, 23);
    const lumiere = tirage(LUMIERES, id, 31);
    const cadrage = tirage(CADRAGES, id, 53);

    const boisson = recette.category === 'boissons' || recette.category === 'rafraichissements';

    /**
     * Tout le catalogue tirait vers le brun automnal : c'est le défaut du style
     * « cookbook », qui va bien à un mijoté et mal à une salade. Les plats frais
     * réclament une lumière et des surfaces claires.
     */
    const fraiche = /salade|crudit|gaspacho|ceviche|tartare|smoothie|sorbet|granit[ée]|fruits?\b/i
        .test(recette.title || '') || ['entrees', 'rafraichissements'].includes(recette.category);

    const palette = fraiche
        ? 'Bright airy palette, cool clean whites and fresh greens, crisp high-key lighting.'
        : 'Warm inviting palette, natural earthy tones.';

    /**
     * Le contenant : celui que le titre impose, sinon un tiré au sort. Sans ça,
     * la page d'accueil n'alignait que des plats ronds.
     */
    const titreImposeLaForme = /tarte|quiche|pizza|gratin|tajine|cake|g[âa]teau|focaccia|pita|naan/i
        .test(recette.title || '');
    const contenant = titreImposeLaForme ? '' : tirage(CONTENANTS, recette.id, 41);

    /**
     * Le cœur du style : le plat ENTAMÉ et la bouchée prélevée.
     *
     * C'est ce détail qui sépare une photo de catalogue d'une photo de table :
     * on montre un plat dans lequel quelqu'un vient de se servir. Une boisson
     * ne se coupe pas — on la déplie autrement, mais toujours vue du dessus.
     */
    const forme = formeDuTitre(recette.title);
    const speciale = sceneSpeciale(recette.title);

    const scene = boisson
        ? [
            // Interdire « pas de fourchette » revient à souffler le mot au modèle,
            // qui en dessine une : la série précédente en avait posé deux à côté du
            // verre. On DÉCRIT donc ce qui occupe la place, sans rien interdire.
            `A tall filled glass of ${recette.title} in the foreground, seen from the front,`,
            'condensation on the glass, ice visible through it, garnish on the rim.',
            'Behind it, slightly out of focus: a second glass, a cocktail shaker,',
            'halved citrus fruits and fresh herb sprigs on the bar counter.',
            'A bar scene: only glassware, bar tools and fruit.',
        ].join(' ')
        : speciale
        ? `Seen from directly above: ${speciale.replace(/\{T\}/g, recette.title)}.`
        : [
            `A dish of ${recette.title} seen from directly above, already cut into,`,
            forme ? `The dish is shaped as: ${forme}.` : '',
            contenant ? `Served in ${contenant}.` : '',
            'one portion lifted out and resting on a small plate nearby,',
            'a fork or spoon holding a single bite, the serving dish beside it,',
            'a stack of clean plates, and the ingredients scattered around.',
        ].filter(Boolean).join(' ');

    return [
        boisson
            // Vu du dessus, un cocktail n'est qu'un rond de liquide : on perd la
            // transparence, les couches, la glace et la buée. De face, tout revient.
            ? 'Straight-on beverage photography, styled editorial cocktail shot.'
            : 'Overhead flat-lay food photography, styled editorial cookbook shot.',
        scene,
        ingredients ? `The dish is made of: ${ingredients}.` : '',
        boisson ? '' : cadrage,
        `Surface: ${table}. Tableware: ${vaisselle}. ${couverts}.`,
        // Dit explicitement : sans ça, un plat brun sur bois brun se noie.
        boisson ? '' : 'Strong tonal separation between the food and the surface beneath it.',
        `Lighting: ${lumiere}. ${palette}`,
        boisson
            ? 'Camera at glass height, straight-on eye-level view, the glass sharp and the background softly blurred, natural colours.'
            : 'Camera directly overhead at 90 degrees, everything sharp, natural colours, generous negative space, an abundant but tidy arrangement.',
        // Répété et explicite : les modèles rapides inventent volontiers des
        // étiquettes couvertes de fausses lettres.
        'STRICTLY NO text, NO letters, NO words, NO labels, NO logos, NO packaging,',
        'NO brand names, NO hands, NO people, NO watermark.',
        // Le modèle meuble les vides avec ce qui lui passe par la tête : la
        // première série avait posé un livre à côté d'un cocktail.
        'Only food, tableware and kitchen items in frame:',
        'NO books, NO phones, NO candles, NO flowers in vases, NO decorative objects,',
        'NO jewellery, NO fabric other than the napkin or cloth.',
        'Photorealistic, shot on a 50mm lens, shallow depth of field only at the edges.',
    ].filter(Boolean).join(' ');
}

/** Extrait les recettes du fichier de données, sans l'exécuter. */
function lireRecettes() {
    const source = fs.readFileSync(MOCKS[0], 'utf8');
    // On repère l'affectation elle-même : chercher le premier « [ » du fichier
    // tombait sur les crochets du type (`Recipe[]`), deux caractères plus tôt.
    const marque = source.indexOf('mockRecipes');
    const debut = source.indexOf('[', source.indexOf('=', marque));
    const json = source.slice(debut, source.lastIndexOf(']') + 1);
    try {
        return JSON.parse(json);
    } catch (e) {
        console.error('Lecture de mockData impossible :', e.message);
        process.exit(1);
    }
}

async function genererUne(recette) {
    const rep = await fetch(`https://fal.run/${MODELE}`, {
        method: 'POST',
        headers: {
            authorization: `Key ${process.env.FAL_KEY}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            prompt: consigne(recette),
            // « ultra » se pilote par ratio ; les autres modèles par un gabarit
            // nommé. Portrait 3:4 : le format tient aussi bien sur une carte
            // carrée que sur l'affiche verticale du héros.
            ...(MODELE.includes('ultra')
                ? { aspect_ratio: '3:4' }
                : { image_size: 'portrait_4_3' }),
            num_images: 1,
            enable_safety_checker: true,
        }),
    });
    if (!rep.ok) {
        const detail = (await rep.text()).slice(0, 200);
        throw new Error(`API ${rep.status} — ${detail}`);
    }
    const data = await rep.json();
    // fal ne renvoie pas l'image : il renvoie son adresse, à aller chercher.
    const url = data?.images?.[0]?.url;
    if (!url) throw new Error('aucune image dans la réponse');
    const fichier = await fetch(url);
    if (!fichier.ok) throw new Error(`téléchargement ${fichier.status}`);
    return Buffer.from(await fichier.arrayBuffer());
}

/** Remplace le champ image d'une recette dans les deux copies de mockData. */
function pointerVers(id, chemin) {
    for (const fichier of MOCKS) {
        const source = fs.readFileSync(fichier, 'utf8');
        const motif = new RegExp(`("id":\\s*"${id}",[\\s\\S]*?)"image":\\s*"[^"]*"`);
        if (!motif.test(source)) continue;
        fs.writeFileSync(fichier, source.replace(motif, `$1"image": "${chemin}"`));
    }
}

(async () => {
    const recettes = lireRecettes();

    let cibles;
    if (valeur('--ids')) {
        const ids = valeur('--ids').split(',').map((s) => s.trim());
        cibles = recettes.filter((r) => ids.includes(String(r.id)));
    } else if (valeur('--recent')) {
        cibles = recettes.slice(0, parseInt(valeur('--recent'), 10) || 5);
    } else if (valeur('--oldest')) {
        // Le catalogue va du plus récent au plus ancien : les dernières entrées
        // sont les plus vieilles.
        cibles = recettes.slice(-(parseInt(valeur('--oldest'), 10) || 5)).reverse();
    } else if (aOption('--all')) {
        cibles = recettes;
    } else {
        console.error('Précise --ids, --recent N ou --all.');
        process.exit(1);
    }

    /*
     * Une fiche restaurant n'est pas une recette : sa photo montre un lieu, pas
     * une assiette, et elle est gérée par import-restaurant-photos.js. Sur les
     * 25 plus anciennes entrées, 4 sont des restaurants — sans ce filtre, on
     * leur aurait fabriqué une assiette vue de haut qui ne veut rien dire.
     */
    const restaurants = cibles.filter((r) => r.category === 'restaurant').length;
    cibles = cibles.filter((r) => r.category !== 'restaurant');
    if (restaurants) console.log(`${restaurants} fiche(s) restaurant écartée(s).`);

    console.log(`${cibles.length} recette(s) visée(s).\n`);

    /*
     * Rebrancher sans rien produire.
     *
     * mockData est réécrit à chaque synchronisation WordPress, et le champ
     * `image` repart alors vers la photo d'origine. Sans cette commande, il
     * faudrait tout régénérer — et repayer — pour retrouver des pointeurs
     * qu'il suffit de réécrire.
     */
    if (aOption('--relier')) {
        let relies = 0;
        for (const r of recettes) {
            const carte = path.join(DOSSIER, `${r.id}-carte.webp`);
            if (!fs.existsSync(carte)) continue;
            pointerVers(r.id, `/recipes-ia/${r.id}-carte.webp`);
            relies++;
        }
        console.log(`${relies} recette(s) rebranchée(s) sur leur image générée.`);
        return;
    }

    if (aOption('--dry-run')) {
        cibles.forEach((r) => console.log(`— ${r.title}\n  ${consigne(r)}\n`));
        return;
    }

    if (!process.env.FAL_KEY) {
        console.error('FAL_KEY manquante. Ajoute-la dans .env.local (voir fal.ai/dashboard/keys).');
        process.exit(1);
    }

    fs.mkdirSync(DOSSIER, { recursive: true });
    let faites = 0, sautees = 0, ratees = 0;

    for (const r of cibles) {
        const fichier = path.join(DOSSIER, `${r.id}.webp`);
        if (fs.existsSync(fichier) && !aOption('--force')) {
            console.log(`= ${r.title} (déjà générée)`);
            sautees++;
            continue;
        }
        try {
            const buffer = await genererUne(r);
            const poids = [];
            for (const t of TAILLES) {
                const sortie = path.join(DOSSIER, `${r.id}${t.suffixe}.webp`);
                await sharp(buffer)
                    .resize({ width: t.largeur, withoutEnlargement: true })
                    .webp({ quality: t.qualite })
                    .toFile(sortie);
                poids.push(`${t.largeur}px : ${Math.round(fs.statSync(sortie).size / 1024)} ko`);
            }
            // Le site pointe sur la PETITE : c'est elle qui s'affiche trente fois
            // sur l'accueil. La fiche recette ira chercher la grande.
            pointerVers(r.id, `/recipes-ia/${r.id}-carte.webp`);
            console.log(`✓ ${r.title} — ${poids.join(', ')}`);
            faites++;
        } catch (e) {
            console.log(`✗ ${r.title} — ${e.message}`);
            ratees++;
        }
        // On ne bouscule pas l'API : une image à la fois, avec un souffle.
        await new Promise((res) => setTimeout(res, 1200));
    }

    console.log(`\n${faites} générée(s), ${sautees} déjà là, ${ratees} en échec.`);
    if (faites) console.log('Relis les images dans public/recipes-ia avant de pousser.');
})();
