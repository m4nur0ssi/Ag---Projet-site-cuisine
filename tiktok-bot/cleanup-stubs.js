
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { fetchTikTokMetadata, isRecipeWithGemini } = require('./recipe-processor');
const { postToWordPress, generateRecipeHtml } = require('./wordpress-poster');
require('dotenv').config();

const user = process.env.WP_USERNAME || 'm4nu';
const pass = process.env.WP_PASSWORD || '2TlsWemp!';
const wpUrl = (process.env.WP_URL || 'http://109.221.250.122/wordpress').replace(/\/$/, '') + '/xmlrpc.php';

async function listStubs() {
    console.log('📡 Récupération des stubs WordPress...');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <methodCall>
        <methodName>wp.getPosts</methodName>
        <params>
            <param><value><int>1</int></value></param>
            <param><value><string>${user}</string></value></param>
            <param><value><string>${pass}</string></value></param>
            <param><value>
                <struct>
                    <member><name>post_status</name><value><string>draft</string></value></member>
                    <member><name>number</name><value><int>50</int></value></member>
                </struct>
            </value></param>
        </params>
    </methodCall>`;

    const res = await fetch(wpUrl, { method: 'POST', body: xml });
    const text = await res.text();
    
    // Simplification : on cherche les blocs <struct> qui ont le titre "attente"
    const stubs = [];
    const structStart = '<struct>';
    const structEnd = '</struct>';
    let currentIdx = text.indexOf(structStart);
    
    while (currentIdx !== -1) {
        const endIdx = text.indexOf(structEnd, currentIdx);
        if (endIdx === -1) break;
        const structText = text.substring(currentIdx, endIdx);
        
        if (structText.includes('Recette TikTok en attente')) {
            const idMatch = structText.match(/<name>post_id<\/name><value><string>(\d+)<\/string><\/value>/);
            const contentStart = structText.indexOf('<name>post_content</name>');
            const contentValueStart = structText.indexOf('<string>', contentStart) + 8;
            const contentValueEnd = structText.indexOf('</string>', contentValueStart);
            const content = structText.substring(contentValueStart, contentValueEnd);
            
            if (idMatch) {
                stubs.push({
                    id: idMatch[1],
                    content: content
                });
            }
        }
        currentIdx = text.indexOf(structStart, endIdx);
    }
    
    return stubs;
}

async function processStub(stub) {
    // Les entités sont souvent échappées (&quot;) dans le XML-RPC
    const videoIdMatch = stub.content.match(/data-video-id=(?:&quot;|")(\d+)(?:&quot;|")/);
    if (!videoIdMatch) {
        console.warn(`   ⚠️ Pas de TikTok ID pour le stub ${stub.id}.`);
        return;
    }
    const tiktokId = videoIdMatch[1];
    const videoUrl = `https://www.tiktok.com/v/${tiktokId}`;
    
    console.log(`🚀 Traitement du stub ${stub.id} (TikTok: ${tiktokId})...`);
    
    // 1. Fetch Metadata
    const metadata = await fetchTikTokMetadata(videoUrl);
    if (!metadata) {
        console.error(`   ❌ Échec récupération metadata pour ${videoUrl}`);
        return;
    }
    
    // 2. AI Analysis
    const analysis = await isRecipeWithGemini(metadata.description, metadata.title);
    if (!analysis || !analysis.isRecipe) {
        console.error(`   ❌ Gemini n'a pas reconnu de recette ou quota dépassé.`);
        return;
    }
    
    if (analysis.isQuotaExceeded) {
         console.warn(`   🚨 Quota Gemini dépassé. On réessayera plus tard.`);
         return;
    }

    // 3. Image
    const { searchPhoto } = require('./photo-search');
    let photoUrl = metadata.imageUrl;
    if (analysis.photoSearchKeyword) {
        const pixabayPhoto = await searchPhoto(analysis.photoSearchKeyword);
        if (pixabayPhoto) photoUrl = pixabayPhoto;
    }

    // 4. Update WP
    console.log(`   📝 Mise à jour WordPress (XML-RPC)...`);
    const finalRecipe = {
        id: stub.id,
        title: analysis.recipeName,
        summary: analysis.summary,
        ingredients: analysis.ingredients,
        steps: analysis.steps,
        tiktokUrl: videoUrl,
        photoUrl: photoUrl,
        category: analysis.category,
        tags: analysis.tags || [],
        status: 'publish',
        updateOnly: true // Mode spécial dans notre wordpress-poster.js
    };

    const updateResult = await postToWordPress(finalRecipe);
    if (updateResult.success) {
        console.log(`   ✅ Stub ${stub.id} publié en tant que: "${analysis.recipeName}"`);
        return true;
    } else {
        console.error(`   ❌ Échec update WP pour ${stub.id}: ${updateResult.error}`);
        return false;
    }
}

async function start() {
    const stubs = await listStubs();
    console.log(`🔍 Trouvé ${stubs.length} stubs en attente.`);
    
    let count = 0;
    for (const stub of stubs) {
        if (count >= 3) break;
        try {
            const success = await processStub(stub);
            if (!success) {
                console.log(`   ⏳ Arrêt temporaire après échec (possible quota)...`);
                // break; 
            }
            count++;
            // Pause entre chaque recette pour éviter de saturer les APIs
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.error(`   🔥 Erreur critique stub ${stub.id}:`, e.message);
        }
    }
    
    console.log('\n✨ Opération terminée.');
}

start();
