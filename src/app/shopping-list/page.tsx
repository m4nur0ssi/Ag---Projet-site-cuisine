import { redirect } from 'next/navigation';

/**
 * L'ancienne liste de courses n'existe plus.
 * =========================================
 *
 * Il y en avait deux : celle-ci, à l'ancien style du site (en-tête clair,
 * onglets Semaine / Jour J / Fusionnée / Recettes), et celle d'Apple TV+ que le
 * téléphone et la coquille de bureau servent tous les deux — le même composant,
 * `TVCourses`. Deux listes, deux comportements, un seul stockage : le réglage
 * « semaine incluse » posé d'un côté était ignoré de l'autre.
 *
 * On garde celle qui est utilisée. Les liens déjà envoyés, les favoris du
 * navigateur et l'ancien en-tête — qui sert encore sur les pages hors coquille
 * TV+ — arrivent ici et repartent au bon endroit.
 *
 * `DesktopPage.tsx` reste sur le disque : le tutoriel lui emprunte encore son
 * `ExtensionBubble`. Plus aucune route ne le rend.
 */
export default function Page() {
    redirect('/tv-courses');
}
