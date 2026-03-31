const http = require('http');
const https = require('https');
const Buffer = require('buffer').Buffer;

const WP_URL = 'http://192.168.1.200/wordpress/wp-json/wp/v2';
const WP_AUTH = Buffer.from('m4nu:2TlsWemp!').toString('base64');
const PIXABAY_KEY = '44284898-75df2864d4b8e9106093630f4';

async function fetchPost(slug) {
    return new Promise((resolve, reject) => {
        http.get(`${WP_URL}/posts?slug=${slug}`, (res) => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)[0]));
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

function searchPixabay(name) {
    const cleanName = name.toLowerCase().replace(/^[0-9\s,./]+(?:g|kg|ml|cl|l|c\.à\.s|c\.à\.c|verre|pincée)?( de | d'| de)?/i, '').trim().split(' (')[0].trim();
    const pixabayUrl = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(cleanName)}&image_type=photo&category=food&per_page=3&safesearch=true`;

    return new Promise((resolve) => {
        https.get(pixabayUrl, (res) => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.hits && json.hits.length > 0) resolve(json.hits[0].webformatURL);
                    else resolve(null);
                } catch (e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function fix() {
    console.log("Vérification rapide (sans IA) de la recette...");
    const post = await fetchPost('messe-libanais-boulettes-de-boeuf-houmous-maison');
    let content = post.content.rendered;

    // Remplacer les styles pour cacher le `alt` défectueux si l'image casse
    content = content.replace('.mpprecipe-ingredient-img{', '.mpprecipe-ingredient-img{color:transparent;font-size:0;');

    // Trouver tous les noms d'ingrédients
    const regex = /<span class="mpprecipe-ingredient-text">(.*?)<\/span>/g;
    let match;
    const ingredients = [];
    while ((match = regex.exec(content)) !== null) {
        ingredients.push(match[1]);
    }

    console.log(`Trouvé ${ingredients.length} ingrédients, recherche sur Pixabay...`);

    for (const ing of ingredients) {
        const pic = await searchPixabay(ing);
        if (pic) {
            console.log(` ✅ Photo: ${ing}`);
            // Remplace l'image Unsplash cassée qui est juste au-dessus du span correspondant
            const htmlToReplace = new RegExp(`<img src="https:\\/\\/source\\.unsplash[^>]*alt="${ing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'g');
            content = content.replace(htmlToReplace, `<img src="${pic}" class="mpprecipe-ingredient-img" alt="${ing}" />`);
        } else {
            console.log(` ❌ Pas de photo: ${ing}`);
            const htmlToReplace = new RegExp(`<img src="https:\\/\\/source\\.unsplash[^>]*alt="${ing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'g');
            content = content.replace(htmlToReplace, `<div class="mpprecipe-ingredient-img" style="display:flex;align-items:center;justify-content:center;background:#fff8ee;color:#ff8a00;font-size:1.5rem;">🥕</div>`);
        }
    }

    console.log("Mise à jour WordPress...");
    await updatePost(post.id, content);
    console.log("Fait !");
}

fix();
