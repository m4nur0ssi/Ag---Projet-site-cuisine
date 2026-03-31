const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/tiktok-bot/.env' });

async function uploadAndAttach() {
    const user = process.env.WP_USERNAME || "m4nu";
    const pass = process.env.WP_PASSWORD || "2TlsWemp!";
    const wpUrl = 'http://192.168.1.200/wordpress/xmlrpc.php';
    const postId = 3499;

    const imagePath = '/Users/manu/.gemini/antigravity/brain/32d2ade6-c907-4fd6-b997-917a7b6820de/brookie_professional_1773150511550.png';
    const buffer = fs.readFileSync(imagePath);
    const base64 = buffer.toString('base64');
    const fileName = `brookie_pro_${Date.now()}.png`;

    console.log("📤 Upload image sur WordPress...");

    const uploadXml = `<?xml version="1.0"?>
    <methodCall>
        <methodName>wp.uploadFile</methodName>
        <params>
            <param><value><int>1</int></value></param>
            <param><value><string>${user}</string></value></param>
            <param><value><string>${pass}</string></value></param>
            <param><value>
                <struct>
                    <member><name>name</name><value><string>${fileName}</string></value></member>
                    <member><name>type</name><value><string>image/png</string></value></member>
                    <member><name>bits</name><value><base64>${base64}</base64></value></member>
                </struct>
            </value></param>
        </params>
    </methodCall>`;

    const upRes = await fetch(wpUrl, { method: 'POST', body: uploadXml });
    const upText = await upRes.text();
    const idMatch = upText.match(/<member><name>id<\/name><value><string>(\d+)<\/string><\/value><\/member>/)
        || upText.match(/<member><name>id<\/name><value><int>(\d+)<\/int><\/value><\/member>/);

    if (!idMatch) {
        console.error("❌ Échec upload:", upText.substring(0, 300));
        return;
    }
    const featuredImageId = idMatch[1];
    console.log("✅ Image uploadée, ID:", featuredImageId);

    const editXml = `<?xml version="1.0"?>
    <methodCall>
        <methodName>wp.editPost</methodName>
        <params>
            <param><value><int>1</int></value></param>
            <param><value><string>${user}</string></value></param>
            <param><value><string>${pass}</string></value></param>
            <param><value><int>${postId}</int></value></param>
            <param><value>
                <struct>
                    <member><name>post_thumbnail</name><value><int>${featuredImageId}</int></value></member>
                </struct>
            </value></param>
        </params>
    </methodCall>`;

    const editRes = await fetch(wpUrl, { method: 'POST', body: editXml });
    const editText = await editRes.text();
    if (editText.includes('<boolean>1</boolean>')) {
        console.log("✅ Photo attachée à la recette Brookie (post ID:", postId, ")");
    } else {
        console.error("❌ Erreur:", editText);
    }
}

uploadAndAttach();
