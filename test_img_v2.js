const https = require('https');

async function testEndpoint(endpoint) {
    const query = encodeURIComponent('potato ingredient isolated white');
    const url = `https://source.unsplash.com/${endpoint}/?${query}`;

    console.log(`Checking [${endpoint}]: ${url}`);

    return new Promise((resolve) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        };
        https.get(url, options, (res) => {
            console.log(`Status [${endpoint}]: ${res.statusCode}`);
            if (res.statusCode === 302) {
                console.log(`Redirect [${endpoint}]: ${res.headers.location}`);
            }
            resolve(res.statusCode);
        }).on('error', (e) => {
            console.log(`Error [${endpoint}]: ${e.message}`);
            resolve(null);
        });
    });
}

(async () => {
    await testEndpoint('400x400');
    await testEndpoint('featured/400x400');
})();
