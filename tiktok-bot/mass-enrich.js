require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');
const { postToWordPress, generateRecipeHtml } = require('./wordpress-poster');
const { isRecipeWithGemini, fetchTikTokMetadata } = require('./recipe-processor');
const { findPhoto } = require('./photo-search');
const path = require('path');

async function getAllDraftsXMLRPC() {
    const user = process.env.WP_USERNAME;
    const pass = process.env.WP_PASSWORD;
    const wpUrl = (process.env.WP_URL || 'http://192.168.1.200/wordpress').replace(/\/$/, '') + '/xmlrpc.php';
    const encoding = '<?xml version="1.0" encoding="UTF-8"?>';
    
    console.log(`📡 Récupération des brouillons via XML-RPC...`);
    
    const xml = `${encoding}
    <methodCall>
      <methodName>wp.getPosts</methodName>
      <params>
        <param><value><int>1</int></value></param>
        <param><value><string>${user}</string></value></param>
        <param><value><string>${pass}</string></value></param>
        <param><value>
          <struct>
            <member><name>post_status</name><value><string>draft</string></value></member>
            <member><name>number</name><value><int>100</int></value></member>
          </struct>
        </value></param>
      </params>
    </methodCall>`;

    try {
        const res = await fetch(wpUrl, { method: 'POST', body: Buffer.from(xml, 'utf-8') });
        const text = await res.text();
        
        if (text.includes('faultCode')) {
             throw new Error(`XML-RPC Fault: ${text.substring(0, 200)}`);
        }

        // Extraction manuelle simplifiée des IDs, titres et contenus
        const posts = [];
        // Parsing robuste pour post_id (peut être string ou int)
        const idMatches = [...text.matchAll(/<member><name>post_id<\/name><value><(?:string|int)>(\d+)<\/(?:string|int)><\/value><\/member>/g)].map(m => m[1]);
        
        // Parsing robuste pour post_title
        const titleMatches = [...text.matchAll(/<member><name>post_title<\/name><value><string>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/string><\/value><\/member>/g)].map(m => m[1]);
        
        // Parsing robuste pour post_content
        const contentMatches = [...text.matchAll(/<member><name>post_content<\/name><value><string>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/string><\/value><\/member>/g)].map(m => m[1]);

        for (let i = 0; i < idMatches.length; i++) {
            posts.push({
                id: idMatches[i],
                title: titleMatches[i] || 'Recette TikTok en attente',
                content: contentMatches[i] || ''
            });
        }
        return posts;
    } catch (e) {
        console.error('❌ Erreur XML-RPC:', e.message);
        return [];
    }
}

async function run() {
    console.log('🚀 Démarrage du traitement de MASSE des brouillons...');
    const posts = await getAllDraftsXMLRPC();
    console.log(`📝 ${posts.length} brouillon(s) trouvé(s).`);
    
    let enrichedCount = 0;

    for (const post of posts) {
        const title = post.title;
        const content = post.content;
        
        console.log(`\n💎 Traitement : "${title}" (ID: ${post.id})`);

        // Extraire l'URL TikTok pour le contexte (Gérer les entités HTML encodées par XML-RPC)
        const decodedContent = content
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&');
            
        const tiktokUrlMatch = decodedContent.match(/href="(https:\/\/www\.tiktok\.com\/[^"]+)"/) 
                            || decodedContent.match(/cite="(https:\/\/www\.tiktok\.com\/[^"]+)"/);
        const tiktokUrl = tiktokUrlMatch ? tiktokUrlMatch[1] : null;

        if (!tiktokUrl) {
            console.log(`   ⚠️ Pas d'URL TikTok trouvée, impossible d'enrichir ce brouillon.`);
            continue;
        }

        console.log(`   🔗 Analyse TikTok : ${tiktokUrl}`);
        let description = title;
        const meta = await fetchTikTokMetadata(tiktokUrl);
        if (meta) {
            description = meta.description;
            console.log(`   ✅ Description TikTok récupérée.`);
        }

        console.log(`   🧠 Analyse IA Gemini...`);
        const analysis = await isRecipeWithGemini(description, title);
        
        if (analysis && analysis.isRecipe && !analysis.isQuotaExceeded) {
            console.log(`   ✅ Détails générés.`);
            
            // Recherche de photo si le contenu ne semble pas en avoir déjà une (plus fiable de tester <img>)
            let photoUrl = '';
            if (!content.includes('<img')) {
                console.log(`   🖼️ Recherche d'une photo...`);
                photoUrl = await findPhoto(analysis.photoSearchKeyword || analysis.recipeName || title);
            }

            // Génération HTML
            const newHtml = generateRecipeHtml({
                ...analysis,
                title: analysis.recipeName || title,
                tiktokUrl: tiktokUrl
            });

            // Mise à jour WordPress et publication
            console.log(`   📡 Publication sur WordPress...`);
            const updateResult = await postToWordPress({
                id: post.id,
                updateOnly: true,
                title: analysis.recipeName || title,
                content: newHtml,
                status: 'publish', // On PUBLIE
                tags: analysis.tags.filter(t => t !== 'À ENRICHIR' && t !== 'Stub'),
                photoUrl: photoUrl
            });

            if (updateResult.success) {
                console.log(`   🎉 SUCCÈS : "${title}" publié !`);
                enrichedCount++;
            } else {
                console.log(`   ❌ Échec : ${updateResult.error}`);
            }
        } else if (analysis && analysis.isQuotaExceeded) {
            console.log(`   🚨 QUOTA DÉPASSÉ. Arrêt.`);
            break; 
        } else {
            console.log(`   ⚠️ L'IA n'a pas pu traiter cette recette.`);
        }
        
        // Délai pour ne pas surcharger (15 RPM = ~4s d'écart)
        await new Promise(r => setTimeout(r, 5000));
    }
    
    console.log(`\n✅ Session terminée. ${enrichedCount} brouillon(s) traité(s) et publié(s).`);
    
    if (enrichedCount > 0) {
        console.log(`📦 Lancement de la synchronisation Vercel...`);
        const { execSync } = require('child_process');
        try { 
            execSync(`node sync-recipes.js --recent`, { cwd: path.join(__dirname, '..') }); 
            console.log("   ✅ Synchro locale terminée.");
        } catch(e){
            console.error("   ❌ Erreur synchro locale:", e.message);
        }
    }
}

run().catch(err => console.error('Erreur fatale:', err));
