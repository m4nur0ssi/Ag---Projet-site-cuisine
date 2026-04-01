require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');

/**
 * Unified Gemini API Caller with support for multiple API keys (rotation)
 * @param {string} prompt - The prompt to send
 * @param {string} model - The model to use
 * @param {boolean} isJson - Whether to expect and parse JSON response
 * @returns {Promise<any>} - The AI response (parsed JSON or raw text)
 */
async function callGemini(prompt, model = 'gemini-2.0-flash', isJson = true) {
    const keys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',').filter(Boolean);
    
    if (keys.length === 0) {
        throw new Error('Aucune clé API Gemini trouvée. Vérifiez votre fichier .env');
    }

    console.log(`   🚀 Gemini : Utilisation de ${keys.length} clé(s) API en rotation.`);

    let lastError = null;

    for (const key of keys) {
        try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: prompt }] }], 
                    generationConfig: { temperature: 0.1 } 
                })
            });

            if (!r.ok) {
                if (r.status === 429) {
                    console.log(`   🚨 Quota dépassé pour ${model} avec la clé ${key.substring(0, 10)}... (429).`);
                    lastError = 'QUOTA_EXCEEDED';
                    continue; // Try next key
                }
                const errData = await r.json().catch(() => ({}));
                console.log(`   ⚠️ Erreur Gemini (${model}) : Status ${r.status} - ${errData.error?.message || ''}`);
                continue;
            }

            const data = await r.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            if (isJson) {
                // Extrait le bloc JSON
                const match = text.match(/[\{\[]([\s\S]*)[\}\]]/);
                if (match) {
                    try {
                        return JSON.parse(match[0]);
                    } catch (e) {
                        console.error("   ❌ Erreur parsing JSON Gemini:", e.message);
                    }
                }
            }
            return text;
        } catch (e) {
            console.error(`   ❌ Exception Gemini:`, e.message);
        }
    }

    if (lastError === 'QUOTA_EXCEEDED') {
        throw new Error('QUOTA_EXCEEDED');
    }
    return null;
}

module.exports = { callGemini };
