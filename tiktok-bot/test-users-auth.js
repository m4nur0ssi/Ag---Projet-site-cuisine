const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/.env' });

async function listUsers() {
    const user = process.env.WP_USERNAME;
    const pass = process.env.WP_PASSWORD;
    const auth = Buffer.from(`${user}:${pass}`).toString('base64');

    // Test multiple variants for GET /users/me
    const variants = [
        `http://192.168.1.200/wordpress/wp-json/wp/v2/users/me`,
        `http://192.168.1.200/wordpress/wp-json/wp/v2/users/me?_auth_user=${user}&_auth_pass=${encodeURIComponent(pass)}`,
        `http://192.168.1.200/wordpress/wp-json/wp/v2/users/me?bot_password=${encodeURIComponent(pass)}`
    ];

    for (const url of variants) {
        console.log(`\nTesting with Header & Query: ${url}`);
        try {
            const res = await fetch(url, {
                headers: { 'Authorization': `Basic ${auth}` }
            });
            console.log(`Status: ${res.status}`);
            const data = await res.json();
            if (res.ok) {
                console.log(`✅ SUCCESS! Name: ${data.name}`);
            } else {
                console.log(`❌ Error: ${JSON.stringify(data)}`);
            }
        } catch (e) {
            console.error(`Error: ${e.message}`);
        }
    }
}

listUsers();
