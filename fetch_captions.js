const WORDPRESS_LOCAL_IP = '192.168.1.200';
const parentId = '1270';

async function fetchCaptions() {
    const url = `http://${WORDPRESS_LOCAL_IP}/wordpress/wp-json/wp/v2/media?parent=${parentId}`;
    try {
        const res = await fetch(url);
        const media = await res.json();
        const results = media.map(m => ({
            id: m.id,
            title: m.title.rendered,
            caption: m.caption.rendered,
            description: m.description.rendered,
            alt: m.alt_text,
            url: m.source_url
        }));
        const fs = require('fs');
        fs.writeFileSync('media_captions_1270.json', JSON.stringify(results, null, 2));
        console.log(`✅ Extracted ${results.length} media with captions.`);
    } catch (e) {
        console.error(e);
    }
}
fetchCaptions();
