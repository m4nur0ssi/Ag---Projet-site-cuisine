const fs = require('fs');
const path = require('path');
const translations = require('./translations-fr.js');

const FILES = [
  path.join(__dirname, '../src/data/mockData.ts'),
  path.join(__dirname, '../src/mobile/data/mockData.ts'),
];

function getArrayBounds(src) {
  const eq = src.indexOf('=', src.indexOf('mockRecipes'));
  const start = src.indexOf('[', eq);
  const end = start + src.slice(start).lastIndexOf('];'); // index of ']'
  return { start, end };
}

// Conserve le préfixe "EMOJI\n   " et remplace seulement le texte
function swapIngredientText(name, newText) {
  const m = name.match(/^([\s\S]*?\n\s*)/);
  if (!m) return newText;
  return m[1] + newText;
}

let report = [];

for (const file of FILES) {
  const src = fs.readFileSync(file, 'utf8');
  const { start, end } = getArrayBounds(src);
  const header = src.slice(0, start);
  const arrText = src.slice(start, end + 1);
  const recipes = JSON.parse(arrText);

  let changed = 0;
  for (const r of recipes) {
    const t = translations[String(r.id)];
    if (!t) continue;
    if (t.title) r.title = t.title;
    if (t.ingredients && r.ingredients) {
      t.ingredients.forEach((txt, i) => {
        if (txt == null || !r.ingredients[i]) return;
        r.ingredients[i].name = swapIngredientText(r.ingredients[i].name, txt);
      });
    }
    if (t.steps && r.steps) {
      t.steps.forEach((txt, i) => {
        if (txt == null) return;
        r.steps[i] = txt;
      });
    }
    changed++;
  }

  const out = header + JSON.stringify(recipes, null, 4) + ';\n';
  fs.writeFileSync(file, out, 'utf8');
  report.push(`${path.relative(process.cwd(), file)} : ${changed} recettes traduites`);
}

console.log(report.join('\n'));
console.log('IDs traduits:', Object.keys(translations).join(', '));
