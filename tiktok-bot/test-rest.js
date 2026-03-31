const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/.env' });

async function testREST() {
    const user = process.env.WP_USERNAME;
    const pass = process.env.WP_PASSWORD;
    const wpUrl = "http://192.168.1.200/wordpress/wp-json/wp/v2/posts";
    const auth = Buffer.from(`${user}:${pass}`).toString('base64');

    console.log(`🚀 Testing REST API for user: ${user}`);
    
    const body = JSON.stringify({
        title: 'Test REST Emoji 🍝 ' + new Date().toISOString(),
        content: 'Content with emoji 🍎 and <p>HTML</p>',
        status: 'draft'
    });

    try {
        const res = await fetch(wpUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: body
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Response ID: ${data.id}`);
    } catch (e) {
        console.error("Exception:", e);
    }
}

testREST();
