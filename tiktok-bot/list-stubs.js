
const fetch = require('node-fetch');
const user = 'm4nu';
const pass = '2TlsWemp!';
const wpUrl = 'http://109.221.250.122/wordpress/xmlrpc.php';

async function listStubs() {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <methodCall>
        <methodName>wp.getPosts</methodName>
        <params>
            <param><value><int>1</int></value></param>
            <param><value><string>${user}</string></value></param>
            <param><value><string>${pass}</string></value></param>
            <param><value>
                <struct>
                    <member><name>post_status</name><value><string>draft</string></value></member>
                    <member><name>number</name><value><int>100</int></value></member>
                </struct>
            </value></param>
        </params>
    </methodCall>`;

    const res = await fetch(wpUrl, { method: 'POST', body: xml });
    const text = await res.text();
    const stubs = [];
    const structStart = '<struct>';
    const structEnd = '</struct>';
    let currentIdx = text.indexOf(structStart);
    while (currentIdx !== -1) {
        const endIdx = text.indexOf(structEnd, currentIdx);
        if (endIdx === -1) break;
        const structText = text.substring(currentIdx, endIdx);
        if (structText.includes('Recette TikTok en attente')) {
            const idMatch = structText.match(/<name>post_id<\/name><value><string>(\d+)<\/string><\/value>/);
            const videoIdMatch = structText.match(/data-video-id=(?:&quot;|")(\d+)(?:&quot;|")/);
            if (idMatch && videoIdMatch) {
                stubs.push({ id: idMatch[1], tiktokId: videoIdMatch[1] });
            }
        }
        currentIdx = text.indexOf(structStart, endIdx);
    }
    console.log(JSON.stringify(stubs, null, 2));
}

listStubs();
