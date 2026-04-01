const fs = require('fs');
require('dotenv').config({ path: __dirname + '/tiktok-bot/.env' });
const fetch = require('node-fetch');

async function listDraftsXMLRPC() {
    const wpUrl = (process.env.WP_URL || 'http://109.221.250.122/wordpress').replace(/\/$/, '') + '/xmlrpc.php';
    const user = process.env.WP_USERNAME || 'm4nu';
    const pass = process.env.WP_PASSWORD || '2TlsWemp!';
    const encoding = '<?xml version="1.0" encoding="UTF-8"?>';

    console.log(`🔍 Interrogation via XML-RPC: ${wpUrl}...`);
    
    // On demande les derniers posts filtrés par statut via metaWeblog.getRecentPosts ou wp.getPosts
    const xml = `${encoding}<methodCall><methodName>wp.getPosts</methodName><params><param><value><int>1</int></value></param><param><value><string>${user}</string></value></param><param><value><string>${pass}</string></value></param><param><value><struct><member><name>post_status</name><value><string>draft</string></value></member><member><name>number</name><value><int>20</int></value></member></struct></value></param></params></methodCall>`;

    try {
        const res = await fetch(wpUrl, { 
            method: 'POST', 
            body: Buffer.from(xml, 'utf-8')
        });
        const text = await res.text();
        
        // Parsing manuel basique pour voir les titres
        const titles = text.match(/<member><name>post_title<\/name><value><string>(.*?)<\/string><\/value><\/member>/g);
        const ids = text.match(/<member><name>post_id<\/name><value><string>(\d+)<\/string><\/value><\/member>/g);
        
        if (!titles || titles.length === 0) {
            console.log("✅ Aucun brouillon trouvé.");
            return;
        }

        console.log(`📝 ${titles.length} brouillon(s) trouvé(s) :`);
        for(let i=0; i<titles.length; i++) {
            const t = titles[i].replace(/<member><name>post_title<\/name><value><string>(.*?)<\/string><\/value><\/member>/, '$1');
            const id = ids[i] ? ids[i].replace(/<member><name>post_id<\/name><value><string>(\d+)<\/string><\/value><\/member>/, '$1') : '?';
            console.log(`- ID: ${id} | Titre: ${t}`);
        }
        
    } catch (e) {
        console.error('❌ Erreur :', e.message);
    }
}

listDraftsXMLRPC();
