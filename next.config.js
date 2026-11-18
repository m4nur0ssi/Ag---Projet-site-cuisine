/*
 * L'identité d'une version du site.
 *
 * Next.js compare, à CHAQUE navigation interne, l'identifiant de construction
 * de la page ouverte à celui du serveur : s'ils diffèrent, il abandonne la
 * navigation douce et recharge tout le document — l'écran blanc d'une
 * demi-seconde sur le téléphone. Le site est redéployé plusieurs fois par jour
 * (synchro WordPress), donc une PWA restée ouverte en arrière-plan tombait
 * dedans au premier appui.
 *
 * On fixe donc cet identifiant NOUS-MÊMES et on l'expose au navigateur
 * (NEXT_PUBLIC_VERSION_APP) et au serveur (/api/version) : l'app peut ainsi
 * apprendre qu'une nouvelle version existe au moment où elle revient au premier
 * plan, et se mettre à jour à ce moment-là plutôt qu'au milieu d'un geste.
 * Voir src/components/VersionAJour.
 */
const VERSION_APP =
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    `local-${Date.now()}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
    generateBuildId: async () => VERSION_APP,
    env: {
        NEXT_PUBLIC_VERSION_APP: VERSION_APP,
    },
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
     * Cache navigateur des images du site.
     *
     * Par défaut Vercel sert `public/` avec `max-age=0, must-revalidate` : le
     * navigateur redemande chaque photo à chaque affichage, et chaque « 304
     * inchangé » compte comme une requête CDN. Sur le quota gratuit (1 M/mois),
     * c'est ce qui a mis le compte en pause.
     *
     * Un jour de cache franc, puis une semaine de copie servie pendant la
     * mise à jour en arrière-plan. Une photo régénérée au même nom peut donc
     * mettre jusqu'à un jour à s'afficher.
     */
    async headers() {
        const cacheImages = [{
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
        }];
        return [
            { source: '/recipes-ia/:path*', headers: cacheImages },
            { source: '/recipes/:path*', headers: cacheImages },
            { source: '/ingredients/:path*', headers: cacheImages },
            { source: '/images/:path*', headers: cacheImages },
        ];
    },

    /**
     * Le détourage des bouteilles a besoin de ses binaires.
     *
     * `/api/decoupe-bouteille` fait tourner U²-Net sur le runtime WASM
     * d'ONNX. Ces deux fichiers sont ouverts par un CHEMIN calculé à
     * l'exécution (`path.join(process.cwd(), …)`) : l'analyse statique de Next
     * ne peut pas les voir, et la fonction partait chez Vercel sans eux. Le
     * modèle sortait alors une erreur « no such file » à la première photo,
     * uniquement en production — le développement local lit le disque du
     * projet et ne montre rien.
     *
     * On les déclare donc à la main. Pour mémoire : `onnxruntime-node` aurait
     * évité ce détour, mais il pèse 301 Mo, au-dessus de la limite d'une
     * fonction Vercel.
     */
    outputFileTracingIncludes: {
        '/api/decoupe-bouteille': [
            './public/modeles/u2netp.onnx',
            './node_modules/onnxruntime-web/dist/*.wasm',
            './node_modules/onnxruntime-web/dist/*.mjs',
        ],
    },

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
