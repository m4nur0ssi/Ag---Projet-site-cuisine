const { callGemini } = require('./gemini-config');
const { postToWordPressXMLRPC } = require('./wordpress-poster.js');

async function getTagsWithGemini(title, description, rawContent) {
    const prompt = `Voici une recette. Je veux juste une liste de tags pertinents pour WordPress (tags courts).
    Titre : ${title}
    Description / Contenu : ${description || rawContent.substring(0, 1000)}
    
    Règles (très important):
    - Retourne UNIQUEMENT un JSON array de strings comme ça: ["Healthy", "Végé", "France", "Apéritif", "Poulet"]
    - Ne te base que sur ce qui est dans la recette.
    - Identifie le pays si évident (ex: Italie, Mexique, France). Identifie "Healthy" ou "Végé" si applicable. Identifie l'ingrédient principal.`;

    const models = [
        'gemini-2.0-flash',
        'gemini-1.5-flash'
    ];
    for (const model of models) {
        try {
            const tags = await callGemini(prompt, model, true);
            if (tags) return tags;
        } catch (e) { console.error(`Erreur IA (${model}):`, e.message); }
    }
    return null;
}

async function run() {
    console.log("🔍 Récupération des 15 derniers articles sur WordPress...");
    const fetch = require('node-fetch');
    const res = await fetch('http://109.221.250.122/wordpress/wp-json/wp/v2/posts?per_page=15&_embed');
    const posts = await res.json();
    
    for (const p of posts) {
        const id = p.id;
        const title = p.title.rendered;
        const textContent = p.content.rendered.replace(/<[^>]*>?/gm, ' ');
        const tags = p._embedded?.['wp:term']?.[1] || [];
        const tagNames = tags.map(t => t.name);
        
        console.log(`\n🍽️  [${id}] ${title}`);
        
        if (tags.length <= 1) { // 0 ou 1 tag, souvent incomplet
            console.log(`   🔸 Tags actuels: ${tagNames.length ? tagNames.join(', ') : 'Aucun'} => On va re-générer les étiquettes.`);
            const newTags = await getTagsWithGemini(title, '', textContent);
            if (newTags && newTags.length > 0) {
                console.log(`   🧠 L'IA propose: ${newTags.join(', ')}`);
                const updateRes = await postToWordPressXMLRPC({ updateOnly: true, id: id, tags: newTags });
                if (updateRes.success) {
                    console.log(`   ✅ Mise à jour sauvegardée avec succès sur WordPress !`);
                } else {
                    console.error(`   ❌ Échec:`, updateRes.error);
                }
            } else {
                console.log(`   ⚠️ L'IA n'a pas trouvé de tags.`);
            }
        } else {
            console.log(`   ✨ Tags actuels OK: ${tagNames.join(', ')}`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log("\n✅ TERMINÉ !");
}

run();
