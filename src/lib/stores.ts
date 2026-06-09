'use client';
// Magasins disponibles pour "Commander". Le choix est persistant (localStorage)
// et partagé partout via l'event 'store-changed'.
import { useEffect, useState } from 'react';

export type StoreId = 'carrefour' | 'picard' | 'monoprix' | 'franprix';

export interface StoreDef {
    id: StoreId;
    label: string;
    color: string;
    logo: string; // remplace le fichier dans public/images/stores/ par le vrai logo (même nom)
    search: (q: string) => string;
}

export const STORES: StoreDef[] = [
    { id: 'carrefour', label: 'Carrefour', color: '#004E9F', logo: '/images/stores/carrefour.svg', search: q => `https://www.carrefour.fr/s?q=${encodeURIComponent(q)}` },
    { id: 'picard',    label: 'Picard',    color: '#0A4A9F', logo: '/images/stores/picard.svg',    search: q => `https://www.picard.fr/recherche?q=${encodeURIComponent(q)}` },
    { id: 'monoprix',  label: 'Monoprix',  color: '#E6007E', logo: '/images/stores/monoprix.svg',  search: q => `https://www.monoprix.fr/courses/rechercher?q=${encodeURIComponent(q)}` },
    { id: 'franprix',  label: 'Franprix',  color: '#E2001A', logo: '/images/stores/franprix.svg',  search: q => `https://www.franprix.fr/recherche?q=${encodeURIComponent(q)}` },
];

export const STORE_BY_ID: Record<StoreId, StoreDef> =
    Object.fromEntries(STORES.map(s => [s.id, s])) as Record<StoreId, StoreDef>;

// URL de recherche d'un magasin + file complète des ingrédients encodée dans le
// hash (#mlist=...&mi=index). L'extension "Courses Magiques" lit cette file pour
// faire défiler les produits sans changer d'onglet. Sans extension : ignoré.
export function storeSearchWithQueue(id: StoreId, terms: string[], index = 0): string {
    const base = STORE_BY_ID[id].search(terms[index] || '');
    try {
        const payload = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(terms)))));
        return `${base}#mlist=${payload}&mi=${index}`;
    } catch {
        return base;
    }
}

const KEY = 'preferred-store';

export function getPreferredStore(): StoreId {
    try {
        const v = localStorage.getItem(KEY) as StoreId | null;
        if (v && STORE_BY_ID[v]) return v;
    } catch { /* SSR / accès refusé */ }
    return 'carrefour';
}

export function setPreferredStore(id: StoreId): void {
    try { localStorage.setItem(KEY, id); } catch { /* noop */ }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('store-changed'));
}

// Hook : magasin courant + setter, synchronisé entre toutes les instances.
export function usePreferredStore(): [StoreId, (id: StoreId) => void] {
    const [store, setStore] = useState<StoreId>('carrefour');
    useEffect(() => {
        setStore(getPreferredStore());
        const h = () => setStore(getPreferredStore());
        window.addEventListener('store-changed', h);
        window.addEventListener('storage', h);
        return () => { window.removeEventListener('store-changed', h); window.removeEventListener('storage', h); };
    }, []);
    const set = (id: StoreId) => { setPreferredStore(id); setStore(id); };
    return [store, set];
}
