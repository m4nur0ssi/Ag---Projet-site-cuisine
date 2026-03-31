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
    const titles = [...text.matchAll(/<member><name>post_title<\/name><value><string>(.*?)<\/string>/g)].map(m => m[1]);
    console.log(`Titles: ${titles.length}`);
    console.log(titles.slice(0, 20).join('\n'));
}

test();
