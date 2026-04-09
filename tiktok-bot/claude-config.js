require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');

/**
 * Call Anthropic (Claude) API
 * @param {string} prompt - The prompt to send
 * @param {string} model - The model to use (default: claude-3-5-sonnet-20240620)
 * @returns {Promise<any>} - The parsed JSON response or raw text
 */
async function callClaude(prompt, model = 'claude-sonnet-4-6') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error("   ⚠️ ANTHROPIC_API_KEY manquante dans le .env");
        return null;
    }

    // Extraction du format JSON attendu pour le prompt système
    const jsonFormat = prompt.includes('Format JSON attendu') ? "Tu es un assistant culinaire qui répond uniquement en JSON." : "";

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 2000,
                messages: [{ role: 'user', content: prompt }],
                system: jsonFormat
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error(`   ❌ Erreur Claude (${response.status}):`, err.error?.message || response.statusText);
            return null;
        }

        const data = await response.json();
        const text = data.content[0].text;

        // Extraction JSON
        const match = text.match(/[\{\[]([\s\S]*)[\}\]]/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (e) {
                console.error("   ❌ Erreur parsing JSON Claude:", e.message);
            }
        }
        return text;
    } catch (e) {
        console.error("   ❌ Exception Claude:", e.message);
        return null;
    }
}

module.exports = { callClaude };
