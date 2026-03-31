const fetch = require('node-fetch');
const user = 'm4nu';
const pass = '2TlsWemp!';
const auth = Buffer.from(`${user}:${pass}`).toString('base64');

async function test() {
    const url = 'http://192.168.1.200/wordpress/wp-json/wp/v2/users/me';
    console.log(`Testing with Host header: 109.221.250.122`);
    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Host': '109.221.250.122'
            }
        });
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Response: ${text.substring(0, 200)}`);
    } catch (e) { console.error(e); }
}

test();
