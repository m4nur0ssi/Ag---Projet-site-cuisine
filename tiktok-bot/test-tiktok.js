const fetch = require('node-fetch');

async function testFetchFavorites() {
    const sessionId = process.env.TIKTOK_SESSION_ID;
    const ttwid = process.env.TIKTOK_WEBID;

    // API la plus basique possible pour contourner X-Bogus proxy
    const url = 'https://www.tiktok.com/node/share/user/@' + process.env.TIKTOK_USERNAME + '?is_favorite=1';

    console.log("Tentative d'accès alternatif aux favoris...");
    try {
        const res = await fetch(url, {
            headers: {
                'Cookie': `sessionid=${sessionId}; ttwid=${ttwid};`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            }
        });

        if (!res.ok) {
            console.log("Erreur HTTP", res.status);
            return;
        }

        const data = await res.json();
        const items = data.body?.itemListData || [];
        console.log(`Nombre de favoris trouvés : ${items.length}`);

        if (items.length > 0) {
            console.log("Premier favori :", items[0].itemInfos?.text?.substring(0, 50) + '...');
        }
    } catch (e) {
        console.error("Erreur:", e.message);
    }
}

testFetchFavorites();
