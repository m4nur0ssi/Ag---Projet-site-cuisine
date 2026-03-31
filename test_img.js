const https = require('https');

async function checkUrl(name) {
    const cleanName = name.replace(/^\d+[\s\w]*\s+(de|d')?\s*/i, '').trim();
    const query = encodeURIComponent(cleanName + ' ingredient isolated white');
    const url = `https://source.unsplash.com/400x400/?${query}`;

    console.log(`Checking: ${url}`);

    return new Promise((resolve) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };
        https.get(url, options, (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Redirect: ${res.headers.location}`);
            resolve(res.headers.location || url);
        }).on('error', (e) => {
            console.log(`Error: ${e.message}`);
            resolve(null);
        });
    });
}

checkUrl('pommes de terre');
