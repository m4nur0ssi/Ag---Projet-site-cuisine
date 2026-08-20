/**
 * Les astuces de première visite.
 *
 * Une par écran, montrée UNE FOIS, jamais deux. Chacune ne décrit pas l'écran :
 * elle demande un geste. On retient ce qu'on a fait, pas ce qu'on a lu — d'où
 * des textes qui commencent par un verbe et désignent un endroit précis.
 */
export interface Tip {
    /** Clé de mémorisation : ne JAMAIS la renommer, sinon l'astuce revient. */
    id: string;
    kicker: string;
    title: string;
    /** `{geste}` est remplacé par « appui long » ou « clic droit » selon l'appareil. */
    text: string;
    /** Intitulé du bouton de sortie (défaut : « J'ai compris »). */
    cta?: string;
}

export const TIPS: Record<string, Tip> = {
    accueil: {
        id: 'accueil',
        kicker: 'Bienvenue',
        title: 'Le menu caché des cartes',
        text: 'Fais un {geste} sur n’importe quelle carte de recette : un menu s’ouvre — favoris, à faire plus tard, partager, voir la catégorie.',
    },
    cave: {
        id: 'cave',
        kicker: 'Ma cave',
        title: 'Range une bouteille sans la perdre',
        text: 'Descends le stock d’une bouteille à zéro, ou tire-la vers « Goûté & approuvé » : elle quitte la cave mais garde sa photo et ta note. Un {geste} ouvre son menu.',
    },
    planner: {
        id: 'planner',
        kicker: 'Planificateur',
        title: 'Une semaine entière en un geste',
        text: 'Touche « Composer », tout en bas, choisis une tendance — Italie, Healthy, Barbecue — et les quatorze repas se remplissent sans jamais répéter un plat.',
    },
    courses: {
        id: 'courses',
        kicker: 'Liste de courses',
        title: 'Coche, puis choisis ton magasin',
        text: 'Coche les articles que tu veux : les boutons « Partager » et « Magasin » apparaissent alors, et n’emportent QUE ce qui est coché.',
    },
    favoris: {
        id: 'favoris',
        kicker: 'Favoris',
        title: 'Le cœur suit ton compte',
        text: 'Touche le cœur sur une recette, où que tu sois : elle se range ici, et te suit sur ton téléphone comme sur ton ordinateur.',
    },
    palmares: {
        id: 'palmares',
        kicker: 'Palmarès',
        title: 'Les trophées se gagnent en cuisinant',
        text: 'Rien à cocher ici : ouvre une recette, suis ses étapes, et marque-la comme cuisinée. Les pays, les plats et les semaines planifiées comptent tout seuls.',
    },
    resto: {
        id: 'resto',
        kicker: 'Comme au resto',
        title: 'Garde une trace de tes sorties',
        text: 'Ouvre une adresse et donne-lui tes étoiles : la pilule « j’ai testé » se souvient de ton passage, et ta note se range à côté de celle des autres.',
    },
    fiche: {
        id: 'fiche',
        kicker: 'La fiche',
        title: 'Deux gestes qui changent tout',
        text: 'Coche un ingrédient : il part dans ta liste de courses. Fais un {geste} dessus : les remplacements possibles s’affichent, s’il t’en manque un.',
    },
    recherche: {
        id: 'recherche',
        kicker: 'Recherche',
        title: 'Demande en français',
        text: 'Passe sur « Assistant » et décris ton envie — « un plat rapide au poulet », « un dessert sans gluten ». La dictée fonctionne aussi.',
    },
};
