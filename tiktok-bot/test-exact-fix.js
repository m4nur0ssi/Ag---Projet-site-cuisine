const http = require('http');
require('dotenv').config({ path: __dirname + '/.env' });

const WP_URL = (process.env.WP_URL || 'http://192.168.1.200/wordpress').replace(/\/$/, '');
const USER = process.env.WP_USERNAME;
const PASS = process.env.WP_PASSWORD;
const WP_AUTH = Buffer.from(`${USER}:${PASS}`).toString('base64');

async function testPost() {
    console.log(`--- TEST EXACT FIX-RECIPE-TOOL LOGIC ---`);
    const path = '/wp-json/wp/v2/posts';
    const url = `${WP_URL}${path}?_auth_user=${encodeURIComponent(USER)}&_auth_pass=${encodeURIComponent(PASS)}`;

    const body = JSON.stringify({
        title: 'Test Exact ' + new Date().toISOString(),
        content: 'Test content',
        status: 'draft'
    });

    const options = {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${WP_AUTH}`,
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
