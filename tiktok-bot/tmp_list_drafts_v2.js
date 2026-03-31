require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');

async function test() {
    const wpBase = (process.env.WP_URL || 'http://109.221.250.122/wordpress').replace(/\/$/, '');
    const user = process.env.WP_USERNAME;
    const pass = process.env.WP_PASSWORD;
    const wpUrl = wpBase + '/xmlrpc.php';

    const xml = `<?xml version="1.0"?>
    <methodCall>
        <methodName>wp.getPosts</methodName>
        <params>
            <param><value><int>1</int></value></param>
            <param><value><string>${user}</string></value></param>
            <param><value><string>${pass}</string></value></param>
            <param><value><struct>
                <member><name>post_status</name><value><string>draft</string></value></member>
                <member><name>number</name><value><int>100</int></value></member>
            </struct></value></param>
        </params>
    </methodCall>`;

    const res = await fetch(wpUrl, { method: 'POST', body: xml });
    const text = await res.text();
    
    // Compter les balises <struct> à la racine de l'array
    // Chaque post est un <value><struct>...</struct></value>
    const postsCount = (text.match(/<value><struct>/g) || []).length;
    console.log(`REAL DRAFT COUNT FROM XML-RPC: ${postsCount}`);
    
    // Lister les titres pour vérifier le contenu
    const titles = [...text.matchAll(/<member><name>post_title<\/name><value><string>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/string>/gs)].map(m => m[1]);
    console.log(`TITLES FOUND (${titles.length}):`);
    titles.forEach((t, i) => console.log(`${i+1}: ${t.substring(0, 50)}`));
}

test();
