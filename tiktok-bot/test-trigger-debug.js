const { processRecipe } = require('./recipe-processor.js');
const fs = require('fs');
const path = require('path');

async function test() {
    try {
        require('dotenv').config({ path: path.join(__dirname, '.env') });
        const queuePath = path.join(__dirname, 'queue.json');
        const queueData = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
        
        if (queueData.queue && queueData.queue.length > 0) {
            const first = queueData.queue[0];
            console.log('--- TEST MANUEL DEBUG ---');
            console.log('Video:', first.videoUrl);
            const success = await processRecipe(first.videoUrl, first.country || 'France');
            console.log('Success:', success);
        } else {
            console.log('Queue empty');
        }
    } catch (e) {
        console.error('CRASH:', e);
    }
}
test();
