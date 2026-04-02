/** @type {import('next').NextConfig} */
const nextConfig = {
    // Optimisé pour Vercel - Désactivation de l'API d'image interne pour économiser 100% de la bande passante "Fast Origin Transfer"
    images: {
        unoptimized: true, // Désormais Vercel ne traitera plus les images. Fini les blocages !
        remotePatterns: [
            {
                protocol: 'http',
                hostname: '109.221.250.122',
            },
            {
                protocol: 'https',
                hostname: 'cdn.pixabay.com',
            },
            {
                protocol: 'https',
                hostname: 'pixabay.com',
            },
            {
                protocol: 'https',
                hostname: 'www.tiktok.com',
            }
        ],
    },
    productionBrowserSourceMaps: false,
}

module.exports = nextConfig
