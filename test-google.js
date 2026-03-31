const https = require('https');
const q = "gâteau au chocolat";
const options = {
    hostname: 'www.google.fr',
    path: `/search?tbm=isch&q=${encodeURIComponent(q)}`,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36' }
};
https.get(options, res => {
    let d = '';
    res.on('data', c => d+=c);
    res.on('end', () => {
        const matches = [...d.matchAll(/\["https:\/\/([^"]+?\.(?:jpg|png))"/g)];
        console.log("Found matches:", matches.length);
        if (matches.length) {
            console.log("https://" + matches[0][1]);
            console.log("https://" + matches[1][1]);
        }
    });
});
