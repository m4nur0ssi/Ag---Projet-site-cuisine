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
    [/flan\b|cr[èe]me caramel|cr[èe]me renvers[ée]e/i,
     'a whole {T}, a silky smooth unmoulded caramel custard turned out onto a plate, glossy amber caramel '
     + 'running down its sides and pooling around the base, one clean wedge sliced out to show the tender set '
     + 'custard, no crust and no pastry, a spoon resting nearby'],
    [/cr[èe]mes? dessert|\bmousse\b|pot de cr[èe]me|panna ?cotta|pudding|cr[èe]me chocolat|tiramisu|yaourt|fromage blanc/i,
     'several individual small glass pots and ramekins of {T}, smooth glossy spoonable surface, '
     + 'one topped with a garnish, a small spoon dipping into one pot, no cutting and no slices, '
     + 'the pots grouped together with the ingredients scattered loosely around'],
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
        ? `${capitale(vue.lead)}: ${speciale.replace(/\{T\}/g, recette.title)}.`
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
        ingredients ? `The dish is made of: ${ingredients}.` : '',
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
// vidéo TikTok de la recette (frames de fin = plat fini), on la décrit via Groq
// vision, et on injecte cette description dans le prompt. Active par --video.
// ────────────────────────────────────────────────────────────────────────────
const { execSync } = require('child_process');
const os = require('os');
const BIN = '/opt/homebrew/bin'; // yt-dlp + ffmpeg (brew)
const GROQ_VISION = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b';

/** Id TikTok depuis le champ videoHtml de la recette. */
function videoIdDe(recette) {
    const h = recette.videoHtml || '';
    const m = h.match(/data-video-id="(\d+)"/) || h.match(/tiktok\.com\/(?:v|@[^/]+\/video)\/(\d+)/);
    return m ? m[1] : null;
}

