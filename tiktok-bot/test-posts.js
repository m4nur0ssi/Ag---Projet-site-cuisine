require('dotenv').config({ path: __dirname + '/.env' });
const fetch = require('node-fetch');

async function test(id) {
    const wpBase = (process.env.WP_URL || 'http://109.221.250.122/wordpress').replace(/\/$/, '');
    const res = await fetch(`${wpBase}/wp-json/wp/v2/posts/${id}`);
    const data = await res.json();
    console.log(`ID: ${id}, Status: ${data.status}, Title: ${data.title?.rendered}`);
}

test(4105);
test(4108);
