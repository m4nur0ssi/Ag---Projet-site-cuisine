const https = require('https');
const fs = require('fs');
const path = require('path');

const INGREDIENTS = [
    { name: 'pain', query: 'French baguette isolated white background' },
    { name: 'poulet', query: 'raw chicken breast isolated white background' },
    { name: 'concombre', query: 'cucumber white background' },
    { name: 'salade', query: 'lettuce isolated white background' },
    { name: 'moutarde', query: 'mustard sauce white background' },
    { name: 'poivre_sel', query: 'salt and pepper white background' }
];

const TARGET_DIR = path.resolve(__dirname, 'public', 'ingredients');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

async function download(url, filename) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: { 'User-Agent': USER_AGENT }
        };
        https.get(url, options, res => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return download(res.headers.location, filename).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
                return;
            }
            const fileStream = fs.createWriteStream(filename);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
            fileStream.on('error', reject);
        }).on('error', reject);
    });
}

async function searchAndDownload(ingredient) {
    console.log(`Searching for ${ingredient.name}...`);
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(ingredient.query)}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url&format=json`;

    return new Promise((resolve) => {
        https.get(apiUrl, { headers: { 'User-Agent': USER_AGENT } }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', async () => {
                try {
                    const json = JSON.parse(data);
                    if (json.query && json.query.pages) {
                        const pages = Object.values(json.query.pages);
                        for (let page of pages) {
                            if (page.imageinfo && page.imageinfo.length > 0) {
                                const url = page.imageinfo[0].url;
                                // Filter for jpg/png/webp and avoid non-realist photos
                                if (url.toLowerCase().endsWith('.jpg') || url.toLowerCase().endsWith('.png') || url.toLowerCase().endsWith('.webp')) {
                                    const ext = path.extname(url);
                                    const targetPath = path.join(TARGET_DIR, `${ingredient.name}${ext}`);
                                    console.log(`Downloading ${url} to ${targetPath}...`);
                                    await download(url, targetPath);
                                    resolve(true);
                                    return;
                                }
                            }
                        }
                    }
                    console.log(`No image found for ${ingredient.name}`);
                    resolve(false);
                } catch (e) {
                    console.error(`Error processing ${ingredient.name}:`, e.message);
                    resolve(false);
                }
            });
        }).on('error', (e) => {
            console.error(`Request error for ${ingredient.name}:`, e.message);
            resolve(false);
        });
    });
}

async function main() {
    for (const ing of INGREDIENTS) {
        await searchAndDownload(ing);
        await new Promise(r => setTimeout(r, 1000));
    }
}

main();
