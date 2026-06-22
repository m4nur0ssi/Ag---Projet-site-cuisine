/**
 * Ajoute une recette depuis une vidéo YouTube — usage EXCEPTIONNEL, en local sur Mac.
 * (La logique est partagée avec le traitement cloud via tiktok-bot/youtube-import.js.)
 *
 * Usage :
 *   node add-youtube-recipe.js "https://www.youtube.com/watch?v=XXXXXXXXXXX"
 *   node add-youtube-recipe.js "https://youtu.be/XXXXXXXXXXX" --draft   # brouillon
 *   node add-youtube-recipe.js "URL" --pays "Desserts"                  # impose une catégorie
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'tiktok-bot', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { importYouTubeRecipe } = require('./tiktok-bot/youtube-import');
const { extractYouTubeId } = require('./tiktok-bot/wordpress-poster');
if (!process.env.WP_URL) process.env.WP_URL = 'http://109.221.250.122/wordpress';

const url = process.argv[2];
const DRAFT = process.argv.includes('--draft');
const paysArg = process.argv.indexOf('--pays');
const country = paysArg !== -1 ? (process.argv[paysArg + 1] || '') : '';
if (!url || !extractYouTubeId(url)) {
    console.error('Usage : node add-youtube-recipe.js "<url YouTube>" [--draft] [--pays "Catégorie"]');
    process.exit(1);
}

(async () => {
    if (!process.env.ANTHROPIC_API_KEY) { console.error('❌ ANTHROPIC_API_KEY manquante (tiktok-bot/.env).'); process.exit(1); }
    const name = await importYouTubeRecipe({ url, country, status: DRAFT ? 'draft' : 'publish' });
    if (name) {
        console.log(`\n✅ Recette ajoutée : "${name}"`);
        console.log('   → Le webhook WordPress déclenche la sync vers le site (Vercel).');
        console.log('   → Sinon, force : node sync-recipes.js');
    } else {
        process.exit(1);
    }
})();
