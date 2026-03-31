const fs = require('fs');
const path = require('path');

// URL de votre site WordPress local
const WORDPRESS_API_URL = 'http://192.168.1.200/wordpress/wp-json/wp/v2';

async function debugRecipe() {
    try {
        console.log('🔍 Récupération d\'une recette pour analyse...');

        // On récupère juste 1 recette pour voir la structure
        const response = await fetch(`${WORDPRESS_API_URL}/posts?per_page=1`);

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const posts = await response.json();

        if (posts.length === 0) {
            console.log('Aucune recette trouvée.');
            return;
        }

        const post = posts[0];

        console.log(`✅ Recette récupérée : "${post.title.rendered}"`);

        // On sauvegarde le contenu brut dans un fichier pour l'examiner
        const debugFile = path.join(__dirname, 'debug_content.html');
        fs.writeFileSync(debugFile, post.content.rendered);

        console.log(`📄 Contenu HTML brut sauvegardé dans : ${debugFile}`);
        console.log('Je vais maintenant lire ce fichier pour comprendre la structure.');

    } catch (error) {
        console.error('❌ Erreur:', error);
    }
}

debugRecipe();
