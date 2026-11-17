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
    /* Texte lisible par Google : l'accueil est chargé côté navigateur, sans
       ceci le serveur renvoie une page sans titre ni contenu. Masqué à l'œil
       (pas display:none), lisible par les moteurs et les lecteurs d'écran. */
    const seo = (
        <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
            <h1>Les Recettes Magiques : recettes de cuisine faciles et gourmandes</h1>
            <p>
                Les Recettes Magiques réunit des centaines de recettes de cuisine faciles et rapides :
                plats, desserts, pâtes, gâteaux et idées du quotidien, avec la liste des ingrédients,
                les étapes détaillées et le temps de préparation.
            </p>
        </div>
    );
    return (
        <>
            {seo}
            {isMobile === true ? <MobileHome /> : <DesktopHome />}
        </>
    );
}
