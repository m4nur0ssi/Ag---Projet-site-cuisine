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
 * Fournisseurs, du gratuit au payant
 * ----------------------------------
 * Les fabricants d'image sont essayés DANS L'ORDRE, et on s'arrête au premier
 * qui répond. Par défaut : `cloudflare,fal`.
 *
 *   1. Cloudflare  @cf/black-forest-labs/flux-1-schnell, palier GRATUIT
 *                  (10 000 neurones/jour, très au-dessus de notre rythme).
 *                  Ne rend que du carré 1024 : on recadre au centre en 3:4,
 *                  soit 768 px de large. Clés : CF_ACCOUNT_ID + CF_API_TOKEN.
 *   2. fal.ai      flux-pro/v1.1-ultra, PAYANT (~5 c l'image), 1792 px de large.
 *                  Dernier recours : il ne puise dans les crédits déjà achetés
 *                  que lorsque le gratuit est en panne ou à court de quota.
 *
 * Gemini a été ESSAYÉ et écarté pour l'image, pas par principe : le palier
 * gratuit de gemini-2.5-flash-image annonce noir sur blanc
 * « generate_content_free_tier_requests, limit: 0 ». Générer avec Gemini
 * suppose donc d'activer la facturation, ce qui ne vaut pas mieux que fal.
 * Le code reste là (`--fournisseurs gemini,…`) pour le jour où ce palier
 * s'ouvre, mais il n'est plus dans la chaîne par défaut. Sa VISION, elle,
 * est bien gratuite et sert de deuxième marche — voir `decrireGemini`.
 *
 * Le recours au payant n'est donc jamais un choix : c'est ce qu'il reste quand
 * le gratuit ne répond pas. `--fournisseurs` force l'ordre, `--fal` réserve la
 * génération à fal (retouche ponctuelle en pleine définition).
 *
 * Ce que ça coûte en définition : seul fal dépasse la taille de la fiche
 * recette. Cloudflare couvre la carte (760 px) à sa définition native et est
 * agrandi pour la fiche (1200 px) — voir `redimensionner()`.
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
 *   --manquantes N  les N recettes SANS photo générée, la plus récente d'abord.
 *                 C'est le rattrapage : il ne dépend d'aucun événement, donc
 *                 une recette ratée (NAS muet, quota épuisé, vision en panne)
 *                 est reprise au passage suivant au lieu d'être perdue.
 *                 Se combine avec --ids (l'union des deux est traitée).
 *   --all         tout le catalogue (long : voir --dry-run d'abord)
 *   --dry-run     n'appelle rien, montre seulement les consignes qui partiraient
 *   --force       régénère même si l'image existe déjà
 *   --fournisseurs a,b  ordre des fabricants d'image (défaut cloudflare,fal ;
 *                 « gemini » existe mais suppose la facturation Google activée)
 *   --fal         raccourci pour --fournisseurs fal (pleine définition, payant)
 *   --max-payant N  au plus N images payées par exécution (défaut 5). Garde-fou
 *                 des lancements automatiques : une panne prolongée du gratuit
 *                 ne peut pas vider les crédits fal sans que personne ne voie.
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

/**
 * Écrit une taille. Réduit d'habitude ; agrandit quand il le faut.
 *
 * fal rend 1792 px de large : les deux tailles se taillent dedans. Les deux
 * fournisseurs gratuits rendent 768 à 896 px — de quoi servir la carte à sa
 * définition exacte, mais pas la fiche. On refusait alors d'agrandir
 * (`withoutEnlargement`), et la fiche recevait un fichier de 896 px dans un
 * emplacement de 1200 : c'est le NAVIGATEUR qui l'étirait, avec un filtre
 * bien plus grossier que le nôtre. Autant le faire ici, en lanczos, avec un
 * accentuage léger pour rattraper le flou de l'agrandissement.
 */
async function redimensionner(buffer, largeur, qualite, sortie) {
    const source = await sharp(buffer).metadata();
    let img = sharp(buffer).resize({ width: largeur, kernel: sharp.kernel.lanczos3 });
    // L'accentuage ne se justifie QUE sur un agrandissement : appliqué à une
    // réduction, il fait ressortir le grain du modèle et durcit les bords.
    if (source.width && source.width < largeur) img = img.sharpen({ sigma: 0.7 });
    await img.webp({ quality: qualite }).toFile(sortie);
}

/** Lit .env.local sans dépendance : le script tourne hors de Next. */
function chargerEnv(fichier) {
    if (!fs.existsSync(fichier)) return;
    for (const ligne of fs.readFileSync(fichier, 'utf8').split('\n')) {
        const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
}
chargerEnv(path.join(RACINE, '.env.local'));
// Les clés Gemini du bot vivent dans tiktok-bot/.env — sans ça, la marche
// gratuite serait invisible depuis le Mac et on retomberait sur fal à chaque
// retouche. `.env.local` reste prioritaire (ses identifiants sont les à jour).
chargerEnv(path.join(RACINE, 'tiktok-bot', '.env'));

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
    /*
     * Chèvre rôti au miel : la vision a vu du rose (le speck) et du jaune (le
     * fromage fondu) et en a fait un gratin de pommes de terre au lard. Ce sont
     * des bûchettes ENTIÈRES, chacune roulée dans sa tranche, posées côte à côte.
     */
    [/ch[èe]vre r[ôo]ti au miel/i,
     'a baking dish of {T}: ten individual goat cheese logs, each one wrapped in a single slice of speck, '
     + 'lined up side by side, the cheese softened and golden at the edges, glossy honey drizzled over them '
     + 'and pooling in the dish, a dusting of red Espelette pepper, sprigs of thyme — whole wrapped logs, '
     + 'never a gratin, never sliced potatoes',
     { sansIngredients: true }],
    /*
     * Trois plats que la vision de la vidéo a mal lus (le vert des pâtes pris
     * pour une salade, les pois chiches rôtis pour des croûtons, le beurre pour
     * la viande qu'il accompagne). Leur scène est donc écrite à la main, et on
     * les régénère sans --video pour qu'elle l'emporte.
     */
    [/p[âa]tes? vert|p[âa]tes? [àa] l['’]?[ée]pinard|pesto d['’]?[ée]pinard/i,
     'a bowl of {T}: cooked pasta entirely coated in a vivid bright-green spinach and almond pesto, '
     + 'every strand stained green, glossy with olive oil, shavings of parmesan and toasted almonds on top, '
     + 'a fork twirling a mouthful — pasta only, never a leaf salad'],
    [/salade.*pois chiches?|pois chiches? croustillants?/i,
     'a wide shallow bowl of {T}: plenty of deep golden roasted chickpeas, crisp and paprika-dusted, scattered '
     + 'generously over cucumber rounds, avocado cubes, thin red onion slivers, crumbled white feta, pine nuts and '
     + 'chopped dill — the whole chickpeas clearly the main element, never bread croutons'],
    /*
     * Le tiramisu tombait dans la règle des « petits pots » avec les mousses et
     * les panna cotta, alors que c'est un plat entier qu'on découpe. Les formes
     * dérivées gardent leur propre gabarit : cupcakes, rochers, bûche façon
     * Magnum, version salée — d'où l'exclusion.
     */
    [/^(?=.*tiramisu)(?!.*(?:cupcake|rocher|magnum|sal[ée]))/i,
     'a whole {T} in a rectangular ceramic dish, seen as a sharing dessert: clean stacked layers of soaked '
     + 'ladyfinger biscuits alternating with thick pale mascarpone cream, the surface completely and evenly dusted '
     + 'with dark cocoa powder unless the ingredients call for another topping, one square portion lifted out onto '
     + 'a plate so the layers show along the cut edge — always visibly a tiramisu, a full dish and never small pots'],
    [/tarte.*p[êe]che.*panna ?cotta|panna ?cotta.*p[êe]che/i,
     'a whole round {T} on a board: a dark golden tart shell filled flush with diced peaches set in a rosy jelly, '
     + 'the top covered with piped domes of white panna cotta speckled with vanilla seeds, thin wedges of fresh '
     + 'peach and glossy halved plums tucked between the domes, a mint leaf and a purple flower petal — '
     + 'a flat fruit tart crowded with white cream domes, never a plain custard tart'],
    [/tarte.*fruits rouges|tarte aux? fraises?/i,
     'a whole round {T} on a wooden board: a pale golden shortcrust shell filled flush with a deep crimson berry '
     + 'compote, glossy and smooth, topped with evenly spaced piped domes of white whipped cream alternating with '
     + 'slices of fresh strawberry laid flat and a few whole raspberries — a flat glazed berry tart, '
     + 'never a lattice pie and never whole fruit heaped up'],
    [/poche [àa] douille/i,
     'a cloth piping bag fitted with a fluted steel nozzle, plump with pale cream and twisted closed just above '
     + 'the filling, lying on a marble worktop beside a bowl of the same cream and a few piped rosettes on baking '
     + 'paper — the piping bag itself is the subject of the photograph',
     { sansIngredients: true }],
    [/bagel/i,
     'a {T} on a board: a sesame bagel split in half, its base thickly spread with a chunky cream cheese mixture '
     + 'flecked with dill and chives, layered with folded ribbons of orange smoked salmon, thin cucumber rounds '
     + 'and slivers of red onion, the crown resting tilted against it so the filling shows in section, '
     + 'a lemon wedge alongside'],
    [/croque? ?mc ?do|croque? ?mc ?donald/i,
     'a {T}: two flat burger buns pressed and toasted together like a croque-monsieur, golden and flattened, '
     + 'a thin beef patty and melted orange cheese oozing from the edges, slivers of onion and pickle visible, '
     + 'cut in half diagonally and stacked so the squashed layers show, a smear of burger sauce on the plate — '
     + 'a pressed toasted burger sandwich, never a tall burger and never a fish or salmon filling',
     { sansIngredients: true }],
    [/king fusion|mc ?flurry/i,
     'a clear plastic cup of {T} standing squarely on the table, filled to the brim with thick pale soft-serve '
     + 'ice cream, a dark chocolate-hazelnut spread swirled over the top and running down the inside of the cup, '
     + 'crunchy chocolate crisped pearls scattered over it, a long spoon planted in the middle — the cup resting '
     + 'flat on the surface, never floating or tilted in the air'],
    [/boulettes? de poisson/i,
     'a wide shallow pan of {T}: pale golden fish balls simmering in a bright red tomato sauce, strips of yellow '
     + 'preserved lemon peel and whole dark purple olives tucked between them, chopped coriander and parsley '
     + 'scattered over, a serving spooned onto a plate of plain white rice beside the pan'],
    /*
     * La ligne des ingrédients s'arrête au septième : le lait de coco du
     * cabillaud arrivait en huitième position et la sauce sortait claire. On la
     * décrit donc dans la scène.
     */
    [/(?:cabillaud|poisson|colin|lieu|crevettes?).*lait de coco|lait de coco.*(?:cabillaud|poisson|colin|lieu)/i,
     'pieces of white fish in a wide pan of {T}, bathed in a thick creamy pale coconut sauce — opaque and ivory, '
     + 'clinging to the fish rather than running clear — flecked with red paprika and chopped coriander, '
     + 'a portion served over white rice on a plate beside the pan'],
    [/cabillaud|filets? de morue|dos de morue/i,
     'thick white flaky {T} fillets as the only protein — no prawns, no shrimp, no shellfish anywhere — plated '
     + 'with their sauce spooned over and around them, the flesh just cooked and separating into large moist '
     + 'flakes where a fork has been pressed in, the accompaniments the recipe calls for arranged alongside'],
    [/ktipiti|htipiti|tirokafteri/i,
     'a shallow bowl of {T}: a thick creamy dip of roasted red peppers blended with crumbled white feta, its '
     + 'colour a soft salmon pink flecked with red pepper, swirled with the back of a spoon into ridges holding '
     + 'a pool of olive oil, extra crumbled feta and chopped chives on top, warm pita wedges alongside — '
     + 'a pepper and feta dip, absolutely no prawns and no seafood'],
    [/papillote/i,
     'an opened foil {T} parcel lying flat on a wooden board, its edges folded up into a shallow tray: pale '
     + 'poached white fish fillets, just cooked and never browned or grilled, resting among sliced courgette, '
     + 'halved red and yellow cherry tomatoes and thin rings of spring onion, the cooking juices pooled in the '
     + 'foil, and a thick spoonful of pale garlic aioli set in one corner of the parcel'],
    [/tarte normande/i,
     'a whole {T}: an apple custard tart, thin apple slices arranged in overlapping circles over a set golden '
     + 'custard in a buttery pastry shell, the top caramelised — burnished amber and glossy, the apple edges '
     + 'browned and lightly blistered by the sugar — one wedge cut out and lifted onto a plate'],
    [/p[âa]te [àa] (?:pizza|pain|brioche)|p[âa]te lev[ée]e/i,
     'a single smooth round ball of raw {T} resting on a floured wooden board, its surface soft and slightly '
     + 'domed with a dusting of white flour, a light scatter of flour around it and a folded cloth nearby — '
     + 'raw dough only, never a baked or topped pizza'],
    [/caprese/i,
     'a long rectangular white platter of {T}: a glaze of olive oil and dark pomegranate molasses zigzagged across '
     + 'the plate, a row of thick ripe tomato slices along one side, round slices of white mozzarella down the '
     + 'middle, slices of green avocado laid over them, finely chopped red onion and fresh dill and parsley '
     + 'scattered on top — a flat composed platter, never a tossed bowl of salad leaves, '
     + 'and nothing to drink anywhere in frame: no cup, no mug, no glass'],
    [/adana|kebab hach|k[öo]fte|kefta|lule ?kebab/i,
     'long flat {T} skewers: elongated logs of spiced minced meat pressed onto flat skewers, deep red-orange '
     + 'from paprika and chilli, char-grilled with blackened ridges along their length, laid side by side on a dark '
     + 'slate plate with herbed rice pilaf and a bowl of creamy yoghurt sauce flecked with chilli — long skewers, '
     + 'never round patties and never a burger'],
    [/smashed potato|pommes? de terre [ée]cras[ée]es?/i,
     'a plate of {T}: whole small potatoes smashed flat under a press so their skins split open and the fluffy '
     + 'insides burst out at the ragged torn edges, roasted until those shaggy edges are dark golden brown and '
     + 'blistered crisp while the centres stay soft, each one a different broken shape with cracks and craters '
     + 'across its surface, glossy with garlic-parsley-chilli oil and dusted with grated parmesan — smashed broken '
     + 'potatoes with torn frilly edges, never smooth round slices, never neat cubes or wedges'],
    [/poireaux? (?:confits?|gratin[ée]s?|[àa] la cr[èe]me)/i,
     'a rectangular white ceramic baking dish of {T}: short thick leek segments packed tightly side by side, '
     + 'their tops deeply caramelised golden-brown and gratinated under melted cheese, sitting in a pale ivory '
     + 'cream sauce that pools around them, scattered with chopped parsley, one segment lifted out on a spoon '
     + 'showing its soft pale-green layers — a creamy baked leek gratin, never a brown gravy and never a stew'],
    [/beurre persill|beurre (?:[àa] l['’]?ail|ma[îi]tre d['’]?h[ôo]tel|aux? herbes)/i,
     'a chilled log of {T}: soft yellow butter densely packed with bright green chopped parsley — vivid green '
     + 'herb specks visible everywhere through the butter, green all the way through, never plain pale butter — '
     + 'sliced into thick round discs on a small plate, one disc melting golden over a thick grilled red beef steak '
     + 'resting beside it on a board, the herb-green butter the clear subject in the foreground and the meat behind it',
     { sansIngredients: true }],
    [/flan\b|cr[èe]me caramel|cr[èe]me renvers[ée]e/i,
     'a whole {T}, a silky smooth unmoulded caramel custard turned out onto a plate, glossy amber caramel '
     + 'running down its sides and pooling around the base, one clean wedge sliced out to show the tender set '
     + 'custard, no crust and no pastry, a spoon resting nearby'],
    [/cr[èe]mes? dessert|\bmousse\b|pot de cr[èe]me|panna ?cotta|pudding|cr[èe]me chocolat|tiramisu|yaourt|fromage blanc/i,
     'several individual small glass pots and ramekins of {T}, smooth glossy spoonable surface, '
     + 'one topped with a garnish, a small spoon dipping into one pot, no cutting and no slices, '
     + 'the pots grouped together and all standing flat on the surface — never floating or tipped in mid-air — '
     + 'with the ingredients scattered loosely around'],
    [/hachis parmentier|\bparmentier\b/i,
     'a baked {T} in a white oven dish, a smooth mashed-potato crust with fork-drawn ridges browned golden on top, '
     + 'a generous corner portion scooped out to reveal the layer of rich minced beef underneath, '
     + 'the scooped serving on a plate nearby'],
    [/\bcalzones?\b/i,
     'folded half-moon calzone pizza pockets of {T}, puffed golden baked dough with a crimped sealed edge, '
     + 'one cut across so the melted cheese and filling spill out and stretch, a little tomato sauce alongside'],
    [/\bcouronne\b/i,
     'a large ring-shaped (crown) tart of {T} with a hollow open centre, a golden pastry ring topped all the way '
     + 'around its circumference with the garnish, seen from directly above so the empty middle is clearly visible, '
     + 'presented whole on a round wooden board'],
    [/\baray[eè]s?\b|pita farci|pain pita.*farci/i,
     'wedges of Lebanese arayes — flat pita bread stuffed with spiced minced meat and pine nuts, '
     + 'pan-grilled until the bread is crisp and golden, cut into triangles with the meat filling '
     + 'clearly visible along the cut edge, a small bowl of tzatziki or yoghurt dip and fresh mint alongside'],
    [/samboussek|sambousek|samosas?|b[öo]rek|beignets? (de|[àa] la|au|aux) viande|chaussons? [àa] la viande|empanadas?/i,
     'a generous pile of golden deep-fried stuffed pastry parcels of {T}, half-moon and triangle shapes, '
     + 'crisp blistered golden crust, one broken open to reveal the spiced minced-meat filling steaming inside, '
     + 'a small bowl of dipping sauce and fresh herbs alongside'],
    // ── Pâtisserie / formes précises ────────────────────────────────────────
    [/torta della nonna/i,
     'a whole Torta della Nonna, a pale golden custard-filled shortcrust tart, its surface entirely covered '
     + 'with toasted pine nuts and dusted with icing sugar, one wedge cut to show the thick vanilla custard layer'],
    [/layer cake|g[âa]teau.*[ée]tages?/i,
     'a tall {T} shown from a slightly raised angle, several sponge layers stacked with cream and fruit between '
     + 'each, the sides visible, one thick slice removed and laid on its side so the distinct layers show clearly'],
    [/sp[ée]culoos|mascarpone/i,
     'a chilled layered {T} scooped from a dish, alternating creamy mascarpone layers and biscuit/speculoos layers '
     + 'clearly visible in cross-section, red berries on top, a spoonful lifted onto a plate, no baked crust'],
    [/g[âa]teau roul|roul[ée].*l[ée]opard|swiss roll|b[ûu]che/i,
     'a rolled sponge cake (Swiss roll) of {T} on a board, several round slices cut and laid flat to reveal the '
     + 'spiral cross-section of sponge and cream filling, the whole roll behind them'],
    [/tartelettes?\b/i,
     'several individual round tartlets of {T} with crisp fluted pastry shells, each neatly filled and topped, '
     + 'arranged in a loose group, no single large tart and no baking dish'],
    [/cupcakes?\b/i,
     'a batch of individual cupcakes of {T} in paper liners, each with a generous swirl of topping, '
     + 'arranged in a loose group, one unwrapped to show the crumb'],
    [/feuillet[ée]/i,
     'several individual golden puff-pastry {T}, flaky layered pastry parcels/twists, crisp and glossy, '
     + 'piled loosely, one broken open to show the melting filling, no large dish and no cake'],
    [/phyllo|filo|roul[ée]s? .*[ée]pinard|b[öo]rek aux? [ée]pinard/i,
     'a pile of crisp golden phyllo rolls (cigars) of {T}, thin flaky pastry rolled around the filling, '
     + 'one cut across to show the spinach-and-cheese filling inside, sesame scattered, a yoghurt dip alongside'],
    // ── Pains plats ─────────────────────────────────────────────────────────
    [/flammekueche|tarte flamb/i,
     'a very thin rectangular Alsatian flammekueche on baking paper, crisp cracker-thin base topped with white '
     + 'crème fraîche, thin onion slices and lardons, cut into rectangles, one piece lifted'],
    [/fougasse/i,
     'a flat leaf-shaped fougasse bread with the characteristic diagonal cut slits opened into a ladder/leaf '
     + 'pattern, golden crust brushed with oil and herbs, torn at one end, on a wooden board'],
    // ── Apéritif / tartines / fritures ──────────────────────────────────────
    [/\bcrostoni\b|\bcrostini\b|bruschett/i,
     'several separate slices of toasted crusty bread ({T}), each slice open-face with the topping piled on top, '
     + 'arranged in a row on a board, clearly individual toasts and not a bake or gratin'],
    [/\btartines?\b|\btoasts?\b/i,
     'several open-face {T}: individual slices of toasted bread, each spread and generously topped, arranged in a '
     + 'row, the toppings fresh and clearly visible, never a baked dish or gratin'],
    [/\bchips\b/i,
     'a loose heap of thin crispy vegetable chips ({T}), wafer-thin translucent rounds in different colours, '
     + 'piled in a bowl and scattered around, light and crisp, not roasted chunks'],
    [/tempura/i,
     'a neat arrangement of individual tempura {T}: each separate vegetable piece (a courgette baton, a carrot '
     + 'stick, a pepper strip, a green bean) coated in its own thin pale lacy tempura batter, distinct and '
     + 'recognizable, light and crisp, laid out in a row on paper with a small bowl of dipping sauce — the pieces '
     + 'are clearly separate, never clumped together, never popcorn-like balls, never a bake'],
    [/focaccia/i,
     'a thick rectangular focaccia bread of {T} on a baking tray, the surface covered in characteristic finger '
     + 'dimples pooled with glossy olive oil, scattered with rosemary sprigs, coarse sea salt and a few olives '
     + 'and cherry tomatoes pressed in, golden airy crumb, cut into a few squares, one lifted'],
    [/grenailles?|pommes? de terre.*(parmesan|gruy[èe]re|four)|patates? .*r[ôo]ti/i,
     'a dish of roasted baby potatoes (grenailles) of {T}, halved with crisp golden-brown cut faces, tossed with '
     + 'melted stringy gruyère and grated parmesan and herbs, some crispy edges, served in a roasting dish'],
    [/rillettes?\b/i,
     'a bowl of {T}, a soft rustic spread/pâté with a rough forked texture, a spreading knife resting on the rim, '
     + 'slices of toasted bread and lemon alongside, no stew and no chunks'],
    // ── Salades fraîches / soupes froides ───────────────────────────────────
    [/taboul|tabboul/i,
     'a fresh {T} in a shallow bowl, mostly bright green finely chopped parsley and mint with bulgur, diced tomato '
     + 'and onion, raw and glistening, a wedge of lemon on the side, a cold uncooked herb salad'],
    [/\bsalade\b/i,
     'a fresh colourful {T} loosely tossed in a wide shallow bowl, raw crisp ingredients clearly identifiable and '
     + 'vibrant, glossy dressing, a cold salad — never baked, never in an oven dish'],
    [/gaspacho.*(concombre|courgette|vert|avocat)|(concombre|courgette).*gaspacho/i,
     'a chilled bowl of smooth PALE GREEN cucumber gazpacho, cold and creamy green, a swirl on the surface, '
     + 'a drizzle of olive oil, cubes of white feta and fresh mint leaves scattered on top, clearly a cold green soup'],
    [/gaspacho|gazpacho/i,
     'a chilled bowl of cold {T} soup, smooth and served cold with ice implied, a swirl of the soup, a drizzle of '
     + 'olive oil and a small garnish on top, the colour taken from its vegetables, clearly a cold soup'],
    // ── Plats salés spécifiques ─────────────────────────────────────────────
    [/houmous.*(lahm|viande|meat)|bil ?lahm/i,
     'a wide plate of smooth hummus spread in a swirl, generously topped in the centre with spiced sautéed minced '
     + 'meat and toasted pine nuts, olive oil and paprika, warm flatbread torn alongside'],
    [/saumon croustillant|crispy salmon|saumon.*croustill/i,
     'crispy-skinned salmon fillets, golden lacquered crust on top, flaked open at one corner to show the pink '
     + 'tender flesh, a swoosh of spicy mayonnaise and sesame/spring onion, on a plate'],
    [/k[ée]fta|kefta/i,
     'a tagine of {T}: rounded meatballs (vegetarian kefta) nestled in a rich red tomato sauce with eggs cracked '
     + 'and set on top, fresh coriander, the conical tagine lid set aside, seen from above'],
    [/champis? de la flemme|champignons? farcis|stuffed mushrooms?/i,
     'a tray of individual stuffed mushroom caps ({T}): whole round mushroom caps each filled with a creamy '
     + 'ham-and-chive filling, topped with melted golden gratinéed cheese, browned on top, arranged side by side, '
     + 'fresh chives scattered — clearly distinct stuffed caps, never a bake or a chunky sauté'],
    [/c[ôo]tes? de porc|c[ôo]telettes? de porc|pork chops?/i,
     'several thick bone-in pork chops of {T}, each a clearly recognizable pork chop with the visible rib bone, '
     + 'seared golden-brown on the surface, arranged in a pan/dish with the garlic-herb pan sauce spooned over, '
     + 'fresh herbs on top — distinct whole chops, never shredded or diced meat'],
    [/travers\b|spare ?ribs|\bribs\b|gochujang/i,
     'a pile of sticky glazed {T} ribs, deep-brown lacquered caramelised glaze clinging to the meat, sesame and '
     + 'sliced spring onion scattered over, one rib pulled slightly aside, on a dark tray'],
    [/[ée]paule d.?agneau|souris d.?agneau|gigot|agneau.*chef/i,
     'a slow-roasted lamb shoulder on a serving platter, deeply browned and glistening, so tender the meat is '
     + 'pulling away from the bone, some pulled apart with two forks, roasting juices and herbs around it'],
    [/pancakes?.*(jambon|fromage|ham|cheese)|(jambon|fromage).*pancakes?/i,
     'a short stack of small round golden savoury pancakes of {T}, one stack cut through to reveal a filling of '
     + 'ham and melting cheese, arranged on a plate, individual fluffy pancakes and not a single large cake'],
    [/pancakes?\b/i,
     'a tall stack of round fluffy American pancakes of {T}, golden and soft, drizzled with syrup, a knob of butter '
     + 'melting on top and fresh berries around, a sweet breakfast stack — never a single large cake'],
    // ── Soupes / veloutés (bols, jamais gratins) ────────────────────────────
    [/\bsoupe\b|velout[ée]|potage|\bbisque\b|\bpho\b|minestrone/i,
     'a bowl of {T}, clearly a soup — liquid broth or smooth pureed soup filling a deep bowl, a swirl of cream and '
     + 'a garnish on top, a spoon resting in it, steam implied, served in a bowl and never baked in a dish'],
    // ── Glaces / sorbets (boules en coupe) ──────────────────────────────────
    [/sorbet|\bglace\b|granit[ée]|cr[èe]me glac/i,
     'rounded scoops of {T} sorbet/ice cream in a chilled coupe glass or bowl, smooth frozen balls, slightly melting, '
     + 'a few pieces of the flavouring fruit alongside, clearly a cold frozen dessert and never a baked custard'],
    // ── Pâtisseries à forme précise ─────────────────────────────────────────
    [/cr[êe]pes?\b/i,
     'a stack of thin flat French crêpes of {T}, very thin pale golden pancakes folded into quarters or loosely '
     + 'rolled, one folded triangle in front, a light dusting or filling visible, never a thick soufflé or bake'],
    [/cannel[ée]s?\b/i,
     'several individual Bordeaux cannelés of {T}, small fluted cylindrical cakes with a dark caramelised mahogany '
     + 'crust and pale custardy interior, arranged in a group, one cut to show the soft inside'],
    [/paris-?brest/i,
     'a Paris-Brest of {T}: a ring of choux pastry split horizontally and filled with piped praline cream, the top '
     + 'scattered with flaked almonds and dusted with icing sugar, one portion cut'],
    [/g[âa]teau.*mousse|mousse.*g[âa]teau/i,
     'a tall sliceable {T} mousse cake on a plate, a smooth set chocolate mousse layer on a thin base, one clean '
     + 'wedge cut and lifted to show the airy mousse texture, glossy top — a cake, not pots'],
    [/\bfraisier\b/i,
     'a Fraisier cake of {T}: a layered sponge-and-crème-mousseline cake with halved strawberries lined up cut-side '
     + 'out all around the visible sides, a smooth top, one slice removed to show the neat layers'],
    [/bomboloni|beignets? fourr[ée]s?|malasada/i,
     'a pile of round Italian bomboloni of {T}, golden deep-fried sugar-coated doughnuts, one cut open to show the '
     + 'cream/custard filling oozing, dusted with sugar'],
    [/bouch[ée]es? glac|glac[ée]es?\b/i,
     'small individual frozen {T} bites on a chilled plate, little frozen bonbons/squares with a chocolate coating, '
     + 'one bitten to show the frozen layers, frost implied — a cold frozen treat, never a baked cake'],
    [/dans des citrons|cr[èe]me.*citron.*citron|citrons? givr/i,
     'hollowed-out lemon halves filled with smooth lemon cream, arranged on a plate with mint, the fruit shells used '
     + 'as cups — clearly citrus filled with cream, never a bake'],
    [/bambas?\b/i,
     'a plate of Portuguese bambas de nata: round sugar-dusted fried cream buns, one split to show the pale custard '
     + 'cream inside, golden and soft'],
    // ── Fritures / roulés / bricks ──────────────────────────────────────────
    [/\bnems?\b|rouleaux de printemps|spring rolls?|rouleaux imp[ée]riaux/i,
     'a generous mounded pile of deep-fried Vietnamese nems (fried spring rolls) of {T} stacked like a pyramid on a '
     + 'white plate, each a thick finger-length roll with a deep golden-brown BLISTERED bubbly crackly fried wrapper '
     + '(clearly deep-fried pastry rolls, NOT pasta and NOT smooth tubes), one broken open to show the savoury '
     + 'filling, a small bowl of dipping sauce and fresh herbs and lettuce leaves alongside'],
    [/\bbrick\b|bricks?\b|\bb[öo]rek\b/i,
     'crisp golden fried brick pastry parcels of {T}, thin shatteringly-crisp filo triangles/cigars, one broken open '
     + 'to reveal the filling, a lemon wedge and dip alongside — never a stew or a bowl of rice'],
    [/frites? d.?avocat|avocado fries/i,
     'a pile of avocado fries of {T}: wedges of avocado in a crisp golden breadcrumb coating, one broken to show the '
     + 'creamy green avocado inside, a dip alongside — never potato fries'],
    [/r[öo]sti|rosti/i,
     'a golden crisp grated-potato rösti of {T}, a flat round pan-fried potato cake with lacy crisp edges, cut into '
     + 'wedges, the topping (smoked salmon and cream) laid over it'],
    [/bao\b|bao buns?/i,
     'soft white steamed bao buns of {T}, pillowy folded white steamed buns (not golden or baked), each holding a '
     + 'glazed filling, arranged on parchment in a steamer basket, one open to show the filling'],
    [/\bchoux\b|profiterole|[ée]clair/i,
     'several individual round choux pastry puffs of {T}, light golden hollow puffs filled with cream, some topped '
     + 'with caramel or icing, one cut open to show the cream — round cream puffs, never a flan or slab'],
    // ── Sushi / makis ───────────────────────────────────────────────────────
    [/makis?\b|sushi|maki\b/i,
     'neat rounds of maki sushi of {T}, cylindrical rolls sliced into rounds standing cut-side up to show the rice '
     + 'and filling spiral, arranged in a row with soy sauce, ginger and wasabi alongside'],
    // ── Desserts régionaux / techniques ─────────────────────────────────────
    [/li[ée]geois/i,
     'a tall glass of {T} liégeois: layers of cream/ice and sauce in a clear glass topped with a swirl of whipped '
     + 'cream, seen straight-on, clearly a layered dessert in a glass'],
    [/duchesse/i,
     'a tray of pommes duchesse of {T}: individual piped rosettes/swirls of mashed potato baked golden and crisp at '
     + 'the edges, arranged in neat rows, distinct piped shapes and never a gratin'],
    [/tapioca/i,
     'a bowl of {T}: creamy white tapioca pudding, small translucent pearls in milk, smooth and soft, a spoon in it, '
     + 'a light garnish — never a cheesy bake'],
    [/crumble|cumble/i,
     'a {T} in a baking dish topped with a generous golden crumbly streusel topping, one portion scooped out to show '
     + 'the soft fruit underneath, a scoop of the crumble on a plate — the crumbly topping clearly visible'],
    [/scarpaccia/i,
     'a very thin flat Tuscan scarpaccia of {T}, a wafer-thin savoury zucchini tart/cake baked crisp and golden with '
     + 'thin courgette slices covering the top, cut into squares'],
    [/coupelles?|banane plantain|plantain/i,
     'small fried plantain cups of {T}, little golden cup-shaped fried plantain shells holding a filling, arranged in '
     + 'a group on a plate'],
    // ── Cuisine du monde (orientale / méditerranéenne) ──────────────────────
    [/tzatziki/i,
     'a bowl of tzatziki: thick white yoghurt-and-cucumber dip, smooth and creamy, drizzled with olive oil, a few '
     + 'cucumber slices and mint on top, warm pita bread alongside — a cold white dip, never a bake'],
    [/dolma|feuilles? de vigne|yaprak/i,
     'a plate of dolma: neat little rolled stuffed vine leaves of {T}, tight dark-green cylinders arranged in rows, '
     + 'lemon wedges and a yoghurt dip alongside, one cut to show the rice-and-herb filling'],
    [/shish taouk|chich taouk|\btaouk\b/i,
     'grilled shish taouk chicken skewers of {T}: cubes of marinated chicken chargrilled with golden edges threaded '
     + 'on skewers, garlic sauce and grilled vegetables alongside, fresh and off the grill'],
    [/koobideh|kefta.*kebab|kebab koobideh|brochettes? de viande hach/i,
     'long koobideh kebabs of {T}: elongated skewers of chargrilled seasoned minced meat, slightly charred, served '
     + 'with saffron rice or Shirazi salad and grilled tomato alongside'],
    [/\bfalafel/i,
     'a pile of falafel of {T}: small deep-fried chickpea balls, craggy golden-brown crust and green herby interior '
     + '(one broken open to show it), with tahini sauce, pita and fresh salad alongside'],
    [/kessra|kesra|galette.*semoule|khobz/i,
     'a round flat Algerian semolina flatbread (kesra) of {T}, golden and rustic, torn or cut into wedges to show it '
     + 'is stuffed with a spiced filling, on a wooden board — a flatbread, never a creamy bake'],
    [/madras|\bcurry\b|massaman|korma|tikka masala/i,
     'a bowl of {T} curry: tender pieces in a rich glossy spiced sauce, fresh coriander on top, fluffy white rice '
     + 'served alongside, warm and saucy — clearly a curry in a bowl with rice'],
    [/chermoula|sauce verte|salsa verde/i,
     'a small bowl of {T}: a vibrant green herb sauce, loose and glistening with olive oil, flecks of herbs and '
     + 'garlic visible, a spoon lifting some — clearly a fresh green sauce in a bowl, never a bake'],
    [/casatiello/i,
     'a Neapolitan casatiello: a golden ring-shaped savoury bread of {T} studded with cubes of salami and cheese and '
     + 'whole eggs pressed into the dough around the ring, one wedge cut'],
    [/\bramen\b/i,
     'a deep bowl of {T} ramen: wheat noodles in a rich broth, topped with sliced meat, a soft halved egg, spring '
     + 'onion and nori, chopsticks resting on the bowl — a brothy noodle soup, never a dry bake'],
    [/omurice|omelette.*riz/i,
     'a plate of omurice: a smooth golden omelette blanket draped over a mound of fried rice, a stripe of ketchup on '
     + 'top, a spoon at the side — clearly an omelette-wrapped rice, never a stew'],
    [/salade c[ée]sar|caesar/i,
     'a Caesar salad of {T}: crisp romaine lettuce leaves tossed with creamy dressing, golden croutons, shaved '
     + 'parmesan and black pepper, in a wide bowl — fresh crisp salad with visible croutons and parmesan'],
    [/char ?si[uo]|char ?sui|char ?siew|char ?sio|charsiu/i,
     'sliced char siu pork of {T}: glossy lacquered deep-red BBQ pork, sliced into strips showing the pink centre and '
     + 'caramelised edges, over or beside steamed white rice, spring onion and sesame — never diced cubes'],
    [/stea?ck? hach[ée]|steak hach|beef patty|steak farci/i,
     'a thick juicy beef patty of {T} on a plate, seared brown, cut open so melting cheese oozes from the centre, a '
     + 'little sauce and garnish alongside — a single stuffed beef patty, never diced or a bake'],
    [/poire farcie|pomme farcie|fruits? farcis?/i,
     'halved {T}: fruit halves hollowed and stuffed with a savoury filling, baked until golden, arranged cut-side up '
     + 'on a plate so the filling shows, never a gratin of slices'],
];

/**
 * La scène spéciale imposée par le titre, s'il y en a une.
 *
 * Certaines recettes traînent les ingrédients d'une AUTRE recette dans leur
 * fiche WordPress (le beurre persillé embarque farine, semoule et levure d'un
 * pain) : la ligne « The dish is made of… » y ferait dessiner du pain à côté du
 * beurre. Une scène peut donc demander qu'on la supprime.
 */
function sceneSpeciale(titre) {
    for (const [motif, description, options] of SCENES_SPECIALES) {
        if (motif.test(titre || '')) return { texte: description, ...options };
    }
    return null;
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

/**
 * Angle de prise de vue. Tout était en flat-lay vu du dessus → monotone. On
 * garde ~70 % vu du dessus et ~30 % réparti sur des angles « livre de cuisine »
 * (3/4 rapproché, de face à hauteur d'assiette, gros plan macro). Choisi par
 * hash de l'id → stable et réparti. Ne s'applique pas aux boissons (déjà de face).
 * `lead` s'insère dans la phrase de scène ; `opener` et `camera` encadrent le prompt.
 */
const VUE_DESSUS = {
    opener: 'Overhead flat-lay food photography, styled editorial cookbook shot.',
    lead: 'seen from directly above',
    camera: 'Camera directly overhead at 90 degrees, everything sharp, natural colours, generous negative space, an abundant but tidy arrangement.',
};
const VUES = [
    VUE_DESSUS, VUE_DESSUS, VUE_DESSUS, VUE_DESSUS, VUE_DESSUS, VUE_DESSUS, VUE_DESSUS, // 7/10 = 70 %
    {
        opener: 'Three-quarter 45-degree food photography, styled editorial cookbook shot.',
        lead: 'seen from a low 45-degree three-quarter angle',
        camera: 'Camera at a 45-degree three-quarter angle, close and intimate, shallow depth of field with a softly blurred background, natural colours.',
    },
    {
        opener: 'Straight-on eye-level food photography, styled editorial cookbook shot.',
        lead: 'seen straight-on at eye level',
        camera: 'Camera at table height, straight-on eye-level view, the dish sharp and the background gently blurred, natural colours.',
    },
    {
        opener: 'Close-up macro food photography, styled editorial cookbook shot.',
        lead: 'in a tight close-up crop that fills the frame',
        camera: 'Camera very close for a tight macro crop, the food filling the frame, very shallow depth of field, natural colours.',
    },
];
const capitale = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function consigne(recette, descPlat) {
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
    // Angle de prise de vue (70 % dessus / 30 % autres), stable par id.
    const vue = tirage(VUES, id, 67);

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
        // Description tirée de la vraie vidéo (--video) : prioritaire, elle
        // remplace la devinette par titre. On garde l'angle et le style éditorial.
        : descPlat
        ? `${capitale(vue.lead)}: ${recette.title} — ${descPlat}`
        : speciale
        ? `${capitale(vue.lead)}: ${speciale.texte.replace(/\{T\}/g, recette.title)}.`
        : [
            `A dish of ${recette.title} ${vue.lead}, already cut into,`,
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
            : vue.opener,
        scene,
        ingredients && !(speciale && speciale.sansIngredients)
            ? `The dish is made of: ${ingredients}.` : '',
        boisson ? '' : cadrage,
        `Surface: ${table}. Tableware: ${vaisselle}. ${couverts}.`,
        // Dit explicitement : sans ça, un plat brun sur bois brun se noie.
        boisson ? '' : 'Strong tonal separation between the food and the surface beneath it.',
        `Lighting: ${lumiere}. ${palette}`,
        boisson
            ? 'Camera at glass height, straight-on eye-level view, the glass sharp and the background softly blurred, natural colours.'
            : vue.camera,
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

// ────────────────────────────────────────────────────────────────────────────
// Référence VIDÉO : au lieu de deviner le plat depuis le titre, on regarde la
// vidéo TikTok de la recette (frames de l'accroche puis de la fin, là où le plat
// fini se montre), on la décrit via la vision, et on injecte cette description
// dans le prompt. Active par --video.
// ────────────────────────────────────────────────────────────────────────────
const { execSync } = require('child_process');
const os = require('os');
const BIN = '/opt/homebrew/bin'; // yt-dlp + ffmpeg (brew)
/**
 * Modèles de vision Groq, essayés dans l'ordre.
 *
 * Groq retire ses modèles sans prévenir (llama-3.3-70b a disparu du jour au
 * lendemain et a emporté /api/wine-pairing avec lui). Un seul nom en dur, et
 * la marche gratuite du pipeline tombe le jour du retrait. On en garde donc
 * plusieurs : un 404 / « decommissioned » fait passer au suivant.
 */
const GROQ_VISIONS = (process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b,meta-llama/llama-4-scout-17b-16e-instruct,meta-llama/llama-4-maverick-17b-128e-instruct')
    .split(',').map((s) => s.trim()).filter(Boolean);

/** Id TikTok depuis le champ videoHtml de la recette. */
function videoIdDe(recette) {
    const h = recette.videoHtml || '';
    const m = h.match(/data-video-id="(\d+)"/) || h.match(/tiktok\.com\/(?:v|@[^/]+\/video)\/(\d+)/);
    return m ? m[1] : null;
}

/** Télécharge la vidéo + extrait des frames (4 premières secondes, puis fin), réduites à 448px. */
function framesDeLaVideo(id, dossier) {
    const env = { ...process.env, PATH: `${BIN}:${process.env.PATH}` };
    const mp4 = path.join(dossier, 'v.mp4');
    execSync(`yt-dlp --no-warnings -o ${JSON.stringify(mp4)} "https://www.tiktok.com/@t/video/${id}"`,
        { env, stdio: 'ignore', timeout: 90000 });
    const dur = parseFloat(execSync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(mp4)}`,
        { env }).toString().trim()) || 10;
    /*
     * Les QUATRE PREMIÈRES SECONDES d'abord, puis la fin.
     *
     * On ne regardait que le dernier tiers. Or l'accroche TikTok ouvre presque
     * toujours sur le plat fini, tandis que la fin part souvent ailleurs : le
     * kebab adana terminait sur sa salade d'accompagnement et sa sauce yaourt,
     * d'où des galettes de viande hachée à la place des brochettes ; les smashed
     * potatoes montraient leur assiette dès la première seconde. Les frames du
     * début passent donc en tête. Quand la vidéo commence sur des ingrédients
     * crus ou un visage, la vision répond NONE et on retombe sur la fin.
     */
    // On lit les 4 PREMIÈRES et les 4 DERNIÈRES secondes de la vidéo : le plat fini
    // apparaît presque toujours dans l'une des deux. Le début passe en tête (souvent
    // un plan du plat dès l'ouverture) ; sinon la vision répond NONE et on prend la fin.
    const temps = [
        0.4, 1.4, 2.4, 3.4,                                  // 4 premières secondes
        Math.max(0, dur - 0.3), dur - 1.3, dur - 2.3, dur - 3.3, // 4 dernières secondes
    ].filter((t) => t >= 0 && t < dur);
    const frames = [];
    temps.forEach((t, i) => {
        const out = path.join(dossier, `f${i}.jpg`);
        try {
            execSync(`ffmpeg -loglevel error -ss ${t.toFixed(2)} -i ${JSON.stringify(mp4)} -frames:v 1 -vf scale=448:-1 ${JSON.stringify(out)} -y`,
                { env, timeout: 30000 });
            if (fs.existsSync(out)) frames.push(out);
        } catch { /* frame ratée, on continue */ }
    });
    return frames;
}

/** Décrit le plat fini via Groq vision. Renvoie une phrase EN, ou null. */
async function decrirePlat(recette, frames) {
    if (!process.env.GROQ_API_KEY || !frames.length) return null;
    const contenu = [{
        type: 'text',
        text: `These are frames from the opening and the end of a cooking video for a recipe titled "${recette.title}". `
            + `Describe ONLY the finished, plated dish as it should look for an editorial food photo: `
            + `its exact form/shape, colours, the key visible components, how it is plated and the vessel/plate. `
            + `Answer directly with one or two concise English sentences and nothing else — no reasoning, no preamble. `
            + `Do NOT mention camera, background, hands, on-screen text or people. `
            + `If no finished dish is clearly visible in any frame, reply exactly: NONE`,
    }];
    for (const f of frames) {
        contenu.push({
            type: 'image_url',
            image_url: { url: 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64') },
        });
    }
    const headers = {
        authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'content-type': 'application/json',
        // Sans un User-Agent de navigateur, Cloudflare renvoie 403/1010.
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    };
    // Un modèle retiré répond 404/400 : on n'insiste pas, on prend le suivant.
    for (const modele of GROQ_VISIONS) {
        /*
         * 900, et pas un de plus — la valeur est coincée entre deux murs.
         *
         * En dessous : qwen réfléchit dans un bloc <think>…</think> AVANT de
         * répondre, et ce bloc compte dans le budget. À 700 la réflexion en
         * mangeait l'essentiel ; sur « Vitello Tonnato » il restait de quoi
         * écrire « The Vitello Tonnato is presented in a deep blue bowl, » —
         * une demi-phrase, renvoyée telle quelle au fabricant d'image, qui
         * inventait le reste du plat. Rien ne le signalait : la description
         * était non vide, donc jugée bonne. Une mesure réelle donne ~400 tokens
         * de sortie, réflexion comprise.
         *
         * Au-dessus : le palier gratuit de Groq plafonne la SORTIE à 1000
         * tokens par minute, et il refuse la requête sur la seule valeur de
         * max_tokens, avant même de la traiter — « Limit 1000, Requested 2380 ».
         * Demander large ne coûte donc pas cher : ça ne marche pas du tout.
         *
         * En plus du budget, on REFUSE une réponse coupée (finish_reason
         * « length ») au lieu de la prendre pour argent comptant.
         */
        const body = JSON.stringify({
            model: modele,
            messages: [{ role: 'user', content: contenu }],
            max_tokens: 900,
            temperature: 0.2,
        });
        try {
            let rep, corpsErreur = '';
            // Free tier Groq = 8000 tokens/min : on encaisse les 429 en attendant le
            // délai indiqué, jusqu'à 4 essais.
            for (let essai = 1; essai <= 4; essai++) {
                const c = new AbortController();
                const t = setTimeout(() => c.abort(), 60000);
                rep = await fetch('https://api.groq.com/openai/v1/chat/completions',
                    { method: 'POST', headers, body, signal: c.signal }).finally(() => clearTimeout(t));
                if (rep.ok) break;
                corpsErreur = (await rep.text());
                if (rep.status !== 429 || essai === 4) break;
                const m = corpsErreur.match(/try again in ([\d.]+)s/i);
                const attente = m ? Math.ceil(parseFloat(m[1]) * 1000) + 800 : 12000;
                await new Promise((res) => setTimeout(res, attente));
            }
            if (!rep.ok) {
                // Modèle disparu du catalogue → on essaie le suivant de la liste.
                if (/decommission|does not exist|not found/i.test(corpsErreur) || rep.status === 404) continue;
                return null;    // quota, clé, panne : les autres modèles n'y changeront rien
            }
            const data = await rep.json();
            const choix = data?.choices?.[0];
            let txt = choix?.message?.content || '';
            // qwen émet un bloc <think>…</think> : on garde ce qui suit le dernier.
            if (/<\/think>/i.test(txt)) txt = txt.split(/<\/think>/i).pop();
            else if (/<think>/i.test(txt)) txt = ''; // n'a fait que réfléchir (tronqué)
            txt = txt.replace(/<\/?think>/gi, '').trim();
            // Réponse coupée au plafond de tokens : c'est un bout de phrase, pas
            // une description. On rend la main au fournisseur suivant.
            if (choix?.finish_reason === 'length') return null;
            if (!txt || /^none\b/i.test(txt) || txt.length < 15) return null;
            return txt.replace(/\s+/g, ' ').slice(0, 500);
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Vision de secours via fal (pas de quota journalier contrairement à Groq gratuit).
 * fal-ai/any-llm/vision + gemini-flash accepte une data URI directement.
 */
async function decrireFal(recette, frames) {
    if (!process.env.FAL_KEY || !frames.length) return null;
    /*
     * Le prompt écartait toute frame contenant une personne ou du texte incrusté.
     * Or c'est la norme sur TikTok : le plat fini est presque toujours montré à
     * bout de bras, sous un sous-titre. Le modèle répondait donc NONE alors que
     * l'assiette était parfaitement visible. On lui demande maintenant d'ignorer
     * le décor et de ne renoncer que si AUCUN plat fini n'apparaît.
     */
    const prompt = `This is a still frame from a cooking video for a recipe titled "${recette.title}". `
        + `If the finished dish is visible ANYWHERE in the frame — including held in someone's hands, `
        + `partly covered by on-screen text, or standing next to a person — describe ONLY that dish for an `
        + `editorial food photo: its exact form/shape, colours, the key visible components, how it is served and `
        + `the vessel/plate/glass — one or two concise English sentences. Ignore and never mention the camera, `
        + `background, hands, on-screen text or people. `
        + `Reply exactly NONE only if no finished dish appears at all (raw ingredients, mid-cooking, `
        + `an empty pan, a talking head or plain text only).`;
    /*
     * Un refus de fal n'est PAS un « la vidéo ne montre pas le plat ».
     *
     * La première version passait à la frame suivante dès que l'appel échouait,
     * sans distinguer un vrai NONE d'un 429/403 : sur un lot de 30, la moitié des
     * recettes retombaient sur le repli texte alors que leur vidéo montrait
     * parfaitement l'assiette. On réessaie donc chaque frame, et on remonte la
     * cause quand rien n'a abouti.
     */
    let dernierStatut = null;
    const patienter = (statut, essai) => (essai >= 5
        ? Promise.resolve()
        : new Promise((res) => setTimeout(res, (statut === 403 || statut === 429 ? 8000 : 1500) * essai)));
    // On essaie les frames dans l'ordre (accroche d'abord) et on garde la 1re reconnue.
    for (const f of frames) {
        const data = 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
        for (let essai = 1; essai <= 5; essai++) {
            const c = new AbortController();
            const t = setTimeout(() => c.abort(), 60000);
            try {
                const rep = await fetch('https://fal.run/fal-ai/any-llm/vision', {
                    method: 'POST',
                    headers: { authorization: `Key ${process.env.FAL_KEY}`, 'content-type': 'application/json' },
                    body: JSON.stringify({ prompt, image_url: data, model: 'google/gemini-flash-1.5' }),
                    signal: c.signal,
                });
                if (rep.ok) {
                    const d = await rep.json();
                    const txt = (d?.output || '').replace(/\s+/g, ' ').trim();
                    if (txt && !/^none\b/i.test(txt) && txt.length >= 15) return txt.slice(0, 500);
                    break; // vrai NONE : la frame ne montre pas le plat, on passe à la suivante
                }
                dernierStatut = rep.status;
                // Un compte fal fraîchement rechargé alterne 200 et 403 pendant
                // plusieurs minutes : deux secondes d'attente ne suffisent pas à
                // traverser le trou, il faut tenir comme le fait la génération.
                await patienter(rep.status, essai);
            } catch (e) {
                dernierStatut = e.name === 'AbortError' ? 'timeout' : 'réseau';
                await patienter(null, essai);
            } finally { clearTimeout(t); }
        }
    }
    if (dernierStatut) throw new Error(`vision fal indisponible (${dernierStatut})`);
    return null;
}

/**
 * La clé Gemini. `GEMINI_API_KEYS` est une LISTE (le bot TikTok tourne dessus
 * pour épuiser les quotas l'une après l'autre) : on prend la première.
 * `GEMINI_IMAGE_KEY` la court-circuite — c'est là qu'on met la clé du projet
 * neuf quand l'ancien est signalé.
 */
function cleGemini() {
    const brut = process.env.GEMINI_IMAGE_KEY || process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    return brut.split(',')[0].trim() || null;
}

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Vision gratuite via Gemini : deuxième marche, entre Groq (capé à la journée)
 * et fal (payant). Même contrat que les deux autres : une phrase EN, `null`
 * quand le plat n'est pas visible, une exception quand c'est le SERVICE qui est
 * en panne — la nuance décide si on génère quand même depuis le titre ou si on
 * repasse la recette plus tard.
 */
async function decrireGemini(recette, frames) {
    const cle = cleGemini();
    if (!cle || !frames.length) return null;
    /*
     * Plusieurs modèles, pour la même raison que côté Groq : Google retire les
     * siens vite. gemini-2.0-flash et gemini-2.5-flash-lite répondent DÉJÀ 404
     * (« no longer available »), et l'erreur nomme le successeur. Un seul nom
     * en dur, et la marche gratuite tomberait le jour du retrait suivant.
     */
    const modeles = (process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash,gemini-3.6-flash')
        .split(',').map((s) => s.trim()).filter(Boolean);
    const parts = [{
        text: `These are frames from the opening and the end of a cooking video for a recipe titled "${recette.title}". `
            + `Describe ONLY the finished, plated dish as it should look for an editorial food photo: `
            + `its exact form/shape, colours, the key visible components, how it is plated and the vessel/plate. `
            + `The dish counts as visible even when held in someone's hands or partly covered by on-screen text. `
            + `Answer with one or two concise English sentences and nothing else. `
            + `Never mention the camera, background, hands, on-screen text or people. `
            + `If no finished dish appears in any frame, reply exactly: NONE`,
    }];
    for (const f of frames) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: fs.readFileSync(f).toString('base64') } });
    }
    let dernierStatut = null;
    for (const modele of modeles) {
        for (let essai = 1; essai <= 3; essai++) {
            const c = new AbortController();
            const t = setTimeout(() => c.abort(), 60000);
            try {
                const rep = await fetch(`${GEMINI_API}/${modele}:generateContent?key=${cle}`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts }],
                        generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
                    }),
                    signal: c.signal,
                });
                if (rep.ok) {
                    const d = await rep.json();
                    const txt = (d?.candidates?.[0]?.content?.parts || [])
                        .map((p) => p.text || '').join(' ').replace(/\s+/g, ' ').trim();
                    if (!txt || /^none\b/i.test(txt) || txt.length < 15) return null;
                    return txt.slice(0, 500);
                }
                dernierStatut = rep.status;
                // 404 = modèle retiré du catalogue : on passe au suivant de la liste.
                if (rep.status === 404) break;
                // 400/403 = clé morte ou projet signalé : les autres modèles
                // buteront pareil, inutile de dérouler la liste.
                if (rep.status === 400 || rep.status === 403) return null;
                // 503 « high demand » et 429 sont passagers : on laisse du temps.
                await new Promise((res) => setTimeout(res, 4000 * essai));
            } catch (e) {
                dernierStatut = e.name === 'AbortError' ? 'timeout' : 'réseau';
                await new Promise((res) => setTimeout(res, 3000 * essai));
            } finally { clearTimeout(t); }
        }
    }
    throw new Error(`vision gemini indisponible (${dernierStatut})`);
}

