const fetch = require('node-fetch');
async function test() {
  const WP_URL = 'http://192.168.1.200/wordpress/xmlrpc.php';
  const xml = `<?xml version="1.0"?>
  <methodCall>
      <methodName>wp.newPost</methodName>
      <params>
          <param><value><int>1</int></value></param>
          <param><value><string>m4nu</string></value></param>
          <param><value><string>2TlsWemp!</string></value></param>
          <param><value>
              <struct>
                  <member><name>post_title</name><value><string>Test & test</string></value></member>
                  <member><name>post_content</name><value><string>Content</string></value></member>
              </struct>
          </value></param>
      </params>
  </methodCall>`;
  
  const res = await fetch(WP_URL, { method: 'POST', body: xml });
  console.log(await res.text());
}
test();
