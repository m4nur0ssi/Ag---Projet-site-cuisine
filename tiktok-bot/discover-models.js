require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("❌ Pas de GEMINI_API_KEY dans le .env");
        return;
    }

    console.log(`🔍 Vérification des modèles disponibles pour ta clé API...`);

    // Test v1 et v1beta
    const versions = ['v1', 'v1beta'];

    for (const v of versions) {
        console.log(`\n--- Version : ${v} ---`);
        try {
            const url = `https://generativelanguage.googleapis.com/${v}/models?key=${key}`;
            const res = await fetch(url);
            if (!res.ok) {
                console.log(`⚠️  Version ${v} non accessible (${res.status})`);
                continue;
            }
            const data = await res.json();
            if (data.models) {
                data.models.forEach(m => {
                    const cleanName = m.name.replace('models/', '');
                    const supportsGenerate = m.supportedGenerationMethods.includes('generateContent');
                    if (supportsGenerate) {
                        console.log(`✅ ${cleanName} (OK pour générer)`);
                    } else {
                        console.log(`⏳ ${cleanName} (Autre usage)`);
                    }
                });
            } else {
                console.log("Aucun modèle trouvé.");
            }
        } catch (e) {
            console.error(`Erreur sur ${v}:`, e.message);
        }
    }
}

listModels();
