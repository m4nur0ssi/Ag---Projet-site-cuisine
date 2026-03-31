const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/tiktok-bot/.env' });

const user = process.env.WP_USERNAME || "m4nu";
const pass = process.env.WP_PASSWORD || "2TlsWemp!";
const wpUrl = 'http://192.168.1.200/wordpress/xmlrpc.php';
const brain = '/Users/manu/.gemini/antigravity/brain/32d2ade6-c907-4fd6-b997-917a7b6820de';

const recipes = [
    { postId: 3511, image: `${brain}/poulet_bang_bang_1773150770142.png`, title: 'Poulet Bang Bang' },
    { postId: 3505, image: `${brain}/poulet_croustillant_aigre_douce_1773150786665.png`, title: 'Poulet croustillant aigre-douce' },
    { postId: 3493, image: `${brain}/galette_pomme_terre_1773150820987.png`, title: 'Galette de pomme de terre' },
    { postId: 3489, image: `${brain}/biscuit_caramel_chocolat_1773150838664.png`, title: 'Biscuit caramel chocolat' },
    { postId: 3486, image: `${brain}/cake_caramel_chocolat_1773150857671.png`, title: 'Cake caramel chocolat' },
    { postId: 3483, image: `${brain}/crostoni_salsiccia_1773150874993.png`, title: 'Crostoni Salsiccia' },
    { postId: 3480, image: `${brain}/piccata_poulet_italienne_1773150893555.png`, title: 'Piccata de poulet' },
];

async function uploadImage(imagePath, fileName) {
    const buffer = fs.readFileSync(imagePath);
    const base64 = buffer.toString('base64');
    const xml = `<?xml version="1.0"?>
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
    const res = await fetch(wpUrl, { method: 'POST', body: xml });
    const text = await res.text();
    const match = text.match(/<member><name>id<\/name><value><string>(\d+)<\/string><\/value><\/member>/)
        || text.match(/<member><name>id<\/name><value><int>(\d+)<\/int><\/value><\/member>/);
    return match ? match[1] : null;
}

async function attachImage(postId, mediaId) {
    const xml = `<?xml version="1.0"?>
    <methodCall>
        <methodName>wp.editPost</methodName>
        <params>
            <param><value><int>1</int></value></param>
            <param><value><string>${user}</string></value></param>
            <param><value><string>${pass}</string></value></param>
            <param><value><int>${postId}</int></value></param>
            <param><value>
                <struct>
                    <member><name>post_thumbnail</name><value><int>${mediaId}</int></value></member>
                </struct>
            </value></param>
        </params>
    </methodCall>`;
    const res = await fetch(wpUrl, { method: 'POST', body: xml });
    const text = await res.text();
    return text.includes('<boolean>1</boolean>');
}

async function run() {
    for (const recipe of recipes) {
        try {
            console.log(`\n📸 [${recipe.title}] Upload...`);
            const fileName = `recipe_ai_${recipe.postId}_${Date.now()}.png`;
            const mediaId = await uploadImage(recipe.image, fileName);
            if (!mediaId) { console.log(`   ❌ Échec upload`); continue; }
            console.log(`   ✅ Média uploadé ID: ${mediaId}`);
            const ok = await attachImage(recipe.postId, mediaId);
            console.log(`   ${ok ? '✅ Photo attachée !' : '❌ Erreur attachement'}`);
        } catch (e) {
            console.error(`   ❌ Erreur: ${e.message}`);
        }
    }
    console.log('\n🎉 Terminé !');
}

run();
