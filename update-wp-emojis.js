const fs = require('fs');
const http = require('http');

// Local WordPress connection config
const WORDPRESS_LOCAL_IP = '192.168.1.200';

const USERNAME = 'm4nu';
const APP_PASSWORD = '2TlsWemp!'; // Or normal password if Basic Auth plugin allows it

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
    if (name.includes('lait') || name.includes('crème')) return '🥛';
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
    let cleanName = name.toLowerCase().replace(/^[0-9\s,./]+(?:g|kg|ml|cl|l|c\.à\.s|c\.à\.c|verre|pincée)?(?: de | d'| de)?/i, '').trim().split(' (')[0].trim();
    if (emojiMap[cleanName]) return emojiMap[cleanName];
    return getEmojiForIngredient(cleanName);
}

function processContent(html) {
    if (!html) return html;

    // We want to replace ingredient list items. 
    // They usually follow a headline like <h2...Ingrédients...</h2> and are in a <ul>...</ul>
    // It's safer to just replace ALL <li> that look like ingredients OR do a regex replace on <li>
    // For WordPress, let's inject a consistent style.

    // First, let's clean up any previous inline styles or images in <li> we might have generated
    html = html.replace(/<span style="[^"]*">([^<]*)<\/span>/g, '');
    html = html.replace(/<img[^>]*ingredient-icon[^>]*>/gi, '');
    html = html.replace(/<img[^>]*pixabay[^>]*>/gi, '');

    const liRegex = /<li>(.*?)<\/li>/gi;
    let modified = false;

    const newHtml = html.replace(liRegex, (match, content) => {
        // Strip out existing emojis that we put in last time (if any like 🥕)
        let cleanContent = content.replace(/(🥕|🥣|🥘|🧅|🧄|🥔|🍅|🌶️|🍄|🥦|🥬|🥒|🥑|🍆|🥗|🌽|🫘|🍋|🍎|🍌|🍓|🍇|🍐|🍊|🫐|🍒|🥭|🍗|🥩|🥓|🐟|🦐|🦑|🥚|🥛|🧈|🧀|🌾|🥖|🍝|🍚|🍯|🍫|🍦|🍾|🧂|🥫|🌿|🥜|💧)/g, '').replace(/<span[^>]*><\/span>/g, '').trim();

        let plainText = cleanContent.replace(/<[^>]*>?/gm, ''); // Remove all HTML
        if (plainText.length < 2) return match; // skip empty

        // If it looks like an instruction step (starts with verb or very long), we might skip, 
        // but typically recipes separate ingredients and steps. For now, we apply to all <li> 
        // or just ones that don't end with periods and are short.
        if (plainText.length > 80 && plainText.includes('.')) {
            return match; // probably a step
        }

        const emoji = getEmoji(plainText);

        // Inject the circle design
        modified = true;
        const iconHtml = `<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background-color:#f8f9fa;border:1px solid #dee2e6;font-size:14px;margin-right:8px;vertical-align:middle;box-shadow:0 1px 3px rgba(0,0,0,0.1);">${emoji}</span>`;

        return `<li style="list-style-type:none;margin-bottom:8px;display:flex;align-items:center;">${iconHtml}<span style="flex:1;">${cleanContent}</span></li>`;
    });

    return { html: newHtml, modified };
}

async function updatePost(post) {
    const { html, modified } = processContent(post.content.rendered);

    if (!modified) {
        console.log(`Le post ${post.id} n'a pas été modifié.`);
        return;
    }

    const postData = JSON.stringify({
        content: html
    });

    return new Promise((resolve, reject) => {
        const req = http.request(`http://${WORDPRESS_LOCAL_IP}/wordpress/wp-json/wp/v2/posts/${post.id}?bot_password=${encodeURIComponent(APP_PASSWORD)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': `Basic ${Buffer.from(USERNAME + ':' + APP_PASSWORD).toString('base64')}`
            }
        }, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log(`✅ Post ${post.id} mis à jour avec les nouveaux icônes.`);
                resolve();
            } else {
                let err = '';
                res.on('data', chunk => err += chunk);
                res.on('end', () => {
                    console.error(`❌ Erreur mise à jour post ${post.id}: ${res.statusCode} ${err}`);
                    resolve();
                });
            }
        });

        req.on('error', (e) => {
            console.error(`❌ Erreur réseau post ${post.id}: ${e.message}`);
            resolve();
        });

        req.write(postData);
        req.end();
    });
}

function fetchPosts(page = 1) {
    return new Promise((resolve, reject) => {
        http.get(`http://${WORDPRESS_LOCAL_IP}/wordpress/wp-json/wp/v2/posts?per_page=100&page=${page}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    if (res.statusCode === 400 && data.includes('rest_post_invalid_page_number')) {
                        resolve([]); // finished
                    } else {
                        reject(new Error(`Failed to fetch: ${res.statusCode}`));
                    }
                    return;
                }
                resolve(JSON.parse(data));
            });
        }).on('error', reject);
    });
}

async function run() {
    let page = 1;
    let keepGoing = true;
    while (keepGoing) {
        console.log(`Fetching page ${page}...`);
        const posts = await fetchPosts(page);
        if (posts.length === 0) {
            keepGoing = false;
            break;
        }

        for (let post of posts) {
            await updatePost(post);
            // wait a bit to avoid overwhelming WP
            await new Promise(r => setTimeout(r, 200));
        }
        page++;
    }
    console.log("Mise à jour terminée sur WordPress !");
}

run();
