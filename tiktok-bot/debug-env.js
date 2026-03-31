require('dotenv').config({ path: __dirname + '/.env' });
const p = process.env.WP_PASSWORD;
console.log(`Password length: ${p ? p.length : 'null'}`);
if (p) {
    for (let i = 0; i < p.length; i++) {
        console.log(`Char ${i}: ${p.charCodeAt(i)} ('${p[i]}')`);
    }
}
