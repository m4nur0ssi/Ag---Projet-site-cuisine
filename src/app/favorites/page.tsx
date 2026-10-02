'use client';
import dynamic from 'next/dynamic';
import { useIsMobile } from '@/components/device';
import VersionActuelle from '@/components/VersionActuelle/VersionActuelle';

const MobilePage = dynamic(() => import('@/mobile/screens/favorites/page'), { ssr: false });

/**
 * Au téléphone, l'écran Favoris est celui de la version actuelle. Au bureau,
 * l'ancienne page ne s'affiche plus : les favoris sont un panneau de l'accueil.
 */
export default function Page() {
    const isMobile = useIsMobile();
    if (isMobile === true) return <MobilePage />;
    return <VersionActuelle mobile="/favorites" desktop="/?panel=favoris" />;
}
