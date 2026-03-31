require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');
const { postToWordPress } = require('./wordpress-poster.js');
const path = require('path');
const { callGemini } = require('./gemini-config');


async function getTrendingTagsWithAI(title, content) {
    const prompt = `Analyse cette recette de cuisine TikTok et propose une liste d'étiquettes (tags) pertinentes.
    
    Titre : ${title}
    Contenu : ${content.substring(0, 2000)}

    Règles :
    1. Retourne UNIQUEMENT un JSON array de strings, ex: ["Airfryer", "Healthy", "Rapide", "France"]
    2. Identifie IMPÉRATIVEMENT si la recette correspond à ces tendances : 
       - "Airfryer" (si cuisson à l'air fryer mentionnée)
       - "Sous-vide" (si cuisson basse température/sous-vide mentionnée)
       - "Barbecue" (si grill/BBQ mentionné)
       - "Healthy" (si équilibré, légumes, peu gras)
       - "Rapide" ou "Express" (si se fait en moins de 30 min)
       - "Végé" (si pas de viande/poisson)
       - "Léger" (si basses calories)
       - "Gourmand" (si bien gras, sucré, réconfortant)
       - "Astuces" (si c'est plus un conseil qu'une recette)
    3. Ajoute aussi le pays d'origine si détecté (France, Italie, Espagne, Grèce, Liban, USA, Mexique, Maroc, Japon, Asie).
    4. Ajoute l'ingrédient principal (Poulet, Boeuf, Pâtes, Chocolat, etc.).`;

    const model = 'gemini-2.0-flash';
    try {
        console.log(`   🧠 Analyse des tendances avec ${model}...`);
        const tags = await callGemini(prompt, model, true);
        return tags;
    } catch (e) {
        console.error(`   ⚠️ Erreur IA:`, e.message); 
    }
    return null;
}

async function run() {
    console.log("🚀 Lancement de la mise à jour globale des tendances IA...");
    const wpBase = (process.env.WP_URL || 'http://109.221.250.122/wordpress').replace(/\/$/, '');
    
    try {
        // On récupère un maximum de recettes (ex: 100 dernières)
        const res = await fetch(`${wpBase}/wp-json/wp/v2/posts?per_page=100&status=publish&_fields=id,title,content`);
        const posts = await res.json();
        
        console.log(`📋 ${posts.length} recettes à analyser.`);
        let updatedCount = 0;

        for (const post of posts) {
            const id = post.id;
            const title = post.title.rendered;
            const content = post.content.rendered;
            
            console.log(`\n🍽️  [${id}] ${title}`);
            console.log(`   🧠 Analyse des tendances avec l'IA...`);
            const newTags = await getTrendingTagsWithAI(title, content);
            
            if (newTags && newTags.length > 0) {
                console.log(`   ✨ Tendances détectées : ${newTags.join(', ')}`);
                const updateRes = await postToWordPress({ 
                    id: id, 
                    updateOnly: true, 
                    tags: newTags 
                });
                
                if (updateRes.success) {
                    console.log(`   ✅ WordPress mis à jour.`);
                    updatedCount++;
                } else {
                    console.error(`   ❌ Échec WordPress:`, updateRes.error);
                }
            } else {
                console.log(`   ⚠️ Aucun tag généré.`);
            }
            
            // Petit délai
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log(`\n✅ TERMINE. ${updatedCount} recettes enrichies avec les tendances.`);
        
        if (updatedCount > 0) {
            console.log(`📦 Synchronisation locale en cours...`);
            const { execSync } = require('child_process');
            try { 
                execSync(`node sync-recipes.js`, { cwd: path.join(__dirname, '..') }); 
                console.log(`✅ Synchro locale terminée.`);
            } catch(e){
                console.error(`❌ Erreur synchro locale:`, e.message);
            }
        }

    } catch (e) {
        console.error("❌ Erreur critique:", e.message);
    }
}

run();
