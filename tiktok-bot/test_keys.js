const fetch = require('node-fetch');

// Les clés ne sont plus écrites ici : le dépôt est public. On les passe par
// l'environnement, séparées par des virgules :
//   GEMINI_TEST_KEYS="clé1,clé2" node tiktok-bot/test_keys.js
// (à défaut, on teste la seule GEMINI_API_KEY de tiktok-bot/.env).
require('dotenv').config({ path: __dirname + '/.env' });
const keys = (process.env.GEMINI_TEST_KEYS || process.env.GEMINI_API_KEY || '')
    .split(',').map(k => k.trim()).filter(Boolean);
if (!keys.length) {
    console.error('Aucune clé : définir GEMINI_TEST_KEYS ou GEMINI_API_KEY.');
    process.exit(1);
}

async function testKey(key) {
    const model = 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Reponds juste 'OK' si tu m'entends." }] }] })
        });
        
        if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return { key, status: '✅ FONCTIONNE', message: text.trim() };
        } else {
            const error = await response.json();
            return { key, status: '❌ QUOTA_EXCEEDED (429)', error: error.error?.message || response.statusText };
        }
    } catch (e) {
        return { key, status: '⚠️ ERREUR_RESEAU', error: e.message };
    }
}

async function runTests() {
    console.log('🧪 Début du test des clés Gemini...\n');
    for (const key of keys) {
        process.stdout.write(`Vérification de ${key.substring(0, 10)}... `);
        const result = await testKey(key);
        console.log(`${result.status} ${result.message || ''}`);
        if (result.error) console.log(`   └─ ${result.error}`);
    }
}

runTests();
