const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../src/data/mockData.ts');
const src = fs.readFileSync(file, 'utf8');
const eq = src.indexOf('=', src.indexOf('mockRecipes'));
const start = src.indexOf('[', eq);
const tail = src.slice(start);
const arrText = tail.slice(0, tail.lastIndexOf('];') + 1);
const recipes = JSON.parse(arrText);

const ids = process.argv.slice(2);
for (const r of recipes) {
  if (!ids.includes(String(r.id))) continue;
  console.log('===== ID ' + r.id + ' | ' + r.title + ' =====');
  console.log('-- ingredients --');
  (r.ingredients || []).forEach((i, n) => console.log(n + ': qty=[' + (i.quantity||'') + '] name=[' + JSON.stringify(i.name) + ']'));
  console.log('-- steps --');
  (r.steps || []).forEach((s, n) => console.log(n + ': ' + JSON.stringify(s)));
  console.log('');
}
