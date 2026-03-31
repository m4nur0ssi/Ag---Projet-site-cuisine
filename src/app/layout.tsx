import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'Les Recettes Magiques - Cuisine Enchantée',
    description: 'Découvrez des recettes magiques et délicieuses pour enchanter vos papilles',
    keywords: ['recettes', 'cuisine', 'magie', 'gastronomie'],
    manifest: '/manifest.json',
    icons: [
        { rel: 'apple-touch-icon', url: '/icons/icon-192x192.png' },
    ],
    robots: {
        index: false,
        follow: false,
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

import { TimerProvider } from '@/components/Timer/TimerContext'
import SplashScreen from '@/components/SplashScreen/SplashScreen'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="fr">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Outfit:wght@400;600;800;900&display=swap" rel="stylesheet" />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    var isIPhone = /iPhone/i.test(navigator.userAgent);
                                    var hasSeenSplash = sessionStorage.getItem('hasSeenMagicSplash');
                                    if (isIPhone && !hasSeenSplash) {
                                        document.documentElement.classList.add('is-splashing');
                                    }
                                } catch (e) {}
                            })();
                        `,
                    }}
                />
            </head>
            <body>
                <SplashScreen />
                <TimerProvider>
                    <div className="main-content-wrapper">
                        {children}
                    </div>
                </TimerProvider>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            if ('serviceWorker' in navigator) {
                                window.addEventListener('load', function() {
                                    navigator.serviceWorker.register('/sw.js');
                                });
                            }
                        `,
                    }}
                />
            </body>
        </html>
    )
}
// Force rebuild - Rollback stable
