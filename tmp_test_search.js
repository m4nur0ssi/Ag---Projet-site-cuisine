const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/tiktok-bot/.env' });

async function searchRecipe() {
    const wpBase = 'http://109.221.250.122/wordpress';
    const query = 'Ramen';
    console.log(`🔍 Recherche de "${query}" sur WordPress: ${wpBase}...`);
    
    try {
        // Test Published
        const resPub = await fetch(`${wpBase}/wp-json/wp/v2/posts?search=${encodeURIComponent(query)}&_fields=id,title,status`);
        const postsPub = await resPub.json();
        console.log(`--- POSTS PUBLIÉS ---`);
        console.log(postsPub);

        // Test All (if we had auth)
        // Since we don't have REST auth here easily, we rely on XML-RPC or just assume.
    } catch (e) {
        console.error('Erreur:', e.message);
    }
}

searchRecipe();
