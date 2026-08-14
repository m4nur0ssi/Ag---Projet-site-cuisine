'use client';
import dynamic from 'next/dynamic';
import { useIsMobile } from '@/components/device';
import DesktopHome from '@/components/DesktopHome';

// Accueil mobile « Apple TV+ ». L'ancien accueil reste intact dans le dépôt
// (`@/mobile/screens/page`) : pour revenir en arrière, il suffit de rétablir
// l'import ci-dessous. La route /tv sert toujours de banc d'essai.
const MobileHome = dynamic(() => import('@/mobile/screens/tv/TVHome'), { ssr: false });

export default function Page() {
    const isMobile = useIsMobile();
    if (isMobile === true) return <MobileHome />;
    // Desktop : accueil actuel inchangé (la version TV desktop, /tv-desktop,
    // n'a pas encore été revue de bout en bout).
    return <DesktopHome />;
}
