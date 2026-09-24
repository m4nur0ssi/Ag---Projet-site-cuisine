const { Client } = require("@notionhq/client");
require('dotenv').config();
const notion = new Client({ auth: process.env.NOTION_API_TOKEN });

async function run() {
    console.log("Listing recently edited items...");
    try {
        const response = await notion.search({
            sort: {
                direction: 'descending',
                timestamp: 'last_edited_time'
            }
        });
        console.log(`Found ${response.results.length} items.`);
        response.results.forEach(i => {
            let title = "Untitled";
            if (i.object === 'page') {
                title = i.properties.title ? i.properties.title.title[0].plain_text : (i.properties.Name ? (i.properties.Name.title ? i.properties.Name.title[0].plain_text : 'Page') : 'Page');
            } else if (i.object === 'database') {
                title = i.title ? (i.title[0] ? i.title[0].plain_text : 'Database') : 'Database';
            }
            console.log(`[${i.object}] ID: ${i.id} | Title: "${title}" | Edited: ${i.last_edited_time}`);
        });
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
