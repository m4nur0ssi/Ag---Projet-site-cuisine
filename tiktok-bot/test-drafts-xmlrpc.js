const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/.env' });

async function getDrafts() {
    const user = process.env.WP_USERNAME;
    const pass = process.env.WP_PASSWORD;
    const wpUrl = (process.env.WP_URL || 'http://192.168.1.200/wordpress').replace(/\/$/, '') + '/xmlrpc.php';
    const encoding = '<?xml version="1.0" encoding="UTF-8"?>';
    
    console.log(`📡 XML-RPC test towards ${wpUrl}...`);
    
    // Logic for wp.getPosts
    const xml = `${encoding}
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

    try {
        const res = await fetch(wpUrl, { method: 'POST', body: Buffer.from(xml, 'utf-8') });
        const text = await res.text();
        if (text.includes('faultCode')) {
             console.log('❌ XML-RPC Fault:', text);
        } else {
             const ids = Array.from(text.matchAll(/<member><name>post_id<\/name><value><string>(\d+)<\/string><\/value><\/member>/g)).map(m => m[1]);
             console.log(`✅ Success! Found ${ids.length} drafts.`);
             console.log('IDs:', ids.join(', '));
             
             // Extract titles too
             const titles = Array.from(text.matchAll(/<member><name>post_title<\/name><value><string><!\[CDATA\[(.*?)\]\]><\/string><\/value><\/member>/g)).map(m => m[1]);
             titles.forEach((t, i) => console.log(`- [${ids[i]}] ${t}`));
        }
    } catch (e) {
        console.error('❌ Error:', e);
    }
}

getDrafts();
