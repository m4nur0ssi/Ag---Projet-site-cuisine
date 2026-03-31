const fs = require('fs');
const path = require('path');

// URL de votre site WordPress
// On privilégie le domaine public pour que l'app fonctionne partout
const WORDPRESS_DOMAIN = 'lesrec3ttesm4giques.fr';
const WORDPRESS_PUBLIC_IP = process.env.WP_PUBLIC_IP || '109.221.250.122';
const WORDPRESS_LOCAL_IP = '192.168.1.200';

// Déterminer l'IP à utiliser (locale si on est sur le NAS/Mac, publique sinon)
const IS_LOCAL = fs.existsSync('/Volumes/homes') || process.env.NODE_ENV === 'development';
const ACTIVE_IP = IS_LOCAL ? WORDPRESS_LOCAL_IP : WORDPRESS_PUBLIC_IP;

// Le proxy Vercel sert les images en HTTPS depuis le NAS en HTTP
const IMAGE_BASE_URL = `http://${WORDPRESS_PUBLIC_IP}`;
const SYNC_ALL = !process.argv.includes('--recent');
const DELETE_ID = process.argv.find(arg => arg.startsWith('--delete-id='))?.split('=')[1] || null;

if (DELETE_ID) console.log(`🗑️ Ordre de suppression forcée reçu pour l'ID : ${DELETE_ID}`);
if (!SYNC_ALL) console.log("🚀 Mode rapide : Synchronisation de la dernière page uniquement...");

const MOCK_DATA_PATH = path.join(__dirname, 'src', 'data', 'mockData.ts');
const SYNC_STATS_PATH = path.join(__dirname, 'src', 'data', 'sync-stats.json');

