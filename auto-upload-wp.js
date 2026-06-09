/**
 * #11 — Auto-upload des images de recettes vers WordPress.
 *
 * Principe : tu télécharges une image et tu la nommes EXACTEMENT comme la recette
 * (ex. "Poulet Bang Bang.jpg"). Tu la déposes dans le dossier surveillé. Le script :
 *   1. déduit le titre depuis le nom de fichier,
 *   2. retrouve la recette dans mockData → en déduit l'ID du post WordPress,
 *   3. uploade l'image (XML-RPC wp.uploadFile),
 *   4. la définit comme image à la une (wp.editPost post_thumbnail),
 *   5. déplace le fichier traité dans <dossier>/done (ou /erreurs si échec).
 *
 * Usage :
 *   node auto-upload-wp.js                 # traite une fois le dossier par défaut
 *   node auto-upload-wp.js --watch         # surveille en continu (déposer = uploader)
 *   node auto-upload-wp.js /chemin/dossier # dossier personnalisé
 *
 * Dossier par défaut : ~/Downloads/wordpress
 *
 * Identifiants : lus dans tiktok-bot/.env (WP_USERNAME, WP_PASSWORD) avec repli.
 * URL XML-RPC : WP_XMLRPC_URL ou http://192.168.1.200/wordpress/xmlrpc.php
 *   (hors réseau local, mets WP_XMLRPC_URL=http://109.221.250.122/wordpress/xmlrpc.php)
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: path.join(__dirname, 'tiktok-bot', '.env') });

const USER = process.env.WP_USERNAME || 'm4nu';
const PASS = process.env.WP_PASSWORD || '2TlsWemp!';
const WP_URL = process.env.WP_XMLRPC_URL || 'http://192.168.1.200/wordpress/xmlrpc.php';
const FOLDER = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1])
    || path.join(process.env.HOME || '', 'Downloads', 'wordpress');
const WATCH = process.argv.includes('--watch');

const EXT_TYPE = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

// --- Normalisation pour matcher nom de fichier ↔ titre de recette ---
function decodeEntities(s) {
    return String(s || '')
        .replace(/&#0?38;|&amp;/g, '&')
        .replace(/&#0?39;|&rsquo;|&#8217;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&[a-z]+;/gi, ' ');
}
function norm(s) {
    return decodeEntities(s)
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents
        .replace(/['’]/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// --- Charge les recettes depuis mockData (titre → id WordPress) ---
function loadRecipes() {
    const p = path.join(__dirname, 'src', 'data', 'mockData.ts');
    const t = fs.readFileSync(p, 'utf8');
    const m = t.indexOf('mockRecipes: Recipe[] =');
    const i = t.indexOf('[', t.indexOf('=', m));
    const j = t.lastIndexOf(']');
    return JSON.parse(t.slice(i, j + 1));
}

function buildIndex(recipes) {
    const byTitle = new Map();
    recipes.forEach(r => {
        const key = norm(r.title);
        if (key && !byTitle.has(key)) byTitle.set(key, r);
    });
    return byTitle;
}

function findRecipe(index, recipes, fileBase) {
    const key = norm(fileBase);
    if (index.has(key)) return index.get(key);
    // repli : correspondance par inclusion (le titre le plus long qui colle)
    let best = null;
    for (const r of recipes) {
        const k = norm(r.title);
        if (k && (k.includes(key) || key.includes(k))) {
            if (!best || norm(r.title).length > norm(best.title).length) best = r;
        }
    }
    return best;
}

// --- XML-RPC ---
async function uploadImage(imagePath, fileName, mimeType) {
    const base64 = fs.readFileSync(imagePath).toString('base64');
    const xml = `<?xml version="1.0"?>
<methodCall><methodName>wp.uploadFile</methodName><params>
<param><value><int>1</int></value></param>
<param><value><string>${USER}</string></value></param>
<param><value><string>${PASS}</string></value></param>
<param><value><struct>
<member><name>name</name><value><string>${fileName}</string></value></member>
<member><name>type</name><value><string>${mimeType}</string></value></member>
<member><name>bits</name><value><base64>${base64}</base64></value></member>
<member><name>overwrite</name><value><boolean>1</boolean></value></member>
</struct></value></param>
</params></methodCall>`;
    const res = await fetch(WP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml });
    const text = await res.text();
    const match = text.match(/<member><name>id<\/name><value><(?:string|int)>(\d+)<\/(?:string|int)><\/value><\/member>/);
    if (!match) throw new Error('upload sans ID (réponse: ' + text.slice(0, 200) + ')');
    return match[1];
}

async function setThumbnail(postId, mediaId) {
    const xml = `<?xml version="1.0"?>
<methodCall><methodName>wp.editPost</methodName><params>
<param><value><int>1</int></value></param>
<param><value><string>${USER}</string></value></param>
<param><value><string>${PASS}</string></value></param>
<param><value><int>${postId}</int></value></param>
<param><value><struct>
<member><name>post_thumbnail</name><value><int>${mediaId}</int></value></member>
</struct></value></param>
</params></methodCall>`;
    const res = await fetch(WP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml });
    const text = await res.text();
    return text.includes('<boolean>1</boolean>');
}

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function moveTo(dir, file) {
    ensureDir(dir);
    try { fs.renameSync(file, path.join(dir, path.basename(file))); } catch { /* ignore */ }
}

