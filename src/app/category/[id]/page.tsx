import { redirect } from 'next/navigation';

/**
 * L'ancienne page catégorie n'existe plus : l'accueil actuel ouvre la
 * collection correspondante à partir de `?tag=` (TVHome, TVDesktopHome).
 */
export default function CategoryPage({ params }: { params: { id: string } }) {
    redirect(`/?tag=${encodeURIComponent(params.id)}`);
}
