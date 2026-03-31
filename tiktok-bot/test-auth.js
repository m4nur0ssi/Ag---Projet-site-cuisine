const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/.env' });

async function checkAuth() {
    const sessionId = process.env.TIKTOK_SESSION_ID;
    const webId = process.env.TIKTOK_WEBID;
    const msToken = process.env.TIKTOK_MS_TOKEN;
    
    console.log("Checking TikTok Favorites API...");
    
    const url = `https://www.tiktok.com/api/favorite/item_list/?aid=1988&count=10&cursor=0&msToken=${msToken}`;
    const cookieStr = `sessionid=${sessionId}; ttwid=${webId}; msToken=${msToken}`;
    
    try {
        const res = await fetch(url, {
            headers: {
                'Cookie': cookieStr,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://www.tiktok.com/',
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        console.log("Status:", res.status);
        const text = await res.text();
        
        try {
            const data = JSON.parse(text);
            if (data.itemList) {
                console.log("✅ Authenticated! Found", data.itemList.length, "favorites.");
                if (data.itemList.length > 0) {
                    console.log("First item sample:", data.itemList[0].desc.substring(0, 50), "...");
                }
            } else {
                console.log("❌ Authenticated but NO ITEM LIST:", data);
                if (data.status_code === 10202) {
                    console.log("Tip: Check if your sessionid/ttwid are still valid.");
                }
            }
        } catch (e) {
            console.error("❌ Not JSON response:", text.substring(0, 200));
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

checkAuth();
