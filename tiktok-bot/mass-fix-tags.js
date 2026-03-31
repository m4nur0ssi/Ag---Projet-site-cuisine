const { callGemini } = require('./gemini-config');
const { postToWordPress } = require('./wordpress-poster.js');
const fetch = require('node-fetch');

async function getTagsWithGemini(title, content) {
    const prompt = `Analyse cette recette et propose une liste de tags WordPress cohérents (courts et précis).
    Titre : ${title}
    Contenu : ${content.substring(0, 1500)} // Truncated for safety
    
    Règles :
    1. Retourne UNIQUEMENT un JSON array de strings, ex: ["Healthy", "Végé", "France", "Apéritif", "Poulet"]
    2. Identifie le pays (France, Italie, Espagne, Grèce, Liban, USA, Mexique, Orient, Asie).
    3. Identifie le régime (Healthy, Végé, Léger).
    4. Identifie l'ingrédient principal (Poulet, Boeuf, Pâtes, etc.).
    5. Ajoute "Airfryer" si mentionné.
    6. Ajoute "Famille" si convivial.`;

    const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    for (const model of models) {
        try {
            const tags = await callGemini(prompt, model, true);
            if (tags) return tags;
        } catch (e) { console.error(`   ⚠️ Erreur IA (${model}):`, e.message); }
    }
    return null;
}

async function run() {
    console.log("🚀 Démarrage de la mise à jour des étiquettes (50 dernières recettes)...");
    const wpBase = (process.env.WP_URL || 'http://109.221.250.122/wordpress').replace(/\/$/, '');
    
    try {
        const res = await fetch(`${wpBase}/wp-json/wp/v2/posts?per_page=50&status=publish&_fields=id,title,content,tags`);
        const posts = await res.json();
        
        console.log(`📋 ${posts.length} recettes à vérifier.`);
        let updatedCount = 0;

        for (const post of posts) {
            const id = post.id;
            const title = post.title.rendered;
            const content = post.content.rendered;
            
            console.log(`\n🍽️  [${id}] ${title}`);
            console.log(`   🧠 Génération des étiquettes via Gemini...`);
            const newTags = await getTagsWithGemini(title, content);
            
            if (newTags && newTags.length > 0) {
                console.log(`   ✨ Nouveaux tags : ${newTags.join(', ')}`);
                const updateRes = await postToWordPress({ 
                    id: id, 
                    updateOnly: true, 
                    tags: newTags 
                });
                
                if (updateRes.success) {
                    console.log(`   ✅ Mise à jour réussie sur WordPress.`);
                    updatedCount++;
                } else {
                    console.error(`   ❌ Échec:`, updateRes.error);
                }
            } else {
                console.log(`   ⚠️ Aucun tag généré.`);
            }
            
            // Délai pour ne pas surcharger
            await new Promise(r => setTimeout(r, 1500));
        }

        console.log(`\n✅ Session terminée. ${updatedCount} recettes mises à jour.`);
        
        if (updatedCount > 0) {
            console.log(`📦 Déclenchement de la synchro Vercel...`);
            const { execSync } = require('child_process');
            try { 
                const path = require('path');
                execSync(`node sync-recipes.js --recent`, { cwd: path.join(__dirname, '..') }); 
            } catch(e){}
        }

    } catch (e) {
        console.error("❌ Erreur globale:", e.message);
    }
}

run();