async function processFile(file, index, recipes) {
    const ext = path.extname(file).toLowerCase();
    const mime = EXT_TYPE[ext];
    if (!mime) return; // pas une image gérée
    const base = path.basename(file, ext);
    const recipe = findRecipe(index, recipes, base);
    if (!recipe) {
        console.log(`❓ "${base}" → aucune recette correspondante. (ignoré)`);
        moveTo(path.join(FOLDER, 'erreurs'), file);
        return;
    }
    try {
        console.log(`📸 "${base}" → recette #${recipe.id} (${decodeEntities(recipe.title)})`);
        const fileName = `recipe_${recipe.id}_${Date.now()}${ext}`;
        const mediaId = await uploadImage(file, fileName, mime);
        const ok = await setThumbnail(recipe.id, mediaId);
        console.log(`   ${ok ? '✅ image à la une définie' : '⚠️ uploadée mais thumbnail non confirmé'} (média ${mediaId})`);
        moveTo(path.join(FOLDER, 'done'), file);
    } catch (e) {
        console.error(`   ❌ ${e.message}`);
        moveTo(path.join(FOLDER, 'erreurs'), file);
    }
}

async function scanOnce(index, recipes) {
    if (!fs.existsSync(FOLDER)) { ensureDir(FOLDER); console.log(`📁 Dossier créé : ${FOLDER}\nDépose tes images nommées comme les recettes.`); return; }
    const files = fs.readdirSync(FOLDER)
        .filter(f => EXT_TYPE[path.extname(f).toLowerCase()])
        .map(f => path.join(FOLDER, f));
    if (files.length === 0) { console.log('Aucune image à traiter.'); return; }
    for (const f of files) await processFile(f, index, recipes);
}

(async () => {
    const recipes = loadRecipes();
    const index = buildIndex(recipes);
    console.log(`🗂️  ${recipes.length} recettes indexées. Dossier : ${FOLDER}\n   WordPress : ${WP_URL} (user ${USER})`);
    await scanOnce(index, recipes);
    if (WATCH) {
        console.log('\n👀 Surveillance active — dépose une image pour l’uploader (Ctrl+C pour arrêter).');
        let busy = false;
        fs.watch(FOLDER, async (_evt, fname) => {
            if (busy || !fname) return;
            const ext = path.extname(fname).toLowerCase();
            if (!EXT_TYPE[ext]) return;
            const full = path.join(FOLDER, fname);
            // petit délai : laisser le téléchargement se terminer
            setTimeout(async () => {
                if (!fs.existsSync(full)) return;
                busy = true;
                try { await processFile(full, index, recipes); } finally { busy = false; }
            }, 1500);
        });
    } else {
        console.log('\n🎉 Terminé.');
    }
})();
