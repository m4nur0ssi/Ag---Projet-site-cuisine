'use client';
import VersionActuelle from '@/components/VersionActuelle/VersionActuelle';

/**
 * L'ancien planificateur n'existe plus : celui de la version actuelle
 * (page au téléphone, panneau de l'accueil au bureau).
 */
export default function Page() {
    return <VersionActuelle mobile="/tv-planner" desktop="/?panel=planner" />;
}
