/**
 * Les démonstrations filmées.
 * ===========================
 *
 * Chaque entrée est une capture d'écran ANIMÉE de l'application en train de
 * servir : le doigt se voit, le geste se voit, le résultat se voit. Elles sont
 * tournées par `npm run tuto:videos` (voir scripts/tourner-videos-tuto.js) et
 * rangées dans `public/tuto`.
 *
 * Une seule source pour les deux usages — la visite guidée du menu, et les
 * bulles posées sur les écrans : un même geste ne doit pas être expliqué de
 * deux façons différentes selon l'endroit où on le rencontre.
 */

export interface Demo {
    /** Nom du fichier, sans extension, dans /public/tuto. */
    id: string;
    kicker: string;
    titre: string;
    texte: string;
    /** Ce qu'on invite à faire tout de suite après. */
    conseil: string;
    accent: string;
}

export const DEMOS: Record<string, Demo> = {
    'appui-long': {
        id: 'appui-long',
        kicker: 'Accueil',
        titre: 'Le menu caché des cartes',
        texte: 'Garde le doigt une seconde sur une vignette : un menu s’ouvre — favoris, à faire plus tard, planifier, partager, voir la catégorie.',
        conseil: 'Le cœur range en favoris, l’horloge dans « À faire plus tard ».',
        accent: '#FFD60A',
    },
    recherche: {
        id: 'recherche',
        kicker: 'Recherche',
        titre: 'Trouver une recette',
        texte: 'La loupe ouvre trois façons de chercher : par nom, par ce qu’il te reste au frigo, ou en décrivant ton envie à l’assistant. Les résultats se rafraîchissent à chaque lettre.',
        conseil: 'Appui long sur la loupe : la dictée démarre directement sur l’assistant.',
        accent: '#5E5CE6',
    },
    assistant: {
        id: 'assistant',
        kicker: 'Assistant',
        titre: 'Dis-lui ton envie',
        texte: 'Le troisième onglet de la recherche ne cherche pas des mots : il lit une phrase. « Un dîner rapide avec du poulet et du citron », et il rapporte ce qui existe sur le site.',
        conseil: 'Il connaît aussi ta cave : demande-lui un vin pour ton plat.',
        accent: '#64D2FF',
    },
    'mes-videos': {
        id: 'mes-videos',
        kicker: 'Mes vidéos',
        titre: 'Une vidéo devient une recette',
        texte: 'Colle le lien d’une vidéo de cuisine : le site en écoute la voix et en écrit la fiche — ingrédients, étapes, temps. Elle se range dans « Mes vidéos », sur l’accueil, et n’est visible que par toi.',
        conseil: 'Depuis TikTok : « Partager », puis « Copier le lien ». Il faut être connecté.',
        accent: '#FF9F0A',
    },
    filtres: {
        id: 'filtres',
        kicker: 'Le menu',
        titre: 'Filtrer sans se perdre',
        texte: 'Catégories, tendances et pays se cochent, et se combinent : desserts espagnols, plats italiens express. Le bouton du bas annonce le nombre de recettes avant même d’ouvrir.',
        conseil: 'Une coche de trop ? « Effacer » remet tout à plat.',
        accent: '#66D4CF',
    },
    fiche: {
        id: 'fiche',
        kicker: 'Recette',
        titre: 'La fiche',
        texte: 'Ingrédients pour le nombre de personnes que tu choisis, étapes une à une, minuteur, note, accord vin, ajout à la liste de courses. Coche un ingrédient : il file dans « Par recette ».',
        conseil: 'Fiche ouverte : balaye vers la gauche pour la recette voisine.',
        accent: '#30D158',
    },
    'mode-cuisine': {
        id: 'mode-cuisine',
        kicker: 'En cuisine',
        titre: 'Une étape à la fois',
        texte: '« Lancer la préparation » met une seule étape à l’écran, en grand : les mains sont occupées, on ne cherche pas sa ligne dans un paragraphe. Une étape chronométrée lance son minuteur toute seule.',
        conseil: 'Les étapes se lisent à voix haute : dis « suivant » sans poser ton couteau.',
        accent: '#FF453A',
    },
    courses: {
        id: 'courses',
        kicker: 'Courses',
        titre: 'La liste, rangée comme le magasin',
        texte: 'Trois façons de la lire : toute la semaine par rayon, jour par jour, ou recette par recette. Tout part au magasin par défaut — barre ce que tu as déjà au placard.',
        conseil: 'La barre du bas partage la liste, ou la déroule article par article au magasin.',
        accent: '#0A84FF',
    },
    'deplacer-repas': {
        id: 'deplacer-repas',
        kicker: 'Planificateur',
        titre: 'Déplacer un repas',
        texte: 'Appui long sur un repas déjà posé : il passe en main. Change de jour tranquillement, puis touche « Poser ici ». Le créneau d’arrivée déjà pris ? Les deux repas s’échangent.',
        conseil: 'La semaine se feuillette d’un balayage, un jour par écran.',
        accent: '#BF5AF2',
    },
    'jour-j': {
        id: 'jour-j',
        kicker: 'Jour J',
        titre: 'Le menu d’un grand soir',
        texte: 'Six services à remplir, de l’apéritif à la pâtisserie — et « Surprends-moi » comble les creux. Le prix du menu se met à jour à chaque plat ajouté.',
        conseil: '« Déroulé de la soirée » remonte les heures depuis le service : à 18 h 20, tu commences.',
        accent: '#FF375F',
    },
    'ma-cave': {
        id: 'ma-cave',
        kicker: 'Ma cave',
        titre: 'Ranger une bouteille',
        texte: 'Prends une carte de côté et descends-la vers « Goûté & approuvé » : la bouteille quitte la cave mais garde sa photo et ta note.',
        conseil: 'La dernière bouteille bue ? Le stock à zéro l’y range tout seul.',
        accent: '#AC8E68',
    },
};

export const listeDemos = (): Demo[] => Object.values(DEMOS);