/** Regarde la vidéo et renvoie une description du plat, ou null si impossible. */
async function descriptionDepuisVideo(recette) {
    const id = videoIdDe(recette);
    if (!id) return null;
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'recimg-'));
    try {
        const frames = framesDeLaVideo(id, dossier);
        if (!frames.length) return null;
        // fal en premier si demandé (retouche ponctuelle) ; sinon les deux
        // gratuits d'abord — Groq (capé à 200k tokens/jour) puis Gemini — et
        // fal seulement quand les deux sont indisponibles.
        if (aOption('--vision-fal')) return await decrireFal(recette, frames);
        const parGroq = await decrirePlat(recette, frames);
        if (parGroq) return parGroq;
        try {
            const parGemini = await decrireGemini(recette, frames);
            if (parGemini) return parGemini;
        } catch (e) {
            // Gemini en panne n'est pas une réponse : on laisse fal trancher.
            if (!/vision gemini indisponible/.test(e.message || '')) throw e;
        }
        return await decrireFal(recette, frames);
    } catch (e) {
        /*
         * Vision en panne ≠ vidéo muette. Dans le premier cas on ABANDONNE la
         * recette : générer quand même donnerait une image tirée du seul titre,
         * payée au même prix, qu'il faudrait refaire. On la repassera plus tard
         * — c'est précisément ce que rattrape `--manquantes`.
         */
        if (/vision (fal|gemini) indisponible/.test(e.message || '')) throw e;
        return null;
    } finally {
        fs.rmSync(dossier, { recursive: true, force: true });
    }
}

