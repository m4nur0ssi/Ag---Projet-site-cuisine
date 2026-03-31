const fetch = require('node-fetch');
const fs = require('fs');

async function checkCategories() {
    const wpUrl = 'http://192.168.1.200/wordpress/wp-json/wp/v2/categories?per_page=100';
    console.log(`📡 Fetching from: ${wpUrl}`);
    try {
        const res = await fetch(wpUrl);
        const cats = await res.json();
        if (Array.isArray(cats)) {
            console.log("\n📁 LISTE DES CATÉGORIES WORDPRESS :");
            cats.forEach(c => {
                console.log(`- ID: ${c.id} | Nom: ${c.name} | Slug: ${c.slug}`);
            });
        } else {
            console.log("⚠️ Réponse non valide :", cats);
        }
    } catch (e) {
        console.error("❌ Erreur accès WP API:", e.message);
    }
}

checkCategories();
