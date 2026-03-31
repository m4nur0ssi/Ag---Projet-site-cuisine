const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/tiktok-bot/.env' });

async function inspectDraft() {
    const user = process.env.WP_USERNAME;
    const pass = process.env.WP_PASSWORD;
    const wpUrl = "http://109.221.250.122/wordpress/xmlrpc.php";

    console.log(`🚀 Inspecting Draft content via XML-RPC`);
    
    const xml = `<?xml version="1.0"?>
    <methodCall>
        <methodName>wp.getPost</methodName>
        <params>
            <param><value><int>1</int></value></param>
            <param><value><string>${user}</string></value></param>
            <param><value><string>${pass}</string></value></param>
            <param><value><string>4159</string></value></param>
        </params>
    </methodCall>`;

    try {
        const res = await fetch(wpUrl, { method: 'POST', body: xml });
        const text = await res.text();
        console.log("Full Content Preview:", text.substring(text.indexOf('<name>post_content</name>'), text.indexOf('<name>post_content</name>') + 500));
    } catch (e) {
        console.error("Exception:", e);
    }
}

inspectDraft();
