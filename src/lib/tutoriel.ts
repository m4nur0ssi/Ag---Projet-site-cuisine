/**
 * Le tutoriel — source unique.
 * ============================
 *
 * Les étapes de la visite guidée (menu « Tutoriel ») ET les bulles d'astuce
 * posées sur les écrans lisent ce module : un même geste ne s'explique pas de
 * deux façons selon l'endroit où on le rencontre. Une bulle qui correspond à
 * une étape porte son identifiant dans `astuce` ; elle en reprend alors le
 * texte et la scène, et voir l'un compte comme avoir vu l'autre.
 */

export type Art =
    | 'hero' | 'rows' | 'press' | 'clic' | 'card' | 'cook' | 'filter' | 'filtres' | 'search'
    | 'planner' | 'side' | 'compose' | 'jourj' | 'fill' | 'views' | 'dock' | 'cocktail'
    | 'cave' | 'ext' | 'sidebar' | 'library' | 'trophy' | 'taste' | 'install'
    | 'tags' | 'timers' | 'demarrer' | 'plus';

export interface Step {
    kicker: string;
    title: string;
    text: string;
    hint: string;
    tint: string;
    accent: string;
    art: Art;
    /** Nom de la démonstration filmée (public/tuto/<id>.webm), si elle existe. */
    video?: string;
    /**
     * Bulle d'astuce (src/lib/tips.ts) qui montre cette même étape. Voir l'une
     * marque l'autre comme vue — clé de mémorisation : ne JAMAIS la renommer.
     */
    astuce?: string;
}

export const T = {
    hero: 'radial-gradient(60% 100% at 50% 0%, rgba(255,69,58,0.55), transparent 70%)',
    orange: 'radial-gradient(60% 100% at 50% 0%, rgba(255,159,10,0.5), transparent 70%)',
    jaune: 'radial-gradient(60% 100% at 50% 0%, rgba(255,214,10,0.45), transparent 70%)',
    vert: 'radial-gradient(60% 100% at 50% 0%, rgba(48,209,88,0.45), transparent 70%)',
    bleu: 'radial-gradient(60% 100% at 50% 0%, rgba(10,132,255,0.5), transparent 70%)',
    indigo: 'radial-gradient(60% 100% at 50% 0%, rgba(94,92,230,0.55), transparent 70%)',
    violet: 'radial-gradient(60% 100% at 50% 0%, rgba(191,90,242,0.5), transparent 70%)',
    rose: 'radial-gradient(60% 100% at 50% 0%, rgba(255,45,85,0.45), transparent 70%)',
    cyan: 'radial-gradient(60% 100% at 50% 0%, rgba(100,210,255,0.45), transparent 70%)',
    mauve: 'radial-gradient(60% 100% at 50% 0%, rgba(139,92,246,0.5), transparent 70%)',
    vin: 'radial-gradient(60% 100% at 50% 0%, rgba(178,58,72,0.5), transparent 70%)',
    corail: 'radial-gradient(60% 100% at 50% 0%, rgba(255,107,74,0.5), transparent 70%)',
    gris: 'radial-gradient(60% 100% at 50% 0%, rgba(142,142,147,0.45), transparent 70%)',
};


/*
 * Deux visites, pas une.
 *
 * Le même texte ne peut pas décrire les deux : « balaye la photo » n'a aucun
 * sens avec une souris, et « la molette change de rangée » n'en a aucun avec un
 * doigt. Pire, les écrans eux-mêmes diffèrent — le bureau a une barre latérale
 * et une bibliothèque qu'on remplit par glissé, le téléphone a un tiroir et une
 * barre du bas. Une visite guidée qui désigne un bouton absent est pire que pas
 * de visite du tout : elle fait douter l'utilisateur de ce qu'il voit.
 */

