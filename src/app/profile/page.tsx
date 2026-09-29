'use client';
import VersionActuelle from '@/components/VersionActuelle/VersionActuelle';

/** L'ancien profil n'existe plus : Palmarès (page au téléphone, panneau au bureau). */
export default function Page() {
    return <VersionActuelle mobile="/tv-profil" desktop="/?panel=trophies" />;
}
