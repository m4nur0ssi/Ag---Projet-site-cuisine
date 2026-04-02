/**
 * reprocess-stubs.js
 * Scanne WordPress via XML-RPC pour trouver les "Stubs" (recettes en attente)
 * et les complète via Gemini.
 */
require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');
const { fetchTikTokMetadata, isRecipeWithGemini } = require('./recipe-processor');
const { postToWordPress, generateRecipeHtml } = require('./wordpress-poster');
const { findPhoto } = require('./photo-search');

const user = process.env.WP_USERNAME;
const pass = process.env.WP_PASSWORD;
const wpUrl = (process.env.WP_URL || '').replace(/\/$/, '') + '/xmlrpc.php';

async function getStubsViaXmlRpc() {
    console.log(`📡 Listing Drafts via XML-RPC for user: ${user}`);
    
    const xml = `<?xml version="1.0"?>
    <methodCall>
        <methodName>wp.getPosts</methodName>
        <params>
            <param><value><int>1</int></value></param>
            <param><value><string>${user}</string></value></param>
            <param><value><string>${pass}</string></value></param>
            <param><value><struct>
                <member><name>post_status</name><value><string>draft</string></value></member>
                <member><name>number</name><value><int>50</int></value></member>
            </struct></value></param>
        </params>
    </methodCall>`;

    try {
        const res = await fetch(wpUrl, { method: 'POST', body: xml, timeout: 30000 });
        const text = await res.text();
        
        if (text.includes('<fault>')) {
            console.error("❌ XML-RPC Fault:", text);
            return [];
        }

        // Parsing XML manuel simple pour extraire ID, Titre et Description
        const posts = [];
        const postChunks = text.split('<struct>').slice(1);
        
        for (const chunk of postChunks) {
            const idMatch = chunk.match(/<member><name>post_id<\/name><value><string>(\d+)<\/string><\/value><\/member>/);
            const titleMatch = chunk.match(/<member><name>post_title<\/name><value><string><!\[CDATA\[(.*?)\]\]><\/string><\/value><\/member>/) 
                          || chunk.match(/<member><name>post_title<\/name><value><string>(.*?)<\/string><\/value><\/member>/);
            const contentMatch = chunk.match(/<member><name>post_content<\/name><value><string><!\[CDATA\[([\s\S]*?)\]\]><\/string><\/value><\/member>/)
                            || chunk.match(/<member><name>post_content<\/name><value><string>([\s\S]*?)<\/string><\/value><\/member>/);
            
            if (idMatch && titleMatch && contentMatch) {
                const title = titleMatch[1];
                const content = contentMatch[1];
                // Détection élargie :
                // 1. Titres/contenu avec marqueurs explicites (Stubs intentionnels)
                // 2. Contenu vide ou très court (brouillon incomplet)
                // 3. Contenu qui contient une URL TikTok (toujours à enrichir)
                // 4. Brouillons dont le contenu ne contient pas d'ingrédients structurés
                const isExplicitStub = title.includes('attente') || title.includes('Recette TikTok') || 
                                       content.includes('Stub') || content.includes('À ENRICHIR') ||
                                       content.includes('en cours d\'analyse');
                const isThinContent = content.trim().length < 300; // contenu trop court = incomplet
                const hasTikTokLink = /https?:\/\/(?:www\.)?tiktok\.com\//i.test(content);
                const hasNoIngredients = !content.includes('<li') && !content.includes('Ingrédients') && !content.includes('ingredients');

                if (isExplicitStub || (isThinContent && hasTikTokLink) || (hasTikTokLink && hasNoIngredients)) {
                    posts.push({ id: idMatch[1], title, content });
                }
            }
        }
        return posts;
    } catch (e) {
        console.error("❌ Erreur XML-RPC:", e.message);
        return [];
    }
}

function extractTikTokUrl(content) {
    const match = content.match(/https?:\/\/(?:www\.)?tiktok\.com\/(?:@[^/]+\/video|v)\/\d+/i)
               || content.match(/https?:\/\/(?:www\.)?tiktok\.com\/t\/[a-z0-9]+/i);
    return match ? match[0] : null;
}

