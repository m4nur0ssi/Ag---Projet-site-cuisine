const http = require('http');

const options = {
  hostname: '192.168.1.200',
  port: 80,
  path: '/wordpress/wp-json/wp/v2/users/me',
  method: 'GET',
  headers: {
    'Authorization': 'Basic ' + Buffer.from('m4nu:2TlsWemp!').toString('base64')
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusMessage} (${res.statusCode})`);
  console.log('HEADERS:', JSON.stringify(res.headers, null, 2));
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log('BODY:', chunk);
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
});

req.end();