export const STEPS_MOBILE: Step[] = [
    { kicker: 'Accueil', title: 'Le grand visuel', art: 'hero', accent: '#FF453A', tint: T.hero,
      text: "L'accueil s'ouvre sur les dernières recettes, en grand. Balaye pour passer à la suivante, touche la photo pour ouvrir la fiche. Sous le titre, les #hashtags ouvrent toute leur catégorie.",
      hint: 'Touche #ITALIE sous la photo : toutes les recettes italiennes s’affichent.' },
    { kicker: 'Accueil', title: 'Les rangées', art: 'rows', accent: '#FF9F0A', tint: T.orange,
      text: 'Sous le visuel : Top 10, Reprendre la cuisine, À faire plus tard, Pour toi, Nouveautés, puis une rangée par catégorie et par thème — Pâtes, Express, Cocktails, Airfryer… Chaque rangée se balaye.',
      hint: 'Touche le titre d’une rangée (le chevron ›) : elle s’ouvre en grille entière.' },
    { kicker: 'Accueil', title: 'L’appui long', art: 'press', astuce: 'accueil', accent: '#FFD60A', tint: T.jaune,
      text: 'Garde le doigt une seconde sur une carte : un menu s’ouvre — Favoris, À faire plus tard, Accéder à la catégorie, Partager, Voir la recette.',
      hint: 'Le cœur plein range en favoris, l’horloge dans « À faire plus tard ».' },
    { kicker: 'Recette', title: 'La fiche', art: 'card', accent: '#30D158', tint: T.vert,
      text: 'Ingrédients (nombre de personnes ajustable), étapes, ta note au dixième — glisse le doigt sur les étoiles, la fiche ne bouge pas —, l’accord vin et l’ajout à la liste. La barre du bas reste là.',
      hint: 'Fiche ouverte : balaye vers la gauche pour la recette voisine, la croix en haut la ferme.' },
    { kicker: 'Recette', title: 'Les hashtags', art: 'tags', accent: '#FF9F0A', tint: T.orange,
      text: 'Sous la photo de chaque fiche, les #hashtags sont des liens : un toucher, et toutes les recettes de ce thème s’affichent en grille, comme sur l’accueil.',
      hint: 'Ouvre une fiche, touche un #hashtag.' },
    { kicker: 'Recette', title: 'Cuisiner pas à pas', art: 'cook', accent: '#FF6B4A', tint: T.corail,
      text: '« Lancer la préparation » passe en mode cuisine : une étape à la fois, en grand, avec le minuteur qui démarre tout seul quand l’étape en demande un.',
      hint: 'Une recette commencée revient dans « Reprendre la cuisine », sur l’accueil.' },
    { kicker: 'Recette', title: 'Plusieurs chronos', art: 'timers', accent: '#FFD60A', tint: T.jaune,
      text: 'Un chrono par recette, autant que tu veux. La loupe affiche celui qui se termine en premier ; touche-la pour les voir tous, avec la photo et le nom de leur recette.',
      hint: 'La croix à droite d’un chrono l’arrête.' },
    { kicker: 'Menu', title: 'Filtrer', art: 'filter', accent: '#0A84FF', tint: T.bleu,
      text: 'Le tiroir ouvre Catégories, Tendances et Pays, cochables et repliables. Les filtres se combinent : OU dans un groupe, ET entre groupes — « un dessert espagnol express ».',
      hint: 'Coche Desserts + Espagne, puis touche « Voir N recettes ».' },
    { kicker: 'Recherche', title: 'Trois façons', art: 'search', accent: '#5E5CE6', tint: T.indigo,
      text: 'La loupe ouvre Recette (son nom), Ingrédients (ce qu’il te reste au frigo) et Assistant IA, qui comprend une demande en langage courant — à la voix aussi.',
      hint: 'Appui long sur la loupe : la dictée démarre direct sur l’Assistant.' },
    { kicker: 'Recherche', title: 'Les filtres', art: 'filtres', accent: '#5E5CE6', tint: T.indigo,
      text: 'Sous la recherche, Catégorie, Pays et Tendances se cumulent. Dans Tendances, « 100 % de saison » ne garde que les recettes dont les légumes sont de saison ce mois-ci — la sélection change toute seule d’un mois à l’autre.',
      hint: 'Ouvre Tendances et coche « 100 % de saison », puis ajoute une catégorie.' },
    { kicker: 'Planificateur', title: 'Ma semaine', art: 'planner', accent: '#BF5AF2', tint: T.violet,
      text: 'Un jour par écran, ouvert sur aujourd’hui : Midi et Soir. « Choisir une recette » ouvre le sélecteur, « Surprends-moi » en tire une au hasard. Appui long sur une carte pour la déplacer : posée sur un repas déjà prévu, elle le remplace.',
      hint: 'Balaye pour changer de jour, ou touche Lun… Dim en haut.' },
    { kicker: 'Planificateur', title: 'L’accompagnement', art: 'side', accent: '#FF2D55', tint: T.rose,
      text: 'Un plat servi nu — viande ou poisson sans féculent ni légume — appelle un accompagnement. Deux boutons : « Ajouter un accompagnement » (toute la liste) ou « 100 % légumes de saison » (la même liste, limitée aux accompagnements de saison). Plat et accompagnement se changent et se retirent chacun de leur côté.',
      hint: '« Changer » sur l’accompagnement garde le plat ; « Changer » sur le plat garde l’accompagnement.' },
    { kicker: 'Planificateur', title: 'Composer', art: 'compose', accent: '#64D2FF', tint: T.cyan,
      text: '« Composer » remplit toute la semaine sur une tendance — Italie, Healthy, Barbecue… — sans répéter un plat ni sortir du thème.',
      hint: 'Touche Composer, choisis une tendance, regarde les 14 repas se remplir.' },
    { kicker: 'Planificateur', title: 'Le Jour J', art: 'jourj', accent: '#FF9F0A', tint: T.orange,
      text: 'Un onglet à part pour un repas complet : apéritif, entrée, plat, accompagnement, dessert. « Composer » le remplit d’un coup sur des pays et des tendances — chaque recette trouve sa place toute seule.',
      hint: 'Les tendances restent ouvertes : coche-en plusieurs, puis touche « Tendances » pour refermer.' },
    { kicker: 'Jour J', title: 'Démarrer la soirée', art: 'demarrer', accent: '#30D158', tint: T.vert,
      text: '« Déroulé de la soirée » dit quand lancer chaque plat. Touche une étape pour ouvrir sa recette. « Démarrer » te prévient à chaque étape : OK quand c’est fait, ou « dans 10 min » si tu as du retard — tous les horaires suivent.',
      hint: 'Sur iPhone, installe l’app sur l’écran d’accueil pour recevoir les notifications.' },
    { kicker: 'Courses', title: 'Remplir la liste', art: 'fill', accent: '#30D158', tint: T.vert,
      text: '« Remplir ma liste de courses » envoie tous les ingrédients du menu dans la liste, regroupés par rayon et sans doublon.',
      hint: 'Menu prêt : touche le bouton blanc en bas du planificateur.' },
    { kicker: 'Courses', title: 'Trois vues', art: 'views', accent: '#0A84FF', tint: T.bleu,
      text: '« La semaine » fusionne toute la liste par rayon, « Jour par jour » sépare les repas (touche une recette pour ouvrir sa carte), « En + » rassemble tes ajouts à la main et les ingrédients cochés depuis une fiche, sous leur recette.',
      hint: 'Dans « En + », la photo de la recette ouvre sa carte.' },
    { kicker: 'Ma cave', title: 'Tes bouteilles', art: 'cave', accent: '#B23A48', tint: T.vin,
      text: 'Photographie l’étiquette : le nom, le cépage, l’année, la région et la vraie photo de la bouteille entrent seuls en cave. Deux étagères — la cave, et « Goûté & approuvé ».',
      hint: 'Sur un vin, « Quelle recette ? » sort les plats qui vont avec — affine par catégorie, pays ou tendance.' },
    { kicker: 'Palmarès', title: 'Tes trophées', art: 'trophy', accent: '#FFC24B', tint: T.jaune,
      text: 'Six badges qui se débloquent en cuisinant pour de vrai : Première flamme, Apprenti, Chef de maison, Collectionneur, Tour du monde, Organisé. Rien à réclamer, ils viennent seuls.',
      hint: '« Tour du monde » compte les pays différents que tu as cuisinés.' },
    { kicker: 'Tes goûts', title: 'Affine mes goûts', art: 'taste', accent: '#FF2E63', tint: T.rose,
      text: 'Dix recettes, un glissé chacune : à droite j’aime, à gauche je passe. C’est tout ce qui nourrit la rangée « Pour toi » de l’accueil.',
      hint: 'Optionnel et rejouable — la rangée « Pour toi » se recalcule aussitôt.' },
    { kicker: 'Apéritif', title: 'Les cocktails', art: 'cocktail', accent: '#FF6B4A', tint: T.corail,
      text: 'Deux rangées à part : Cocktails et Cocktails sans alcool. Le tri se fait tout seul en lisant les ingrédients — un Mojito part avec l’alcool, sa version virgin sans.',
      hint: 'Cherche « cocktail » ou ouvre la rangée depuis l’accueil.' },
    { kicker: 'Partout', title: 'La barre du bas', art: 'dock', accent: '#8E8E93', tint: T.gris,
      text: 'Favoris, Liste, Accueil et Menu, plus la loupe. Elle te suit partout et se réduit quand tu fais défiler.',
      hint: 'Le menu (à droite) ouvre le tiroir : filtres, planificateur, cave, palmarès.' },
    { kicker: 'Installer', title: 'Comme une app', art: 'install', accent: '#0A84FF', tint: T.bleu,
      text: 'Posé sur l’écran d’accueil, le site s’ouvre en plein écran, sans barre d’adresse. Depuis iOS 26, le chemin passe par le bouton ⋯ de la barre du bas, puis Partager.',
      hint: 'Menu → « Installer l’application » : les cinq écrans y sont dessinés.' },
];