async function getPublishedUrls() {
    console.log(`📡 Fetching published URLs to avoid duplicates...`);
    const xml = `<?xml version="1.0"?>
    <methodCall>
        <methodName>wp.getPosts</methodName>
        <params>
            <param><value><int>1</int></value></param>
            <param><value><string>${user}</string></value></param>
            <param><value><string>${pass}</string></value></param>
            <param><value><struct>
                <member><name>post_status</name><value><string>publish</string></value></member>
                <member><name>number</name><value><int>30</int></value></member>
            </struct></value></param>
        </params>
    </methodCall>`;
    try {
        const res = await fetch(wpUrl, { method: 'POST', body: xml, timeout: 30000 });
        const text = await res.text();
        const urls = new Set();
        const postChunks = text.split('<struct>').slice(1);
        for (const chunk of postChunks) {
            const contentMatch = chunk.match(/<member><name>post_content<\/name><value><string><!\[CDATA\[([\s\S]*?)\]\]><\/string><\/value><\/member>/)
                            || chunk.match(/<member><name>post_content<\/name><value><string>([\s\S]*?)<\/string><\/value><\/member>/);
            if (contentMatch) {
                const url = extractTikTokUrl(contentMatch[1]);
                if (url) urls.add(url);
            }
        }
        return urls;
    } catch (e) { return new Set(); }
}

async function run() {
    console.log('🧹 Démarrage du nettoyage des "Stubs" WordPress...');
    
    // 1. Récupérer les doublons potentiels déjà en ligne
    const publishedUrls = await getPublishedUrls();
    console.log(`🔍 ${publishedUrls.size} vidéos déjà en ligne détectées.`);

    const stubs = await getStubsViaXmlRpc();
    console.log(`\n📂 ${stubs.length} recette(s) en attente trouvée(s).`);

    if (stubs.length === 0) {
        console.log('✅ Aucun brouillon "Stub" à traiter. Tout est propre !');
        return;
    }

    for (const stub of stubs) {
        const postId = stub.id;
        console.log(`\n🔄 Traitement de : "${stub.title}" (ID: ${postId})`);
        
        const videoUrl = extractTikTokUrl(stub.content);
        if (!videoUrl) {
            console.log(`   ⚠️ Impossible de trouver l'URL TikTok pour ce brouillon. Skip.`);
            continue;
        }

        // 🛑 DÉDUPLICATION : Si la vidéo est déjà publiée, on supprime ce doublon en attente
        if (publishedUrls.has(videoUrl)) {
            console.log(`   🛑 DOUBLON DÉTECTÉ : La vidéo ${videoUrl} est déjà publiée. Suppression du brouillon inutile...`);
            const xml = `<?xml version="1.0"?>
            <methodCall>
                <methodName>wp.deletePost</methodName>
                <params>
                    <param><value><int>1</int></value></param>
                    <param><value><string>${user}</string></value></param>
                    <param><value><string>${pass}</string></value></param>
                    <param><value><int>${postId}</int></value></param>
                </params>
            </methodCall>`;
            try { await fetch(wpUrl, { method: 'POST', body: xml }); } catch(e){}
            continue;
        }

        console.log(`   🔗 URL détectée : ${videoUrl}`);

        console.log(`   🔍 Récupération des infos TikTok...`);
        const metadata = await fetchTikTokMetadata(videoUrl);
        const description = metadata ? metadata.description : "";
        
        console.log(`   🧠 Analyse Gemini...`);
        const analysis = await isRecipeWithGemini(description, metadata ? metadata.title : stub.title);

        if (!analysis || !analysis.isRecipe || analysis.isQuotaExceeded) {
            console.log(`   ❌ Échec de l'analyse Gemini (ou quota épuisé).`);
            continue;
        }

        console.log(`   🖼️ Recherche d'une photo...`);
        let photoUrl = "";
        try { photoUrl = await findPhoto(analysis.photoSearchKeyword || analysis.recipeName); } catch(e){}

        console.log(`   📝 Mise à jour et publication de l'article #${postId}...`);
        
        const result = await postToWordPress({
            ...analysis,
            id: postId,
            updateOnly: true,
            title: analysis.recipeName,
            status: 'publish', // On le sort de l'état brouillon !
            photoUrl: photoUrl,
            tiktokUrl: videoUrl,
            content: generateRecipeHtml({
                ...analysis,
                title: analysis.recipeName,
                tiktokUrl: videoUrl,
                summary: analysis.summary
            })
        });

        if (result && result.success) {
            console.log(`   ✅ SUCCESS : "${analysis.recipeName}" est maintenant complété et EN LIGNE !`);
        } else {
            console.log(`   ❌ Erreur de publication : ${result.error}`);
        }
    }

    console.log('\n✨ Nettoyage terminé !');
}

run().catch(err => {
    console.error('💥 Erreur fatale :', err);
});
