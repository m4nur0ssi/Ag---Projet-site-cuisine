const fs = require('fs');
const path = require('path');
const https = require('https');

const CACHE_PATH = path.join(__dirname, '..', 'data', 'ingredient-cache.json');
let cache = {};
if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
}

const HTTP_OPTIONS = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
    }
};

async function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        https.get(url, HTTP_OPTIONS, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    redirectUrl = 'https://www.marmiton.org' + redirectUrl;
                }
                return resolve(fetchHtml(redirectUrl));
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Status ${res.statusCode} for ${url}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function cleanIngredient(name) {
    let cleaned = name.toLowerCase().replace(/\n/g, ' ');
    cleaned = cleaned.replace(/^[\uD83C-\uDBFF\uDC00-\uDFFF]+\s*/, '');
    cleaned = cleaned.replace(/^(?:\d+[\s,.]*\d*|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*(?:pincées?|poignées?|tablettes?|morceaux?|tranches?|gousses?|conserves?|sachets?|briques?|verres?|tasses?|cuillères?|cuil|cubes?|pots?|boîtes?|boite|cas|cac|cups?|ml|cl|kg|oz|lb|l|g|cs|cc)\s*(?:de|d['’])?\s*/i, '');
    cleaned = cleaned.replace(/\s+(?:fraîche?s?|fraiche?s?|frais|haché?e?s?|émincé?e?s?|coupé?e?s?|en dés|rapé?e?s?|râpé?e?s?|émietté?e?s?|moulu?e?s?|en poudre|séché?e?s?|du moulin|au goût|selon votre envie)\s*$/i, '');
    cleaned = cleaned.replace(/^(?:frais|fraîche?s?|fraiche?s?|haché?e?s?|émincé?e?s?|coupé?e?s?|en dés|rapé?e?s?|râpé?e?s?|émietté?e?s?|moulu?e?s?|en poudre|séché?e?s?)/i, '');
    return cleaned.replace(/\s+/g, ' ').trim().split(' (')[0].split(',')[0].trim();
}

async function findMarmitonImageUrl(ingredientName) {
    try {
        console.log(`\n🔍 Recherche Marmiton : "${ingredientName}"...`);
        const searchUrl = `https://www.marmiton.org/recettes/recherche.aspx?aqt=${encodeURIComponent(ingredientName)}`;
        const searchHtml = await fetchHtml(searchUrl);
        
        // Find the first RECIPE link
        const recipeMatch = searchHtml.match(/href="(\/recettes\/recette_[^"]+\.aspx)"/);
        if (!recipeMatch) {
            console.log(`  ❌ Aucune recette trouvée pour ${ingredientName}`);
            return null;
        }
        
        const recipeUrl = `https://www.marmiton.org${recipeMatch[1]}`;
        const recipeHtml = await fetchHtml(recipeUrl);
        
        // Split by ingredient blocks
        const blocks = recipeHtml.split('card-ingredient-title');
        
        for (let i = 1; i < blocks.length; i++) {
            const block = blocks[i];
            const nameMatch = block.match(/data-ingredientNameSingular="([^"]+)"/i);
            if (nameMatch) {
                const marmitonName = nameMatch[1].toLowerCase();
                
                // If it's a fuzzy match with our target ingredient (e.g. 'sel' matches 'sel')
                if (marmitonName.includes(ingredientName) || ingredientName.includes(marmitonName)) {
                    // Extract image. Either data-srcset or src.
                    let imgMatch = block.match(/data-srcset="([^ ]+)/) || block.match(/src="([^"]+afcdn\.com[^"]+)"/);
                    if (imgMatch) {
                        // Keep highest resolution, usually w75h75 or w150h150.
                        const url = imgMatch[1].split(' ')[0];
                        if (url.includes('afcdn.com/recipe')) {
                            console.log(`  ✅ Trouvé ! (${marmitonName}) -> ${url}`);
                            return url;
                        }
                    }
                }
            }
        }
        console.log(`  ❌ L'ingrédient n'a pas été trouvé avec une image sur la page de recette.`);
        return null;
        
    } catch (e) {
        console.error(`  ⚠️ Erreur lors de la recherche de ${ingredientName}: ${e.message}`);
        return null;
    }
}

async function run() {
    console.log(`Début du balayage de TOUS les ingrédients en cache...`);
    const keys = Object.keys(cache);
    let updatedCount = 0;
    
    // Sort keys to prioritize basic ingredients (usually shorter names)
    keys.sort((a,b) => a.length - b.length);

    for (const rawKey of keys) {
        // Skip specific local images already set
        const currentUrl = cache[rawKey];
        if (currentUrl && currentUrl.startsWith('/ingredients/')) {
            continue;
        }
        
        const cleanName = cleanIngredient(rawKey);
        if (!cleanName || cleanName.length < 2) continue;
        
        // Fetch only if it's currently a wikipedia image or null/no-image.
        if (!currentUrl || currentUrl === 'no-image' || currentUrl.includes('wikipedia')) {
             const marmitonUrl = await findMarmitonImageUrl(cleanName);
             if (marmitonUrl) {
                 cache[rawKey] = marmitonUrl;
                 updatedCount++;
                 // Save progressively
                 fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
             } else {
                 // Try searching just the first word if it's multiple words
                 const firstWord = cleanName.split(' ')[0];
                 if (firstWord !== cleanName && firstWord.length > 2) {
                     const splitUrl = await findMarmitonImageUrl(firstWord);
                     if (splitUrl) {
                         cache[rawKey] = splitUrl;
                         updatedCount++;
                         fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
                     }
                 }
             }
             
             // Sleep 1 second to avoid being blocked by Marmiton
             await new Promise(r => setTimeout(r, 1000));
        }
    }
    
    console.log(`\n🎉 Terminé ! ${updatedCount} images remplacées par les officiels Marmiton.`);
}

run();
