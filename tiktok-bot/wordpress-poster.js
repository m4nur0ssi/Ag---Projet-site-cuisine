const fs = require('fs');
const fetch = require('node-fetch');
const https = require('https');
require('dotenv').config({ path: __dirname + '/.env' });

let ingredientIcons = {};
try {
    const iconsPath = __dirname + '/../ingredient-icons.json';
    if (fs.existsSync(iconsPath)) {
        ingredientIcons = JSON.parse(fs.readFileSync(iconsPath, 'utf8'));
    }
} catch (e) { }

function generateRecipeHtml(recipe) {
    const ingredientsHtml = (recipe.ingredients || []).map(ing => {
        const emoji = getEmojiForIngredient(ing.name || ing);
        return `<li style="margin-bottom: 12px; display: flex; align-items: flex-start; gap: 10px; font-size: 1.1em;">
            <span style="font-size: 1.2em;">${emoji}</span>
            <span><strong>${ing.quantity || ''}</strong> ${ing.name || ing}</span>
        </li>`;
    }).join('');

    const stepsHtml = (recipe.steps || []).map(s => `<li style="margin-bottom: 20px; font-size: 1.1em; padding-bottom: 15px; border-bottom: 1px solid #f1f2f6;">${s}</li>`).join('');
    
    const tiktokId = extractTikTokId(recipe.tiktokUrl);
    const tiktokEmbed = tiktokId ? `
<div style="margin: 20px auto; max-width: 325px; min-width: 325px;">
    <blockquote class="tiktok-embed" cite="https://www.tiktok.com/v/${tiktokId}" data-video-id="${tiktokId}" style="max-width: 605px;min-width: 325px;">
        <section>
            <a target="_blank" title="@tiktok" href="https://www.tiktok.com/v/${tiktokId}">Regarder la vidéo sur TikTok</a>
        </section>
    </blockquote>
    <script async src="https://www.tiktok.com/embed.js"></script>
</div>` : `<p style="text-align:center;"><a href="${recipe.tiktokUrl}" target="_blank">🔗 Voir la vidéo sur TikTok</a></p>`;

    const jsonLd = {
        "@context": "http://schema.org/",
        "@type": "Recipe",
        "name": recipe.title,
        "recipeIngredient": Array.isArray(recipe.ingredients) ? (typeof recipe.ingredients[0] === 'string' ? recipe.ingredients : recipe.ingredients.map(i => i.name)) : [],
        "recipeInstructions": (recipe.steps || []).map(s => ({ "@type": "HowToStep", "text": s })),
        "description": recipe.summary || ""
    };

    return `
<div class="mpp-recipe-wrapper" style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #2d3436; max-width: 700px; margin: 0 auto; line-height: 1.6;">
    <p style="font-size: 1.15em; font-style: italic; color: #636e72; margin-bottom: 40px; border-left: 4px solid #ffde59; padding-left: 20px;">
        ${recipe.summary || 'Découvrez cette pépite culinaire venue tout droit de TikTok !'}
    </p>
    <div id="mpprecipe-container" style="background: #ffffff; padding: 35px; border-radius: 16px; border: 1px solid #dfe6e9; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 40px;">
        <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
        <h3 style="margin: 0 0 25px 0; font-size: 1.5em; color: #2d3436; border-bottom: 2px solid #ffde59; padding-bottom: 10px; display: inline-block;">🛒 Ingrédients</h3>
        <ul id="mpprecipe-ingredients-list" style="list-style-type: none; padding-left: 0; margin: 0 0 35px 0;">
            ${ingredientsHtml}
        </ul>
        <div style="height: 10px; background: #f1f2f6; margin: 20px -35px; border-top: 1px solid #dfe6e9; border-bottom: 1px solid #dfe6e9;"></div>
        <h3 style="margin: 25px 0; font-size: 1.5em; color: #2d3436; border-bottom: 2px solid #ffde59; padding-bottom: 10px; display: inline-block;">👨‍🍳 Préparation</h3>
        <ol id="mpprecipe-instructions-list" style="padding-left: 25px; margin: 0; line-height: 1.8; color: #2d3436;">
            ${stepsHtml}
        </ol>
    </div>
    <div style="margin: 50px 0; border-top: 2px dashed #dfe6e9; padding-top: 40px; text-align: center;">
        <h3 style="color: #2d3436; font-size: 1.4em; margin-bottom: 30px;">🔥 Cuisine en vidéo !</h3>
        ${tiktokEmbed}
    </div>
</div>`.trim();
}

