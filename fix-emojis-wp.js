const http = require('http');
const https = require('https');
const fs = require('fs');
const Buffer = require('buffer').Buffer;

const WP_URL = 'http://192.168.1.200/wordpress/wp-json/wp/v2';
const WP_AUTH = Buffer.from('m4nu:2TlsWemp!').toString('base64');
const emojiMap = JSON.parse(fs.readFileSync('ingredient-icons.json', 'utf8'));

// Similar heuristic function just in case
function getEmojiForIngredient(name) {
    name = name.toLowerCase();

    if (name.includes('carotte')) return '🥕';
    if (name.includes('oignon') || name.includes('oignion') || name.includes('échalote') || name.includes('echalote')) return '🧅';
    if (name.includes('ail')) return '🧄';
    if (name.includes('pomme de terre') || name.includes('grenaille') || name.includes('patate')) return '🥔';
    if (name.includes('tomate')) return '🍅';
    if (name.includes('poivron') || name.includes('piment')) return '🌶️';
    if (name.includes('champignon') || name.includes('portobello')) return '🍄';
    if (name.includes('brocoli')) return '🥦';
    if (name.includes('chou') && !name.includes('choux')) return '🥬';
    if (name.includes('choux')) return '🥬';
    if (name.includes('concombre')) return '🥒';
    if (name.includes('avocat')) return '🥑';
    if (name.includes('aubergine')) return '🍆';
    if (name.includes('salade') || name.includes('batavia') || name.includes('laitue') || name.includes('mâche') || name.includes('roquette') || name.includes('épinard') || name.includes('epinard')) return '🥗';
    if (name.includes('maïs')) return '🌽';
    if (name.includes('haricot') || name.includes('pois')) return '🫘';

    if (name.includes('citron')) return '🍋';
    if (name.includes('pomme')) return '🍎';
    if (name.includes('banane')) return '🍌';
    if (name.includes('fraise')) return '🍓';
    if (name.includes('framboise')) return '🍇';
    if (name.includes('poire')) return '🍐';
    if (name.includes('orange')) return '🍊';
    if (name.includes('myrtille')) return '🫐';
    if (name.includes('cerise')) return '🍒';
    if (name.includes('raisin')) return '🍇';
    if (name.includes('mangue')) return '🥭';

    if (name.includes('poulet') || name.includes('volaille') || name.includes('dinde') || name.includes('canard')) return '🍗';
    if (name.includes('boeuf') || name.includes('bœuf') || name.includes('haché') || name.includes('steak') || name.includes('viande')) return '🥩';
    if (name.includes('porc') || name.includes('lardon') || name.includes('jambon') || name.includes('chorizo') || name.includes('saucisse') || name.includes('lard')) return '🥓';
    if (name.includes('saumon') || name.includes('poisson') || name.includes('thon') || name.includes('lieu') || name.includes('cabillaud') || name.includes('truite')) return '🐟';
    if (name.includes('crevette') || name.includes('scampi')) return '🦐';
    if (name.includes('calamar') || name.includes('encornet')) return '🦑';

    if (name.includes('oeuf') || name.includes('œuf')) return '🥚';
    if (name.includes('lait') || name.includes('crème') || name.includes('creme')) return '🥛';
    if (name.includes('beurre')) return '🧈';
    if (name.includes('fromage') || name.includes('gruyère') || name.includes('parmesan') || name.includes('mozzarella') || name.includes('cheddar') || name.includes('mascarpone') || name.includes('gouda') || name.includes('comté') || name.includes('chèvre')) return '🧀';

    if (name.includes('farine') || name.includes('pâte feuil') || name.includes('pâte bri') || name.includes('pâte sab')) return '🌾';
    if (name.includes('pain') || name.includes('chapelure') || name.includes('baguette')) return '🥖';
    if (name.includes('pâte') || name.includes('penne') || name.includes('spaghetti') || name.includes('macaroni') || name.includes('rigatoni') || name.includes('farfalle') || name.includes('casarecce') || name.includes('nouille')) return '🍝';
    if (name.includes('riz')) return '🍚';
    if (name.includes('sucre') || name.includes('miel') || name.includes('sirop')) return '🍯';
    if (name.includes('chocolat') || name.includes('cacao')) return '🍫';
    if (name.includes('vanille')) return '🍦';

    if (name.includes('huile') || name.includes('vinaigre')) return '🍾';
    if (name.includes('sel')) return '🧂';
    if (name.includes('poivre')) return '🌶️';
    if (name.includes('moutarde') || name.includes('mayonnaise') || name.includes('ketchup') || name.includes('sauce') || name.includes('bouillon') || name.includes('concentré de tomate')) return '🥫';
    if (name.includes('thym') || name.includes('persil') || name.includes('basilic') || name.includes('coriandre') || name.includes('ciboulette') || name.includes('herbe') || name.includes('romarin') || name.includes('menthe') || name.includes('estragon') || name.includes('aneth')) return '🌿';
    if (name.includes('curry') || name.includes('paprika') || name.includes('cumin') || name.includes('curcuma') || name.includes('cannelle') || name.includes('gingembre') || name.includes('muscade') || name.includes('épice')) return '🧂';

    if (name.includes('noix') || name.includes('noisette') || name.includes('amande') || name.includes('cajou') || name.includes('pécan') || name.includes('pistache')) return '🥜';
    if (name.includes('eau') || name.includes('vin') || name.includes('rhum') || name.includes('bière')) return '💧';

    return '🥣'; // Fallback
}

