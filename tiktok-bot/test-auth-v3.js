const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/.env' });

async function checkAuth() {
    const sessionId = process.env.TIKTOK_SESSION_ID;
    const webId = process.env.TIKTOK_WEBID;
    const msToken = process.env.TIKTOK_MS_TOKEN;
    
    console.log("Checking TikTok Favorites API with ALL PARAMS...");
    
    const params = new URLSearchParams({
        device_id: '7478631165438232097', // Dummy web device id
        aid: '1988',
        app_name: 'tiktok_web',
        device_platform: 'web_pc',
        browser_name: 'chrome',
        browser_version: '122.0.0.0',
        browser_language: 'fr-FR',
        browser_platform: 'Win32',
        screen_width: '1920',
        screen_height: '1080',
        count: '20',
        cursor: '0',
        msToken: msToken
    });

    const url = `https://www.tiktok.com/api/favorite/item_list/?${params.toString()}`;
    const cookieStr = `sessionid=${sessionId}; ttwid=${webId}; msToken=${msToken}; tt_webid_v2=7478631165438232097`;
    
    try {
        const res = await fetch(url, {
            headers: {
                'Cookie': cookieStr,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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
                console.log("✅ SUCCESS! Found", data.itemList.length, "favorites.");
            } else {
                console.log("❌ FAILED:", JSON.stringify(data, null, 2));
            }
        } catch (e) {
            console.error("❌ Not JSON response:", text.substring(0, 200));
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

checkAuth();
