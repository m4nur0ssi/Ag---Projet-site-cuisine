const fetch = require('node-fetch');

const keys = [
    'AIzaSyBDGs4GjLfrrn6qTx3-8KZ0kN8ideh-oTw',
    'AIzaSyAIjz-HYke3CA4FH69XHa7MyNBxONIfREk',
    'AIzaSyB70uc2YzIY-7ssKt33M0f4AyZybxKKrdo',
    'AIzaSyD6lvhzw4XvsqNCtQ4c5C4NKuJGL9WHvKU'
];

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