/** Sauve l'ancienne image (avant écrasement) dans un dossier du Bureau. */
function sauvegarderAncienne(recette) {
    const dest = path.join(os.homedir(), 'Desktop', 'anciennes-photos-recettes', 'remplacees');
    fs.mkdirSync(dest, { recursive: true });
    const safe = String(recette.title || recette.id).replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 60);
    for (const suf of ['.webp', '-carte.webp']) {
        const src = path.join(DOSSIER, `${recette.id}${suf}`);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(dest, `${recette.id}_${safe}${suf}`));
        }
    }
}

/**
 * Gemini 2.5 Flash Image — HORS chaîne par défaut, et c'est délibéré.
 *
 * C'est le seul fournisseur à sortir du portrait NATIF : on lui demande du 3:4
 * et il le rend sans recadrage, autour de 896 px de large. Techniquement le
 * meilleur des trois pour notre cadrage… mais son palier gratuit est à zéro
 * (« generate_content_free_tier_requests, limit: 0 »), donc l'utiliser revient
 * à payer. On le garde câblé pour le jour où ça change : `--fournisseurs
 * gemini,cloudflare,fal`.
 */
async function genererGemini(consigneTexte) {
    const cle = cleGemini();
    if (!cle) throw new Error('pas de clé Gemini');
    const modele = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    let dernier = '';
    for (let essai = 1; essai <= 3; essai++) {
        const rep = await fetch(`${GEMINI_API}/${modele}:generateContent?key=${cle}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: consigneTexte }] }],
                generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4' } },
            }),
        });
        if (rep.ok) {
            const d = await rep.json();
            const part = (d?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
            if (!part) throw new Error('réponse sans image');
            return Buffer.from(part.inlineData.data, 'base64');
        }
        dernier = (await rep.text()).slice(0, 200);
        // 429 = quota du palier gratuit atteint pour la minute ; on souffle.
        // 400/403 = clé morte ou projet signalé : inutile d'insister.
        if (rep.status !== 429 || essai === 3) throw new Error(`Gemini ${rep.status} — ${dernier}`);
        await new Promise((res) => setTimeout(res, 20000 * essai));
    }
    throw new Error(`Gemini — ${dernier}`);
}

/**
 * Cloudflare Workers AI (FLUX schnell) — deuxième marche, gratuite.
 *
 * Il ne sait rendre que du CARRÉ 1024. On recadre au centre en 3:4, ce qui
 * donne 768 × 1024. Le cadrage du bas est le moins risqué : la consigne place
 * le plat au centre et remplit les bords de vaisselle, donc rogner à gauche et
 * à droite n'ampute jamais l'assiette.
 */
async function genererCloudflare(consigneTexte) {
    const compte = process.env.CF_ACCOUNT_ID;
    const jeton = process.env.CF_API_TOKEN;
    if (!compte || !jeton) throw new Error('pas de clés Cloudflare');
    const modele = process.env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
    // La consigne de la maison dépasse parfois la limite du modèle (2048
    // caractères) : on la coupe, les interdits sont en tête.
    const prompt = consigneTexte.slice(0, 2040);
    let dernier = '';
    for (let essai = 1; essai <= 3; essai++) {
        const rep = await fetch(`https://api.cloudflare.com/client/v4/accounts/${compte}/ai/run/${modele}`, {
            method: 'POST',
            headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
            /*
             * `steps` plafonne à 8 chez Cloudflare, et SURTOUT : pas de
             * `width` ni de `height`. Ce modèle REFUSE la requête entière si on
             * les envoie — « Additional or unevaluated properties '/width,
             * /height' not allowed », erreur 5006. On les passait en pensant
             * qu'ils seraient ignorés ; ils faisaient échouer chaque appel, et
             * la chaîne basculait sur le payant sans qu'on sache pourquoi.
             * Il rend du 1024 carré de toute façon, et on lit la taille réelle
             * juste après.
             */
            body: JSON.stringify({ prompt, steps: 8 }),
        });
        if (rep.ok) {
            const d = await rep.json();
            const b64 = d?.result?.image;
            if (!b64) throw new Error('réponse sans image');
            const rendu = Buffer.from(b64, 'base64');
            const meta = await sharp(rendu).metadata();
            const hauteur = meta.height || 1024;
            const largeur = Math.round(hauteur * 0.75);   // recadrage centré en 3:4
            /*
             * Garde-fou de définition. Ce modèle est facturé « par tuile de
             * 512 » et sa taille de sortie n'est pas garantie par la doc : s'il
             * rend du 512, le 3:4 tombe à 384 px et il faudrait DOUBLER pour
             * remplir une carte de 760. Un agrandissement pareil se voit. Mieux
             * vaut renoncer et laisser la main à fal : une image payée mais nette
             * vaut mieux qu'une image gratuite et molle, et le cas est rare.
             */
            if (largeur < 700) throw new Error(`rendu trop petit (${meta.width}×${meta.height})`);
            return await sharp(rendu)
                .extract({
                    top: 0,
                    left: Math.round(((meta.width || 1024) - largeur) / 2),
                    width: largeur,
                    height: hauteur,
                })
                .png()
                .toBuffer();
        }
        dernier = (await rep.text()).slice(0, 200);
        if (rep.status !== 429 || essai === 3) throw new Error(`Cloudflare ${rep.status} — ${dernier}`);
        await new Promise((res) => setTimeout(res, 15000 * essai));
    }
    throw new Error(`Cloudflare — ${dernier}`);
}

