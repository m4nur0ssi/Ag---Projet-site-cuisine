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
            <param><int>1</int></param>
            <param><string>${user}</string></param>
            <param><string>${pass}</string></param>
            <param><struct>
                <member><name>post_status</name><value><string>draft</string></value></member>
                <member><name>number</name><value><int>50</int></value></member>
            </struct></param>
        </params>
    </methodCall>`;

    const res = await fetch(wpUrl, { method: 'POST', body: xml });
    const text = await res.text();
    
    const posts = [];
    const idMatches = [...text.matchAll(/<member><name>post_id<\/name><value><(?:string|int)>(\d+)<\/(?:string|int)><\/value><\/member>/g)].map(m => m[1]);
    const titleMatches = [...text.matchAll(/<member><name>post_title<\/name><value><string>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/string><\/value><\/member>/g)].map(m => m[1]);
    const contentMatches = [...text.matchAll(/<member><name>post_content<\/name><value><string>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/string><\/value><\/member>/g)].map(m => m[1]);

    for (let i = 0; i < idMatches.length; i++) {
        const content = contentMatches[i] || '';
        const unescaped = content.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        const tiktokUrlMatch = unescaped.match(/href="(https:\/\/www\.tiktok\.com\/[^"]+)"/) 
                            || unescaped.match(/cite="(https:\/\/www\.tiktok\.com\/[^"]+)"/);
        
        posts.push({
            id: idMatches[i],
            title: titleMatches[i] || 'Untitled',
            tiktokUrl: tiktokUrlMatch ? tiktokUrlMatch[1] : null
        });
    }

    console.log(JSON.stringify(posts, null, 2));
}

test();
