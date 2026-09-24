async function search() {
    const q = "recette poulet frit";
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&first=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const matches = [...html.matchAll(/murl&quot;:&quot;(.*?)&quot;/g)];
    for (const match of matches) {
        let imgUrl = match[1];
        if (imgUrl.includes('x.com')) continue;
        console.log("Found:", imgUrl);
    }
}
search();
