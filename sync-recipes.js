const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');

// On utilise node-fetch (v2) pour plus de stabilité dans GitHub Actions (Node 18+)
const fetch = require('node-fetch');

/**
 * Script de synchronisation des recettes depuis WordPress vers le projet local
 * Ce script interroge l'API REST de WordPress et génère le fichier mockData.ts
 */

// Configuration des IP
const WORDPRESS_DOMAIN = 'lesrec3ttesm4giques.fr';
const WORDPRESS_PUBLIC_IP = process.env.WP_PUBLIC_IP || '109.221.250.122';
const WORDPRESS_LOCAL_IP = '192.168.1.200';

// Détection intelligente de l'environnement
const isCI = process.env.GITHUB_ACTIONS === 'true';
let ACTIVE_IP = (isCI || process.env.WP_FORCE_PUBLIC === 'true') ? WORDPRESS_PUBLIC_IP : WORDPRESS_LOCAL_IP;

console.log(`📡 Environnement: ${isCI ? 'GitHub CI' : 'Local'} | IP choisie: ${ACTIVE_IP}`);

const WORDPRESS_API_URL = `http://${ACTIVE_IP}/wordpress/wp-json/wp/v2`;
const IMAGE_BASE_URL = `http://${WORDPRESS_PUBLIC_IP}`;

const SYNC_ALL = !process.argv.includes('--recent');
const DELETE_ID = process.argv.find(arg => arg.startsWith('--delete-id='))?.split('=')[1] || null;

// Destins des fichiers générés
const MOCK_DATA_PATH = path.join(__dirname, 'src/data/mockData.ts');
const SYNC_STATS_PATH = path.join(__dirname, 'src/data/sync-stats.json');

/**
 * Décode les entités HTML courantes
 */
function decodeHtmlEntities(text) {
    if (!text) return "";
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, "-")
        .replace(/&#8230;/g, "...")
        .replace(/&nbsp;/g, " ")
        .replace(/\u00A0/g, " ");
}

/**
 * Extrait les données structurées du contenu HTML d'un post WordPress
 */
