const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/tiktok-bot/.env' });

async function inspectDraft() {
    const user = process.env.WP_USERNAME;
    const pass = process.env.WP_PASSWORD;
    const wpUrl = "http://109.221.250.122/wordpress/xmlrpc.php";

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
        const start = text.indexOf('<name>post_content</name>');
        const end = text.indexOf('</value>', start);
        console.log("Post Content:", text.substring(start, end));
    } catch (e) {
        console.error("Exception:", e);
    }
}

inspectDraft();
