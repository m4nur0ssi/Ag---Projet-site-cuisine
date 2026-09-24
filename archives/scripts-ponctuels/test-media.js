const fs = require('fs');
const https = require('https');
const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/tiktok-bot/.env' });

async function uploadMedia() {
    const user = process.env.WP_USERNAME;
    const pass = process.env.WP_PASSWORD;
    const wpUrl = 'http://192.168.1.200/wordpress/xmlrpc.php';

    const photoUrl = 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Kiwi_%28Actinidia_chinensis%29_1_Luc_Viatour.jpg';

    const imgRes = await fetch(photoUrl);
    const buffer = await imgRes.buffer();
    const base64 = buffer.toString('base64');
    const fileName = `test_upload_${Date.now()}.jpg`;

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
                    <member><name>type</name><value><string>image/jpeg</string></value></member>
                    <member><name>bits</name><value><base64>${base64}</base64></value></member>
                </struct>
            </value></param>
        </params>
    </methodCall>`;

    const upRes = await fetch(wpUrl, {
        method: 'POST',
        body: uploadXml
    });
    const text = await upRes.text();
    console.log(text);
}
uploadMedia();
