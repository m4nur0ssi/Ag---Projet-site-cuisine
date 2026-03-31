require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');

const WP_URL = process.env.WP_URL;
const user = process.env.WP_USERNAME;
const pass = process.env.WP_PASSWORD;

async function testAll() {
    const variants = [
        { name: 'v1: _auth_user & _auth_pass', url: `${WP_URL}/wp-json/wp/v2/users/me?_auth_user=${user}&_auth_pass=${pass}` },
        { name: 'v2: bot_password (alone)', url: `${WP_URL}/wp-json/wp/v2/users/me?bot_password=${pass}` },
        { name: 'v3: bot_password & user', url: `${WP_URL}/wp-json/wp/v2/users/me?user=${user}&bot_password=${pass}` },
        { name: 'v4: Standard Basic Auth Header (No query)', url: `${WP_URL}/wp-json/wp/v2/users/me`, headers: { 'Authorization': `Basic ${Buffer.from(user + ':' + pass).toString('base64')}` } }
    ];

    for (const v of variants) {
        console.log(`\n--- Testing ${v.name} ---`);
        try {
            const res = await fetch(v.url, { headers: v.headers || {} });
            console.log(`Status: ${res.status}`);
            const text = await res.text();
            if (res.ok) {
                console.log(`✅ SUCCESS!`);
                console.log(`User: ${text.substring(0, 100)}`);
            } else {
                console.log(`❌ Failed: ${text.substring(0, 100)}`);
            }
        } catch (e) {
            console.error(`Error: ${e.message}`);
        }
    }
}

testAll();