function extractRecipeData(post) {
    const cleanContent = post.content.rendered;
    
    // 1. Recherche du container structuré (Magic Post Parser ou autre)
    const splitIndex = cleanContent.indexOf('<div id="mpprecipe-container');
    let rawDescription = "";
    let pluginContent = "";

    if (splitIndex !== -1) {
        rawDescription = cleanContent.substring(0, splitIndex);
        pluginContent = cleanContent.substring(splitIndex);
    } else {
        rawDescription = cleanContent;
    }

    // 2. Extraction des ingrédients
    let ingredients = [];
    
    // On essaie d'extraire les ingrédients du bloc mpprecipe
    const ingBlockMatch = pluginContent.match(/<ul[^>]*id=["']mpprecipe-ingredients-list["'][^>]*>([\s\S]*?)<\/ul>/i);
    if (ingBlockMatch) {
        const items = ingBlockMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
        for (const match of items) {
            let text = match[1].replace(/<[^>]*>/g, '').trim();
            if (text) ingredients.push({ quantity: "", name: decodeHtmlEntities(text) });
        }
    }

    // 3. Extraction des étapes
    let steps = [];
    const stepMatch = pluginContent.match(/<ol[^>]*id=["']mpprecipe-instructions-list["'][^>]*>([\s\S]*?)<\/ol>/i);
    if (stepMatch) {
        const items = stepMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
        for (const match of items) {
            let text = match[1].replace(/<[^>]*>/g, '').trim();
            if (text) steps.push(decodeHtmlEntities(text));
        }
    }

    // 4. Fallback intelligent pour les étapes si le plugin est absent ou vide
    // IMPORTANT : On utilise rawDescription pour ne pas avoir de résidus du plugin !
    if (steps.length < 2) {
        let textForSteps = rawDescription;
        // Supprimer tags complexes
        textForSteps = textForSteps.replace(/<div[^>]*>|<\/div>|<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ');
        
        const blocks = textForSteps.split(/<img[^>]*>|<hr[^>]*>|<p[^>]*>|<\/p>|<br\s*\/?>/i);
        
        const refinedSteps = blocks.map(b => {
            let t = b.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            return decodeHtmlEntities(t);
        }).filter(s => {
            if (s.length < 20) return false;
            const low = s.toLowerCase();
            if (low.includes('cliquez pour') || low.includes('save recipe') || low.includes('print recipe') || low.includes('regarder la vidéo')) return false;
            if (low === 'ingredients' || low === 'préparation' || low === 'conseils de préparation') return false;
            // Éliminer les résidus de tags mal coupés
            if (s.includes('style=') || s.includes('width=') || s.includes('height=')) return false;
            return true;
        });

        if (refinedSteps.length >= 2) {
            steps = refinedSteps;
        }
    }

    // 5. Extraction des métadonnées (temps, parts, difficulté)
    const prepTimeMatch = pluginContent.match(/Préparation :<\/strong>\s*(\d+)/i);
    const cookTimeMatch = pluginContent.match(/Cuisson :<\/strong>\s*(\d+)/i);
    const servingsMatch = pluginContent.match(/Parts :<\/strong>\s*(\d+)/i);
    const difficultyMatch = pluginContent.match(/Difficulté :<\/strong>\s*(.*?)</i);

    // 6. Extraction de la vidéo TikTok
    let videoHtml = "";
    const tiktokMatch = cleanContent.match(/<blockquote[^>]*tiktok-embed[\s\S]*?<\/blockquote>/i);
    if (tiktokMatch) {
        videoHtml = tiktokMatch[0] + '<script async src="https://www.tiktok.com/embed.js"></script>';
    }

    // Description propre (avant le plugin)
    let description = decodeHtmlEntities(rawDescription.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
    if (description.length > 250) description = description.substring(0, 247) + "...";

    return {
        id: String(post.id),
        title: decodeHtmlEntities(post.title.rendered),
        description: description,
        image: post._embedded?.['wp:featuredmedia']?.[0]?.source_url 
            ? `/api/image-proxy?url=${encodeURIComponent(post._embedded['wp:featuredmedia'][0].source_url.replace(WORDPRESS_LOCAL_IP, WORDPRESS_PUBLIC_IP))}&v=${new Date(post.modified).getTime()}`
            : "/images/recipe-placeholder.jpg",
        category: (() => {
            const title = decodeHtmlEntities(post.title.rendered).toLowerCase();
            const tags = (post._embedded?.['wp:term']?.[1]?.map(tag => tag.name.toLowerCase()) || []);
            
            // 1. Détection par tags prioritaires (si présents sur WordPress)
            if (tags.includes('glaces') || tags.includes('sorbet')) return "glaces";
            // Rafraîchissements : toutes variantes (rafraichissements / rafraîchissements / smoothie...)
            if (tags.some(t => t.includes('rafra'))) return "rafraichissements";
            if (tags.includes('boissons') || tags.includes('cocktail') || tags.includes('smoothie') || tags.includes('jus')) return "rafraichissements";
            if (tags.includes('apéro') || tags.includes('apéritifs')) return "aperitifs";
            if (tags.includes('entrées')) return "entrees";
            if (tags.includes('plats')) return "plats";
            if (tags.includes('desserts')) return "desserts";
            if (tags.includes('pâtisserie')) return "patisserie";

            // 2. Détection par mots-clés dans le titre
            if (title.includes('glace') || title.includes('sorbet')) return "glaces";
            if (title.includes('smoothie') || title.includes('boisson') || title.includes('cocktail') || title.includes('rafraîchissement') || title.includes('jus de')) return "rafraichissements";
            if (title.includes('croquetas') || title.includes('apéro') || title.includes('tapas') || title.includes('houmous')) return "aperitifs";
            if (title.includes('salade') || title.includes('soupe') || title.includes('velouté') || title.includes('œuf') || title.includes('carpaccio')) return "entrees";
            if (['gâteau', 'cake', 'tarte', 'cookie', 'muffins', 'pâtisserie'].some(k => title.includes(k))) return "desserts";
            if (['chocolat', 'sucre', 'fruit', 'tiramisu', 'mousse', 'dessert'].some(k => title.includes(k))) return "desserts";

            // 3. Fallback sur la catégorie WordPress ou "plats" par défaut
            if (post.categories?.includes(14)) return "plats"; // ID WordPress pour Plats
            return "plats"; // Fin du règne de la pâtisserie par défaut !
        })(),
        difficulty: (difficultyMatch?.[1]?.toLowerCase().trim() || "moyen"),
        prepTime: parseInt(prepTimeMatch?.[1] || "15"),
        cookTime: parseInt(cookTimeMatch?.[1] || "30"),
        servings: parseInt(servingsMatch?.[1] || "4"),
        videoHtml: videoHtml,
        ingredients: ingredients.length > 0 ? ingredients : [{ quantity: "", name: "Ingrédients détaillés dans la vidéo" }],
        steps: steps.length > 0 ? steps : ["Suivre les instructions détaillées dans la vidéo"],
        tags: post._embedded?.['wp:term']?.[1]?.map(tag => tag.name) || [],
        isFeatured: post.sticky || false,
        isFavorite: false,
        address: ""
    };
}

/**
 * Lance la synchronisation
 */
async function syncRecipes() {
    console.log("🚀 Démarrage de la synchronisation...");
    
    let allPosts = [];
    let page = 1;
    let hasMore = true;

    try {
        while (hasMore) {
            const url = `${WORDPRESS_API_URL}/posts?per_page=100&page=${page}&status=publish&_embed&orderby=modified&nocache=${Date.now()}`;
            console.log(`📡 Connexion page ${page} : ${url}`);

            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 400 && page > 1) {
                    hasMore = false;
                    break;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const posts = await response.json();
            if (posts.length === 0) {
                hasMore = false;
                break;
            }

            console.log(`   📥 Reçu ${posts.length} recettes de la page ${page}...`);
            for (const post of posts) {
                allPosts.push(extractRecipeData(post));
            }

            if (posts.length < 100) {
                hasMore = false;
            } else {
                page++;
            }
        }

        // Sauvegarde mockData.ts
        const fileContent = `import { Recipe } from '../types';
    
/**
 * Recettes synchronisées depuis WordPress
 * Dernière mise à jour: ${new Date().toLocaleString('fr-FR')}
 * Total: ${allPosts.length} recettes
 */
export const exportSyncId = "${Date.now()}";
export const mockRecipes: Recipe[] = ${JSON.stringify(allPosts, null, 4)};
`;

        fs.writeFileSync(MOCK_DATA_PATH, fileContent);
        
        fs.writeFileSync(SYNC_STATS_PATH, JSON.stringify({
            lastSync: new Date().toISOString(),
            totalRecipes: allPosts.length,
            environment: ACTIVE_IP === WORDPRESS_LOCAL_IP ? 'local' : 'public'
        }, null, 2));

        console.log(`\n✅ Synchronisation terminée ! ${allPosts.length} recettes sauvegardées.`);
        
    } catch (error) {
        console.error("\n❌ Erreur de synchronisation :", error.message);
        process.exit(1);
    }
}

syncRecipes();
