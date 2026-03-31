const fetch = require('node-fetch');
const { searchPhoto } = require('./photo-search');
const { postToWordPressXMLRPC } = require('./wordpress-poster');
require('dotenv').config({ path: __dirname + '/.env' });

async function fill() {
    console.log("🚀 Recherche des recettes sans photos sur WordPress...");
    const urls = [
        `${process.env.WP_URL}/wp-json/wp/v2/posts?per_page=50&_embed`,
        `http://109.221.250.122/wordpress/wp-json/wp/v2/posts?per_page=50&_embed`,
        `http://lesrec3ttesm4giques.fr/wordpress/wp-json/wp/v2/posts?per_page=50&_embed`
    ];

    let posts = null;
    for (const url of urls) {
        try {
            console.log(`📡 Tentative : ${url}...`);
            const res = await fetch(url, { timeout: 10000 });
            if (res.ok) {
                posts = await res.json();
                console.log(`✅ Connexion réussie via : ${url}`);
                break;
            }
        } catch (e) {
            console.log(`⚠️ Échec sur ${url} : ${e.message}`);
        }
    }

    if (!posts) {
        console.error("❌ Impossible de contacter WordPress sur aucune des adresses connues.");
        return;
    }

    for (const post of posts) {
        const hasPhoto = post._embedded && post._embedded['wp:featuredmedia'];
        if (!hasPhoto) {
            const title = post.title.rendered;
            console.log(`\n📸 Recette sans photo détectée : "${title}"`);
            const photoUrl = await searchPhoto(title);
            if (photoUrl) {
                console.log(`   ✨ Photo trouvée ! Mise à jour de WordPress (ID: ${post.id})...`);
                // On utilise XML-RPC pour mettre à jour l'image à la une
                await postToWordPressXMLRPC({ 
                    id: post.id,
                    title: title, 
                    photoUrl: photoUrl,
                    updateOnly: true 
                });
            }
        }
    }
}

fill().then(() => console.log("\n✅ Terminé !")).catch(console.error);
