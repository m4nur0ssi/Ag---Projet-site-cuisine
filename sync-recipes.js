const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');

// Charge les variables d'env (.env / .env.local) pour que GROQ_API_KEY soit
// visible côté sync (gate de la traduction auto) et hérité par le process enfant.
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

// On utilise node-fetch (v2) pour plus de stabilité dans GitHub Actions (Node 18+)
const fetch = require('node-fetch');

// Infos restaurant réelles vérifiées (fusionnées dans les fiches catégorie restaurant).
const WP_RESTAURANT_CAT = 42; // ID de la catégorie WordPress "Restaurants"
const RESTAURANTS_INFO_PATH = path.join(__dirname, 'src', 'data', 'restaurants-info.json');
let RESTAURANTS_INFO = {};
try { RESTAURANTS_INFO = require('./src/data/restaurants-info.json'); } catch { RESTAURANTS_INFO = {}; }
const { enrichRestaurant } = require('./google-places');

// Enrichit via Google Places les restos qui n'ont pas encore d'infos (adresse…).
// Persiste dans restaurants-info.json → survit aux syncs suivants (pas de re-appel API).
async function enrichRestaurantsMissingInfo(posts) {
    let changed = false;
    for (const post of posts) {
        if (!post.categories?.includes(WP_RESTAURANT_CAT)) continue;
        const id = String(post.id);
        const existing = RESTAURANTS_INFO[id] || {};
        if (existing.address) continue; // déjà renseigné (auto ou manuel) → on ne retouche pas
        const title = decodeHtmlEntities(post.title.rendered || '');
        const tags = (post._embedded?.['wp:term']?.[1]?.map(t => String(t.name).toLowerCase()) || []);
        const subTag = tags.find(t => t.startsWith('resto-'));
        const subType = existing.subType || (subTag ? subTag.replace(/^resto-/, '') : undefined);
        console.log(`   🍽️ Google Places pour "${title}"…`);
        const places = await enrichRestaurant(title);
        if (places) {
            RESTAURANTS_INFO[id] = { ...(subType ? { subType } : {}), ...places, ...existing };
            changed = true;
            console.log(`      ✅ ${places.address || '(sans adresse)'}${places.rating ? ` · ${places.rating}★` : ''}`);
        } else if (subType && !existing.subType) {
            RESTAURANTS_INFO[id] = { subType, ...existing };
            changed = true;
        }
    }
    if (changed) {
        try { fs.writeFileSync(RESTAURANTS_INFO_PATH, JSON.stringify(RESTAURANTS_INFO, null, 2) + '\n'); console.log('   💾 restaurants-info.json mis à jour (Google Places).'); }
        catch (e) { console.log('   ⚠️ écriture restaurants-info.json :', e.message); }
    }
}

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
const MOBILE_MOCK_DATA_PATH = path.join(__dirname, 'src/mobile/data/mockData.ts');
const SYNC_STATS_PATH = path.join(__dirname, 'src/data/sync-stats.json');

/**
 * Décode les entités HTML courantes
 */