/**
 * Enchaîne les fournisseurs et renvoie { buffer, par } — `par` sert au journal,
 * pour qu'on voie d'un coup d'œil combien d'images sont passées par le payant.
 */
const FOURNISSEURS = {
    gemini: { nom: 'Gemini (gratuit)', appel: genererGemini, dispo: () => !!cleGemini() },
    cloudflare: { nom: 'Cloudflare (gratuit)', appel: genererCloudflare, dispo: () => !!(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) },
    fal: { nom: 'fal (payant)', appel: (c) => genererFal(c), dispo: () => !!process.env.FAL_KEY },
};

function ordreFournisseurs() {
    if (aOption('--fal')) return ['fal'];
    const demande = valeur('--fournisseurs') || process.env.IMAGE_FOURNISSEURS || 'cloudflare,fal';
    return demande.split(',').map((s) => s.trim()).filter((n) => FOURNISSEURS[n]);
}

/*
 * PLAFOND DE DÉPENSE, par exécution.
 *
 * Le repli payant est voulu — mais il est déclenché par une PANNE, et une
 * panne ne dure pas cinq minutes. Si Cloudflare tombe une nuit et que le
 * rattrapage passe toutes les heures, chaque passage bascule sur fal sans que
 * personne ne regarde. On borne donc : au-delà de N images payantes dans une
 * même exécution, fal est écarté et les recettes restantes sont laissées pour
 * plus tard — `--manquantes` les reprendra de toute façon.
 * `--fal` (retouche manuelle assumée) et `--force` ne sont pas concernés.
 */
