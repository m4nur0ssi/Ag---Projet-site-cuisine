const http = require('http');
const https = require('https');
const Buffer = require('buffer').Buffer;

const WP_URL = 'http://192.168.1.200/wordpress/wp-json/wp/v2';
const WP_AUTH = Buffer.from('m4nu:2TlsWemp!').toString('base64');
const GEMINI_API_KEY = 'AIzaSyB70uc2YzIY-7ssKt33M0f4AyZybxKKrdo';

async function fetchPage(page) {
    return new Promise((resolve, reject) => {
        const url = `${WP_URL}/posts?per_page=50&page=${page}&_embed`;
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 400) return resolve([]);
                try {
                    const json = JSON.parse(data);
                    resolve(Array.isArray(json) ? json : []);
                } catch (e) { resolve([]); }
            });
        }).on('error', reject);
    });
}

async function updatePost(id, content) {
    return new Promise((resolve, reject) => {
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
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function geminiParse(title, content) {
    const prompt = `Tu es un expert culinaire. Reatruecture cette recette en JSON.
    Titre: ${title}
    Contenu HTML: ${content}
    Réponds uniquement le JSON: {"ingredients": ["quantité nom", ...], "steps": ["étape 1", ...]}`;

    const models = [
        { name: 'gemini-2.0-flash-lite', api: 'v1beta' },
        { name: 'gemini-2.0-flash', api: 'v1beta' },
        { name: 'gemini-flash-latest', api: 'v1' }
    ];
    for (const model of models) {
        try {
            const res = await new Promise((resolve, reject) => {
                const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
                const req = https.request(`https://generativelanguage.googleapis.com/${model.api}/models/${model.name}:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (resp) => {
                    let d = ''; resp.on('data', c => d += c); resp.on('end', () => {
                        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
                    });
                });
                req.on('error', reject);
                req.write(body); req.end();
            });

            if (res.error && res.error.code === 429) {
                console.log(`      ⏳ Quota local dépassé pour ${model.name}, attente 30s...`);
                await new Promise(r => setTimeout(r, 30000));
                return geminiParse(title, content); // Réessai récursif
            }

            if (res.error) {
                console.log(`      ⚠️ ${model.name}: ${res.error.message}`);
                continue;
            }
            if (res.candidates && res.candidates[0].content.parts[0].text) {
                const match = res.candidates[0].content.parts[0].text.match(/\{[\s\S]*\}/);
                return JSON.parse(match[0]);
            }
        } catch (e) {
            console.log(`      ⚠️ ${model.name} err: ${e.message}`);
        }
    }
    return null;
}

async function searchIngredientPhoto(name) {
    const cleanName = name.toLowerCase().replace(/^[0-9\s,./]+(?:g|kg|ml|cl|l|c\.à\.s|c\.à\.c|verre|pincée)?( de | d'| de)?/i, '').trim().split(' (')[0].trim();
    const pixabayKey = '44284898-75df2864d4b8e9106093630f4';
    const pixabayUrl = `https://pixabay.com/api/?key=${pixabayKey}&q=${encodeURIComponent(cleanName)}&image_type=photo&category=food&per_page=3&safesearch=true`;
    return new Promise((resolve) => {
        https.get(pixabayUrl, (res) => {
            let data = '';
            res.on('data', c => data += c);
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

async function processAll() {
    let page = 1;
    let fixed = 0;
    while (true) {
        console.log(`\n📄 Lecture de la page ${page}...`);
        const posts = await fetchPage(page);
        if (posts.length === 0) break;

        for (const post of posts) {
            // Uniquement si pas déjà fait OU si on veut forcer les logos
            if (post.content.rendered.includes('mpprecipe-ingredient-img') && post.slug !== 'messe-libanais-boulettes-de-boeuf-houmous-maison') {
                continue;
            }

            console.log(`   🛠️  REPARATION : "${post.title.rendered}"`);
            const parsed = await geminiParse(post.title.rendered, post.content.rendered);
            if (!parsed) { console.log('      ❌ Erreur IA'); continue; }

            const richIng = [];
            for (const ing of parsed.ingredients) {
                await new Promise(r => setTimeout(r, 200));
                const photo = await searchIngredientPhoto(ing);
                richIng.push({ name: ing, image: photo });
            }

            const jsonLd = { "@context": "http://schema.org/", "@type": "Recipe", "name": post.title.rendered, "recipeIngredient": parsed.ingredients, "recipeInstructions": parsed.steps.map(s => ({ "@type": "HowToStep", "text": s })) };

            const style = `
<style>
.mpprecipe-ingredient-item{display:flex;align-items:center;gap:15px;margin-bottom:12px;list-style:none}
.mpprecipe-ingredient-img{width:45px;height:45px;border-radius:50%;object-fit:cover;border:1px solid #eee;background:#fff;flex-shrink:0}
.mpprecipe-ingredient-text{font-size:1rem}
#mpprecipe-ingredients-list{padding:0}
</style>`;

            const content = `${style}<div id="mpprecipe-container"><script type="application/ld+json">${JSON.stringify(jsonLd)}</script><div class="mpprecipe-description">${post.title.rendered}</div><ul id="mpprecipe-ingredients-list">${richIng.map(i => `<li class="mpprecipe-ingredient-item">${i.image ? `<img src="${i.image}" class="mpprecipe-ingredient-img" alt="${i.name}" />` : '<div class="mpprecipe-ingredient-img" style="display:flex;align-items:center;justify-content:center;">🥕</div>'}<span class="mpprecipe-ingredient-text">${i.name}</span></li>`).join('')}</ul><ol id="mpprecipe-instructions-list">${parsed.steps.map(s => `<li>${s}</li>`).join('')}</ol></div>`;

            const status = await updatePost(post.id, content);
            if (status === 200 || status === 201) {
                fixed++;
                console.log(`      ✅ Fixé (${fixed} au total)`);
            } else {
                console.error(`      ❌ Erreur WP: ${status}`);
            }
        }
        page++;
    }
    console.log(`\n🎉 TERMINÉ ! ${fixed} recettes ont été réparées.`);
}

processAll();