/** Télécharge la vidéo + extrait quelques frames (début + fin), réduites à 512px. */
function framesDeLaVideo(id, dossier) {
    const env = { ...process.env, PATH: `${BIN}:${process.env.PATH}` };
    const mp4 = path.join(dossier, 'v.mp4');
    execSync(`yt-dlp --no-warnings -o ${JSON.stringify(mp4)} "https://www.tiktok.com/@t/video/${id}"`,
        { env, stdio: 'ignore', timeout: 90000 });
    const dur = parseFloat(execSync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(mp4)}`,
        { env }).toString().trim()) || 10;
    // Le plat fini est presque toujours dans le dernier quart ; on prend aussi
    // une frame du tout début (parfois un plan du plat avant la recette).
    // Plusieurs frames, FIN d'abord : le plat fini apparaît à des moments variés
    // (parfois la toute fin, parfois avant l'outro). On les essaie dans l'ordre et
    // on garde la 1re que la vision reconnaît comme plat fini (voir decrireFal).
    const temps = [
        Math.max(0, dur - 0.3), dur * 0.96, dur * 0.90, dur * 0.83, dur * 0.72, dur * 0.55,
    ];
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
        text: `These are frames from the END of a cooking video for a recipe titled "${recette.title}". `
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
    const body = JSON.stringify({
        model: GROQ_VISION,
        messages: [{ role: 'user', content: contenu }],
        max_tokens: 700,
        temperature: 0.2,
    });
    const headers = {
        authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'content-type': 'application/json',
        // Sans un User-Agent de navigateur, Cloudflare renvoie 403/1010.
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    };
    try {
        let rep, txt417 = '';
        // Free tier Groq = 8000 tokens/min : on encaisse les 429 en attendant le
        // délai indiqué, jusqu'à 4 essais.
        for (let essai = 1; essai <= 4; essai++) {
            const c = new AbortController();
            const t = setTimeout(() => c.abort(), 60000);
            rep = await fetch('https://api.groq.com/openai/v1/chat/completions',
                { method: 'POST', headers, body, signal: c.signal }).finally(() => clearTimeout(t));
            if (rep.ok) break;
            txt417 = (await rep.text());
            if (rep.status !== 429 || essai === 4) return null;
            const m = txt417.match(/try again in ([\d.]+)s/i);
            const attente = m ? Math.ceil(parseFloat(m[1]) * 1000) + 800 : 12000;
            await new Promise((res) => setTimeout(res, attente));
        }
        const data = await rep.json();
        let txt = data?.choices?.[0]?.message?.content || '';
        // qwen émet un bloc <think>…</think> : on garde ce qui suit le dernier.
        if (/<\/think>/i.test(txt)) txt = txt.split(/<\/think>/i).pop();
        else if (/<think>/i.test(txt)) txt = ''; // n'a fait que réfléchir (tronqué)
        txt = txt.replace(/<\/?think>/gi, '').trim();
        if (!txt || /^none\b/i.test(txt) || txt.length < 15) return null;
        return txt.replace(/\s+/g, ' ').slice(0, 500);
    } catch {
        return null;
    }
}

/**
 * Vision de secours via fal (pas de quota journalier contrairement à Groq gratuit).
 * fal-ai/any-llm/vision + gemini-flash accepte une data URI directement.
 */
async function decrireFal(recette, frames) {
    if (!process.env.FAL_KEY || !frames.length) return null;
    const prompt = `This is a still frame from a cooking video for a recipe titled "${recette.title}". `
        + `If it shows the FINISHED, plated dish, describe ONLY that dish for an editorial food photo: its exact `
        + `form/shape, colours, the key visible components, how it is plated and the vessel/plate — one or two concise `
        + `English sentences, no mention of camera, background, hands, on-screen text or people. `
        + `If the frame does NOT clearly show the finished plated dish (e.g. mid-cooking, raw ingredients, a person, `
        + `just text), reply exactly: NONE`;
    // On essaie les frames dans l'ordre (fin d'abord) et on garde la 1re reconnue.
    for (const f of frames) {
        const data = 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
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
            }
        } catch { /* frame suivante */ } finally { clearTimeout(t); }
    }
    return null;
}

/** Regarde la vidéo et renvoie une description du plat, ou null si impossible. */
async function descriptionDepuisVideo(recette) {
    const id = videoIdDe(recette);
    if (!id) return null;
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'recimg-'));
    try {
        const frames = framesDeLaVideo(id, dossier);
        if (!frames.length) return null;
        // fal en premier si demandé (Groq gratuit est capé à 200k tokens/jour) ;
        // sinon Groq puis repli fal automatique.
        if (aOption('--vision-fal')) return await decrireFal(recette, frames);
        return (await decrirePlat(recette, frames)) || (await decrireFal(recette, frames));
    } catch {
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

async function genererUne(recette, descPlat) {
    const corps = JSON.stringify({
        prompt: consigne(recette, descPlat),
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
            // Regarde la vidéo TikTok pour décrire le vrai plat (si --video).
            let descPlat = null;
            if (aOption('--video')) {
                descPlat = await descriptionDepuisVideo(r);
                console.log(`  🎬 ${r.id} vidéo : ${descPlat ? descPlat.slice(0, 90) + '…' : 'pas de description (repli titre)'}`);
            }
            // Sauve l'ancienne image sur le Bureau avant de l'écraser.
            if (fs.existsSync(fichier)) sauvegarderAncienne(r);
            const buffer = await genererUne(r, descPlat);
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
        // On ne bouscule pas l'API : une image à la fois, avec un souffle. En mode
        // --video, la vision Groq est plafonnée à 8000 tokens/min (~3200/appel) :
        // on espace davantage pour éviter les 429 qui font retomber sur le titre.
        await new Promise((res) => setTimeout(res, aOption('--video') ? 9000 : 1200));
    }

    console.log(`\n${faites} générée(s), ${sautees} déjà là, ${ratees} en échec.`);
    if (faites) console.log('Relis les images dans public/recipes-ia avant de pousser.');
})();
