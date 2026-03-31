const fetch = require('node-fetch');

async function test() {
    const pass = '2TlsWemp!';
    const url = `http://192.168.1.200/wordpress/wp-json/wp/v2/users/me?bot_password=${encodeURIComponent(pass)}`;

    console.log(`Testing ONLY bot_password: ${url}`);
    try {
        const res = await fetch(url);
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log(`Response: ${JSON.stringify(data)}`);
    } catch (e) { console.error(e); }
}

test();
