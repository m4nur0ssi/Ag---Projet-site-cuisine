const fetch = require('node-fetch');

async function testPixabay() {
    const key = '44284898-75df2864d4b8e9106093630f4';
    const query = encodeURIComponent('chocolate chip cookies');
    const url = `https://pixabay.com/api/?key=${key}&q=${query}&image_type=photo&category=food&safesearch=true`;

    console.log(`URL: ${url}`);
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log(`Total hits: ${data.totalHits}`);
    if (data.hits) {
        data.hits.slice(0, 1).forEach(h => console.log(`Result: ${h.largeImageURL}`));
    }
}

testPixabay();
