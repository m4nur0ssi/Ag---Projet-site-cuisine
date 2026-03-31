require('dotenv').config({ path: __dirname + '/.env' });
const { postToWordPress, generateRecipeHtml } = require('./wordpress-poster');

async function publishAll(recipes) {
    for (const data of recipes) {
        console.log(`\n🚀 Publication Antigravity pour l'ID: ${data.id} ("${data.recipeName}")`);
        
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
            console.log(`   ✅ SUCCÈS : "${data.recipeName}" publié !`);
        } else {
            console.error(`   ❌ ÉCHEC : ${result.error}`);
        }
        
        // Petit délai pour ne pas saturer XML-RPC
        await new Promise(r => setTimeout(r, 1000));
    }

    // Sync final
    const { execSync } = require('child_process');
    try { 
        console.log(`\n📦 Synchro finale vers Vercel...`);
        execSync(`node sync-recipes.js --recent`, { cwd: __dirname + '/..' }); 
        console.log(`✨ Synchro terminée.`);
    } catch(e) { console.error(`❌ Erreur synchro: ${e.message}`); }
}

const recipes = [
    {
        "id": "4085",
        "recipeName": "Saint-Jacques sur purée de butternut et chorizo",
        "summary": "Une alliance terre-mer d'exception : des noix de Saint-Jacques snackées sur une purée de butternut onctueuse, relevées par le piquant du chorizo.",
        "ingredients": [
            {"quantity": "1", "name": "🎃 Butternut"},
            {"quantity": "120g", "name": "🥛 Crème fraîche"},
            {"quantity": "6-8", "name": "🐚 Noix de Saint-Jacques"},
            {"quantity": "30g", "name": "🧈 Beurre demi-sel"},
            {"quantity": "50g", "name": "🥓 Chorizo"},
            {"quantity": "", "name": "🌿 Persil frais"},
            {"quantity": "", "name": "🫒 Huile d'olive"}
        ],
        "steps": [
            "Coupez le butternut et faites-le rôtir au four avec de l'huile d'olive pendant 40 à 50 minutes à 190°C.",
            "Mixez le butternut rôti avec la crème fraîche jusqu'à obtenir une purée bien lisse.",
            "Incisez légèrement les Saint-Jacques en quadrillage et snackez-les dans le beurre demi-sel (1 à 2 min par face).",
            "Coupez le chorizo en dés et faites-le griller rapidement à la poêle.",
            "Dressez la purée, déposez les Saint-Jacques par-dessus, puis ajoutez les éclats de chorizo et le persil."
        ],
        "category": "plats",
        "tags": ["Noël", "Gourmand", "Famille"],
        "tiktokUrl": "https://www.tiktok.com/v/7618498566549540118",
        "status": "publish"
    },
    {
        "id": "4082",
        "recipeName": "Hachis Parmentier maison (Norbert Tarayre)",
        "summary": "Le grand classique réconfortant revisité par le chef Norbert Tarayre pour un résultat ultra onctueux et savoureux.",
        "ingredients": [
            {"quantity": "1kg", "name": "🥔 Pommes de terre"},
            {"quantity": "200g", "name": "🧈 Beurre"},
            {"quantity": "100g", "name": "🥛 Lait"},
            {"quantity": "100g", "name": "🥛 Crème épaisse (30%)"},
            {"quantity": "500g", "name": "🥩 Viande hachée"},
            {"quantity": "1", "name": "🧅 Oignon"},
            {"quantity": "1", "name": "🧄 Gousse d’ail"},
            {"quantity": "2", "name": "🥕 Carottes"},
            {"quantity": "50g", "name": "🧀 Fromage râpé"},
            {"quantity": "", "name": "🌿 Thym, Muscade"}
        ],
        "steps": [
            "Faites cuire les pommes de terre et préparez une purée onctueuse en ajoutant le beurre, le lait et la crème.",
            "Faites revenir l'oignon, l'ail et les carottes hachées avec le thym dans un filet d'huile.",
            "Ajoutez la viande hachée, salez, poivrez et laissez mijoter jusqu'à cuisson complète.",
            "Dans un plat à gratin, déposez la viande puis recouvrez avec la purée.",
            "Saupoudrez de fromage râpé et enfournez à 180°C pendant 25 à 30 minutes jusqu'à ce que ce soit bien gratiné."
        ],
        "category": "plats",
        "tags": ["Classique", "Famille", "Chef"],
        "tiktokUrl": "https://www.tiktok.com/v/7604762745589746977",
        "status": "publish"
    }
];

publishAll(recipes);
