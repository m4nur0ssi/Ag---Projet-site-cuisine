const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/.env' });

async function testConnectivity() {
    const keys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',').filter(Boolean);
    const model = 'gemini-2.0-flash';
    
    console.log(`🚀 TEST CONNECTIVITY: Found ${keys.length} keys.\n`);
    
    const prompt = "Réponds juste 'OK' si tu reçois ce message.";
    
    for (const key of keys) {
        console.log(`🔑 Test de la clé : ${key.substring(0, 10)}...`);
        try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            
            console.log(`   Status: ${r.status}`);
            if (!r.ok) {
                const data = await r.json().catch(() => ({}));
                console.log(`   🚨 Erreur : ${data.error?.message || r.statusText}`);
            } else {
                const data = await r.json();
                console.log(`   ✅ OK : ${data.candidates?.[0]?.content?.parts?.[0]?.text}`);
            }
        } catch (e) {
            console.error(`   ❌ Exception: ${e.message}`);
        }
        console.log('-------------------');
    }
}

testConnectivity();
