async function search() {
    const q = "gâteau au chocolat";
    const res = await fetch(`https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=isch`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36', 'Accept': 'text/html' }
    });
    const html = await res.text();
    const matches = [...html.matchAll(/http[^"]+\.(?:jpg|png|jpeg)/g)];
    if (matches.length) console.log("Found matches:", matches.slice(0, 3).map(m=>m[0]));
    else console.log("No matches found");
}
search();
