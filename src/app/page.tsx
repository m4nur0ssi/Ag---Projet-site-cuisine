'use client';
import dynamic from 'next/dynamic';
import { useIsMobile } from '@/components/device';

// Accueil « Apple TV+ » des deux côtés. Les anciens accueils restent intacts
// dans le dépôt (`@/mobile/screens/page` et `@/components/DesktopHome`) : pour
// revenir en arrière, il suffit de rétablir l'import correspondant. Les routes
// /tv et /tv-desktop servent toujours de bancs d'essai.
const MobileHome = dynamic(() => import('@/mobile/screens/tv/TVHome'), { ssr: false });
const DesktopHome = dynamic(() => import('@/components/tvdesktop/TVDesktopHome'), { ssr: false });

export default function Page() {
    const isMobile = useIsMobile();
    if (isMobile === true) return <MobileHome />;
    return <DesktopHome />;
}
