const fetch = require('node-fetch');

async function test() {
    const user = 'm4nu';
    const pass = '2TlsWemp';
    const auth = Buffer.from(`${user}:${pass}`).toString('base64');

    const url = `http://192.168.1.200/wordpress/wp-json/wp/v2/users/me?_auth_user=${user}&_auth_pass=${encodeURIComponent(pass)}`;

    console.log(`Testing without exclamation: ${url}`);
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Basic ${auth}` } });
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log(`Response: ${JSON.stringify(data)}`);
    } catch (e) { console.error(e); }
}

test();
