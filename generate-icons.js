const fs = require('fs');
const https = require('https');

const GEMINI_API_KEY = 'AIzaSyB70uc2YzIY-7ssKt33M0f4AyZybxKKrdo';
const INGREDIENTS_FILE = 'ingredients-list.json';
const OUTPUT_FILE = 'ingredient-icons.json';

const ingredients = JSON.parse(fs.readFileSync(INGREDIENTS_FILE, 'utf8'));

let emojiMap = {};
if (fs.existsSync(OUTPUT_FILE)) {
    emojiMap = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
}

// Offline ingredient mapping to avoid API issues and ensure consistency
function getEmojiForIngredient(name) {
    name = name.toLowerCase();

    // Légumes
    if (name.includes('carotte')) return '🥕';
    if (name.includes('oignon') || name.includes('oignion') || name.includes('échalote') || name.includes('echalote')) return '🧅';
    if (name.includes('ail')) return '🧄';
    if (name.includes('pomme de terre') || name.includes('grenaille') || name.includes('patate')) return '🥔';
    if (name.includes('tomate')) return '🍅';
    if (name.includes('poivron') || name.includes('piment')) return '🌶️';
    if (name.includes('champignon') || name.includes('portobello')) return '🍄';
    if (name.includes('brocoli')) return '🥦';
    if (name.includes('chou') && !name.includes('choux')) return '🥬'; // chou vert
    if (name.includes('choux')) return '🥬';
    if (name.includes('concombre')) return '🥒';
    if (name.includes('avocat')) return '🥑';
    if (name.includes('aubergine')) return '🍆';
    if (name.includes('salade') || name.includes('batavia') || name.includes('laitue') || name.includes('mâche') || name.includes('roquette') || name.includes('épinard') || name.includes('epinard')) return '🥗';
    if (name.includes('maïs')) return '🌽';
    if (name.includes('haricot') || name.includes('pois')) return '🫘';

    // Fruits
    if (name.includes('citron')) return '🍋';
    if (name.includes('pomme')) return '🍎';
    if (name.includes('banane')) return '🍌';
    if (name.includes('fraise')) return '🍓';
    if (name.includes('framboise')) return '🍇'; // closest
    if (name.includes('poire')) return '🍐';
    if (name.includes('orange')) return '🍊';
    if (name.includes('myrtille')) return '🫐';
    if (name.includes('cerise')) return '🍒';
    if (name.includes('raisin')) return '🍇';
    if (name.includes('mangue')) return '🥭';

    // Viandes & Poissons
    if (name.includes('poulet') || name.includes('volaille') || name.includes('dinde') || name.includes('canard')) return '🍗';
    if (name.includes('boeuf') || name.includes('bœuf') || name.includes('haché') || name.includes('steak') || name.includes('viande')) return '🥩';
    if (name.includes('porc') || name.includes('lardon') || name.includes('jambon') || name.includes('chorizo') || name.includes('saucisse') || name.includes('lard')) return '🥓';
    if (name.includes('saumon') || name.includes('poisson') || name.includes('thon') || name.includes('lieu') || name.includes('cabillaud') || name.includes('truite')) return '🐟';
    if (name.includes('crevette') || name.includes('scampi')) return '🦐';
    if (name.includes('calamar') || name.includes('encornet')) return '🦑';

    // Laitiers & Œufs
    if (name.includes('oeuf') || name.includes('œuf')) return '🥚';
    if (name.includes('lait') || name.includes('crème')) return '🥛';
    if (name.includes('beurre')) return '🧈';
    if (name.includes('fromage') || name.includes('gruyère') || name.includes('parmesan') || name.includes('mozzarella') || name.includes('cheddar') || name.includes('mascarpone') || name.includes('gouda') || name.includes('comté') || name.includes('chèvre')) return '🧀';

    // Carb & Pâtisserie
    if (name.includes('farine') || name.includes('pâte feuil') || name.includes('pâte bri') || name.includes('pâte sab')) return '🌾';
    if (name.includes('pain') || name.includes('chapelure') || name.includes('baguette')) return '🥖';
    if (name.includes('pâte') || name.includes('penne') || name.includes('spaghetti') || name.includes('macaroni') || name.includes('rigatoni') || name.includes('farfalle') || name.includes('casarecce') || name.includes('nouille')) return '🍝';
    if (name.includes('riz')) return '🍚';
    if (name.includes('sucre') || name.includes('miel') || name.includes('sirop')) return '🍯';
    if (name.includes('chocolat') || name.includes('cacao')) return '🍫';
    if (name.includes('vanille')) return '🍦';

    // Huiles & Sauces & Epices
    if (name.includes('huile') || name.includes('vinaigre')) return '🍾';
    if (name.includes('sel')) return '🧂';
    if (name.includes('poivre')) return '🌶️';
    if (name.includes('moutarde') || name.includes('mayonnaise') || name.includes('ketchup') || name.includes('sauce') || name.includes('bouillon') || name.includes('concentré de tomate')) return '🥫';
    if (name.includes('thym') || name.includes('persil') || name.includes('basilic') || name.includes('coriandre') || name.includes('ciboulette') || name.includes('herbe') || name.includes('romarin') || name.includes('menthe') || name.includes('estragon') || name.includes('aneth')) return '🌿';
    if (name.includes('curry') || name.includes('paprika') || name.includes('cumin') || name.includes('curcuma') || name.includes('cannelle') || name.includes('gingembre') || name.includes('muscade') || name.includes('épice')) return '🧂';

    // Autres
    if (name.includes('noix') || name.includes('noisette') || name.includes('amande') || name.includes('cajou') || name.includes('pécan') || name.includes('pistache')) return '🥜';
    if (name.includes('eau') || name.includes('vin') || name.includes('rhum') || name.includes('bière')) return '💧';

    return '🥣'; // Fallback
}

function run() {
    const missing = ingredients.filter(i => !emojiMap[i]);
    missing.forEach(ing => {
        emojiMap[ing] = getEmojiForIngredient(ing);
    });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(emojiMap, null, 2));
    console.log(`Saved emoji map offline. Total entries: ${Object.keys(emojiMap).length}`);
}

run();