const MAX_PAYANT = parseInt(valeur('--max-payant') || process.env.IMAGE_MAX_PAYANT || '5', 10);
let payantes = 0;

async function genererUne(recette, descPlat) {
    const consigneTexte = consigne(recette, descPlat);
    let noms = ordreFournisseurs().filter((n) => FOURNISSEURS[n].dispo());
    if (!noms.length) throw new Error('aucun fournisseur configuré (voir CF_ACCOUNT_ID/CF_API_TOKEN, FAL_KEY)');
    const plafonne = !aOption('--fal') && !aOption('--force') && payantes >= MAX_PAYANT;
    if (plafonne) noms = noms.filter((n) => n !== 'fal');
    if (!noms.length) throw new Error(`plafond de ${MAX_PAYANT} image(s) payante(s) atteint — repris au prochain passage`);
    const raisons = [];
    for (const nom of noms) {
        try {
            const buffer = await FOURNISSEURS[nom].appel(consigneTexte);
            if (nom === 'fal') payantes++;
            return { buffer, par: FOURNISSEURS[nom].nom };
        } catch (e) {
            raisons.push(`${nom}: ${e.message}`);
        }
    }
    throw new Error(raisons.join(' | '));
}

async function genererFal(consigneTexte) {
    const corps = JSON.stringify({
        prompt: consigneTexte,
        // « ultra » se pilote par ratio ; les autres modèles par un gabarit
        // nommé. Portrait 3:4 : le format tient aussi bien sur une carte
        // carrée que sur l'affiche verticale du héros.
        ...(MODELE.includes('ultra')
            ? { aspect_ratio: '3:4' }
            : { image_size: 'portrait_4_3' }),
        num_images: 1,
        enable_safety_checker: true,
    });
    // fal renvoie par intermittence « User is locked. Reason: TOP_UP » et 429
    // même quand le compte a du crédit (propagation incohérente côté fal) : on
    // réessaie plusieurs fois avant d'abandonner.
    let rep, detail = '';
    for (let essai = 1; essai <= 6; essai++) {
        rep = await fetch(`https://fal.run/${MODELE}`, {
            method: 'POST',
            headers: { authorization: `Key ${process.env.FAL_KEY}`, 'content-type': 'application/json' },
            body: corps,
        });
        if (rep.ok) break;
        detail = (await rep.text()).slice(0, 200);
        const transitoire = rep.status === 429 || /TOP_UP|locked/i.test(detail);
        if (!transitoire || essai === 6) throw new Error(`API ${rep.status} — ${detail}`);
        await new Promise((res) => setTimeout(res, 2500 * essai));
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

    /*
     * LE RATTRAPAGE.
     *
     * Tout le reste du script vise des recettes qu'on lui DÉSIGNE : un id, les
     * N dernières, tout. Ça marchait tant qu'un événement arrivait à coup sûr —
     * le webhook WordPress à la publication. Il suffit qu'il manque une fois
     * (NAS éteint, adresse publique changée, quota épuisé, vision en panne)
     * pour que la recette passe sans photo, définitivement : plus rien ne
     * repasse dessus.
     *
     * `--manquantes` renverse la logique : au lieu d'attendre qu'on lui dise
     * quoi faire, le script REGARDE ce qui manque sur le disque. Lancé à chaque
     * synchronisation, il finit toujours par rattraper ce qui a été raté, sans
     * qu'on ait à s'en occuper.
     */
    const sansPhoto = (r) => !fs.existsSync(path.join(DOSSIER, `${r.id}-carte.webp`));
    let cibles;
    if (valeur('--ids') || valeur('--manquantes')) {
        const ids = (valeur('--ids') || '').split(',').map((s) => s.trim()).filter(Boolean);
        cibles = recettes.filter((r) => ids.includes(String(r.id)));
        if (valeur('--manquantes')) {
            const combien = parseInt(valeur('--manquantes'), 10) || 0;
            const vus = new Set(cibles.map((r) => String(r.id)));
            // Le catalogue va du plus récent au plus ancien : on rattrape les
            // nouveautés d'abord, ce sont elles qu'on regarde le lendemain.
            for (const r of recettes) {
                if (cibles.length >= ids.length + combien) break;
                if (vus.has(String(r.id)) || !sansPhoto(r)) continue;
                // Les fiches restaurant n'ont pas d'assiette à montrer : elles
                // sont écartées plus bas de toute façon. Sans ce filtre ICI,
                // elles consommeraient les N places du rattrapage à chaque
                // passage et aucune vraie recette ne serait jamais reprise.
                if (r.category === 'restaurant') continue;
                cibles.push(r);
                vus.add(String(r.id));
            }
        }
    } else if (valeur('--recent')) {
        cibles = recettes.slice(0, parseInt(valeur('--recent'), 10) || 5);
    } else if (valeur('--oldest')) {
        // Le catalogue va du plus récent au plus ancien : les dernières entrées
        // sont les plus vieilles.
        cibles = recettes.slice(-(parseInt(valeur('--oldest'), 10) || 5)).reverse();
    } else if (aOption('--all')) {
        cibles = recettes;
    } else {
        console.error('Précise --ids, --manquantes N, --recent N ou --all.');
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

    const dispos = ordreFournisseurs().filter((n) => FOURNISSEURS[n].dispo());
    if (!dispos.length) {
        console.error('Aucun fournisseur d\'image configuré. Renseigne au moins une clé :');
        console.error('  GEMINI_IMAGE_KEY  (gratuit — aistudio.google.com/apikey)');
        console.error('  CF_ACCOUNT_ID + CF_API_TOKEN  (gratuit — dash.cloudflare.com → Workers AI)');
        console.error('  FAL_KEY  (payant — fal.ai/dashboard/keys)');
        process.exit(1);
    }
    console.log(`Fournisseurs, dans l'ordre : ${dispos.map((n) => FOURNISSEURS[n].nom).join(' → ')}\n`);

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
            // Regarde la vidéo TikTok pour décrire le vrai plat (si --video).
            let descPlat = null;
            if (aOption('--video')) {
                descPlat = await descriptionDepuisVideo(r);
                console.log(`  🎬 ${r.id} vidéo : ${descPlat ? descPlat.slice(0, 90) + '…' : 'pas de description (repli titre)'}`);
            }
            // Sauve l'ancienne image sur le Bureau avant de l'écraser. Inutile
            // sur un runner GitHub : le Bureau y est un dossier jetable.
            if (fs.existsSync(fichier) && !process.env.CI) sauvegarderAncienne(r);
            const { buffer, par } = await genererUne(r, descPlat);
            const poids = [];
            for (const t of TAILLES) {
                const sortie = path.join(DOSSIER, `${r.id}${t.suffixe}.webp`);
                await redimensionner(buffer, t.largeur, t.qualite, sortie);
                poids.push(`${t.largeur}px : ${Math.round(fs.statSync(sortie).size / 1024)} ko`);
            }
            // Le site pointe sur la PETITE : c'est elle qui s'affiche trente fois
            // sur l'accueil. La fiche recette ira chercher la grande.
            pointerVers(r.id, `/recipes-ia/${r.id}-carte.webp`);
            console.log(`✓ ${r.title} — ${par} — ${poids.join(', ')}`);
            faites++;
        } catch (e) {
            console.log(`✗ ${r.title} — ${e.message}`);
            ratees++;
        }
        // On ne bouscule pas l'API : une image à la fois, avec un souffle. En mode
        // --video, la vision Groq est plafonnée à 8000 tokens/min (~3200/appel) :
        // on espace davantage pour éviter les 429 qui font retomber sur le titre.
        await new Promise((res) => setTimeout(res, aOption('--video') ? 9000 : 1200));
    }

    console.log(`\n${faites} générée(s), ${sautees} déjà là, ${ratees} en échec.`);
    if (faites) console.log('Relis les images dans public/recipes-ia avant de pousser.');
})();
