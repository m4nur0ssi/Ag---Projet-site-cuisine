require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');

const WP_API = `${process.env.WP_URL}/wp-json/wp/v2`;
const password = process.env.WP_PASSWORD;

async function testAuth() {
    console.log("--- TEST AUTH BYPASS (Query Param Only) ---");
    const url = `${WP_API}/users/me?bot_password=${encodeURIComponent(password)}`;
    console.log(`URL: ${url}`);

    try {
        const res = await fetch(url, { method: 'GET' });
        const status = res.status;
        const text = await res.text();

        console.log(`Status: ${status}`);
        console.log(`Response: ${text.substring(0, 500)}`);

        if (status === 200) {
            console.log("✅ BYPASS SUCCESSFUL!");
        } else {
            console.log("❌ BYPASS FAILED (Standard header might be needed or password wrong)");
            
            console.log("\n--- TEST AUTH HEADER (Standard Basic) ---");
            const auth = Buffer.from(`${process.env.WP_USERNAME}:${password}`).toString('base64');
            const res2 = await fetch(`${WP_API}/users/me`, {
                method: 'GET',
                headers: { 'Authorization': `Basic ${auth}` }
            });
            console.log(`Status: ${res2.status}`);
            console.log(`Response: ${(await res2.text()).substring(0, 100)}`);
        }
    } catch (e) {
        console.error("Erreur réseau :", e.message);
    }
}

testAuth();
