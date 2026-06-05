// Aide PWA : précache les favoris (pages + images) pour consultation hors-ligne.

// Base de l'app déduite de l'URL courante (gère le déploiement sous /recettes/).
export const appBase = (): string => {
    if (typeof window === 'undefined') return '';
    const m = window.location.pathname.match(
        /^(.*?)\/(favorites|shopping-list|recipe|search|profile|meal-planner|category)(\/|$)/
    );
    return m ? m[1] : '';
};

// Demande au service worker de mettre en cache une liste d'URLs.
export const precacheUrls = (urls: string[]): void => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !urls.length) return;
    navigator.serviceWorker.ready
        .then((reg) => {
            const sw = reg.active || navigator.serviceWorker.controller;
            if (sw) sw.postMessage({ type: 'CACHE_URLS', urls });
        })
        .catch(() => { /* SW indispo : sans effet */ });
};

// Précache les pages détail + images des recettes favorites.
export const precacheFavorites = (recipes: { id: string; image?: string }[]): void => {
    if (typeof window === 'undefined' || !recipes.length) return;
    const base = `${window.location.origin}${appBase()}`;
    const urls: string[] = [];
    recipes.forEach((r) => {
        urls.push(`${base}/recipe/${r.id}`);
        if (r.image) urls.push(r.image);
    });
    precacheUrls(urls);
};
