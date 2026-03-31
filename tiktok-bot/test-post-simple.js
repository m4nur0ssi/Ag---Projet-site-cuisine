const { postToWordPress } = require('./wordpress-poster');

async function test() {
    console.log("🧪 Test de publication XML-RPC (TikTok Bot)...");

    const mockRecipe = {
        title: "Recette Test XML-RPC " + new Date().toLocaleTimeString(),
        ingredients: [
            { name: "Pommes de terre", image: "https://images.pixabay.com/photo/2016/08/11/08/04/potatoes-1585060_960_720.jpg" },
            { name: "Oignons", image: null }
        ],
        steps: [
            "Éplucher les légumes",
            "Faire cuire à la vapeur",
            "Servir chaud"
        ],
        category: "Plats",
        featuredImage: "https://images.pixabay.com/photo/2017/10/09/19/29/eat-2834549_960_720.jpg",
        videoHtml: "<blockquote>Vidéo TikTok simulée</blockquote>"
    };

    const result = await postToWordPress(mockRecipe);

    if (result.success) {
        console.log("✅ TEST RÉUSSI ! Post ID:", result.postId);
    } else {
        console.log("❌ TEST ÉCHOUÉ :", result.error);
    }
}

test();

