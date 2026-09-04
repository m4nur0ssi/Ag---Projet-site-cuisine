'use client';

/**
 * useAmbianceImage — donne à une fiche la couleur de SA photo.
 *
 * Renvoie `null` tant que la photo n'est pas lue, et si elle n'a aucune couleur
 * exploitable (photo en noir et blanc, plan de travail nu). L'appelant garde
 * alors sa couleur de repli : il ne doit jamais y avoir de moment gris.
 */

import { useEffect, useState } from 'react';
import { lireAmbiance, type AmbianceImage } from './couleur-image';

export function useAmbianceImage(src?: string | null): AmbianceImage | null {
    const [ambiance, setAmbiance] = useState<AmbianceImage | null>(null);

    useEffect(() => {
        if (!src) { setAmbiance(null); return; }
        let vivant = true;
        // La photo est déjà dans le cache du navigateur (la carte l'a affichée) :
        // la relire ne coûte qu'un décodage, sans nouvel aller-retour réseau.
        lireAmbiance(src).then((a) => { if (vivant) setAmbiance(a); });
        return () => { vivant = false; };
    }, [src]);

    return ambiance;
}
