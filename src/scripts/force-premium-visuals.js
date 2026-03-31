const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(__dirname, '..', 'data', 'ingredient-cache.json');
const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));

const PREMIUM_URLS = [
    // Légumes & Herbes (Haute Priorité pour éviter les faux positifs dans les crèmes/huiles)
    ['basilic', 'https://upload.wikimedia.org/wikipedia/commons/9/92/Basil_leaves.jpg'],
    ['persil', 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Flat_leaf_parsley.jpg'],
    ['oignon', 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Oignon_doux_des_C%C3%A9vennes_1.jpg'],
    ['ail', 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Garlic_bulbs_and_cloves.jpg'],
    ['tomates pelées', '/ingredients/canned-tomatoes.png'],
    ['conserve de tomate', '/ingredients/canned-tomatoes.png'], ['boite de tomate', '/ingredients/canned-tomatoes.png'], ['conserve de tomates', '/ingredients/canned-tomatoes.png'], ['chair de tomates', '/ingredients/canned-tomatoes.png'], ['purée de tomates', '/ingredients/canned-tomatoes.png'],
    ['tomate', 'https://upload.wikimedia.org/wikipedia/commons/8/89/Tomato_je.jpg'],
    ['carotte', 'https://upload.wikimedia.org/wikipedia/commons/0/03/Carrot_on_white_background.jpg'],
    ['citron', 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Lemon.jpg'],
    ['pomme de terre', 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Potato_and_its_cross_section_on_white_background.jpg'],

    // Féculents & Pâtes
    ['pâte feuilletée', '/ingredients/puff-pastry.png'],
    ['pâte sablée', '/ingredients/puff-pastry.png'],
    ['pâte brisée', '/ingredients/puff-pastry.png'],
    ['pâtes', 'https://upload.wikimedia.org/wikipedia/commons/0/05/Rigatoni_on_white_background.jpg'],
    ['riz', 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Arroz_blanco.jpg'],
    
    // Viandes & Poissons
    ['viande hachée', 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Ground_beef_USDA.jpg'],
    ['boeuf haché', 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Ground_beef_USDA.jpg'],
    ['bœuf haché', 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Ground_beef_USDA.jpg'],
    ['poulet', 'https://upload.wikimedia.org/wikipedia/commons/8/8f/Tavuk_G%C3%B6%C4%9Fs%C3%BC.JPG'],
    ['chorizo', 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Chorizo_ib%C3%A9rico_de_bellota.jpg'],
    ['boeuf', 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Raw_beef_on_white_background.jpg'],
    ['bœuf', 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Raw_beef_on_white_background.jpg'],
    
    // Produits laitiers
    ['creme liquide', 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Creme_anglaise_p1050168.jpg'],
    ['crème liquide', 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Creme_anglaise_p1050168.jpg'],
    ['creme', 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Creme_anglaise_p1050168.jpg'],
    ['crème', 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Creme_anglaise_p1050168.jpg'],
    ['lait', 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Glass_of_Milk_on_white_background.jpg'],
    ['beurre', 'https://upload.wikimedia.org/wikipedia/commons/6/60/Butter_250_g.jpg'],
    ['mozzarella', 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Mozzarella_di_bufala_campana.jpg'],
    ['parmesan', 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Cuneiform_slice_of_Parmigiano-Reggiano.jpg'],
    
    // Base & Assaisonnements
    ['levure', 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Fresh_yeast.png'],
    ['farine', 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Farine_de_bl%C3%A9_type_55.jpg'],
    ['oeuf', 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Egg_on_white_background.jpg'],
    ['œuf', 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Egg_on_white_background.jpg'],
    ['oeufs', 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Egg_on_white_background.jpg'],
    ['œufs', 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Egg_on_white_background.jpg'],
    ['sucre', 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Sugar_in_glass_bowl.jpg'],
    ['sel', '/ingredients/salt.png'],
    ['poivre', '/ingredients/pepper.png'],
    ['huile', 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Olive_oil_bottle.jpg'],
    ['moutarde de dijon', 'https://upload.wikimedia.org/wikipedia/commons/3/30/Moutarde_de_Bourgogne_04.jpg'],
    ['moutarde fuerte', 'https://upload.wikimedia.org/wikipedia/commons/2/23/Mustard.JPG'],
    ['moutarde', 'https://upload.wikimedia.org/wikipedia/commons/2/23/Mustard.JPG'],
    
    // Autres
    ['chocolat', 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Chocolate_pieces.jpg'],
    ['pâte', 'https://upload.wikimedia.org/wikipedia/commons/0/13/Pâte_à_pain.jpg']
];

let fixedCount = 0;
for (let [key, url] of Object.entries(cache)) {
    const keyLower = key.toLowerCase();
    
    // Check if the key contains any of our premium keywords as a WHOLE word
    for (const [kw, premiumUrl] of PREMIUM_URLS) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        
        if (regex.test(keyLower)) {
            // Exceptions
            if (kw === 'lait' && (keyLower.includes('coco') || keyLower.includes('soja') || keyLower.includes('laitue'))) continue;
            if (kw === 'huile' && keyLower.includes('basilic')) continue;
            
            if (cache[key] !== premiumUrl) {
                console.log(`✨ Fix Premium: "${key}" -> ${kw}`);
                cache[key] = premiumUrl;
                fixedCount++;
                break;
            }
            // If we found a match and it's already correct, we still break to respect priority
            break;
        }
    }
}

// Manual cleanup of the "Cuirass", "Laitue" error and other obvious errors found
const manualFixes = {
    "filet de laitue peu d’huile d’olive": "no-image",
    "thon à l’huile": "https://upload.wikimedia.org/wikipedia/commons/1/16/Rouvet_%28Ruvettus_pretiosus%29_%28Ifremer_00764-87604%29.jpg" // Actually a fish, it's ok but maybe not premium
};

for (const [key, target] of Object.entries(manualFixes)) {
    if (cache[key]) {
        cache[key] = target;
    }
}

fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
console.log(`\n✅ Terminé. ${fixedCount} ingrédients corrigés.`);
