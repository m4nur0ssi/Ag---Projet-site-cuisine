require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');

const rawUrl = process.env.WP_URL;
const user = process.env.WP_USERNAME;
const pass = process.env.WP_PASSWORD;

// Format: http://user:pass@host/path
const urlWithAuth = rawUrl.replace('://', `://${user}:${encodeURIComponent(pass)}@`);
const finalUrl = `${urlWithAuth}/wp-json/wp/v2/users/me`;

async function test() {
    console.log(`Testing URL with Auth embbeded: ${finalUrl.replace(pass, '****')}`);
    try {
        const res = await fetch(finalUrl);
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Response: ${text.substring(0, 200)}`);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

test();
