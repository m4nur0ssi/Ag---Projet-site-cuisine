const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/data/mockData.ts');
const src = fs.readFileSync(file, 'utf8');

// Extract the JSON array assigned to mockRecipes
const eq = src.indexOf('=', src.indexOf('mockRecipes'));
const start = src.indexOf('[', eq);
// find matching: array ends at "];\n" after exportSyncId already consumed. Use last "];" before end markers.
// Simpler: cut from start, then find the terminating "];"
const tail = src.slice(start);
const end = tail.lastIndexOf('];');
const arrText = tail.slice(0, end + 1);
const recipes = JSON.parse(arrText);

// English-only cooking indicators (regex, word-boundary, case-insensitive)
const EN = [
  'cup', 'cups', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons',
  'ounce', 'ounces', 'pound', 'pounds', 'preheat', 'bake', 'baking',
  'whisk', 'dough', 'combine', 'sprinkle', 'stir', 'minced', 'chopped',
  'boneless', 'until', 'oven', 'pour', 'fold', 'grease', 'dough',
  'the', 'and', 'with', 'add', 'mix', 'heat', 'into', 'about', 'remove',
  'remaining', 'softened', 'melted', 'sliced', 'season', 'serve', 'set aside',
  'flour', 'sugar', 'butter', 'eggs', 'salt', 'water', 'milk', 'cream',
];
const enRe = new RegExp('\\b(' + EN.join('|') + ')\\b', 'i');

// French stopwords — if present, likely French
const frRe = /\b(de|la|le|les|une?|dans|avec|pour|et|à|au|aux|du|des|sur|puis|ensuite|cuillère|mélanger|ajouter|verser|four|cuire|pâte|sucre|farine|beurre|œufs?|sel|lait|crème)\b/i;

function scoreText(t) {
  if (!t) return { en: 0, fr: 0 };
  const en = (t.match(new RegExp(enRe, 'gi')) || []).length;
  const fr = (t.match(new RegExp(frRe, 'gi')) || []).length;
  return { en, fr };
}

const flagged = [];
for (const r of recipes) {
  const ingTxt = (r.ingredients || []).map(i => (i.name || '') + ' ' + (i.quantity || '')).join(' \n ');
  const stepTxt = (r.steps || []).join(' \n ');
  const all = ingTxt + ' \n ' + stepTxt;
  const { en, fr } = scoreText(all);
  // Flag if English signal clearly beats French
  if (en >= 3 && en > fr) {
    flagged.push({ id: r.id, title: r.title, en, fr, steps: r.steps?.length, ings: r.ingredients?.length });
  }
}

console.log('Total recettes:', recipes.length);
console.log('Flaggées non-FR (en>=3 & en>fr):', flagged.length);
console.log(JSON.stringify(flagged, null, 2));
