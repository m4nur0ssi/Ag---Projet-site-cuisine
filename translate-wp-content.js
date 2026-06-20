/**
 * Réécrit le CONTENU des posts WordPress avec la version française (ingrédients + étapes),
 * en réutilisant le générateur du bot (generateRecipeHtml) + metaWeblog.editPost.
 *
 * - Ne touche PAS au titre (règle : le titre n'est jamais traduit).
 * - Ne touche PAS à l'image (updateOnly + content uniquement).
 * - Source des textes FR = src/data/mockData.ts (déjà traduit par translate-recipes-fr.js).
 *
 * Usage :
 *   node translate-wp-content.js --ids 6198            # un/des id précis (test)
 *   node translate-wp-content.js --all                 # toutes les recettes du cache de traduction
 *   node translate-wp-content.js --dry --ids 6198      # n'écrit rien, montre le contenu généré
 *
 * Identifiants : tiktok-bot/.env (WP_USERNAME, WP_PASSWORD, WP_URL).
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'tiktok-bot', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.WP_URL) {
    const ip = process.env.WP_FORCE_PUBLIC === 'true' ? '109.221.250.122' : '192.168.1.200';
    process.env.WP_URL = `http://${ip}/wordpress`;
}
const { postToWordPress, generateRecipeHtml } = require('./tiktok-bot/wordpress-poster');

const DRY = process.argv.includes('--dry');
const ALL = process.argv.includes('--all');
const idsArg = process.argv.indexOf('--ids');
const THROTTLE = parseInt(process.env.WP_WRITE_THROTTLE_MS || '700');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadRecipes() {
    const src = fs.readFileSync(path.join(__dirname, 'src/data/mockData.ts'), 'utf8');
    const eq = src.indexOf('=', src.indexOf('mockRecipes'));
    const start = src.indexOf('[', eq);
    const closeAbs = start + src.slice(start).lastIndexOf('];');
    return JSON.parse(src.slice(start, closeAbs + 1));
}

// Retire le préfixe emoji + retour-ligne + indentation d'un nom d'ingrédient mockData
// ("🥣\n   150g sucre" → "150g sucre"). generateRecipeHtml rajoute lui-même l'emoji.
function stripPrefix(name) {
    return String(name || '').replace(/^[^\p{L}\p{N}]*\s*/u, '').trim();
}
function tiktokUrlFrom(videoHtml) {
    const m = String(videoHtml || '').match(/data-video-id="(\d+)"/);
    return m ? `https://www.tiktok.com/v/${m[1]}` : '';
}

(async () => {
    const recipes = loadRecipes();
    const fileArg = process.argv.indexOf('--ids-file');
    let targetIds;
    if (idsArg !== -1 && process.argv[idsArg + 1]) {
        targetIds = process.argv[idsArg + 1].split(',').map(s => s.trim());
    } else if (fileArg !== -1 && process.argv[fileArg + 1]) {
        let raw = '';
        try { raw = fs.readFileSync(process.argv[fileArg + 1], 'utf8'); } catch { raw = ''; }
        targetIds = raw.split(',').map(s => s.trim()).filter(Boolean);
        if (!targetIds.length) { console.log('Aucun id à répercuter (fichier vide).'); return; }
    } else if (ALL) {
        const cache = JSON.parse(fs.readFileSync(path.join(__dirname, 'translate-cache.json'), 'utf8'));
        targetIds = [...new Set(Object.keys(cache).map(k => k.split(':')[0]))];
    } else {
        console.error('Précise --ids 6198[,...] ou --all.');
        process.exit(1);
    }

    const byId = new Map(recipes.map(r => [String(r.id), r]));
    const targets = targetIds.map(id => byId.get(String(id))).filter(Boolean);
    console.log(`📝 ${targets.length} recette(s) à réécrire sur WordPress (FR, ingrédients + étapes).`);

    let ok = 0, err = 0, done = 0;
    for (const r of targets) {
        const recipeObj = {
            id: r.id,
            updateOnly: true,
            title: r.title,                       // conservé (non envoyé pour édition du titre)
            summary: r.description || '',
            ingredients: (r.ingredients || []).map(i => ({ quantity: i.quantity || '', name: stripPrefix(i.name) })),
            steps: r.steps || [],
            tiktokUrl: tiktokUrlFrom(r.videoHtml),
        };
        const content = generateRecipeHtml(recipeObj);
        if (DRY) {
            console.log(`\n--- #${r.id} ${r.title} ---\n${content.slice(0, 600)}\n…`);
            continue;
        }
        try {
            const res = await postToWordPress({ updateOnly: true, id: r.id, content });
            if (res?.success) { ok++; console.log(`  ✅ #${r.id} ${r.title}`); }
            else { err++; console.log(`  ❌ #${r.id} ${r.title} : ${res?.error || 'échec'}`); }
        } catch (e) { err++; console.log(`  ❌ #${r.id} ${r.title} : ${e.message}`); }
        await sleep(THROTTLE);
        if (++done % 20 === 0) console.log(`  … ${done}/${targets.length}`);
    }
    console.log(`\n✅ WordPress mis à jour : ${ok} | erreurs : ${err}.`);
})();
