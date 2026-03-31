const fetch = require('node-fetch');
const user = 'm4nu';
const pass = '2TlsWemp!';
const auth = Buffer.from(`${user}:${pass}`).toString('base64');

async function testDomain() {
    const urls = [
        'http://lesrec3ttesm4giques.fr/wp-json/wp/v2/users/me',
        'http://lesrec3ttesm4giques.fr/wordpress/wp-json/wp/v2/users/me',
        'http://192.168.1.200/wordpress/wp-json/wp/v2/users/me'
    ];

    for (const url of urls) {
        console.log(`\nTesting URL: ${url}`);
        try {
            const res = await fetch(url, {
                headers: { 'Authorization': `Basic ${auth}` }
            });
            console.log(`Status: ${res.status}`);
            const text = await res.text();
            console.log(`Response: ${text.substring(0, 100)}`);
        } catch (e) {
            console.error(`Error: ${e.message}`);
        }
    }
}

testDomain();
