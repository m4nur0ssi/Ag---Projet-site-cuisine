const { processRecipe } = require('./recipe-processor.js');
const fs = require('fs');

async function test() {
    require('dotenv').config({ path: __dirname + '/.env' });
    const queueData = JSON.parse(fs.readFileSync(__dirname + '/queue.json', 'utf8'));
    if (queueData.queue && queueData.queue.length > 0) {
        const first = queueData.queue[0];
        console.log('--- TEST MANUEL SUR FIRST ITEM ---');
        console.log('Video:', first.videoUrl);
        const success = await processRecipe(first.videoUrl, first.country || 'France');
        console.log('Resultat:', success ? 'SUCCES' : 'ECHEC');
    } else {
        console.log('File d\'attente vide');
    }
}
test();
