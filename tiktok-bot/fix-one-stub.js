
const { isRecipeWithGemini } = require('./recipe-processor');
const { postToWordPress } = require('./wordpress-poster');
require('dotenv').config();

const desc = `This Air Fryer Recipe Is Amazing | Easy & Tasty!🥰
Ingredients:😋
Tortilla
4 eggs
Onion
Ham
Cherry tomatoes
Mini mozzarella balls
Grated cheese
Salt, pepper, favorite spices

Easy and Tasty Air Fryer Tortilla Recipe

If you're looking for a quick and delicious meal, this easy air fryer tortilla recipe is just what you need! It combines a delightful mix of ingredients that result in a scrumptious dish perfect for breakfast, lunch, or dinner.

Ingredients:
To create this mouthwatering air fryer tortilla, gather the following ingredients:
- 4 large eggs
- 1 tortilla
- 1 onion, chopped
- Slices of ham
- A handful of cherry tomatoes, halved
- Mini mozzarella balls
- Grated cheese of your choice
- Salt, pepper, and your favorite spices

Instructions:
1. Start by preheating your air fryer to the recommended temperature for cooking eggs and tortillas.
2. In a bowl, whisk together the eggs, adding salt, pepper, and any spices you prefer to enhance the flavor.
3. In a separate pan, lightly sauté the onion until it's soft and aromatic. You can also add the ham at this stage for a bit of crispiness.
4. Combine the sautéed onion and ham with the egg mixture, ensuring everything is well mixed.
5. Place the tortilla flat in the air fryer basket. Pour the egg and ham mixture over the tortilla evenly.
6. Scatter cherry tomatoes and mini mozzarella balls on top, finishing with a sprinkle of grated cheese.
7. Cook in the air fryer until the eggs are set and the cheese is bubbling and golden.`;

async function run() {
    console.log('🧠 Analyse Gemini...');
    const analysis = await isRecipeWithGemini(desc, 'Tortilla Air Fryer');
    if (analysis && analysis.isRecipe) {
        console.log(`✅ Recette reconnue: ${analysis.recipeName}`);
        const { generateRecipeHtml } = require('./wordpress-poster');
        const finalRecipe = {
            id: '4153',
            title: analysis.recipeName,
            summary: analysis.summary,
            ingredients: analysis.ingredients,
            steps: analysis.steps,
            tiktokId: '7595219025815194902',
            tiktokUrl: 'https://www.tiktok.com/@hearty_and_delicious/video/7595219025815194902',
            category: analysis.category,
            tags: (analysis.tags || []).concat(['Airfryer']),
            status: 'publish',
            updateOnly: true
        };
        finalRecipe.content = generateRecipeHtml(finalRecipe);
        
        const res = await postToWordPress(finalRecipe);
        console.log('📡 Résultat WordPress:', JSON.stringify(res));
    } else {
        console.error('❌ Échec analyse Gemini');
    }
}
run();
