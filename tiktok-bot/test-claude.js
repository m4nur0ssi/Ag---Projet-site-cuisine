require('dotenv').config({ path: __dirname + '/.env' });
const { callClaude } = require('./claude-config');

async function testClaude() {
    console.log("🧪 Test de Claude...");
    console.log("API Key present:", !!process.env.ANTHROPIC_API_KEY);
    
    const prompt = "Réponds juste 'OK' si tu reçois ce message.";
    const response = await callClaude(prompt, 'claude-sonnet-4-6');
    
    if (response) {
        console.log("✅ Claude a répondu :", response);
    } else {
        console.log("❌ Claude n'a pas répondu. Vérifiez les logs ci-dessus.");
    }
}

testClaude();
