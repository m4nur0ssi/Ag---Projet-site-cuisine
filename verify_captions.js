const WORDPRESS_LOCAL_IP = '192.168.1.200';
const parentId = '1270';

async function verifyCaptions() {
    const url = `http://${WORDPRESS_LOCAL_IP}/wordpress/wp-json/wp/v2/media?parent=${parentId}`;
    try {
        const res = await fetch(url);
        const media = await res.json();
        const simplified = media.map(m => ({
            id: m.id,
            caption: m.caption.rendered,
            desc: m.description.rendered,
            alt: m.alt_text
        }));
        console.log('--- MEDIA DATA FOR 1270 ---');
        console.log(JSON.stringify(simplified, null, 2));
    } catch (e) {
        console.error(e);
    }
}
verifyCaptions();
