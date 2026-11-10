/**
 * Les ordres que l'on peut dire pendant la préparation.
 *
 * On compare des MOTS entiers, sans accents ni ponctuation : « go » ne se déclenche plus
 * dans « goût », « fin » dans « enfin », « prêt » dans « apprêter ». L'ordre des tests
 * compte : « arrête le minuteur » doit être compris avant « arrête » tout court.
 */
export type CommandeVoix =
    | 'suivant' | 'precedent' | 'repete' | 'ingredients'
    | 'minuteur' | 'stop-minuteur' | 'quitter';

const normaliser = (t: string) =>
    ` ${t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;

const TESTS: [CommandeVoix, RegExp][] = [
    ['stop-minuteur', / (arrete|stop|annule|coupe|eteins|supprime) .*minuteur | minuteur .*(arrete|stop|annule|coupe) /],
    ['minuteur', / (lance|demarre|mets|met|active|programme|declenche) .*(minuteur|chrono) | minuteur | chrono /],
    ['ingredients', / ingredients? | de quoi (j ai|on a|il faut) besoin | qu est ce qu il (me )?faut | il me faut quoi /],
    ['repete', / (repete|repeter|redis|encore une fois|j ai pas compris|pas compris|pardon) /],
    ['precedent', / (precedent|precedente|retour|reviens|revenir|en arriere) /],
    ['suivant', / (suivant|suivante|prochain|prochaine|on y va|c est bon|c est fait|c est pret|termine|fini|j ai fini) /],
    ['quitter', / (quitter|quitte|ferme|fermer|on arrete|arreter la preparation|stop la preparation) /],
];

/** Rend l'ordre compris dans la phrase entendue, ou `null`. */
export function analyserCommande(phrase: string): CommandeVoix | null {
    const t = normaliser(phrase);
    for (const [nom, motif] of TESTS) if (motif.test(t)) return nom;
    return null;
}

/** Ce qu'on affiche sous la phrase entendue quand l'ordre est reconnu. */
export const LIBELLE_COMMANDE: Record<CommandeVoix, string> = {
    suivant: 'Étape suivante',
    precedent: 'Étape précédente',
    repete: 'Je répète',
    ingredients: 'Les ingrédients',
    minuteur: 'Minuteur',
    'stop-minuteur': 'Minuteur arrêté',
    quitter: 'Je quitte',
};
