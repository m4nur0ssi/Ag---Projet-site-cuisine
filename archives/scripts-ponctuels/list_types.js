const WORDPRESS_LOCAL_IP = '192.168.1.200';

async function listPostTypes() {
    const url = `http://${WORDPRESS_LOCAL_IP}/wordpress/wp-json/wp/v2/types`;
    try {
        const res = await fetch(url);
        const types = await res.json();
        console.log('Available Post Types:', Object.keys(types));
    } catch (e) {
        console.error(e);
    }
}
listPostTypes();
