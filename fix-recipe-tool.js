const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Charger .env manuellement
// Charger .env de manière relative
const envPath = path.join(__dirname, 'tiktok-bot', '.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
}
const WP_AUTH = Buffer.from(`${process.env.WP_USERNAME || 'm4nu'}:${process.env.WP_PASSWORD || '2TlsWemp!'}`).toString('base64');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyB70uc2YzIY-7ssKt33M0f4AyZybxKKrdo';
const WP_BASE = 'http://192.168.1.200/wordpress/wp-json/wp/v2';

async function fetchPost(slug) {
    return new Promise((resolve, reject) => {
        const url = `http://192.168.1.200/wordpress/wp-json/wp/v2/posts?slug=${slug}`;
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)[0]));
        }).on('error', reject);
    });
}

async function updatePost(id, content) {
    return new Promise((resolve, reject) => {
        // Bypass auth via query param pour NAS/Nginx
        const url = `${WP_BASE}/posts/${id}?_auth_user=${process.env.WP_USERNAME}&_auth_pass=${process.env.WP_PASSWORD}`;
        const body = JSON.stringify({ content });
        const options = {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${WP_AUTH}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };
        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    console.error(`❌ WP Update Error (${res.statusCode}):`, data);
                    return reject(new Error(`WP status ${res.statusCode}`));
                }
                resolve(JSON.parse(data));
            });
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
    
    Réponds avec ce JSON exact (sans texte autour) :
    {
      "ingredients": ["1kg de pommes de terre", "..."],
      "steps": ["Étape 1...", "..."]
    }`;

    const models = [
        { name: 'gemini-2.0-flash-lite', api: 'v1beta' },
        { name: 'gemini-2.0-flash', api: 'v1beta' },
        { name: 'gemini-flash-latest', api: 'v1' }
    ];

    for (const model of models) {
        try {
            console.log(`   🤖 Essai avec ${model.name}...`);
            const result = await new Promise((resolve, reject) => {
                const url = `https://generativelanguage.googleapis.com/${model.api}/models/${model.name}:generateContent?key=${GEMINI_API_KEY}`;
                const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
                const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve(JSON.parse(data)));
                });
                req.on('error', reject);
                req.write(body);
                req.end();
            });

            if (result.error && result.error.code === 429) {
                console.log(`      ⏳ Quota dépassé pour ${model.name}, attente 15s...`);
                await new Promise(r => setTimeout(r, 15000));
                return geminiParse(title, content); // Réessai
            }
            if (result.error) {
                console.log(`   ⚠️ Erreur ${model.name}: ${result.error.message}`);
                continue;
            }

            if (result.candidates && result.candidates.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                const match = text.match(/\{[\s\S]*\}/);
                return JSON.parse(match[0]);
            }
        } catch (e) {
            console.log(`   ⚠️ Erreur critique ${model.name}: ${e.message}`);
        }
    }
    console.log('⏳ Attente 15s supplémentaire puis dernier essai...');
    await new Promise(r => setTimeout(r, 15000));
    return geminiParse(title, content);
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

async function fixRecipe(slug) {
    console.log(`🚀 Analyse de la recette : ${slug}`);
    const post = await fetchPost(slug);
    if (!post) return console.log('❌ Post non trouvé');

    console.log('🤖 Extraction par Gemini...');
    const parsed = await geminiParse(post.title.rendered, post.content.rendered);

    console.log(`📸 Recherche de ${parsed.ingredients.length} photos d'ingrédients...`);
    const richIngredients = [];
    for (const ing of parsed.ingredients) {
        process.stdout.write(`   🔍 ${ing}... `);
        const photo = await searchIngredientPhoto(ing);
        richIngredients.push({ name: ing, image: photo });
        console.log(photo ? '✅' : '❓');
    }

    // On utilise la logique de wordpress-poster.js (simplifiée ici)
    const jsonLd = {
        "@context": "http://schema.org/",
        "@type": "Recipe",
        "name": post.title.rendered,
        "recipeIngredient": parsed.ingredients,
        "recipeInstructions": parsed.steps.map(s => ({ "@type": "HowToStep", "text": s }))
    };

    const styleBlock = `<style>.mpprecipe-ingredient-item{display:flex;align-items:center;gap:15px;margin-bottom:12px;list-style:none}.mpprecipe-ingredient-img{width:45px;height:45px;border-radius:50%;object-fit:cover;border:1px solid #eee;background:#fff;flex-shrink:0}.mpprecipe-ingredient-text{font-size:1rem}#mpprecipe-ingredients-list{padding:0}</style>`;

    const newContent = `
${styleBlock}
<div id="mpprecipe-container">
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <div class="mpprecipe-description">${post.title.rendered} reformatée.</div>
    <ul id="mpprecipe-ingredients-list">
        ${richIngredients.map(ing => `
            <li class="mpprecipe-ingredient-item">
                ${ing.image ? `<img src="${ing.image}" class="mpprecipe-ingredient-img" alt="${ing.name}" />` : '<div class="mpprecipe-ingredient-img" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🥕</div>'}
                <span class="mpprecipe-ingredient-text">${ing.name}</span>
            </li>`).join('')}
    </ul>
    <ol id="mpprecipe-instructions-list">
        ${parsed.steps.map(step => `<li>${step}</li>`).join('')}
    </ol>
</div>`.trim();

    console.log('📤 Mise à jour WordPress...');
    await updatePost(post.id, newContent);
    console.log('✨ Terminé !');
}

const slugToFix = process.argv[2] || 'messe-libanais-boulettes-de-boeuf-houmous-maison';
fixRecipe(slugToFix);
