const WORDPRESS_LOCAL_IP = '192.168.1.200';
const id = '1270';

async function checkRaw() {
    const url = `http://${WORDPRESS_LOCAL_IP}/wordpress/wp-json/wp/v2/posts/${id}?_fields=content`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log('--- RAW CONTENT ---');
        console.log(data.content.raw);
    } catch (e) {
        console.error(e);
    }
}
checkRaw();