export const STEPS_BUREAU: Step[] = [
    { kicker: 'Repères', title: 'Le menu de gauche', art: 'sidebar', accent: '#8E8E93', tint: T.gris,
      text: 'Tout part de la barre latérale : Planificateur, Liste de courses, Extension Chrome, Favoris, Palmarès, Ma cave, Tutoriel, Affine mes goûts — puis les Catégories, Tendances et Pays, dépliables.',
      hint: 'Le chevron en haut replie la barre : l’accueil récupère toute la largeur.' },
    { kicker: 'Accueil', title: 'Le grand visuel', art: 'hero', accent: '#FF453A', tint: T.hero,
      text: 'L’accueil s’ouvre sur les dernières recettes, en grand. Les flèches ‹ › changent de recette, « Voir la recette » ouvre la fiche.',
      hint: 'Le bouton ⋯ du visuel ouvre le même menu que le clic droit sur une carte.' },
    { kicker: 'Accueil', title: 'Les rangées', art: 'rows', accent: '#FF9F0A', tint: T.orange,
      text: 'Top 10, Reprendre la cuisine, À faire plus tard, Pour toi, Nouveautés, les catégories puis les thèmes. La molette change de RANGÉE — pas de trois centimètres — et la rangée visée vient se placer au centre.',
      hint: 'À droite, l’ascenseur de rangées saute directement à Desserts ou Cocktails.' },
    { kicker: 'Accueil', title: 'Le clic droit', art: 'clic', astuce: 'accueil', accent: '#FFD60A', tint: T.jaune,
      text: 'Clic droit sur une carte : Favoris, À faire plus tard, Accéder à la catégorie, Partager, Voir la recette. Les flèches ‹ › de chaque rangée la font défiler d’un écran.',
      hint: 'L’icône horloge, au survol d’une carte, met la recette « à faire plus tard ».' },
    { kicker: 'Recette', title: 'La fiche', art: 'card', accent: '#30D158', tint: T.vert,
      text: 'Ingrédients (nombre de personnes ajustable), étapes, minuteur, ta note au dixième, l’accord vin et l’ajout à la liste. Coche un ingrédient : il file dans l’onglet « En + » de la liste. Les #hashtags sous la photo ouvrent leur catégorie.',
      hint: 'Échap referme la fiche et rend l’accueil à l’endroit exact où tu étais.' },
    { kicker: 'Recette', title: 'Cuisiner pas à pas', art: 'cook', accent: '#FF6B4A', tint: T.corail,
      text: '« Lancer la préparation » passe en mode cuisine : une étape à la fois, en grand, avec le minuteur qui démarre tout seul quand l’étape en demande un.',
      hint: 'Une recette commencée revient dans « Reprendre la cuisine », sur l’accueil.' },
    { kicker: 'Menu', title: 'Filtrer', art: 'filter', accent: '#0A84FF', tint: T.bleu,
      text: 'Catégories, Tendances et Pays s’ouvrent dans la barre latérale. Les cases se cumulent : OU dans un groupe, ET entre groupes — « un dessert espagnol express ».',
      hint: 'Coche Plats + Italie + Express : la grille se recompose sans recharger la page.' },
    { kicker: 'Menu', title: 'La bibliothèque', art: 'library', accent: '#5E5CE6', tint: T.indigo,
      text: 'Glisse une catégorie, une tendance ou un pays vers le haut de la barre : il s’épingle dans ta bibliothèque, et te suit jusque dans le tiroir du téléphone.',
      hint: 'La croix, au survol d’une épingle, la retire de la bibliothèque.' },
    { kicker: 'Recherche', title: 'Trois façons', art: 'search', accent: '#5E5CE6', tint: T.indigo,
      text: 'La loupe ouvre Recette (son nom), Ingrédients (ce qu’il te reste au frigo) et Assistant IA, qui comprend une demande en langage courant.',
      hint: 'L’Assistant sort aussi des restaurants : ville, type de cuisine, terrasse.' },
    { kicker: 'Recherche', title: 'Les filtres', art: 'filtres', accent: '#5E5CE6', tint: T.indigo,
      text: 'Sous la recherche, Catégorie, Pays et Tendances se cumulent. Dans Tendances, « 100 % de saison » ne garde que les recettes dont les légumes sont de saison ce mois-ci — la sélection change toute seule d’un mois à l’autre.',
      hint: 'Ouvre Tendances et coche « 100 % de saison », puis ajoute une catégorie.' },
    { kicker: 'Planificateur', title: 'Ma semaine', art: 'planner', accent: '#BF5AF2', tint: T.violet,
      text: 'Le panneau s’ouvre à droite du menu, ouvert sur aujourd’hui : Midi et Soir. « Choisir une recette » ouvre le sélecteur, « Surprends-moi » en tire une au hasard. Plat et accompagnement se changent chacun de leur côté.',
      hint: 'Lun… Dim en haut : un clic suffit pour changer de jour.' },
    { kicker: 'Planificateur', title: 'L’accompagnement', art: 'side', accent: '#FF2D55', tint: T.rose,
      text: 'Un plat servi nu — viande ou poisson sans féculent ni légume — ouvre une ligne « Accompagnement » sous lui, avec deux choix : toute la liste, ou « 100 % légumes de saison ». Un couscous, déjà complet, n’en demande pas.',
      hint: 'Mets une viande à midi : la ligne Accompagnement apparaît juste dessous.' },
    { kicker: 'Planificateur', title: 'Composer', art: 'compose', accent: '#64D2FF', tint: T.cyan,
      text: '« Composer » remplit toute la semaine sur une tendance — Italie, Healthy, Barbecue… — sans répéter un plat ni sortir du thème.',
      hint: 'Clique Composer, choisis une tendance, regarde les 14 repas se remplir.' },
    { kicker: 'Planificateur', title: 'Le Jour J', art: 'jourj', accent: '#FF9F0A', tint: T.orange,
      text: 'Un onglet à part pour un repas complet : apéritif, entrée, plat, accompagnement, dessert et pâtisserie. Idéal pour un dîner d’invités.',
      hint: 'En haut, bascule « Semaine » → « Jour J ».' },
    { kicker: 'Courses', title: 'Remplir la liste', art: 'fill', accent: '#30D158', tint: T.vert,
      text: '« Remplir ma liste de courses » envoie tous les ingrédients du menu dans la liste, regroupés par rayon et sans doublon.',
      hint: 'Menu prêt : le bouton blanc est en bas du planificateur.' },
    { kicker: 'Courses', title: 'Trois vues', art: 'views', accent: '#0A84FF', tint: T.bleu,
      text: '« La semaine » fusionne tout par rayon (avec les bascules Semaine / Jour J), « Jour par jour » sépare les repas (clic sur une recette = sa carte), « En + » rassemble les ajouts à la main et les ingrédients cochés en fiche.',
      hint: 'Coche des articles : les boutons Partager et Magasin apparaissent.' },
    { kicker: 'Courses', title: 'L’extension Chrome', art: 'ext', accent: '#8B5CF6', tint: T.mauve,
      text: 'L’extension « Courses Magiques » pose ta liste par-dessus le site du magasin — Carrefour, Monoprix, Picard, Leclerc Drive — et passe au produit suivant toute seule. Plus besoin de changer d’onglet.',
      hint: 'Menu → Extension Chrome : le .zip et les cinq étapes d’installation.' },
    { kicker: 'Ma cave', title: 'Tes bouteilles', art: 'cave', accent: '#B23A48', tint: T.vin,
      text: 'Le nom, le cépage, l’année, la région et la vraie photo de la bouteille. Deux étagères — la cave, et « Goûté & approuvé » — et un glissé pour passer de l’une à l’autre.',
      hint: 'Sur un vin, « Quelle recette ? » sort les plats du site qui vont avec.' },
    { kicker: 'Palmarès', title: 'Tes trophées', art: 'trophy', accent: '#FFC24B', tint: T.jaune,
      text: 'Six badges qui se débloquent en cuisinant pour de vrai : Première flamme, Apprenti, Chef de maison, Collectionneur, Tour du monde, Organisé. Rien à réclamer, ils viennent seuls.',
      hint: '« Tour du monde » compte les pays différents que tu as cuisinés.' },
    { kicker: 'Tes goûts', title: 'Affine mes goûts', art: 'taste', accent: '#FF2E63', tint: T.rose,
      text: 'Dix recettes, un glissé (ou un clic) chacune : à droite j’aime, à gauche je passe. C’est tout ce qui nourrit la rangée « Pour toi » de l’accueil.',
      hint: 'Optionnel et rejouable — la rangée « Pour toi » se recalcule aussitôt.' },
    { kicker: 'Installer', title: 'Dans le Dock', art: 'install', accent: '#0A84FF', tint: T.bleu,
      text: 'Le site s’installe aussi sur l’ordinateur : sa propre fenêtre, sans barre d’adresse ni onglets. Chrome et Edge le proposent depuis la barre d’adresse, Safari par Fichier → Ajouter au Dock.',
      hint: 'Menu → « Installer l’application » : le chemin y est dessiné pour ton navigateur.' },
];