// Désactiver la vérification SSL
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function decodeHtmlEntities(text) {

    if (!text) return '';
    return text
        .replace(/&#038;/g, '&')
        .replace(/&amp;/g, '&')
        .replace(/&#8217;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&#8211;/g, "-")
        .replace(/&ndash;/g, "-")
        .replace(/&nbsp;/g, " ")
        .replace(/&Agrave;/g, "À")
        .replace(/&agrave;/g, "à")
        .replace(/&Eacute;/g, "É")
        .replace(/&eacute;/g, "é")
        .replace(/&Egrave;/g, "È")
        .replace(/&egrave;/g, "è")
        .replace(/&circ;/g, "^")
        .replace(/&icirc;/g, "î")
        .replace(/&ocirc;/g, "ô")
        .replace(/&ucirc;/g, "û")
        .replace(/<[^>]*>?/gm, '') // Enlève aussi les balises HTML restantes
        .trim();
}

const ingredientEmojiMap = {
    'oeuf': '🥚', 'œuf': '🥚', 'farine': '🌾', 'sucre': '🍯', 'beurre': '🧈', 'lait': '🥛',
    'chocolat': '🍫', 'crème': '🥛', 'creme': '🥛', 'sel': '🧂', 'poivre': '🧂', 'huile': '🍾',
    'eau': '🥣', 'levure': '🥣', 'vanille': '🍦', 'pomme': '🍎', 'citron': '🍋', 'fraise': '🍓',
    'banane': '🍌', 'tomate': '🍅', 'oignon': '🧅', 'ail': '🧄', 'échalotte': '🧅', 'echalote': '🧅',
    'basilic': '🌿', 'persil': '🌿', 'saumon': '🐟', 'poulet': '🍗', 'boeuf': '🥩', 'bœuf': '🥩',
    'porc': '🍖', 'pâte': '🍝', 'riz': '🍚', 'pâtes': '🍝', 'fromage': '🧀', 'parmesan': '🧀',
    'mozzarella': '🧀', 'aubergine': '🍆', 'courgette': '🥒', 'carotte': '🥕', 'miel': '🍯',
    'noisette': '🥜', 'noix': '🥜', 'amande': '🥜', 'café': '☕', 'the': '🍵', 'thé': '🍵',
    'vin': '🍷', 'crevette': '🍤', 'poisson': '🐟', 'lard': '🥓', 'lardon': '🥓', 'jambon': '🍖'
};

function getEmojiForIngredient(name) {
    const lowerName = name.toLowerCase();
    for (const [key, emoji] of Object.entries(ingredientEmojiMap)) {
        if (lowerName.includes(key)) return emoji;
    }
    return null;
}

function parseIngredientString(text) {
    // Nettoyage de base : on supprime les retours à la ligne et espaces multiples
    let cleanText = text.replace(/\s+/g, ' ').trim().replace(/^[•\-\*]\s*/, '');
    let result = { quantity: '', name: cleanText };

    // Cas 1: Quantité textuelle (Du, De la, Une pincée...)
    const quantityTextMatch = cleanText.match(/^(Du|De la|De|Des|Une?|Quelques|Au|Aux|Pincée|Un peu)\s+(.+)$/i);
    if (quantityTextMatch) {
        result = {
            quantity: quantityTextMatch[1],
            name: quantityTextMatch[2].trim()
        };
    } else {
        // Cas 2: Quantité numérique (100g de Farine, 2 oeufs...)
        const numericMatch = cleanText.match(/^([\d\s.,\/]+(?:g|kg|ml|cl|l|c\.à\.s|c\.à\.c|cuillère|verre|pincée)?(?: de)?)\s+(.+)$/i);
        if (numericMatch) {
            result = {
                quantity: numericMatch[1].trim(),
                name: numericMatch[2].trim()
            };
        }
    }

    // Injection automatique d'émoji si absent
    const hasEmoji = /^[\uD83C-\uDBFF\uDC00-\uDFFF]/.test(result.name);
    if (!hasEmoji) {
        const emoji = getEmojiForIngredient(result.name);
        if (emoji) {
            result.name = `${emoji} ${result.name}`;
        }
    }

    return result;
}

function extractRecipeData(content) {
    let description = '';
    let ingredients = [];
    let steps = [];
    let videoHtml = '';
    let address = '';
    let difficulty = 'moyen';
    let prepTime = 15;
    let cookTime = 30;

    // 0. NETTOYAGE RADICAL DU CODE (Style, Script)
    const cleanContent = content
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // Extraction de la difficulté et des temps (Heuristique améliorée)
    const difficultyMatch = cleanContent.match(/(Facile|Intermédiaire|Moyen|Difficile|Expert)/i);
    if (difficultyMatch) {
        difficulty = difficultyMatch[1].toLowerCase();
        if (difficulty === 'intermédiaire') difficulty = 'moyen';
    }

    // On cherche les patterns type "Préparation : 15 min", "Cuisson : 30 min"
    const prepMatch = cleanContent.match(/Prép[^:]*:\s*(\d+)\s*(min|h)/i);
    const cookMatch = cleanContent.match(/Cuisson\s*:\s*(\d+)\s*(min|h)/i);
    const totalMatch = cleanContent.match(/Total\s*:\s*(\d+)\s*(min|h)/i);

    if (prepMatch) {
        prepTime = parseInt(prepMatch[1]);
        if (prepMatch[2].toLowerCase().startsWith('h')) prepTime *= 60;
    }
    if (cookMatch) {
        cookTime = parseInt(cookMatch[1]);
        if (cookMatch[2].toLowerCase().startsWith('h')) cookTime *= 60;
    }

    // Fallback si pas de labels précis : on cherche les premiers nombres suivis de min/h
    if (!prepMatch && !cookMatch) {
        const timeMatches = Array.from(cleanContent.matchAll(/(\d+)\s*(min|h|heure)/gi));
        if (timeMatches.length >= 1) {
            prepTime = parseInt(timeMatches[0][1]);
            if (timeMatches[0][2].toLowerCase().startsWith('h')) prepTime *= 60;
        }
        if (timeMatches.length >= 2) {
            cookTime = parseInt(timeMatches[1][1]);
            if (timeMatches[1][2].toLowerCase().startsWith('h')) cookTime *= 60;
        }
    }

    // Caping temps express si titre contient "Traditionnel" ou "Longue"
    const lowerContent = cleanContent.toLowerCase();
    if (lowerContent.includes('traditionnel') || lowerContent.includes('longue cuisson')) {
        if (prepTime + cookTime < 45) {
            prepTime = Math.max(prepTime, 20);
            cookTime = Math.max(cookTime, 30);
        }
    }

    // Détection des vidéos
    const youtubeMatch = cleanContent.match(/<iframe[^>]*src="[^"]*youtu[\.?be|be\.com][^"]*"[^>]*>.*?<\/iframe>/is);
    const tiktokMatch = cleanContent.match(/<blockquote[^>]*class=["'][^"']*tiktok-embed[^"']*["'][^>]*>([\s\S]*?)<\/blockquote>/i);
    const tiktokLinkMatch = cleanContent.match(/https?:\/\/(?:www\.)?tiktok\.com\/@[^/]+\/(?:video|photo)\/(\d+)/i);
    const videoTagMatch = cleanContent.match(/<video[^>]*>.*?<\/video>/is);

    if (youtubeMatch) videoHtml = youtubeMatch[0];
    else if (tiktokMatch) {
        videoHtml = tiktokMatch[0];
        if (!videoHtml.includes('tiktok.com/embed.js')) videoHtml += '<script async src="https://www.tiktok.com/embed.js"></script>';
    } else if (tiktokLinkMatch) {
        const videoId = tiktokLinkMatch[1];
        const videoUrl = tiktokLinkMatch[0];
        videoHtml = `
<blockquote class="tiktok-embed" cite="${videoUrl}" data-video-id="${videoId}" style="max-width: 605px; min-width: 325px;">
    <section>
        <a target="_blank" title="@tiktok" href="${videoUrl}">Regarder la vidéo sur TikTok</a>
    </section>
</blockquote><script async src="https://www.tiktok.com/embed.js"></script>`;
    } else if (videoTagMatch) videoHtml = videoTagMatch[0];

    // Nettoyage description
    let rawDescription = cleanContent;
    const splitIndex = cleanContent.indexOf('<div id="mpprecipe-container');
    if (splitIndex !== -1) {
        rawDescription = cleanContent.substring(0, splitIndex);
        const pluginContent = cleanContent.substring(splitIndex);

        // 1. Ingrédients du plugin
        const ingMatch = pluginContent.match(/<ul[^>]*id=["']mpprecipe-ingredients-list["'][^>]*>([\s\S]*?)<\/ul>/i);
        if (ingMatch) {
            const items = ingMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
            if (items) {
                ingredients = items.map(item => {
                    const imgMatch = item.match(/<img[^>]*src=["'](.*?)["']/i);
                    const cleanText = item.replace(/<[^>]*>/g, '').trim();
                    const parsed = parseIngredientString(decodeHtmlEntities(cleanText));
                    if (imgMatch) parsed.image = imgMatch[1];
                    return parsed;
                }).filter(ing => ing.name.length > 1);
            }
        }

        // 2. Étapes du plugin
        const stepMatch = pluginContent.match(/<ol[^>]*id=["']mpprecipe-instructions-list["'][^>]*>([\s\S]*?)<\/ol>/i);
        if (stepMatch) {
            const items = stepMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
            if (items) {
                steps = items.map(item => decodeHtmlEntities(item.replace(/<[^>]*>/g, '').trim())).filter(s => s.length > 5);
            }
        }
    }

    // --- FALLBACK HEURISTIQUE SI DONNÉES MANQUANTES ---
    // Si pas d'étapes ou étapes trop courtes/parasitées (ex: juste "bien.")
    if (steps.length < 2 || (steps.length === 1 && steps[0].length < 15)) {
        console.log("   🔦 Fallback : Tentative d'extraction intelligente des étapes...");

        // On cherche des blocs de texte significatifs séparés par des images ou des sauts de ligne triples
        const blocks = cleanContent.split(/<img[^>]*>|<hr[^>]*>|<div[^>]*mpprecipe-container/i);
        const refinedSteps = blocks.map(b => {
            // On enlève les balises, on décode, on nettoie
            let t = b.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            return decodeHtmlEntities(t);
        }).filter(s => {
            // On garde les textes de plus de 30 caractères qui ne sont pas des titres de sections
            if (s.length < 30) return false;
            const low = s.toLowerCase();
            if (low.includes('cliquez pour') || low.includes('save recipe') || low.includes('print recipe')) return false;
            if (low === 'ingredients' || low === 'conseils de préparation') return false;
            // On ne veut pas reprendre les ingrédients dans les étapes
            if (ingredients.length > 0 && ingredients.every(ing => s.includes(ing.name) && s.length < 100)) return false;
            return true;
        });

        if (refinedSteps.length >= 2) {
            steps = refinedSteps;
            console.log(`   ✨ ${steps.length} étapes extraites via le fallback visuel.`);
        } else {
            // Ultime secours : lignes brutes
            const lines = cleanContent.replace(/<(?!br|li|p|\/li|\/p)[^>]*>/gi, '\n').split(/\n|<br\s*\/?>/);
            const stepCandidates = lines.filter(l => {
                const c = l.trim();
                if (c.includes('{') || c.includes('}') || c.includes('!important')) return false;
                return (c.length > 25 && c.length < 800) && !ingredients.some(ing => c.includes(ing.name) && c.length < 50);
            });
            if (stepCandidates.length > 2) {
                steps = stepCandidates.map(c => decodeHtmlEntities(c.trim()));
            }
        }
    }

    // Nettoyage final description
    description = decodeHtmlEntities(rawDescription.replace(/<img[^>]*>/gi, '').replace(/<a[^>]*>\s*<\/a>/gi, '').trim());
    if (description.length > 500) description = description.substring(0, 497) + '...';

    // Extraction adresse
    const addrMatch = description.match(/(\d+\s+[^,\n\r]+,\s*\d{5}\s+[^<\n\r]+)|📍\s*([^<\n\r]+)|Adresse\s*:\s*([^<\n\r]+)/i);
    if (addrMatch) address = (addrMatch[1] || addrMatch[2] || addrMatch[3]).trim();

    return { description, ingredients, steps, videoHtml, address, difficulty, prepTime, cookTime };
}


function determineCategory(post) {
    const title = (post.title?.rendered || '').toLowerCase();
    const content = (post.content?.rendered || '').toLowerCase();

    // 1. Détection par slugs WordPress
    let catSlug = [];
    if (post._embedded && post._embedded['wp:term']) {
        const categories = post._embedded['wp:term'][0];
        if (categories) {
            catSlug = categories.map(c => c.slug.toLowerCase());
        }
    }

    // 2. Détection par mots-clés si slugs absents ou imprécis
    const isPatisserie = catSlug.some(s => s.includes('patisserie')) || 
                        title.includes('gâteau') || title.includes('torta') || title.includes('cake');
                        
    const isDessertMatch = catSlug.some(s => s.includes('dessert') || s.includes('sucre')) ||
                          title.includes('fondant') || title.includes('biscuits') || title.includes('dessert');

    if (isPatisserie) return 'patisserie';
    if (isDessertMatch) return 'desserts';
    if (catSlug.includes('entrees') || title.includes('entrée')) return 'entrees';
    if (catSlug.includes('aperitifs') || catSlug.includes('boissons') || catSlug.includes('potions')) return 'aperitifs';
    if (catSlug.includes('restaurant') || catSlug.includes('restaurants') || title.includes('📍')) return 'restaurant';

    return 'plats'; // Par défaut
}

async function syncRecipes() {
    console.log(`🚀 Démarrage de la synchronisation...`);

    // --- NOUVEAU : CHARGEMENT DES RECETTES EXISTANTES ---
    let allRecipes = [];
    if (fs.existsSync(MOCK_DATA_PATH) && !SYNC_ALL) {
        try {
            const currentFile = fs.readFileSync(MOCK_DATA_PATH, 'utf-8');
            const jsonPart = currentFile.match(/mockRecipes: Recipe\[\] = (\[[\s\S]*?\]);/);
            if (jsonPart) {
                allRecipes = JSON.parse(jsonPart[1]);
                console.log(`📦 ${allRecipes.length} recettes existantes chargées.`);
            }
        } catch (e) {
            console.warn("⚠️ Impossible de charger les recettes existantes, synchro complète forcée.");
        }
    }

    const initialTotalPages = SYNC_ALL ? 50 : 1; // On passe à 50 pages max pour être sûr (5000 recettes)
    let page = 1;
    let totalPages = initialTotalPages; 
    let posts = [];

    do {
        console.log(`\nPage ${page}...`);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 300000); // 5 minutes

            const testUrl = `http://${ACTIVE_IP}/wordpress/wp-json/wp/v2/posts?per_page=100&page=${page}&status=publish&_embed&orderby=modified&nocache=${Date.now()}&v=${Math.random()}`;
            console.log(`📡 Connexion : ${testUrl}`);
            const response = await fetch(testUrl, { signal: controller.signal });
            clearTimeout(timeout);

            if (!response.ok) {
                console.log(`⚠️ Fin des pages ou erreur (${response.status})`);
                break;
            }

            totalPages = parseInt(response.headers.get('X-WP-TotalPages')) || 1;
            let rawText = await response.text();

            // Nettoyage des warnings PHP (souvent présents sur les NAS)
            // On cherche le premier caractère JSON valide [ ou {
            const jsonStartIndex = rawText.search(/[\[\{]/);
            if (jsonStartIndex > 0) {
                console.log(`⚠️  Nettoyage de ${jsonStartIndex} caractères parasites (Warnings PHP).`);
                rawText = rawText.substring(jsonStartIndex);
            }

            try {
                posts = JSON.parse(rawText);
            } catch (e) {
                console.error(`❌ Erreur de parsing JSON sur la page ${page}. Contenu reçu:`, rawText.substring(0, 100));
                break;
            }

            if (posts.length === 0) break;

            let cleanText = JSON.stringify(posts);

            // 2. Optionnel : Mode RELATIF (Désactivé pour Vercel)
            const MODE_RELATIVE = false;
            if (MODE_RELATIVE) {
                // (Logique relative désactivée pour Vercel)
            }

            // Convertir toutes les URLs d'images vers l'IP publique (proxy)
            cleanText = cleanText
                .replace(/http:\/\/109\.221\.250\.122/g, IMAGE_BASE_URL)
                .replace(/http:\/\/192\.168\.1\.200/g, IMAGE_BASE_URL)
                .replace(/https:\/\/lesrec3ttesm4giques\.fr/g, IMAGE_BASE_URL)
                .replace(/http:\/\/lesrec3ttesm4giques\.fr/g, IMAGE_BASE_URL);

            const cleanPosts = JSON.parse(cleanText);

            // Mapping des résultats
            const pageRecipes = cleanPosts.map((post, index) => {
                const { description, ingredients, steps, videoHtml, address, difficulty, prepTime, cookTime } = extractRecipeData(post.content.rendered);
                const category = determineCategory(post);
                let featuredImage = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';

                // --- FALLBACK IMAGE : Si pas d'image mise en avant, on cherche dans le contenu ---
                if (!featuredImage) {
                    const imgInContent = post.content.rendered.match(/<img[^>]*src=["'](.*?)["']/i);
                    if (imgInContent) {
                        featuredImage = imgInContent[1];
                        // S'assurer que l'image du contenu est aussi en absolu public
                        if (featuredImage.startsWith('/')) {
                            featuredImage = `${IMAGE_BASE_URL}${featuredImage}`;
                        } else {
                            featuredImage = featuredImage
                                .replace(/http:\/\/192\.168\.1\.200/g, IMAGE_BASE_URL)
                                .replace(/http:\/\/109\.221\.250\.122/g, IMAGE_BASE_URL)
                                .replace(/https:\/\/lesrec3ttesm4giques\.fr/g, IMAGE_BASE_URL)
                                .replace(/http:\/\/lesrec3ttesm4giques\.fr/g, IMAGE_BASE_URL);
                        }
                    }
                }

                // Passer TOUTES les images par le proxy Vercel pour éviter le Mixed Content
                // On ajoute un cache-buster basé sur la date de modification du post
                // Ainsi, quand une photo est changée dans WordPress, l'URL change et le cache est invalidé
                const postModified = new Date(post.modified || post.date).getTime();
                if (featuredImage && featuredImage.startsWith('http://')) {
                    featuredImage = `/api/image-proxy?url=${encodeURIComponent(featuredImage)}&v=${postModified}`;
                }


                const tags = post._embedded?.['wp:term']?.[1] || [];
                const tagNames = tags.map(tag => tag.name);

                // --- AUTO TAGGING ---
                const titleLower = post.title.rendered.toLowerCase();
                const contentLower = post.content.rendered.toLowerCase();
                const fullText = titleLower + ' ' + contentLower;

                const countryMapping = [
                    { tag: 'Italie', keywords: ['italie', 'italien', 'pizza', 'pasta', 'risotto', 'mozzarella', 'parmesan', 'rigatonni', 'spaghetti', 'lasagne'] },
                    { tag: 'France', keywords: ['france', 'français', 'quiche', 'ratatouille', 'cassoulet', 'boulangerie'] },
                    { tag: 'Espagne', keywords: ['espagne', 'espagnol', 'paella', 'tapas', 'torta', 'tortilla'] },
                    { tag: 'Grèce', keywords: ['grèce', 'grec', 'feta', 'moussaka', 'tzatziki'] },
                    { tag: 'Liban', keywords: ['liban', 'libanais', 'houmous', 'falafel', 'mezzé', 'liban'] },
                    { tag: 'Maroc', keywords: ['maroc', 'marocain', 'couscous', 'tajine', 'tunisie', 'algérie', 'maghreb'] },
                    { tag: 'Japon', keywords: ['japon', 'japonais', 'sushi', 'ramen', 'miso', 'yakitori'] },
                    { tag: 'Asie', keywords: ['asie', 'asiatique', 'chine', 'thaï', 'vietnam', 'corée', 'riz', 'soja', 'sauce soja', 'wok', 'curry', 'gingembre', 'lait de coco'] },
                    { tag: 'USA', keywords: ['usa', 'états-unis', 'amérique du nord', 'burger', 'pancake', 'canada', 'steak house'] },
                    { tag: 'Mexique', keywords: ['mexique', 'mexicain', 'texmex', 'tex-mex', 'brésil', 'argentine', 'amérique du sud', 'tacos', 'taco', 'fajitas', 'guacamole', 'ceviche', 'enchiladas'] },
                    { tag: 'Autre', keywords: ['monde', 'international', 'fusion'] }
                ];

                const specialMapping = [
                    { tag: 'Végé', keywords: ['végé', 'vege', 'vegan', 'végan', 'végétarien', '#vege', '#vegan'] },
                    { tag: 'Léger', keywords: ['léger', 'light', 'kcal', 'calorie', 'perte de poids', '#pertedepoids', 'minceur'] },
                    { tag: 'Airfryer', keywords: ['airfryer', 'air fryer', '#airfryer'] },
                    { tag: 'Astuces', keywords: ['astuce', 'tips', '#astuces'] }
                ];

                countryMapping.forEach(mapping => {
                    if (mapping.keywords.some(kw => fullText.includes(kw))) {
                        if (!tagNames.includes(mapping.tag)) tagNames.push(mapping.tag);
                    }
                });

                specialMapping.forEach(mapping => {
                    if (mapping.keywords.some(kw => fullText.includes(kw))) {
                        if (!tagNames.includes(mapping.tag)) tagNames.push(mapping.tag);
                    }
                });
                
                // --- NETTOYAGE VÉGÉ/VIANDARD STRICT ---
                const meatKeywords = ['viande', 'porc', 'boeuf', 'bœuf', 'poulet', 'agneau', 'veau', 'steak', 'lardons', 'bacon', 'charcuterie', 'chorizo', 'viandard', 'jambon', 'salami', 'merguez', 'saussice', 'canard'];
                const hasMeatInIngredients = ingredients.some(ing => meatKeywords.some(m => ing.name.toLowerCase().includes(m)));
                const hasMeatInText = meatKeywords.some(m => fullText.includes(m));
                
                if (hasMeatInIngredients || hasMeatInText) {
                    // Supprimer Végé si viande détectée
                    const vegeIdx = tagNames.findIndex(t => t.toLowerCase().includes('végé') || t.toLowerCase().includes('vege'));
                    if (vegeIdx !== -1) tagNames.splice(vegeIdx, 1);
                } else if (!hasMeatInIngredients && !hasMeatInText) {
                    // Ajouter Végé si pas de viande et déjà marqué ou catégorie
                    if (category === 'vegetarien' && !tagNames.includes('Végé')) tagNames.push('Végé');
                }

                return {
                    id: post.id.toString(),
                    title: decodeHtmlEntities(post.title.rendered),
                    description: description,
                    image: featuredImage,
                    category: category,
                    difficulty: difficulty,
                    prepTime: prepTime,
                    cookTime: cookTime,
                    servings: 4,
                    videoHtml: videoHtml,
                    ingredients: ingredients,
                    steps: steps,
                    tags: tagNames,
                    isFeatured: page === 1 && index === 0,
                    isFavorite: false,
                    address: address
                };
            });

            // Merge avec les existants (on remplace si ID identique)
            const recipeMap = new Map(allRecipes.map(r => [r.id, r]));
            pageRecipes.forEach(r => recipeMap.set(r.id, r));
            allRecipes = Array.from(recipeMap.values());

            // Trier par ID décroissant (plus récentes en haut)
            allRecipes.sort((a, b) => parseInt(b.id) - parseInt(a.id));

            const names = pageRecipes.slice(0, 3).map(r => r.title).join(', ');
            console.log(`✅ Page ${page} synchronisée : ${names}${pageRecipes.length > 3 ? '...' : ''} (${allRecipes.length} recettes au total)`);

            page++;
            if (!SYNC_ALL) break; // Arrêt après 1 page en mode rapide
        } catch (error) {
            console.error(`❌ Erreur page ${page}:`, error.message);
            break;
        }
    } while (page <= totalPages);

    if (allRecipes.length === 0) {
        console.log('⚠️ Aucune recette trouvée.');
        return;
    }

    // --- NOUVEAU : LOGIQUE DE NETTOYAGE (SUPPRESSIONS) ---
    console.log('\n🧹 Vérification des suppressions...');
    try {
        // On récupère tous les IDs d'articles publiés sur WordPress (très léger)
        const allWpIdsUrl = `http://${ACTIVE_IP}/wordpress/wp-json/wp/v2/posts?per_page=100&_fields=id&orderby=modified&nocache=${Date.now()}&v=${Math.random()}`;

        // Comme on peut avoir plus de 100 articles, on fait une boucle rapide pour les IDs
        let validIds = [];
        let idPage = 1;
        let moreIds = true;

        while (moreIds && idPage <= 10) { // Max 1000 articles pour la sécurité
            const idRes = await fetch(`${allWpIdsUrl}&page=${idPage}`);
            if (idRes.ok) {
                const idBatch = await idRes.json();
                if (idBatch.length > 0) {
                    validIds = validIds.concat(idBatch.map(p => p.id.toString()));
                    idPage++;
                } else {
                    moreIds = false;
                }
            } else {
                moreIds = false;
            }
        }

        if (validIds.length > 0) {
            const beforeCount = allRecipes.length;
            // On ne garde que les recettes dont l'ID existe encore sur WordPress
            // ET on force la suppression du DELETE_ID s'il est fourni
            allRecipes = allRecipes.filter(r => {
                const idString = r.id.toString();
                if (DELETE_ID && idString === DELETE_ID.toString()) return false;
                return validIds.includes(idString);
            });
            const removedCount = beforeCount - allRecipes.length;
            if (removedCount > 0) {
                console.log(`🗑️ ${removedCount} recette(s) supprimée(s) (WordPress ID check + Force delete).`);
            } else {
                console.log('✅ Aucune suppression nécessaire.');
            }
        }
    } catch (e) {
        console.warn('⚠️ Échec du nettoyage des suppressions :', e.message);
        // On ne bloque pas la synchro si le nettoyage échoue
    }

    const fileContent = `import { Recipe } from '../types';
    
/**
 * Recettes synchronisées depuis WordPress
 * Dernière mise à jour: ${new Date().toLocaleString('fr-FR')}
 * Total: ${allRecipes.length} recettes
 */
export const exportSyncId = "${new Date().getTime()}";
export const mockRecipes: Recipe[] = ${JSON.stringify(allRecipes, null, 4)};
`;

    fs.writeFileSync(MOCK_DATA_PATH, fileContent);
    
    // Forcer un changement pour Git/Vercel
    fs.writeFileSync(SYNC_STATS_PATH, JSON.stringify({
        lastSync: new Date().toISOString(),
        totalRecipes: allRecipes.length,
        status: 'success'
    }, null, 2));

    console.log(`\n✨ TOUTES LES RECETTES ONT ÉTÉ SYNCHRONISÉES !`);
    console.log(`📂 Fichier : ${MOCK_DATA_PATH}`);
    console.log(`📊 Total : ${allRecipes.length} recettes.`);
}

syncRecipes();
