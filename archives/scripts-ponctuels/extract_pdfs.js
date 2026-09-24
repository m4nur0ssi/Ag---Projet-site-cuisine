const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const sourceDir = 'C:/Users/manu/CloudStation/SCOLARITE/ALYSSA/PROTECTORAT/Inscription';
const targetFiles = [
    'Contrat de scolarisation.pdf',
    'Réglement Intérieur Lycée-Pôle-Sup.pdf',
    'Tarifs indicatifs du Second Degré.pdf'
];

async function run() {
    console.log("Analyzing files in: " + sourceDir);
    const results = [];
    for (const fileName of targetFiles) {
        const filePath = path.join(sourceDir, fileName);
        if (fs.existsSync(filePath)) {
            console.log(`Extracting: ${fileName}`);
            try {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdf(dataBuffer);
                results.push({
                    file: fileName,
                    text: data.text
                });
            } catch (err) {
                console.error(`Error reading ${fileName}:`, err.message);
            }
        } else {
            console.error(`File NOT found: ${filePath}`);
        }
    }
    fs.writeFileSync('extracted_texts.json', JSON.stringify(results, null, 2));
    console.log("Extraction complete. Results in extracted_texts.json");
}

run();