/** Les étapes de la plateforme : le bureau a sa propre visite (voir plus haut). */
export const etapesTuto = (bureau: boolean): Step[] => (bureau ? STEPS_BUREAU : STEPS_MOBILE);

/** L'étape du tutoriel que montre une bulle d'astuce, s'il y en a une. */
export const etapePourAstuce = (astuce: string, bureau: boolean): Step | undefined =>
    etapesTuto(bureau).find((s) => s.astuce === astuce);

/*
 * Vu / pas vu — un seul registre pour les bulles et la visite.
 * (La clé est celle des bulles depuis toujours : la changer ferait revenir
 * toutes les astuces déjà fermées.)
 */
const VUES_KEY = 'magic-tips-seen-v1';

export const astucesVues = (): string[] => {
    try { const v = JSON.parse(localStorage.getItem(VUES_KEY) || '[]'); return Array.isArray(v) ? v : []; }
    catch { return []; }
};

export function marquerAstuceVue(id: string) {
    try {
        const list = astucesVues();
        if (list.includes(id)) return;
        localStorage.setItem(VUES_KEY, JSON.stringify([...list, id]));
    } catch { /* stockage refusé : l'astuce reviendra, tant pis */ }
}

/*
 * Les cartes montrées dans les scènes : de VRAIES recettes du site, celles de
 * l'accueil — le héros « Purée façon Joël Robuchon » et la rangée
 * « Top 100 : les mieux notées ». Une carte inventée se reconnaît tout de
 * suite, et fait douter de ce qu'on regarde.
 */
export const TUTO_CARTES = {
    /** Le grand visuel de l'accueil. */
    heros: '8116',
    /** Rangée « Top 100 : les mieux notées » ; la première reçoit le geste. */
    top: ['8140', '8116', '8135', '8133', '8121'],
    /** Seconde rangée de la scène des rangées : d'autres recettes récentes du site. */
    nouveautes: ['8123', '8125', '8127', '8118', '8113'],
    /** Scènes animées (src/components/TutoScene/TutoAnim.tsx) : recettes réelles du catalogue. */
    bavette: '8113',
    /** Accompagnements « 100 % de saison » proposés après le toucher. */
    saison: ['8049', '8118', '5535'],
    /** Un plat servi nu, une recette de plat, sa fiche et son #hashtag France. */
    france: ['8116', '8113', '8068'],
    /** Réponses de l'assistant à « un plat rapide au poulet ». */
    poulet: ['8024', '8013'],
} as const;
