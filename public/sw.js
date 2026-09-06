// Service worker — offline pour favoris + liste de courses.
// Stratégies : navigations network-first (fallback cache → page offline),
// statiques cache-first, images stale-while-revalidate.
// v5 : bascule de l'accueil mobile vers TVHome (2026-08-14). Changer ce nom
// PURGE les anciens caches à l'activation — sans ça, un visiteur déjà venu
// pouvait continuer à recevoir l'ancienne page (repli hors-ligne des
// navigations + chunks JS servis cache-first).
// v6 : « Partager en image » réparé (2026-08-20). Un iPhone déjà venu gardait
// l'ancien lot de fichiers et continuait d'afficher un aperçu vide.
// v7 : la PWA revenait parfois sur une VIEILLE page (2026-08-23). Au lancement,
// la radio de l'iPhone n'est pas encore prête : le premier `fetch` échouait,
// on servait la copie en cache — un HTML d'il y a plusieurs jours, avec ses
// anciens fichiers, tous encore là (ils ne sont jamais purgés). D'où une app
// d'apparence complète, mais périmée. Voir `reseauAvecSecondeChance`.
// v8 : l'app se relançait en tapant « Ajouter au planificateur » (2026-09-06).
// Un morceau de code chargé À LA DEMANDE est le seul à partir APRÈS le
// démarrage — donc le seul exposé à une microcoupure. On répondait alors
// `Response.error()`, sans appel : Next.js constate le morceau manquant et
// recharge la page, écran d'ouverture compris. Les statiques ont désormais la
// même seconde chance que les navigations.
const CACHE = 'recettes-magiques-v8';
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

/**
 * Le réseau, avec une seconde chance.
 *
 * Au démarrage d'une PWA, la première requête part souvent avant que la
 * connexion soit établie et échoue aussitôt. Un demi-instant plus tard, elle
 * passe. Sans ce rattrapage, cet échec d'une fraction de seconde condamnait
 * toute la session à la copie en cache.
 */
async function reseauAvecSecondeChance(request) {
    try {
        return await fetch(request);
    } catch (_) {
        await new Promise((r) => setTimeout(r, 500));
        return await fetch(request);
    }
}

/** Prévient les pages ouvertes qu'elles affichent une copie, pas le site. */
async function signalerCopie() {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.postMessage({ type: 'SERVED_FROM_CACHE' }));
}

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
                const net = await reseauAvecSecondeChance(request);
                const cache = await caches.open(CACHE);
                cache.put(request, net.clone());
                return net;
            } catch (_) {
                const cached = await caches.match(request);
                if (cached) {
                    // La page saura se recharger dès le retour du réseau : une
                    // vieille copie dépanne hors ligne, elle ne doit pas devenir
                    // la version que l'on croit à jour.
                    event.waitUntil(signalerCopie());
                    return cached;
                }
                return (await caches.match(OFFLINE_URL)) || Response.error();
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
                /*
                 * La MÊME seconde chance que les navigations.
                 *
                 * Les morceaux de code chargés à la demande (un volet, une
                 * fiche) partent APRÈS le démarrage : ce sont les seuls à
                 * traverser le réseau en pleine utilisation, quand on passe
                 * sous un porche ou que la radio décroche une seconde. Un échec
                 * d'une fraction de seconde renvoyait `Response.error()` — et
                 * Next.js, voyant le morceau manquant, rechargeait la page.
                 */
                const net = await reseauAvecSecondeChance(request);
                if (net && net.status === 200) { const c = await caches.open(CACHE); c.put(request, net.clone()); }
                return net;
            } catch (_) { return cached || Response.error(); }
        })());
        return;
    }

    // 4) Reste : réseau d'abord, repli cache.
    event.respondWith(fetch(request).catch(() => caches.match(request)));
});
