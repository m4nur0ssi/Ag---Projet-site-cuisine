'use client';
// Page de TEST DE DESIGN (local) — accueil mobile façon Apple TV+.
// Non référencée depuis le site : aucune modification de l'accueil de production.
import dynamic from 'next/dynamic';

const TVHome = dynamic(() => import('@/mobile/screens/tv/TVHome'), { ssr: false });

export default function Page() {
    return <TVHome />;
}
