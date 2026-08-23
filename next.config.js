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

    /**
     * Les recettes n'existent qu'en UN exemplaire dans le paquet livré.
     *
     * `src/data/mockData.ts` et `src/mobile/data/mockData.ts` sont écrits
     * ensemble par la synchro WordPress et ont toujours le même contenu (2,1 Mo
     * chacun). Les deux étaient embarqués : 3 Mo de JavaScript à télécharger,
     * analyser et exécuter sur le téléphone, pour deux fois les mêmes recettes.
     *
     * On ne fusionne PAS les fichiers : leurs types diffèrent (le mobile
     * connaît `video` et des catégories que le bureau ignore) et une dizaine de
     * scripts les réécrivent. L'alias n'agit qu'au moment de l'assemblage :
     * TypeScript continue de lire le fichier mobile et ses types, le
     * navigateur ne reçoit qu'une copie des données.
     */
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            [require('path').resolve(__dirname, 'src/mobile/data/mockData')]:
                require('path').resolve(__dirname, 'src/data/mockData.ts'),
        };
        return config;
    },
}

module.exports = nextConfig
