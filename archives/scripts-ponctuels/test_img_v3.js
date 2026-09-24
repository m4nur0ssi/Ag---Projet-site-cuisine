const https = require('https');

async function testSpoonacular(ing) {
    const cleanName = ing.toLowerCase()
        .replace(/^[0-9\s,./]+(?:g|kg|ml|cl|l|c\.à\.s|c\.à\.c|verre|pincée)?( de | d'| de)?/i, '') // Vire la quantité
        .trim()
        .split(' ')[0] // Prend juste le premier mot (carotte, pomme, etc.)
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Vire les accents

    const url = `https://spoonacular.com/cdn/ingredients_250x250/${cleanName}.jpg`;

    console.log(`Checking Spoonacular for [${ing}] -> [${cleanName}]: ${url}`);

    return new Promise((resolve) => {
        https.get(url, (res) => {
            console.log(`Status: ${res.statusCode}`);
            resolve(res.statusCode === 200);
        }).on('error', (e) => {
            console.log(`Error: ${e.message}`);
            resolve(false);
        });
    });
}

(async () => {
    await testSpoonacular('Pommes de terre');
    await testSpoonacular('Ail');
    await testSpoonacular('Pois chiches');
    await testSpoonacular('citron');
})();
