/** @type {import('next').NextConfig} */
const nextConfig = {
    // Optimisé pour Vercel
    images: {
        unoptimized: true, // Garder True si on utilise des images externes sans config
    },
    productionBrowserSourceMaps: false,
}

module.exports = nextConfig
