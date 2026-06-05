// Service worker — offline pour favoris + liste de courses.
// Stratégies : navigations network-first (fallback cache → page offline),
// statiques cache-first, images stale-while-revalidate.
const CACHE = 'recettes-magiques-v3';
const OFFLINE_URL = new URL('offline.html', self.location).toString();

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        // Page de repli offline (relative au scope du SW → marche en dev et sous /recettes/).
        try { await cache.add(new Request(OFFLINE_URL, { cache: 'reload' })); } catch (_) {}
        self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

// Precache à la demande : la page poste les URLs des recettes favorites + leurs images.
self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
    if (data.type === 'CACHE_URLS' && Array.isArray(data.urls)) {
        event.waitUntil((async () => {
            const cache = await caches.open(CACHE);
            await Promise.all(data.urls.map(async (u) => {
                try {
                    const res = await fetch(u, { cache: 'reload' });
                    if (res && (res.ok || res.type === 'opaque')) await cache.put(u, res.clone());
                } catch (_) { /* hors-ligne : on ignore */ }
            }));
        })());
    }
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    // Dev : ne jamais intercepter en local (sinon chunks Next stale servis cache-first).
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return;

    // 1) Navigations : réseau d'abord, sinon cache, sinon page offline.
    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const net = await fetch(request);
                const cache = await caches.open(CACHE);
                cache.put(request, net.clone());
                return net;
            } catch (_) {
                const cached = await caches.match(request);
                return cached || (await caches.match(OFFLINE_URL)) || Response.error();
            }
        })());
        return;
    }

    // 2) Images + CDN du site : stale-while-revalidate.
    if (request.destination === 'image' || url.hostname.includes('lesrec3ttesm4giques.fr')) {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE);
            const cached = await cache.match(request);
            const fetchP = fetch(request)
                .then((r) => { if (r && (r.status === 200 || r.type === 'opaque')) cache.put(request, r.clone()); return r; })
                .catch(() => cached);
            return cached || fetchP;
        })());
        return;
    }

    // 3) Statiques même origine (_next/static, css, js, fonts) : cache-first.
    const isStatic = url.origin === self.location.origin &&
        (url.pathname.includes('/_next/static') || ['style', 'script', 'font'].includes(request.destination));
    if (isStatic) {
        event.respondWith((async () => {
            const cached = await caches.match(request);
            if (cached) return cached;
            try {
                const net = await fetch(request);
                if (net && net.status === 200) { const c = await caches.open(CACHE); c.put(request, net.clone()); }
                return net;
            } catch (_) { return cached || Response.error(); }
        })());
        return;
    }

    // 4) Reste : réseau d'abord, repli cache.
    event.respondWith(fetch(request).catch(() => caches.match(request)));
});
