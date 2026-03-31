require('dotenv').config();
const fetch = require('node-fetch');

async function listModels() {
    try {
        const keys = (process.env.GEMINI_API_KEYS || '').split(',');
        const key = keys[0];
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();

        if (data.models) {
            console.log("Modèles disponibles :");
            data.models.forEach(m => {
                if (m.name.includes('gemini')) {
                    console.log("- " + m.name.replace('models/', ''));
                }
            });
        } else {
            console.log("Erreur API :", data);
        }
    } catch (e) {
        console.error("Crash :", e.message);
    }
}

listModels();
