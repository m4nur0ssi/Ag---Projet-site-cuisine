const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { Client } = require("@notionhq/client");

require('dotenv').config();
const notion = new Client({ auth: process.env.NOTION_API_TOKEN });

const sourceDir = 'C:/Users/manu/CloudStation/SCOLARITE/ALYSSA/PROTECTORAT/Inscription';
const targetFiles = [
    'Contrat de scolarisation.pdf',
    'Réglement Intérieur Lycée-Pôle-Sup.pdf',
    'Tarifs indicatifs du Second Degré.pdf'
];

async function run() {
    console.log("Starting PDF extraction...");

    // 1. Extract PDFs
    let combinedBlocks = [];

    for (const fileName of targetFiles) {
        const filePath = path.join(sourceDir, fileName);
        if (fs.existsSync(filePath)) {
            console.log(`Reading: ${fileName}`);
            try {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdfParse(dataBuffer);

                // Add heading for this document
                combinedBlocks.push({
                    object: 'block',
                    type: 'heading_2',
                    heading_2: {
                        rich_text: [{ type: 'text', text: { content: fileName.replace('.pdf', '') } }]
                    }
                });

                // Split text into chunks (Notion limit: 2000 chars per block)
                const lines = data.text.split('\n').filter(l => l.trim() !== '');
                let currentChunk = "";

                for (const line of lines) {
                    if ((currentChunk.length + line.length) > 1800) {
                        if (currentChunk.trim().length > 0) {
                            combinedBlocks.push({
                                object: 'block',
                                type: 'paragraph',
                                paragraph: {
                                    rich_text: [{ type: 'text', text: { content: currentChunk.trim() } }]
                                }
                            });
                        }
                        currentChunk = "";
                    }
                    currentChunk += line + "\n";
                }

                if (currentChunk.trim().length > 0) {
                    combinedBlocks.push({
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [{ type: 'text', text: { content: currentChunk.trim() } }]
                        }
                    });
                }

            } catch (err) {
                console.error(`Error reading ${fileName}:`, err.message);
            }
        } else {
            console.error(`File not found: ${filePath}`);
        }
    }

    console.log(`Extracted ${combinedBlocks.length} blocks.`);

    // 2. Create page in Notion
    try {
        console.log("Creating Notion page 'Protectorat Alyssa'...");

        // Create as child of "Projet Pochette cadeau" (only accessible page)
        const PARENT_PAGE_ID = '308f1980-ec18-806f-b932-eac77fe98838';

        const newPage = await notion.pages.create({
            parent: { page_id: PARENT_PAGE_ID },
            properties: {
                title: [
                    { text: { content: 'Protectorat Alyssa' } }
                ]
            },
            children: combinedBlocks.slice(0, 100) // First batch
        });

        console.log(`Page created: ${newPage.id}`);
        console.log(`URL: ${newPage.url}`);

        // Append remaining blocks in batches
        if (combinedBlocks.length > 100) {
            for (let i = 100; i < combinedBlocks.length; i += 100) {
                const batch = combinedBlocks.slice(i, i + 100);
                await notion.blocks.children.append({
                    block_id: newPage.id,
                    children: batch
                });
                console.log(`Appended batch ${Math.floor(i / 100) + 1}`);
            }
        }

        console.log("Done! Page created successfully.");

    } catch (error) {
        console.error('Notion API Error:', error.body || error.message);
    }
}

run();
