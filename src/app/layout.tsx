import type { Metadata } from 'next'
import './globals.css'
import { mockRecipes } from '@/data/mockData'

export const metadata: Metadata = {
    metadataBase: new URL('https://lesrecettesmagiques.fr'),
    title: {
        default: 'Les Recettes Magiques - Cuisine Enchantée',
        template: '%s | Les Recettes Magiques',
    },
    description: 'Découvrez des recettes magiques et délicieuses pour enchanter vos papilles',
    keywords: ['recettes', 'recettes magiques', 'cuisine', 'magie', 'gastronomie', 'recette facile'],
    manifest: '/manifest.json',
    /*
     * Plein écran sur les iPhone d'avant iOS 16.4.
     *
     * Depuis 16.4, Safari lit le manifeste et honore `display: standalone`.
     * En dessous, sans ces balises, le site ajouté à l'écran d'accueil s'ouvre
     * AVEC la barre d'adresse — c'est-à-dire sans l'allure d'application qui
     * justifie l'installation.
     */
    appleWebApp: {
        capable: true,
        title: 'Recettes Magiques',
        // Le contenu passe sous l'heure et la batterie, qui restent lisibles en
        // blanc sur nos fonds sombres.
        statusBarStyle: 'black-translucent',
    },
    icons: [
        { rel: 'icon', url: '/icons/icon-192x192.png', type: 'image/png' },
        { rel: 'apple-touch-icon', sizes: '180x180', url: '/icons/icon-180x180.png' },
        { rel: 'apple-touch-icon', sizes: '192x192', url: '/icons/icon-192x192.png' },
        /*
         * Écrans de lancement iOS. Apple ne met pas ces images à l'échelle : il
         * faut la taille exacte de l'écran, sélectionnée par media query, sinon
         * il retombe sur un rectangle vide. Générés par
         * `node scripts/build-splash-ios.js`.
         */
        ...[
            [1320, 2868, 3], [1290, 2796, 3], [1206, 2622, 3], [1179, 2556, 3],
            [1170, 2532, 3], [1125, 2436, 3], [828, 1792, 2], [750, 1334, 2],
        ].map(([l, h, d]) => ({
            rel: 'apple-touch-startup-image',
            url: `/splash/splash-${l}x${h}.png`,
            media: `(device-width: ${l / d}px) and (device-height: ${h / d}px) and (-webkit-device-pixel-ratio: ${d}) and (orientation: portrait)`,
        })),
    ],
    alternates: {
        canonical: '/',
    },
    verification: {
        google: '4Ey6Ijivoum_YAXbUB_JQfhzShnkWHj2SZfniaoBCh4',
    },
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        type: 'website',
        locale: 'fr_FR',
        url: 'https://lesrecettesmagiques.fr',
        siteName: 'Les Recettes Magiques',
        title: 'Les Recettes Magiques - Cuisine Enchantée',
        description: 'Découvrez des recettes magiques et délicieuses pour enchanter vos papilles',
    },
}

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#f5f5f7' },
        { media: '(prefers-color-scheme: dark)', color: '#000000' },
    ],
}

