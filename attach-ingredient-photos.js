const fs = require('fs');
const path = require('path');
const https = require('https');

const MOCK_DATA_PATH = path.join(__dirname, 'src', 'data', 'mockData.ts');
const CACHE_PATH = path.join(__dirname, 'src', 'data', 'ingredient-cache.json');

let cache = {};
if (fs.existsSync(CACHE_PATH)) {
    try {
        cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    } catch (e) { }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const PREMIUM_OVERRIDES = {
    'lait': 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Glass_of_Milk_%2833657535532%29.jpg',
    'beurre': 'https://upload.wikimedia.org/wikipedia/commons/6/60/Butter_250_g.jpg',
    'levure': 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Fresh_yeast.png',
    'farine': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Farine_de_bl%C3%A9_type_55.jpg',
    'oeuf': 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Egg_on_white_background.jpg',
    'sucre': 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Sugar_in_glass_bowl.jpg',
    'sel': 'https://upload.wikimedia.org/wikipedia/commons/2/22/Salt_shaker_on_white_background.jpg',
    'oignon': 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Oignon_doux_des_C%C3%A9vennes_1.jpg',
    'ail': 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Garlic_bulbs_and_cloves.jpg',
    'huile': 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Olive_oil_bottle.jpg',
    'chocolat': 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Chocolate_pieces.jpg',
    'mozzarella': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Mozzarella_di_bufala_campana.jpg',
    'parmesan': 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Cuneiform_slice_of_Parmigiano-Reggiano.jpg',
    'creme': 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Creme_anglaise_p1050168.jpg'
};

async function fetchWikiImage(ingredientName) {
    if (!ingredientName || ingredientName.length < 3) return null;
    
    // Nettoyage agressif pour la recherche
    let cleanName = ingredientName.toLowerCase()
        .replace(/^[\uD83C-\uDBFF\uDC00-\uDFFF]+\s*/, '') // Remove emoji
        .replace(/^[0-9\s,./]+(?:g|kg|ml|cl|l|c\.à\.s|c\.à\.c|verre|pincée)?(?: de | d'| de)?/i, '')
        .replace(/^(?:frais|fraîche|fraiche|haché|émincé|coupé|en dés|rapé|râpé|émietté|moulu|en poudre|séché|séchée)\s+/i, '')
        .trim().split(' (')[0].trim();
        
    if (cleanName.length < 2) return null;

    // Check Premium Overrides FIRST
    for (const [kw, premiumUrl] of Object.entries(PREMIUM_OVERRIDES)) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(cleanName)) {
            // Exceptions
            if (kw === 'lait' && (cleanName.includes('coco') || cleanName.includes('soja') || cleanName.includes('laitue'))) continue;
            if (kw === 'huile' && cleanName.includes('basilic')) continue;
            
            cache[cleanName] = premiumUrl;
            return premiumUrl;
        }
    }

    // Check cache
    if (cache[cleanName] !== undefined) {
        return cache[cleanName] === 'no-image' ? null : cache[cleanName];
    }

    // Recherche beaucoup plus spécifique pour avoir des "packshots" (fond blanc)
    const query = encodeURIComponent(`"${cleanName}" food ingredient white background`);
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url&format=json`;

    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'RecipeApp/1.0 (Contact: local)' } }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.query && json.query.pages) {
                        const pages = Object.values(json.query.pages);
                        
                        // Score les résultats pour éviter les trucs bizarres
                        const excludes = ['church', 'label', 'map', 'street', 'city', 'portrait', 'museum', 'book', 'bottle'];
                        
                        for (let page of pages) {
                            if (page.imageinfo && page.imageinfo.length > 0) {
                                const imgUrl = page.imageinfo[0].url.toLowerCase();
                                const title = page.title.toLowerCase();
                                
                                // On évite les formats non-images ou les trucs suspects
                                if (imgUrl.endsWith('.svg') || imgUrl.endsWith('.tif') || imgUrl.endsWith('.tiff')) continue;
                                if (excludes.some(word => title.includes(word) || imgUrl.includes(word))) continue;

                                const finalUrl = page.imageinfo[0].url;
                                cache[cleanName] = finalUrl;
                                fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
                                resolve(finalUrl);
                                return;
                            }
                        }
                    }
                    cache[cleanName] = 'no-image';
                    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
                    resolve(null);
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function run() {
    console.log("Lecture de mockData.ts...");
    let content = fs.readFileSync(MOCK_DATA_PATH, 'utf8');

    // Extract JSON part
    const jsonStart = content.indexOf('export const mockRecipes: Recipe[] = [') + 'export const mockRecipes: Recipe[] = '.length;
    const jsonEnd = content.lastIndexOf(']') + 1;
    if (jsonStart === -1 || jsonEnd === 0) {
        console.error("Format mockData.ts invalide.");
        return;
    }

    const rawJson = content.substring(jsonStart, jsonEnd);
    let recipes = JSON.parse(rawJson);
    let updatedCount = 0;

    console.log("Recherche de photos manquantes sur Wikimedia...");
    for (let recipe of recipes) {
        if (!recipe.ingredients) continue;
        for (let ing of recipe.ingredients) {
            if (!ing.image || ing.image.includes('🥕') || ing.image === '🥕') {
                const img = await fetchWikiImage(ing.name);
                if (img) {
                    ing.image = img;
                    updatedCount++;
                    console.log(` ✅ Photo trouvée pour: ${ing.name}`);
                }
                await sleep(100); // respect rate limits
            }
        }
    }

    console.log(`\n${updatedCount} images mises à jour ! Enregistrement...`);
    const newContent = content.substring(0, jsonStart) + JSON.stringify(recipes, null, 4) + content.substring(jsonEnd);
    fs.writeFileSync(MOCK_DATA_PATH, newContent);
    console.log("Terminé.");
}

run();
