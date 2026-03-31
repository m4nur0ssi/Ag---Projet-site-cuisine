const fetch = require('node-fetch');

async function testOEmbed(url) {
    const videoIdMatch = url.match(/\/video\/(\d+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    
    console.log(`Testing videoId: ${videoId}`);
    
    const oEmbedUrl1 = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@tiktok/video/${videoId}`;
    const oEmbedUrl2 = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    
    console.log(`OEmbed 1: ${oEmbedUrl1}`);
    const r1 = await fetch(oEmbedUrl1);
    console.log(`R1 Status: ${r1.status}`);
    const d1 = await r1.json();
    console.log(`D1 Title: ${d1.title}`);
    
    console.log(`OEmbed 2: ${oEmbedUrl2}`);
    const r2 = await fetch(oEmbedUrl2);
    console.log(`R2 Status: ${r2.status}`);
    const d2 = await r2.json();
    console.log(`D2 Title: ${d2.title}`);
}

const url = 'https://www.tiktok.com/v/7595219025815194902';
testOEmbed(url).catch(console.error);
