const { isRecipeWithGemini, fetchTikTokMetadata } = require('./recipe-processor');
require('dotenv').config({ path: __dirname + '/.env' });

async function test(url) {
    console.log(`Testing URL: ${url}`);
    const meta = await fetchTikTokMetadata(url);
    if (!meta) {
        console.log('Failed to fetch metadata');
        return;
    }
    console.log(`Metadata description: ${meta.description}`);
    const analysis = await isRecipeWithGemini(meta.description, meta.title);
    console.log('Analysis result:', JSON.stringify(analysis, null, 2));
}

const url = process.argv[2] || 'https://www.tiktok.com/v/7595219025815194902';
test(url);
