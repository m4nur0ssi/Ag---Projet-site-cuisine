import { CONTACT_EMAIL } from '@/lib/legal';

/**
 * « Ajouter une recette » : ouvre le courrier du lecteur, tout écrit.
 *
 * Le corps est un formulaire en creux — on répond sous chaque intitulé. Sans
 * ces lignes, on reçoit un lien seul et il faut relancer la personne pour les
 * ingrédients, les étapes et la cuisson.
 *
 * Défini ICI et pas dans un menu : les deux menus, celui du téléphone et celui
 * de l'ordinateur, doivent envoyer exactement le même message.
 */
export const MAIL_RECETTE = (() => {
    const sujet = 'Ajouter une recette';
    const corps = [
        'Salut Manu,',
        '',
        "J'aimerais que tu ajoutes cette recette :",
        '',
        'Lien TikTok, lien YouTube ou titre de la recette :',
        '',
        '',
        'Ingrédients :',
        '',
        '',
        'Étapes :',
        '',
        '',
        'Cuisson (température et durée) :',
        '',
        '',
        'Merci !',
    ].join('\n');
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
})();
