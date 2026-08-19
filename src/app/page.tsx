'use client';
import dynamic from 'next/dynamic';
import { useIsMobile } from '@/components/device';

// Accueil « Apple TV+ » des deux côtés. Les anciens accueils ont été supprimés
// du dépôt (ils affichaient encore les temps WordPress, faux sur les 617
// recettes) : pour revenir en arrière, prendre le tag `v-avant-accueil-tv`.
// Les bancs d'essai /tv et /tv-desktop sont partis avec — l'accueil réel EST
// désormais le banc d'essai.
const MobileHome = dynamic(() => import('@/mobile/screens/tv/TVHome'), { ssr: false });
const DesktopHome = dynamic(() => import('@/components/tvdesktop/TVDesktopHome'), { ssr: false });

export default function Page() {
    const isMobile = useIsMobile();
    if (isMobile === true) return <MobileHome />;
    return <DesktopHome />;
}
