const http = require('http');
require('dotenv').config({ path: __dirname + '/.env' });

const WP_URL = (process.env.WP_URL || 'http://192.168.1.200/wordpress').replace(/\/$/, '');
const USER = process.env.WP_USERNAME;
const PASS = process.env.WP_PASSWORD;

async function testPost() {
    console.log(`--- TEST QUERY PARAMS ONLY (No Header) ---`);
    const path = '/wp-json/wp/v2/posts';
    // Utilisation de _auth_user et _auth_pass (Plugin Application Passwords ou similaire)
    const url = `${WP_URL}${path}?_auth_user=${encodeURIComponent(USER)}&_auth_pass=${encodeURIComponent(PASS)}`;

    const body = JSON.stringify({
        title: 'Test Query ' + new Date().toISOString(),
        content: 'Test content',
        status: 'draft'
    });

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'User-Agent': 'Mozilla/5.0'
        }
    };

    console.log(`URL: ${url}`);

    const req = http.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Response: ${data}`);
            if (res.statusCode === 201) console.log("✅ SUCCESS!");
            else console.log("❌ FAILED.");
        });
    });

    req.on('error', e => console.error(e));
    req.write(body);
    req.end();
}

testPost();
