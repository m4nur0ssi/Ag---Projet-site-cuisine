'use client';
import { useEffect } from 'react';
import { useIsMobile } from '@/components/device';

/**
 * Renvoie vers la version ACTUELLE du site (Apple TV+).
 *
 * Les anciennes pages (recette, catégorie, recherche, profil, favoris et
 * planificateur de l'ancien site) ne doivent plus jamais s'afficher : les
 * liens déjà envoyés, les favoris du navigateur et Google y mènent encore, on
 * les fait donc repartir au bon endroit. `location.replace` : le bouton
 * Retour ne ramène pas sur l'ancienne adresse.
 *
 * `mobile` / `desktop` : sur ordinateur, le planificateur, les favoris… sont
 * des panneaux de l'accueil (`/?panel=…`), pas des pages.
 */
export default function VersionActuelle({ mobile, desktop }: { mobile: string; desktop?: string }) {
    const isMobile = useIsMobile();
    useEffect(() => {
        if (isMobile === null) return;
        window.location.replace(isMobile ? mobile : (desktop ?? mobile));
    }, [isMobile, mobile, desktop]);
    return null;
}