function decodeHtmlEntities(text) {
    if (!text) return "";
    return text
        .replace(/&amp;/g, '&')
        .replace(/&amp;/g, '&')
        .replace(/&#0*38;/g, '&')
        .replace(/&#0*215;|&#215;/g, '×')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&rdquo;/g, '"')
        .replace(/&ldquo;/g, '"')
        .replace(/&#8216;/g, "'")
        .replace(/&#8217;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&#8211;/g, "-")
        .replace(/&#8212;/g, "-")
        .replace(/&ndash;/g, "-")
        .replace(/&mdash;/g, "-")
        .replace(/&#8230;/g, "...")
        .replace(/&hellip;/g, "...")
        .replace(/&laquo;/g, '"')
        .replace(/&raquo;/g, '"')
        .replace(/&nbsp;/g, " ")
        .replace(/\u00A0/g, " ")
        // Caractères typographiques Unicode directs (WordPress Smart Quotes)
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/\u2026/g, "...")
        .replace(/\u00AB/g, '"').replace(/\u00BB/g, '"');
}

// Marqueurs (dans le titre) de plats portugais souvent mal tagués "Espagne" sur WP.
// Phrases précises pour éviter les collisions (ex. "Natillas" espagnol ne matche pas "de nata").
const PORTUGAL_MARKERS = [
    'bifana', 'piri piri', 'piri-piri', 'bola de berlim', 'jardineira', 'bacalhau',
    'francesinha', 'caldo verde', 'pastel de nata', 'pastéis de nata', 'pasteis de nata',
    'de nata', 'portugais', 'portugaise', 'portugal',
];

/**
 * Reclasse en "Portugal" les recettes portugaises détectées via le titre,
 * et retire le tag "Espagne" erroné. Idempotent.
 */
function normalizeCountryTags(tags, title) {
    const t = (title || '').toLowerCase();
    if (!PORTUGAL_MARKERS.some(m => t.includes(m))) return tags;
    let out = (tags || []).filter(x => String(x).toLowerCase() !== 'espagne');
    if (!out.some(x => String(x).toLowerCase() === 'portugal')) out.push('Portugal');
    return out;
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
    const youtubeMatch = cleanContent.match(/<iframe[^>]*(?:youtube\.com|youtu\.be)[\s\S]*?<\/iframe>/i);
    if (tiktokMatch) {
        videoHtml = tiktokMatch[0] + '<script async src="https://www.tiktok.com/embed.js"></script>';
    } else if (youtubeMatch) {
        // Vidéo YouTube (recette ajoutée manuellement via add-youtube-recipe.js)
        videoHtml = youtubeMatch[0];
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
            : "/images/recipe-placeholder.svg",
        category: (() => {
            // Fiches restaurant (catégorie WordPress "Restaurants") → catégorie restaurant.
            if (post.categories?.includes(WP_RESTAURANT_CAT)) return "restaurant";
            const title = decodeHtmlEntities(post.title.rendered).toLowerCase();
            const tags = (post._embedded?.['wp:term']?.[1]?.map(tag => tag.name.toLowerCase()) || []);

            // 0. SAUCES pures (#8) : tag sauce(s), ou mot-sauce en TÊTE du titre.
            //    Ne doivent apparaître que dans le thème "sauces", jamais dans "plats".
            if (tags.includes('sauce') || tags.includes('sauces')) return "sauces";
            if (/^(?:sauce|pesto|mayonnaise|vinaigrette|tzatziki|guacamole|a[iï]oli|tapenade|coulis|chimichurri|b[ée]arnaise|hollandaise|ketchup|pico de gallo|r[ée]moulade)\b/.test(title)) return "sauces";

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
        tags: (() => {
            const base = normalizeCountryTags(post._embedded?.['wp:term']?.[1]?.map(tag => tag.name) || [], decodeHtmlEntities(post.title.rendered));
            const info = post.categories?.includes(WP_RESTAURANT_CAT) ? RESTAURANTS_INFO[String(post.id)] : null;
            if (info?.subType) { const t = `resto-${info.subType}`; if (!base.includes(t)) base.push(t); }
            return base;
        })(),
        isFeatured: post.sticky || false,
        isFavorite: false,
        address: (post.categories?.includes(WP_RESTAURANT_CAT) && RESTAURANTS_INFO[String(post.id)]?.address) || "",
        ...(post.categories?.includes(WP_RESTAURANT_CAT) && RESTAURANTS_INFO[String(post.id)]
            ? { restaurant: RESTAURANTS_INFO[String(post.id)] }
            : {})
    };
}

/**
 * Lance la synchronisation
 */
async function syncRecipes() {
    console.log("🚀 Démarrage de la synchronisation...");
    
    let allPosts = [];
    let rawPosts = [];
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
            rawPosts.push(...posts);

            if (posts.length < 100) {
                hasMore = false;
            } else {
                page++;
            }
        }

        // Enrichit les nouveaux restaurants via Google Places AVANT de construire
        // mockData (extractRecipeData lira les infos fraîchement écrites).
        await enrichRestaurantsMissingInfo(rawPosts);
        allPosts = rawPosts.map(extractRecipeData);

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
        // Parité : la vue mobile du site partage exactement les mêmes recettes.
        fs.writeFileSync(MOBILE_MOCK_DATA_PATH, fileContent);

        fs.writeFileSync(SYNC_STATS_PATH, JSON.stringify({
            lastSync: new Date().toISOString(),
            totalRecipes: allPosts.length,
            environment: ACTIVE_IP === WORDPRESS_LOCAL_IP ? 'local' : 'public'
        }, null, 2));

        console.log(`\n✅ Synchronisation terminée ! ${allPosts.length} recettes sauvegardées.`);

        // #13 — Traduction FR AUTOMATIQUE après chaque sync (anglais/espagnol/autre → français).
        //   Traduit ingrédients + étapes uniquement (le titre est conservé tel quel).
        //   Activée par défaut. Pour désactiver : --no-translate ou TRANSLATE_AFTER_SYNC=0.
        //   Nécessite GROQ_API_KEY ; sans clé, l'étape est sautée sans bloquer le sync.
        const translateDisabled = process.argv.includes('--no-translate') || process.env.TRANSLATE_AFTER_SYNC === '0';
        if (!translateDisabled) {
            if (!process.env.GROQ_API_KEY) {
                console.log('ℹ️  Traduction auto sautée : GROQ_API_KEY absent.');
            } else {
                // Réglages doux par défaut (free tier Groq) pour limiter les 429 :
                // concurrence 1 + throttle 1.5 s. Surchargés par l'env si déjà défini.
                // Deux passes : la 2e rattrape via le cache ce qui a échoué en 429.
                const childEnv = {
                    ...process.env,
                    TRANSLATE_CONCURRENCY: process.env.TRANSLATE_CONCURRENCY || '1',
                    TRANSLATE_THROTTLE_MS: process.env.TRANSLATE_THROTTLE_MS || '1500',
                };
                const runTranslate = (label) => {
                    console.log(`\n🌍 Traduction FR auto (ingrédients + étapes) ${label}…`);
                    require('child_process').execSync('node translate-recipes-fr.js', {
                        cwd: __dirname, stdio: 'inherit', env: childEnv,
                    });
                };
                try {
                    runTranslate('— passe 1');
                    runTranslate('— passe 2 (rattrapage 429)');
                } catch (e) {
                    console.error('⚠️  Traduction échouée (non bloquant) :', e.message);
                }
            }
        }

    } catch (error) {
        console.error("\n❌ Erreur de synchronisation :", error.message);
        process.exit(1);
    }
}

syncRecipes();
