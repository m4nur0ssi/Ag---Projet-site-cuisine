const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/tiktok-bot/.env' });

async function listDrafts() {
    const user = process.env.WP_USERNAME;
    const pass = process.env.WP_PASSWORD;
    const wpUrl = "http://109.221.250.122/wordpress/xmlrpc.php";

    console.log(`🚀 Listing Drafts via XML-RPC for user: ${user}`);
    
    const xml = `<?xml version="1.0"?>
    <methodCall>
        <methodName>wp.getPosts</methodName>
        <params>
            <param><value><int>1</int></value></param>
            <param><value><string>${user}</string></value></param>
            <param><value><string>${pass}</string></value></param>
            <param><value><struct>
                <member><name>post_status</name><value><string>draft</string></value></member>
                <member><name>number</name><value><int>5</int></value></member>
            </struct></value></param>
        </params>
    </methodCall>`;

    try {
        const res = await fetch(wpUrl, { method: 'POST', body: xml });
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        if (text.includes('<fault>')) {
            console.error("XML-RPC Fault:", text);
        } else {
            // Extract titles and IDs manually from XML if regex works
            const ids = text.match(/<member><name>post_id<\/name><value><string>(\d+)<\/string><\/value><\/member>/g);
            console.log("Found IDs:", ids ? ids.length : 0);
            console.log("Raw Preview:", text.substring(0, 500));
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

listDrafts();
