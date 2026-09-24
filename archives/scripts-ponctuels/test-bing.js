async function search() {
    const q = "recette poulet frit photo HD";
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&first=1`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const matches = [...html.matchAll(/murl&quot;:&quot;(.*?)&quot;/g)];
    for (const match of matches) {
        const imgUrl = match[1];
        try {
            const checkRes = await fetch(imgUrl, { method: 'HEAD', timeout: 5000, headers: {'User-Agent': 'Mozilla/5.0'} });
            const type = checkRes.headers.get('content-type');
            if (checkRes.ok && type && type.startsWith('image/')) {
                console.log("Found:", imgUrl);
                return;
            }
        } catch(e) {}
    }
}
search();
