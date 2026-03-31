require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');
const { postToWordPress, generateRecipeHtml } = require('./wordpress-poster');
const { isRecipeWithGemini, fetchTikTokMetadata } = require('./recipe-processor');
const { findPhoto } = require('./photo-search');

/**
 * Script d'enrichissement automatique pour les recettes "Stubs" (incomplètes)
 * Scanne les derniers articles WordPress et complète ceux qui n'ont pas d'ingrédients.
 */

async function getRecentPosts() {
    const wpBase = (process.env.WP_URL || 'http://109.221.250.122/wordpress').replace(/\/$/, '');
    const user = process.env.WP_USERNAME;
    const pass = process.env.WP_PASSWORD;
    const wpUrl = wpBase + '/xmlrpc.php';

    console.log(`📡 Récupération des articles (Tous status) via XML-RPC sur ${wpUrl}...`);
    
    const xml = `<?xml version="1.0"?>
    <methodCall>
        <methodName>wp.getPosts</methodName>
        <params>
            <param><value><int>1</int></value></param>
            <param><value><string>${user}</string></value></param>
            <param><value><string>${pass}</string></value></param>
            <param><value><struct>
                <member><name>post_status</name><value><string>any</string></value></member>
                <member><name>number</name><value><int>100</int></value></member>
            </struct></value></param>
        </params>
    </methodCall>`;

    try {
        const res = await fetch(wpUrl, { method: 'POST', body: xml });
        const text = await res.text();
        
        // Parsing simplifié pour extraire titre, contenu et ID
        // On cherche les structures <struct>...</struct>
        const posts = [];
        const structMatches = text.match(/<struct>[\s\S]*?<\/struct>/g) || [];
        
        for (const struct of structMatches) {
            const idMatch = struct.match(/<name>post_id<\/name><value><string>(\d+)<\/string><\/value>/);
            const titleMatch = struct.match(/<name>post_title<\/name><value><string><!\[CDATA\[([\s\S]*?)\]\]><\/string><\/value>/)
                || struct.match(/<name>post_title<\/name><value><string>([\s\S]*?)<\/string><\/value>/);
            const contentMatch = struct.match(/<name>post_content<\/name><value><string><!\[CDATA\[([\s\S]*?)\]\]><\/string><\/value>/)
                || struct.match(/<name>post_content<\/name><value><string>([\s\S]*?)<\/string><\/value>/);

            if (idMatch) {
                posts.push({
                    id: idMatch[1],
                    title: { rendered: titleMatch ? titleMatch[1] : 'Untitled' },
                    content: { rendered: contentMatch ? contentMatch[1] : '' }
                });
            }
        }
        return posts;
    } catch (e) {
        console.error('❌ Erreur lors de la récupération des posts (XML-RPC):', e.message);
        return [];
    }
}

async function run() {
    console.log('🚀 Démarrage de la session d\'enrichissement automatique...');
    const posts = await getRecentPosts();
    
    let enrichedCount = 0;

    for (const post of posts) {
        const title = post.title.rendered;
        const content = post.content.rendered;
        
        // Critères d'un stub : 
        // 1. Contient le texte d'attente
        // 2. OU n'a pas de liste d'ingrédients (<li>)
        // 3. OU a le tag "À ENRICHIR" (si on peut le vérifier via l'ID)
        const isStub = content.includes('en cours d\'analyse') || !content.includes('<li') || content.includes('À ENRICHIR');
        
        if (!isStub) continue;

        console.log(`\n💎 Stub détecté : "${title}" (ID: ${post.id})`);

        // Extraire l'URL TikTok pour le contexte (gérer les quotes encodées &quot;)
        const unescapedContent = content.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        const tiktokUrlMatch = unescapedContent.match(/href="(https:\/\/www\.tiktok\.com\/[^"]+)"/);
        const tiktokUrl = tiktokUrlMatch ? tiktokUrlMatch[1] : null;

        if (!tiktokUrl) {
            console.log(`   ⚠️ Pas d'URL TikTok trouvée, impossible d'enrichir.`);
            continue;
        }

        console.log(`   🔗 Analyse TikTok : ${tiktokUrl}`);
        let description = title;
        const meta = await fetchTikTokMetadata(tiktokUrl);
        if (meta) {
            description = meta.description;
            console.log(`   ✅ Description TikTok récupérée.`);
        }

        console.log(`   🧠 Appel à l'IA Gemini pour les détails...`);
        const analysis = await isRecipeWithGemini(description, title);
        
        if (analysis && analysis.isRecipe && !analysis.isQuotaExceeded) {
            console.log(`   ✅ IA a généré les détails !`);
            
            // Recherche de photo si le stub n'en a pas
            let photoUrl = '';
            if (!content.includes('<img')) {
                console.log(`   🖼️ Recherche d'une photo...`);
                photoUrl = await findPhoto(analysis.photoSearchKeyword || analysis.recipeName || title);
            }

            // Génération du nouveau contenu HTML
            const newHtml = generateRecipeHtml({
                ...analysis,
                title: analysis.recipeName || title,
                tiktokUrl: tiktokUrl
            });

            // Mise à jour de WordPress
            console.log(`   📡 Mise à jour de l'article sur WordPress...`);
            const updateResult = await postToWordPress({
                id: post.id,
                updateOnly: true,
                title: analysis.recipeName || title,
                content: newHtml,
                status: 'publish', // On sort du brouillon
                tags: analysis.tags.filter(t => t !== 'À ENRICHIR' && t !== 'Stub'),
                photoUrl: photoUrl
            });

            if (updateResult.success) {
                console.log(`   🎉 SUCCÈS : "${title}" est maintenant complète et publiée !`);
                enrichedCount++;
            } else {
                console.log(`   ❌ Échec de la mise à jour : ${updateResult.error}`);
            }
        } else if (analysis && analysis.isQuotaExceeded) {
            console.log(`   ⏳ Quota toujours dépassé (429). On arrête pour cette fois.`);
            break; 
        } else {
            console.log(`   ⚠️ L'IA n'a pas pu identifier de recette ou a échoué.`);
        }
    }
    
    console.log(`\n✅ Session terminée. ${enrichedCount} recette(s) enrichie(s).`);
    
    if (enrichedCount > 0) {
        console.log(`📦 Déclenchement de la synchro Vercel...`);
        const { execSync } = require('child_process');
        try { execSync(`node sync-recipes.js --recent`, { cwd: __dirname + '/..' }); } catch(e){}
    }
}

run().catch(err => console.error('Erreur fatale:', err));
