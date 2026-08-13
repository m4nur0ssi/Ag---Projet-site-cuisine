'use client';
// Page de TEST DE DESIGN (local) — accueil DESKTOP façon Apple TV+ (app Mac).
// Non référencée depuis le site : l'accueil desktop de production reste intact.
import dynamic from 'next/dynamic';

const TVDesktopHome = dynamic(() => import('@/components/tvdesktop/TVDesktopHome'), { ssr: false });

export default function Page() {
    return <TVDesktopHome />;
}