import AppShell from '@/components/AppShell'
import CookieConsent from '@/components/CookieConsent/CookieConsent'
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="fr" suppressHydrationWarning>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Outfit:wght@400;600;800;900&display=swap" rel="stylesheet" />
                {/* Google Consent Mode v2 — refus par défaut tant que l'utilisateur n'a pas consenti.
                    Aucun cookie de mesure/pub n'est autorisé avant le clic sur "Accepter". */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            window.dataLayer = window.dataLayer || [];
                            function gtag(){dataLayer.push(arguments);}
                            window.gtag = gtag;
                            gtag('consent', 'default', {
                                ad_storage: 'denied',
                                analytics_storage: 'denied',
                                ad_user_data: 'denied',
                                ad_personalization: 'denied',
                                wait_for_update: 500
                            });
                        `,
                    }}
                />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    var ua = navigator.userAgent || '';
                                    var narrow = window.matchMedia('(max-width: 1024px)').matches;
                                    var mobUA = /iPhone|iPod|iPad|Android|Mobile/i.test(ua);
                                    window.__isMobile = !!(narrow || mobUA);
                                    document.documentElement.classList.add(window.__isMobile ? 'is-mobile' : 'is-desktop');

                                    /* Écran d'accueil : la décision est prise ICI, avant le
                                       premier affichage. Le splash est chargé à la demande ;
                                       le temps que son morceau de code arrive (une bonne
                                       demi-seconde en PWA), l'accueil s'affichait puis se
                                       faisait recouvrir — ce clignotement, c'est l'écran de
                                       trop. On masque donc le contenu tout de suite. */
                                    if (window.__isMobile) {
                                        var KEY = 'hasSeenMagicSplash-v8';
                                        var sp = new URLSearchParams(window.location.search);
                                        if (sp.has('fiche') || sp.has('q')) {
                                            sessionStorage.setItem(KEY, 'true');
                                        } else if (!sessionStorage.getItem(KEY)) {
                                            document.documentElement.classList.add('is-splashing');
                                            /* Filet : si le splash ne se montait pas (code non
                                               chargé, erreur), le contenu resterait caché. Le
                                               splash annule ce minuteur dès qu'il s'affiche. */
                                            window.__splashGuard = setTimeout(function () {
                                                document.documentElement.classList.remove('is-splashing');
                                            }, 5000);
                                        }
                                    }
                                } catch (e) { window.__isMobile = false; }
                            })();
                        `,
                    }}
                />
            </head>
            <body>
                {/* Écran d'accueil INSTANTANÉ.

                    Le vrai splash est un composant chargé à la demande : le temps
                    que son morceau de code arrive et que React s'hydrate, l'écran
                    restait noir — c'est l'attente signalée au lancement de la PWA.
                    Ce squelette-ci vient avec le HTML : il s'affiche à la première
                    image, sans une ligne de JavaScript. Le splash animé prend le
                    relais dès qu'il est prêt (classe `splash-live`), sur le même
                    fond et la même typographie : la relève ne se voit pas. */}
                <div id="splash-boot" aria-hidden="true">
                    <div className="splash-boot-frame">
                        <p className="splash-boot-kicker">Les Recettes</p>
                        <span className="splash-boot-title">Magiques</span>
                        <span className="splash-boot-count">{mockRecipes.length} recettes</span>
                    </div>
                </div>
                <AppShell>
                    {children}
                </AppShell>
                <CookieConsent />
                {/* Vercel Web Analytics (Hobby, gratuit) : visiteurs + pages vues. */}
                <Analytics />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            if ('serviceWorker' in navigator) {
                                var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
                                if (isLocal) {
                                    // Dev : pas de SW (sinon chunks Next stale -> originalFactory undefined).
                                    navigator.serviceWorker.getRegistrations().then(function(rs){ rs.forEach(function(r){ r.unregister(); }); });
                                    if (window.caches) caches.keys().then(function(ks){ ks.forEach(function(k){ caches.delete(k); }); });
                                } else {
                                    window.addEventListener('load', function() {
                                        navigator.serviceWorker.register('/sw.js');
                                    });
                                    /* Le service worker prévient quand il a servi une COPIE
                                       (réseau injoignable au lancement). On ne reste pas sur
                                       une page d'il y a trois jours : dès que la connexion
                                       revient, on recharge. Une seule fois — pas de boucle
                                       si le réseau vacille. */
                                    navigator.serviceWorker.addEventListener('message', function (e) {
                                        if (!e.data || e.data.type !== 'SERVED_FROM_CACHE') return;
                                        if (window.__copieSignalee) return;
                                        window.__copieSignalee = true;
                                        var rafraichir = function () {
                                            if (!navigator.onLine) return;
                                            window.removeEventListener('online', rafraichir);
                                            location.reload();
                                        };
                                        window.addEventListener('online', rafraichir);
                                    });
                                }
                            }
                        `,
                    }}
                />
            </body>
        </html>
    )
}
// Force rebuild - Rollback stable
