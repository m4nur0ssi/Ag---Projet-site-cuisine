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

import AppShell from '@/components/AppShell'

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
