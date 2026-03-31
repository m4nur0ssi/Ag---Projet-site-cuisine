/** @type {import('next').NextConfig} */
const nextConfig = {
    // Optimisé pour Vercel
    images: {
        unoptimized: false, // ACTIVÉ : Vercel va maintenant compacter tes images (WebP/AVIF) otomatisement
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
