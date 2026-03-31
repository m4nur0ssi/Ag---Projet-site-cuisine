const fetch = require('node-fetch');
const user = 'm4nu';
const pass = '2TlsWemp!';
const auth = Buffer.from(`${user}:${pass}`).toString('base64');

async function testHostHeader() {
    const url = 'http://192.168.1.200/wordpress/wp-json/wp/v2/users/me';
    console.log(`Testing URL: ${url} with Host: lesrec3ttesm4giques.fr`);
    try {
        const res = await fetch(url, {
            headers: { 
                'Authorization': `Basic ${auth}`,
                'Host': 'lesrec3ttesm4giques.fr'
            }
        });
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Response: ${text.substring(0, 100)}`);
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

testHostHeader();
