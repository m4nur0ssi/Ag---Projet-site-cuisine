/**
 * Réapplique src/data/restaurants-info.json dans mockData.ts sans passer par WordPress.
 *
 * sync-recipes.js fait déjà ce merge, mais il exige un accès au WordPress. Quand on
 * complète restaurants-info.json à la main (infos vérifiées), ce script suffit à
 * propager les changements dans les deux copies de mockData.ts.
 *
 * Reprend exactement les règles de sync-recipes.js :
 *   - recipe.title       = info.name si présent (le titre WP reprend la légende TikTok)
 *   - recipe.restaurant  = RESTAURANTS_INFO[id]
 *   - recipe.description = info.blurb si présent, jamais le bouche-trou du bot TikTok
 *   - recipe.address     = info.address || ""
 *   - recipe.image       = info.photos[cover-1] si photos
 *
 * Usage : node apply-restaurants-info.js
 */
const fs = require('fs');
const path = require('path');

const PLACEHOLDER_DESCRIPTION = /pépite culinaire venue tout droit de TikTok/i;

const INFO = require('./src/data/restaurants-info.json');
const TARGETS = [
    path.join(__dirname, 'src/data/mockData.ts'),
    path.join(__dirname, 'src/mobile/data/mockData.ts'),
];

const src = fs.readFileSync(TARGETS[0], 'utf8');
const marker = 'export const mockRecipes: Recipe[] = ';
const start = src.indexOf(marker);
if (start === -1) throw new Error('mockRecipes introuvable dans mockData.ts');

const header = src.slice(0, start);
const body = src.slice(start + marker.length);
const recipes = JSON.parse(body.slice(0, body.lastIndexOf('];') + 1));

let touched = 0;
for (const recipe of recipes) {
    if (recipe.category !== 'restaurant') continue;
    const info = INFO[String(recipe.id)];
    if (!info) continue;

    recipe.restaurant = info;
    recipe.address = info.address || '';
    if (info.name) recipe.title = info.name;
    if (PLACEHOLDER_DESCRIPTION.test(recipe.description || '')) recipe.description = '';
    if (info.blurb) recipe.description = info.blurb;
    if (info.photos && info.photos.length) {
        const idx = Math.min(Math.max(1, info.cover || 1), info.photos.length) - 1;
        recipe.image = info.photos[idx];
    }
    touched++;
    console.log(`  ✅ ${String(recipe.id).padEnd(6)} ${recipe.title.slice(0, 40)}`);
}

const out = header + marker + JSON.stringify(recipes, null, 4) + ';\n';
for (const target of TARGETS) fs.writeFileSync(target, out);
console.log(`\n${touched} fiches restaurant réappliquées dans ${TARGETS.length} fichiers.`);
