require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');

const WP_URL = process.env.WP_URL;
const user = process.env.WP_USERNAME;

async function testPasswords() {
    const passwords = [
        '2TlsWemp!',
        '2TlsWemp!!',
        '2TlsGemp!!',
        '2TlsGemp!'
    ];

    for (const p of passwords) {
        console.log(`\nTesting with password: ${p}`);
        const auth = Buffer.from(`${user}:${p}`).toString('base64');
        const url = `${WP_URL}/wp-json/wp/v2/users/me?_auth_user=${user}&_auth_pass=${encodeURIComponent(p)}`;

        try {
            const res = await fetch(url, {
                headers: { 'Authorization': `Basic ${auth}` }
            });
            console.log(`Status: ${res.status}`);
            if (res.ok) {
                console.log(`✅ SUCCESS with password: ${p}`);
                process.exit(0);
            }
        } catch (e) {
            console.error(`Error: ${e.message}`);
        }
    }
}

testPasswords();
