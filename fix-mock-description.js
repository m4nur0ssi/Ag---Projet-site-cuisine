const fs = require('fs'); 
const content = fs.readFileSync('src/data/mockData.ts', 'utf8'); 
const jsonStart = content.indexOf('export const mockRecipes: Recipe[] = [') + 37; 
const jsonEnd = content.lastIndexOf(']') + 1; 
let recipes = JSON.parse(content.substring(jsonStart, jsonEnd)); 
recipes.forEach(r => { 
    if(r.description && r.description.startsWith('.mpprecipe-ingredient-item{')) { 
        r.description = ''; 
    } 
}); 
fs.writeFileSync('src/data/mockData.ts', 'import { Recipe } from \'../types/recipe\';\n\nexport const mockRecipes: Recipe[] = ' + JSON.stringify(recipes, null, 2) + ';\n');
