const fs = require('fs');
const path = require('path');
const os = require('os');
const fetch = require('node-fetch');
const sharp = require('sharp');
require('dotenv').config({ path: __dirname + '/.env' });

/**
 * Recherche une photo professionnelle pour la recette.
 * EXCLUSIVE AI MODE: No scraping, only AI generation.
 */
async function searchPhoto(keyword) {
    if (!keyword) return null;

    console.log(`\n   📸 GÉNÉRATION PHOTO IA POUR : "${keyword}"`);

    // 1. Génération par IA (Pollinations - Rapide et sans clé)
    console.log(`     - Génération via IA professionnelle (Style Gourmet)...`);
    let aiPath = await generateImageWithAI(keyword);
    if (aiPath) return aiPath;

    // 2. Fallback : Gemini Image
    console.log(`     - Fallback : Gemini Image (Peut requérir un plan payant)...`);
    aiPath = await generateImageWithGemini(keyword);
    if (aiPath) return aiPath;
    
    // 3. Fallback Pixabay (Images libres de droits professionnelles)
    console.log(`     - Fallback : Recherche sur Pixabay...`);
    let imgUrl = await searchOnPixabay(keyword);
    if (imgUrl) {
        let localPath = await downloadImage(imgUrl);
        if (localPath) return `file://${localPath}`;
    }
    
    // 4. Fallback DuckDuckGo
    console.log(`     - Fallback ultime : DuckDuckGo Images...`);
    imgUrl = await searchImageOnSite(keyword, 'marmiton.org');
    if (!imgUrl) imgUrl = await searchImageOnSite(keyword, 'cuisineaz.com');
    if (imgUrl) {
        let localPath = await downloadImage(imgUrl);
        if (localPath) return `file://${localPath}`;
    }
    
    return null;
}

/**
 * Génère une image via Pollinations.ai (Flux/Stable Diffusion)
 */
async function generateImageWithAI(recipeName) {
    try {
        const environments = [
            "in a modern professional chef's kitchen with stainless steel in the background",
            "in an elegant contemporary dining room",
            "in a beautiful outdoor garden or patio setting during golden hour"
        ];
        const randomEnv = environments[Math.floor(Math.random() * environments.length)];
        
        const promptText = `Professional food photography of ${recipeName}, meticulously plated by a Michelin star chef, ${randomEnv}, gourmet restaurant plating, soft cinematic lighting, shallow depth of field, 8k resolution, highly detailed, photorealistic, appetizing.`;
        const prompt = encodeURIComponent(promptText);
        const url = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000)}&model=flux&nologo=true`;
        
        const localPath = await downloadImage(url);
        if (localPath) {
            console.log(`     ✅ Photo IA générée avec succès !`);
            return `file://${localPath}`;
        }
    } catch (e) {
        console.log(`     ⚠️ Échec génération Pollinations: ${e.message}`);
    }
    return null;
}

/**
 * Recherche sur Pixabay
 */
async function searchOnPixabay(keyword) {
    const apiKey = process.env.PIXABAY_API_KEY || '44284898-75df2864d4b8e9106093630f4';
    try {
        const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(keyword)}&image_type=photo&category=food&safesearch=true&per_page=3&lang=fr`;
        const res = await fetch(url, { timeout: 5000 });
        const data = await res.json();
        
        if (data && data.hits && data.hits.length > 0) {
            return data.hits[0].largeImageURL || data.hits[0].webformatURL;
        }
    } catch (e) {}
    return null;
}

/**
 * DuckDuckGo Scraping
 */
async function searchImageOnSite(keyword, site) {
    const query = `site:${site} ${keyword}`;
    const headers = { 'User-Agent': 'Mozilla/5.0' };
    try {
        const ddgUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
        const res = await fetch(ddgUrl, { headers, timeout: 5000 });
        const html = await res.text();
        const vqdMatch = html.match(/vqd=["'](.*?)["']/);
        if (!vqdMatch) return null;

        const vqd = vqdMatch[1];
        const apiUrl = `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,,&p=1`;
        const apiRes = await fetch(apiUrl, { headers: { ...headers, 'Referer': 'https://duckduckgo.com/' }, timeout: 5000 });
        const data = await apiRes.json();
        
        if (data?.results?.length > 0) {
            return data.results[0].image;
        }
    } catch (e) {}
    return null;
}

/**
 * Télécharge une image
 */
async function downloadImage(url) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
        if (!res.ok) return null;
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('image')) {
            console.log(`     ⚠️ downloadImage: Le contenu n'est pas une image (${contentType})`);
            return null;
        }
        const buffer = await res.buffer();
        const tmpPath = path.join(os.tmpdir(), `recipe_img_${Date.now()}.jpg`);
        fs.writeFileSync(tmpPath, buffer);
        return tmpPath;
    } catch (e) { return null; }
}

/**
 * Nettoyage image
 */
async function processImage(localPath, site) {
    if (site === 'marmiton.org') {
        try {
            const outPath = localPath.replace('.', '_clean.');
            const img = sharp(localPath);
            const metadata = await img.metadata();
            const cropHeight = Math.floor(metadata.height * 0.12);
            await img.extract({ left: 0, top: cropHeight, width: metadata.width, height: metadata.height - cropHeight }).jpeg({ quality: 90 }).toFile(outPath);
            fs.unlinkSync(localPath);
            return outPath;
        } catch (e) {}
    }
    return localPath;
}

/**
 * Gemini Image Fallback
 */
async function generateImageWithGemini(recipeName) {
    const keys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',').filter(Boolean);
    const prompt = `Professional food photography of "${recipeName}". Gourmet plating.`;
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    
    for (const key of keys) {
        for (const model of models) {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } })
                });
                if (res.status === 429) {
                    console.log(`     🚨 Quota Gemini dépassé pour la clé ${key.substring(0, 8)}... (429).`);
                    break; 
                }
                const data = await res.json();
                const part = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (part) {
                    const tmpPath = path.join(os.tmpdir(), `recipe_ai_${Date.now()}.jpg`);
                    fs.writeFileSync(tmpPath, Buffer.from(part.inlineData.data, 'base64'));
                    console.log(`     ✅ Gemini Image OK!`);
                    return `file://${tmpPath}`;
                }
            } catch (e) {
                console.error(`     ⚠️ Erreur Gemini Image (${model}): ${e.message}`);
            }
        }
    }
    return null;
}

module.exports = { searchPhoto, findPhoto: searchPhoto, generateImageWithGemini, searchImageOnSite, downloadImage };
