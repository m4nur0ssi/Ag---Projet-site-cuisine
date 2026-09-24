const { Client } = require("@notionhq/client");
require('dotenv').config();
const notion = new Client({ auth: process.env.NOTION_API_TOKEN });

async function run() {
    const pageId = '308f1980-ec18-806f-b932-eac77fe98838';
    const page = await notion.pages.retrieve({ page_id: pageId });
    console.log(JSON.stringify(page.parent, null, 2));
}

run();
