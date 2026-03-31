const CACHE_NAME = 'recettes-magiques-v2'; // Increment version
const STATIC_ASSETS = [
    '/recettes/',
    '/recettes/manifest.json',
    '/recettes/icons/icon-192x192.png',
    '/recettes/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Cache strategy: Stale-While-Revalidate for images and scripts
    if (request.destination === 'image' || url.hostname.includes('lesrec3ttesm4giques.fr')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(request).then((response) => {
                    const fetchPromise = fetch(request).then((networkResponse) => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                    return response || fetchPromise;
                });
            })
        );
        return;
    }

    // Default Cache-First for static assets
    event.respondWith(
        caches.match(request).then((response) => {
            return response || fetch(request);
        })
    );
});
