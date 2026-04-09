const { callClaude } = require('./anthropic-config');

async function testCurrent() {
    console.log("🧪 Test de la configuration Claude 4.6 mise à jour...");
    try {
        const response = await callClaude("Réponds juste 'OK' si tu m'entends.", 'claude-sonnet-4-6', false);
        if (response) {
            console.log("✅ CLAUDE 4.6 RÉPOND :", response);
        } else {
            console.log("❌ Échec de la réponse.");
        }
    } catch (e) {
        console.error("❌ ERREUR LORS DU TEST :", e.message);
    }
}

testCurrent();
