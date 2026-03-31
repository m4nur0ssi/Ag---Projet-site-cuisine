const { processRecipe } = require('./recipe-processor');
require('dotenv').config({ path: __dirname + '/.env' });

async function run() {
    const url = "https://vm.tiktok.com/ZNRH9oNvD/"; // Tomaten-Käse-Pasta
    console.log(`🚀 Manual test for: ${url}`);
    try {
        await processRecipe({ 
            videoUrl: url, 
            description: "Recette iPhone (Manual Test)", 
            author: "test", 
            country: "Italie" 
        });
    } catch (e) {
        console.error("❌ Process error:", e);
    }
}

run();