function getEmojiForIngredient(name) {
    let clean = name.toLowerCase()
        .replace(/^[0-9\s,./]+(?:g|kg|ml|cl|l|gr|cl|dl|c\.à\.s|c\.à\.c|cuillères|cuillère|cas|cac|pots|pot|verres|verre|pincées|pincée|sachets|sachet|briques|brique|boites|boite|gousses|gousse|tranches|tranche|pavés|pavé|filets|filet|pièces|pièce|boules|boule|bottes|botte|kg|grammes|un |une |des |du |de la |d'|de |l')/i, '')
        .replace(/\b(?:bio|frais|fraiche|mûr|mûre|ciselé|haché|écrasé|râpé|fondu|liquide|fumé|sec|séchée|en poudre|coupé|en morceaux|pour la|pour l')\b/g, '')
        .replace(/.*:\s*/, '')
        .trim();
    if (ingredientIcons[clean]) return ingredientIcons[clean];
    const keywords = ['oeuf', 'farine', 'sucre', 'lait', 'beurre', 'sel', 'chocolat', 'fraise', 'pomme', 'vanille', 'citron', 'pignon', 'amande', 'maizena', 'oeufs', 'œufs', 'vanille'];
    for (const kw of keywords) {
        if (clean.includes(kw)) {
            if (ingredientIcons[kw]) return ingredientIcons[kw];
            if (kw === 'pignon') return '🥣';
            if (kw === 'maizena') return '🥣';
            if (kw.includes('oeuf')) return '🥚';
            if (kw === 'vanille') return '🍦';
        }
    }
    for (const [key, emoji] of Object.entries(ingredientIcons)) {
        if (clean.includes(key)) return emoji;
    }
    return '🥣';
}

function extractTikTokId(url) {
    if (!url) return null;
    if (/^\d+$/.test(url)) return url; // Already an ID
    const match = url.match(/\/(video|photo|v)\/(\d+)/);
    if (match) return match[2];
    const idOnly = url.match(/video\/(\d+)/);
    if (idOnly) return idOnly[1];
    return null;
}

async function uploadImageToWP(photoUrl, user, pass, wpUrl, encoding) {
    let featuredImageId = null;
    try {
        console.log(`📸 Upload image ...`);
        let buffer;
        if (photoUrl.startsWith('file://')) {
            const filePath = photoUrl.replace('file://', '');
            buffer = fs.readFileSync(filePath);
        } else {
            const upRes = await fetch(photoUrl);
            buffer = await upRes.buffer();
        }
        const base64 = buffer.toString('base64');
        const fileName = `recipe_${Date.now()}.jpg`;

        const uploadXml = `${encoding}<methodCall><methodName>wp.uploadFile</methodName><params><param><value><int>1</int></value></param><param><value><string>${user}</string></value></param><param><value><string>${pass}</string></value></param><param><value><struct><member><name>name</name><value><string>${fileName}</string></value></member><member><name>type</name><value><string>image/jpeg</string></value></member><member><name>bits</name><value><base64>${base64}</base64></value></member></struct></value></param></params></methodCall>`;

        const res = await fetch(wpUrl, { 
            method: 'POST', 
            body: Buffer.from(uploadXml, 'utf-8'),
            timeout: 45000 
        });
        const text = await res.text();
        const idMatch = text.match(/<member><name>id<\/name><value><string>(\d+)<\/string><\/value><\/member>/)
            || text.match(/<member><name>id<\/name><value><int>(\d+)<\/int><\/value><\/member>/);
        if (idMatch) featuredImageId = idMatch[1];
    } catch (e) {
        console.warn(`   ⚠️ Upload image ignoré : ${e.message}`);
    }
    return featuredImageId;
}

async function postToWordPressXMLRPC(recipe) {
    const user = process.env.WP_USERNAME;
    const pass = process.env.WP_PASSWORD;
    const wpUrl = (process.env.WP_URL || '').replace(/\/$/, '') + '/xmlrpc.php';
    const encoding = '<?xml version="1.0" encoding="UTF-8"?>';

    // 1. CAS MISE À JOUR SIMPLE (Ex: ajout de photo manquante)
    if (recipe.updateOnly && recipe.id) {
        console.log(`📡 Mise à jour XML-RPC pour l'ID: ${recipe.id}`);
        let featuredImageId = null;
        if (recipe.photoUrl) {
            featuredImageId = await uploadImageToWP(recipe.photoUrl, user, pass, wpUrl, encoding);
        }

        const updateStruct = `<struct>
            ${recipe.title ? `<member><name>title</name><value><string><![CDATA[${recipe.title}]]></string></value></member>` : ''}
            ${recipe.content ? `<member><name>description</name><value><string><![CDATA[${recipe.content}]]></string></value></member>` : ''}
            ${featuredImageId ? `<member><name>wp_post_thumbnail</name><value><string>${featuredImageId}</string></value></member>` : ''}
            ${recipe.tags ? `<member><name>mt_keywords</name><value><string><![CDATA[${(recipe.tags || []).join(', ')}]]></string></value></member>` : ''}
            ${recipe.status ? `<member><name>post_status</name><value><string>${recipe.status}</string></value></member>` : ''}
        </struct>`;
        const updateXml = `${encoding}<methodCall><methodName>metaWeblog.editPost</methodName><params><param><value><string>${recipe.id}</string></value></param><param><value><string>${user}</string></value></param><param><value><string>${pass}</string></value></param><param><value>${updateStruct}</value></param><param><value><boolean>1</boolean></value></param></params></methodCall>`;
        try {
            const res = await fetch(wpUrl, { 
                method: 'POST', 
                body: Buffer.from(updateXml, 'utf-8'),
                timeout: 45000 
            });
            const text = await res.text();
            if (text.includes('<boolean>1</boolean>')) return { success: true, postId: recipe.id };
            return { success: false, error: 'Échec update' };
        } catch (e) { return { success: false, error: e.message }; }
    }

    // 2. CAS PUBLICATION COMPLÈTE
    console.log(`📡 Publication via metaWeblog.newPost vers : ${wpUrl}`);
    const finalHtml = generateRecipeHtml(recipe);

    let categoryName = 'Plats';
    const catSearch = (recipe.category || '').toLowerCase();
    if (catSearch.includes('apéritif') || catSearch.includes('boisson') || catSearch.includes('aperitifs')) categoryName = 'Apéritifs';
    else if (catSearch.includes('dessert') || catSearch.includes('pâtisserie') || catSearch.includes('gâteau') || catSearch.includes('sucré')) categoryName = 'Desserts';
    else if (catSearch.includes('entrée')) categoryName = 'Entrées';

    let featuredImageId = null;
    if (recipe.photoUrl) {
        featuredImageId = await uploadImageToWP(recipe.photoUrl, user, pass, wpUrl, encoding);
    }

    let extraCategories = [];
    if (recipe.manualCountry) {
        let cleanCountry = recipe.manualCountry.replace(/^[^\wÀ-ÿ]+/, '').trim(); // Remove emojis at the start
        
        // Custom mapping for iOS app themes
        if (cleanCountry.toLowerCase().includes('dolce vita')) cleanCountry = 'Dolce Vita';
        if (cleanCountry.toLowerCase().includes('facile')) cleanCountry = 'Facile';
        if (cleanCountry.toLowerCase().includes('noël')) cleanCountry = 'Noël';
        if (cleanCountry.toLowerCase().includes('pâques')) cleanCountry = 'Pâques';
        if (cleanCountry.toLowerCase().includes('astuce')) cleanCountry = 'Astuce';

        if (cleanCountry && cleanCountry !== 'Autre') {
            extraCategories.push(cleanCountry);
        }
    }

    const postStruct = `<struct>
        <member><name>title</name><value><string><![CDATA[${recipe.title}]]></string></value></member>
        <member><name>description</name><value><string><![CDATA[${finalHtml}]]></string></value></member>
        <member><name>mt_keywords</name><value><string><![CDATA[${(recipe.tags || []).join(', ')}]]></string></value></member>
        <member><name>categories</name><value><array><data>
            <value><string>${categoryName}</string></value>
            ${extraCategories.map(c => `<value><string>${c}</string></value>`).join('')}
        </data></array></value></member>
        <member><name>post_status</name><value><string>${recipe.status || 'publish'}</string></value></member>
        ${featuredImageId ? `<member><name>wp_post_thumbnail</name><value><string>${featuredImageId}</string></value></member>` : ''}
    </struct>`;

    const postXml = `${encoding}<methodCall><methodName>metaWeblog.newPost</methodName><params><param><value><string>1</string></value></param><param><value><string>${user}</string></value></param><param><value><string>${pass}</string></value></param><param><value>${postStruct}</value></param><param><value><boolean>1</boolean></value></param></params></methodCall>`;

    try {
        const res = await fetch(wpUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'text/xml' }, 
            body: Buffer.from(postXml, 'utf-8'),
            timeout: 45000 
        });
        const text = await res.text();
        const match = text.match(/<string>(\d+)<\/string>/) || text.match(/<value><int>(\d+)<\/int><\/value>/);
        if (match) return { success: true, postId: match[1] };
        return { success: false, error: 'Échec XML-RPC' };
    } catch (e) { return { success: false, error: e.message }; }
}

module.exports = { postToWordPress: postToWordPressXMLRPC, postToWordPressXMLRPC, generateRecipeHtml, extractTikTokId };
