import type { Metadata } from 'next'
import './globals.css'

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
            url: `/splash/splash-v2-${l}x${h}.png`,
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

/* Identifiant de mesure Google Analytics 4 (propriété « Les Recettes Magiques »).
   Ce n'est pas un secret : il part dans le HTML de chaque page. Écrit ici pour
   qu'aucun réglage d'hébergeur ne soit nécessaire ; NEXT_PUBLIC_GA_ID peut le
   remplacer (autre propriété), et la chaîne vide coupe la mesure. */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? 'G-DRF282F5YG'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="fr" suppressHydrationWarning>
            <head>
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
                {/* Google Analytics 4 — CHARGÉ SEULEMENT APRÈS « Accepter ».

                    Le mode consentement ne suffisait pas : même réglé sur « denied »,
                    le script de Google était téléchargé dès la première page et
                    continuait d'envoyer des relevés sans cookie, donc l'adresse IP du
                    visiteur, à un serveur hors UE. La CNIL n'exempte pas cette mesure.
                    Rien ne part donc chez Google tant que le bandeau n'a pas été accepté.

                    Le chargeur est posé sur window : le bandeau l'appelle au clic, sans
                    recharger la page. Jamais en local (les visites de développement
                    fausseraient les chiffres). */}
                {GA_ID && (
                    <script
                        dangerouslySetInnerHTML={{
                            __html: `
                                (function() {
                                    var h = location.hostname;
                                    if (h === 'localhost' || h === '127.0.0.1') return;
                                    window.__chargerMesure = function() {
                                        if (window.__mesureChargee) return;
                                        window.__mesureChargee = true;
                                        gtag('js', new Date());
                                        gtag('config', '${GA_ID}');
                                        var s = document.createElement('script');
                                        s.async = true;
                                        s.src = 'https://www.googletagmanager.com/gtag/js?id=${GA_ID}';
                                        document.head.appendChild(s);
                                    };
                                    /* Visiteur déjà consentant : on n'attend pas que React
                                       ait monté le bandeau pour reprendre la mesure. */
                                    try {
                                        var brut = localStorage.getItem('cookie-consent-v1');
                                        if (brut && brut.indexOf('accepted') !== -1) {
                                            gtag('consent', 'update', {
                                                ad_storage: 'granted',
                                                analytics_storage: 'granted',
                                                ad_user_data: 'granted',
                                                ad_personalization: 'granted'
                                            });
                                            window.__chargerMesure();
                                        }
                                    } catch (e) {}
                                })();
                            `,
                        }}
                    />
                )}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                /* Clair ou sombre : la réponse est écrite ICI, avant le
                                   premier affichage, et une bonne fois.

                                   Les feuilles de style posaient la question de deux
                                   façons — l'attribut data-theme, et la préférence
                                   du système. Or data-theme n'était posé que par le
                                   bouton de thème, qui n'est pas monté sur tous les
                                   écrans : téléphone en mode clair, l'attribut restait
                                   absent. Les règles « système clair » blanchissaient
                                   les fonds, celles de data-theme laissaient les
                                   textes en blanc — on lisait du blanc sur du blanc.

                                   Une seule source, donc : le choix de l'utilisateur
                                   s'il en a fait un, sinon le réglage du téléphone. */
                                try {
                                    var t = localStorage.getItem('theme');
                                    if (t !== 'light' && t !== 'dark') {
                                        t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
                                    }
                                    document.documentElement.setAttribute('data-theme', t);
                                } catch (e) {
                                    document.documentElement.setAttribute('data-theme', 'dark');
                                }
                                try {
                                    var ua = navigator.userAgent || '';
                                    var narrow = window.matchMedia('(max-width: 1024px)').matches;
                                    var mobUA = /iPhone|iPod|iPad|Android|Mobile/i.test(ua);
                                    window.__isMobile = !!(narrow || mobUA);
                                    document.documentElement.classList.add(window.__isMobile ? 'is-mobile' : 'is-desktop');

                                } catch (e) { window.__isMobile = false; }
                            })();
                        `,
                    }}
                />
            </head>
            <body>
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
