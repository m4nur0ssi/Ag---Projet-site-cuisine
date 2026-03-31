require('dotenv').config({ path: __dirname + '/.env' });
const { postToWordPress, generateRecipeHtml } = require('./wordpress-poster');

async function publish(data) {
    console.log(`🚀 Publication Antigravity pour l'ID: ${data.id}`);
    
    // Génération du HTML
    const html = generateRecipeHtml(data);
    
    // Mise à jour
    const result = await postToWordPress({
        id: data.id,
        updateOnly: true,
        title: data.recipeName,
        content: html,
        status: 'publish',
        tags: data.tags
    });
    
    if (result.success) {
        console.log(`✅ SUCCÈS : "${data.recipeName}" publié !`);
        
        // Sync local
        const { execSync } = require('child_process');
        try { 
            console.log(`📦 Synchro locale...`);
            execSync(`node sync-recipes.js --recent`, { cwd: __dirname + '/..' }); 
            console.log(`✨ Synchro terminée.`);
        } catch(e) { console.error(`❌ Erreur synchro: ${e.message}`); }
    } else {
        console.error(`❌ ÉCHEC : ${result.error}`);
    }
}

// Données extraites par Antigravity
const recipe = {
    "id": "4088",
    "recipeName": "Saint-Félicien fondant aux oignons caramélisés",
    "summary": "Un Saint-Félicien ultra fondant, entouré d’oignons caramélisés, de poivrons et de jambon cru croustillant… une tuerie à partager !",
    "ingredients": [
        {"quantity": "1", "name": "🧀 Saint-Félicien"},
        {"quantity": "1", "name": "🧅 oignon"},
        {"quantity": "Un peu", "name": "🍯 sucre"},
        {"quantity": "1", "name": "🫑 poivron rouge"},
        {"quantity": "", "name": "🌿 marjolaine"},
        {"quantity": "3 tranches", "name": "🍖 jambon cru"},
        {"quantity": "2 tranches", "name": "🥖 pain"}
    ],
    "steps": [
        "Faites revenir un oignon émincé dans une poêle avec un peu de sucre pour le faire caraméliser.",
        "Faites revenir un poivron rouge avec de la marjolaine dans une autre poêle jusqu'à coloration.",
        "Dans un poêlon, disposez les oignons caramélisés puis placez le Saint-Félicien au centre.",
        "Ajoutez les poivrons autour et enfournez à 160°C pendant 10 à 15 minutes.",
        "Émincez le jambon cru, ajoutez-le sur le fromage et remettez au four 5 à 10 minutes.",
        "Servez chaud avec du pain toasté pour tartiner le fromage fondant."
    ],
    "category": "plats",
    "tags": ["France", "Famille", "Gourmand"],
    "tiktokUrl": "https://www.tiktok.com/v/7616809876639059222",
    "status": "publish"
};

publish(recipe);
