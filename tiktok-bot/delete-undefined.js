const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/.env' });

async function deleteUndefined() {
    const user = process.env.WP_USERNAME;
    const pass = process.env.WP_PASSWORD;
    const wpUrl = (process.env.WP_URL || 'http://192.168.1.200/wordpress').replace(/\/$/, '') + '/xmlrpc.php';

    // 1. Lister les posts récents pour trouver l'ID du "undefined"
    const listXml = `<?xml version="1.0"?><methodCall><methodName>wp.getPosts</methodName><params><param><value><int>1</int></value></param><param><value><string>${user}</string></value></param><param><value><string>${pass}</string></value></param><param><value><struct><member><name>number</name><value><int>10</int></value></member></struct></value></param></params></methodCall>`;

    const res = await fetch(wpUrl, { method: 'POST', body: listXml });
    const text = await res.text();
    
    // On cherche l'ID du post qui s'appelle undefined
    const posts = [];
    const postMatches = text.matchAll(/<struct>([\s\S]*?)<\/struct>/g);
    for (const match of postMatches) {
        const content = match[1];
        const id = content.match(/<member><name>post_id<\/name><value><string>(\d+)<\/string>/)?.[1];
        const title = content.match(/<member><name>post_title<\/name><value><string>(.*?)<\/string>/)?.[1];
        if (id && title === 'undefined') {
            console.log(`🗑️ Suppression du post undefined (ID: ${id})`);
            const deleteXml = `<?xml version="1.0"?><methodCall><methodName>wp.deletePost</methodName><params><param><value><int>1</int></value></param><param><value><string>${user}</string></value></param><param><value><string>${pass}</string></value></param><param><value><int>${id}</int></value></param></params></methodCall>`;
            const delRes = await fetch(wpUrl, { method: 'POST', body: deleteXml });
            const delText = await delRes.text();
            console.log(`✅ Réponse brute : ${delText}`);
            console.log(`✅ Résultat suppression : ${delText.includes('true') ? 'Succès' : 'Échec'}`);
        }
    }
}

deleteUndefined();
