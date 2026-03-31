const fetch = require('node-fetch');

async function testOEmbed(videoId) {
    const oEmbedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@a/video/${videoId}`;
    console.log(`Testing OEmbed: ${oEmbedUrl}`);
    const r = await fetch(oEmbedUrl);
    console.log(`Status: ${r.status}`);
    const d = await r.json();
    console.log(`Title: ${d.title}`);
}

testOEmbed('7595219025815194902').catch(console.error);
