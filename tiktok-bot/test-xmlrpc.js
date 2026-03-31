const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/.env' });

async function testXMLRPC() {
    const user = process.env.WP_USERNAME;
    const pass = process.env.WP_PASSWORD;
    const wpUrl = "http://192.168.1.200/wordpress/xmlrpc.php";

    console.log(`🚀 Testing XML-RPC for user: ${user}`);
    
    const xml = `<?xml version="1.0"?>
    <methodCall>
        <methodName>wp.getUsersBlogs</methodName>
        <params>
            <param><value><string>${user}</string></value></param>
            <param><value><string>${pass}</string></value></param>
        </params>
    </methodCall>`;

    try {
        const res = await fetch(wpUrl, { method: 'POST', body: xml });
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${text}`);
    } catch (e) {
        console.error("Exception:", e);
    }
}

testXMLRPC();
