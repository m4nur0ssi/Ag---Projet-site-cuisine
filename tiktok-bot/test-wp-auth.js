require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');

const WP_API = `${process.env.WP_URL}/wp-json/wp/v2`;
const WP_AUTH = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_PASSWORD}`).toString('base64');

async function testAuth() {
    console.log("Test de connexion API WordPress en cours...");
    console.log(`URL: ${WP_API}/users/me`);
    console.log(`Auth envoyée: Basic ${WP_AUTH}`);
    console.log(`Mot de passe bot: ${process.env.WP_PASSWORD}`);

    try {
        const res = await fetch(`${WP_API}/users/me?bot_password=${encodeURIComponent(process.env.WP_PASSWORD)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${WP_AUTH}`
            }
        });

        const status = res.status;
        const text = await res.text();

        console.log(`\n--- REPONSE HTTP ${status} ---`);
        if (status === 200) {
            console.log("✅ Authentification SUCCESS !");
            console.log(JSON.parse(text));
        } else {
            console.log("❌ Authentification FAILED !");
            console.log(text);
        }
    } catch (e) {
        console.error("Erreur réseau :", e.message);
    }
}

testAuth();