function getEmoji(name) {
    let cleanName = name.toLowerCase().replace(/^[0-9\s,./]+(?:g|kg|ml|cl|l|c\.à\.s|c\.à\.c|verre|cuillère|cuillere|pincée)?(?: de | d'| de)?/i, '').trim().split(' (')[0].trim();
    if (emojiMap[cleanName]) return emojiMap[cleanName];
    return getEmojiForIngredient(cleanName);
}

async function fetchPage(page) {
    return new Promise((resolve, reject) => {
        const url = `${WP_URL}/posts?per_page=50&page=${page}&_embed`;
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 400) return resolve([]);
                if (res.statusCode !== 200) return resolve([]);
                try {
                    const json = JSON.parse(data);
                    resolve(Array.isArray(json) ? json : []);
                } catch (e) { resolve([]); }
            });
        }).on('error', reject);
    });
}

async function updatePost(id, content) {
    return new Promise((resolve) => {
        const body = JSON.stringify({ content });
        const options = {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${WP_AUTH}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };
        const req = http.request(`${WP_URL}/posts/${id}`, options, (res) => {
            res.on('data', () => { });
            res.on('end', () => resolve(res.statusCode));
        });
        req.write(body); req.end();
    });
}

function processContent(content) {
    if (!content) return { html: content, modified: false };

    // Pour ne pas casser le style de meal-planner-pro
    content = content.replace('.mpprecipe-ingredient-img{', '.mpprecipe-ingredient-img{color:transparent;font-size:0;');

    // Trouver tous les noms d'ingrédients
    let modified = false;
    let newContent = content;

    // Remove any previously injected div inside images that might be conflicting
    newContent = newContent.replace(/<div class="mpprecipe-ingredient-img".*?<\/div>/g, '');
    newContent = newContent.replace(/<img[^>]*class="mpprecipe-ingredient-img"[^>]*>/g, '');

    const regex = /<span class="mpprecipe-ingredient-text">(.*?)<\/span>/g;
    let match;
    const ingredientsToReplace = [];
    while ((match = regex.exec(content)) !== null) {
        ingredientsToReplace.push(match[1]);
    }

    for (const ing of ingredientsToReplace) {
        const emoji = getEmoji(ing);
        const htmlToReplace = new RegExp(`<span class="mpprecipe-ingredient-text">${ing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/span>`, 'g');
        const replacement = `<div class="mpprecipe-ingredient-img" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background-color:#f8f9fa;border:1px solid #dee2e6;font-size:14px;margin-right:8px;vertical-align:middle;box-shadow:0 1px 3px rgba(0,0,0,0.1); flex-shrink: 0;">${emoji}</div><span class="mpprecipe-ingredient-text">${ing}</span>`;
        if (newContent.indexOf(replacement) === -1) {
            newContent = newContent.replace(htmlToReplace, replacement);
            modified = true;
        }
    }

    return { html: newContent, modified };
}

async function fix() {
    let page = 1;
    let keepGoing = true;

    while (keepGoing) {
        console.log(`\nRécupération page ${page}...`);
        const posts = await fetchPage(page);

        if (posts.length === 0) {
            console.log('Terminé ! Tous les articles ont été vérifiés.');
            keepGoing = false;
            break;
        }

        for (const post of posts) {
            const { html, modified } = processContent(post.content.rendered);

            if (modified) {
                console.log(`Mise à jour de l'article ${post.id} (${post.title?.rendered})`);
                const status = await updatePost(post.id, html);
                if (status === 200 || status === 201) {
                    console.log(` ✅ Post ${post.id}: Succès`);
                } else {
                    console.log(` ❌ Post ${post.id}: Erreur HTTP ${status}`);
                }
            }
        }

        page++;
    }
}

fix();
