/**
 * Auto-upload des photos de RESTAURANTS vers WordPress — même principe que
 * auto-upload-wp.js (recettes), mais pour le CARROUSEL des fiches restaurant
 * (plusieurs photos par resto).
 *
 * Principe :
 *   1. Tu crées un SOUS-DOSSIER nommé comme le restaurant
 *      (ex. "Il Venezia") dans le dossier surveillé.
 *   2. Tu y déposes plusieurs photos. L'ordre alphabétique des noms décide de
 *      l'ordre du carrousel → la 1re est mise en avant (préfixe "1-", "2-"…).
 *   3. Le script, pour chaque sous-dossier :
 *        a. retrouve le restaurant dans mockData → ID du post WordPress,
 *        b. uploade chaque image (XML-RPC wp.uploadFile),
 *        c. écrit photos[] (URLs via /api/image-proxy) dans restaurants-info.json
 *           ET patche les 2 mockData.ts (affichage immédiat),
 *        d. déplace le sous-dossier traité dans <dossier>/done (ou /erreurs).
 *
 * Usage :
 *   node auto-upload-restaurants.js                 # traite une fois
 *   node auto-upload-restaurants.js --watch         # surveille en continu
 *   node auto-upload-restaurants.js /chemin/dossier # dossier personnalisé
 *
 * Dossier par défaut : ~/Downloads/wordpress-restaurants
 *   (les recettes utilisent ~/Downloads/wordpress → dossiers séparés)
 *
 * Identifiants : tiktok-bot/.env (WP_USERNAME, WP_PASSWORD) avec repli.
 * URL XML-RPC : WP_XMLRPC_URL ou http://192.168.1.200/wordpress/xmlrpc.php
 * Hôte public des images : WP_PUBLIC_HOST (défaut 109.221.250.122, comme les recettes).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const fetch = require('node-fetch');
require('dotenv').config({ path: path.join(__dirname, 'tiktok-bot', '.env') });

const USER = process.env.WP_USERNAME || 'm4nu';
const PASS = process.env.WP_PASSWORD || '2TlsWemp!';
const WP_URL = process.env.WP_XMLRPC_URL || 'http://192.168.1.200/wordpress/xmlrpc.php';
const WP_PUBLIC_HOST = process.env.WP_PUBLIC_HOST || '109.221.250.122'; // hôte public servi via image-proxy
const FOLDER = process.argv.slice(2).find(a => !a.startsWith('-'))
    || path.join(process.env.HOME || '', 'Downloads', 'wordpress-restaurants');
const WATCH = process.argv.includes('--watch');

const INFO_PATH = path.join(__dirname, 'src', 'data', 'restaurants-info.json');
const MOCKDATA_FILES = [
    path.join(__dirname, 'src', 'data', 'mockData.ts'),
    path.join(__dirname, 'src', 'mobile', 'data', 'mockData.ts'),
];
const EXT_TYPE = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif' };

// --- Normalisation nom de dossier ↔ titre du restaurant ---
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
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/['’]/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
const naturalSort = (a, b) => a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' });

// --- Restaurants depuis mockData.ts (titre → id WordPress) ---
function loadRestaurants() {
    const t = fs.readFileSync(MOCKDATA_FILES[0], 'utf8');
    const m = t.indexOf('mockRecipes: Recipe[] =');
    const i = t.indexOf('[', t.indexOf('=', m));
    const j = t.lastIndexOf(']');
    const all = JSON.parse(t.slice(i, j + 1));
    return all.filter(r => r.category === 'restaurant').map(r => ({ id: String(r.id), title: r.title }));
}

// Distance de Levenshtein (tolère les fautes de frappe : venezio↔venezia = 1).
function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[m][n];
}
// 2 mots "collent" : égaux, préfixe ≥5, ou faute proche (Lev ≤1 pour ≥5 lettres).
function tokenMatch(a, b) {
    if (a === b) return true;
    if (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a))) return true;
    if (a.length >= 5 && b.length >= 5 && lev(a, b) <= 1) return true;
    return false;
}
function findRestaurant(restaurants, folderName) {
    const key = norm(folderName);
    // 1) exact / inclusion (rapide, sûr)
    let best = null;
    for (const r of restaurants) {
        const k = norm(r.title);
        if (!k) continue;
        if (k === key) return r;
        if (k.includes(key) || key.includes(k)) {
            if (!best || norm(r.title).length > norm(best.title).length) best = r;
        }
    }
    if (best) return best;
    // 2) repli tolérant : mots distinctifs (≥4 lettres) qui collent malgré une faute.
    const keyTok = key.split(' ').filter(t => t.length >= 4);
    let bestScore = 0;
    for (const r of restaurants) {
        const rTok = norm(r.title).split(' ').filter(t => t.length >= 4);
        let score = 0;
        for (const kt of keyTok) if (rTok.some(rt => tokenMatch(kt, rt))) score++;
        if (score > bestScore) { bestScore = score; best = r; }
    }
    return bestScore >= 1 ? best : null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Le serveur WP est lent (~30s/upload) et bloque au-delà d'un certain poids.
// On réduit chaque photo (sips, natif macOS) : plus léger = upload fiable + mieux
// pour le web. Renvoie {path, tmp} ; tmp=true → fichier temporaire à supprimer.
const MAX_DIM = Number(process.env.RESTO_MAX_DIM) || 1400;
const JPG_QUALITY = Number(process.env.RESTO_JPG_QUALITY) || 68;
const RESIZE_ABOVE = 150 * 1024; // en dessous, on garde l'original
function resizeForUpload(src) {
    try {
        if (fs.statSync(src).size <= RESIZE_ABOVE) return { path: src, tmp: false };
        const tmp = path.join(os.tmpdir(), `resto_up_${Date.now()}_${path.basename(src)}`);
        execFileSync('sips', ['-Z', String(MAX_DIM), '-s', 'formatOptions', String(JPG_QUALITY), src, '--out', tmp], { stdio: 'ignore' });
        if (fs.existsSync(tmp) && fs.statSync(tmp).size > 0) return { path: tmp, tmp: true };
    } catch { /* sips absent ou échec → upload original */ }
    return { path: src, tmp: false };
}

// --- XML-RPC upload (renvoie {id, url}) — timeout + retry (WP hangue parfois) ---
async function uploadImageOnce(base64, fileName, mimeType, timeoutMs) {
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
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(WP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml, signal: ctrl.signal });
        const text = await res.text();
        const idM = text.match(/<member><name>id<\/name><value><(?:string|int)>(\d+)<\/(?:string|int)><\/value><\/member>/);
        if (!idM) throw new Error('upload sans ID (réponse: ' + text.slice(0, 200) + ')');
        const urlM = text.match(/<member><name>url<\/name><value><string>([^<]+)<\/string><\/value><\/member>/);
        return { id: idM[1], url: urlM ? urlM[1] : null };
    } finally {
        clearTimeout(timer);
    }
}
async function uploadImage(imagePath, fileName, mimeType) {
    const base64 = fs.readFileSync(imagePath).toString('base64');
    const TIMEOUT = Number(process.env.WP_TIMEOUT_MS) || 90000;
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await uploadImageOnce(base64, fileName, mimeType, TIMEOUT);
        } catch (e) {
            lastErr = e;
            const why = e.name === 'AbortError' ? `timeout ${TIMEOUT}ms` : e.message;
            console.log(`   ⏳ tentative ${attempt}/3 échouée (${why})${attempt < 3 ? ' — nouvel essai…' : ''}`);
            if (attempt < 3) await sleep(2000 * attempt);
        }
    }
    throw lastErr;
}

// URL WP publique → même format que les recettes : /api/image-proxy?url=...&v=...
function toProxyUrl(wpUrl) {
    let u = wpUrl.replace('192.168.1.200', WP_PUBLIC_HOST);
    return `/api/image-proxy?url=${encodeURIComponent(u)}&v=${Date.now()}`;
}

// --- Écriture data ---
function writeInfo(id, photos) {
    const data = JSON.parse(fs.readFileSync(INFO_PATH, 'utf8'));
    if (!data[id]) data[id] = {};
    data[id].photos = photos;
    fs.writeFileSync(INFO_PATH, JSON.stringify(data, null, 2) + '\n');
}

// Patche la clé "restaurant" (JSON sur une ligne) du post <id> dans mockData.ts.
function patchMockDataById(file, id, photos) {
    if (!fs.existsSync(file)) return false;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    let inTarget = false, patched = false;
    for (let i = 0; i < lines.length; i++) {
        if (new RegExp(`^\\s*"id":\\s*"${id}"\\s*,`).test(lines[i])) { inTarget = true; continue; }
        if (inTarget && /^\s*"id":\s*"/.test(lines[i])) break; // post suivant sans match
        if (inTarget) {
            const m = lines[i].match(/^(\s*)"restaurant":\s*(\{.*\})(,?)\s*$/);
            if (m) {
                let obj; try { obj = JSON.parse(m[2]); } catch { continue; }
                obj.photos = photos;
                lines[i] = `${m[1]}"restaurant": ${JSON.stringify(obj)}${m[3]}`;
                patched = true;
                break;
            }
        }
    }
    if (patched) fs.writeFileSync(file, lines.join('\n'));
    return patched;
}

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function moveTo(dir, src) {
    ensureDir(dir);
    const dest = path.join(dir, path.basename(src));
    try { fs.rmSync(dest, { recursive: true, force: true }); } catch { /* */ }
    try { fs.renameSync(src, dest); } catch { /* */ }
}

async function processDir(dirPath, restaurants) {
    const name = path.basename(dirPath);
    const resto = findRestaurant(restaurants, name);
    if (!resto) {
        console.log(`❓ "${name}" → aucun restaurant correspondant. (ignoré)`);
        moveTo(path.join(FOLDER, 'erreurs'), dirPath);
        return false;
    }
    const imgs = fs.readdirSync(dirPath)
        .filter(f => EXT_TYPE[path.extname(f).toLowerCase()] && !f.startsWith('.'))
        .sort(naturalSort);
    if (imgs.length === 0) {
        console.log(`⚠️  "${name}" → aucune image dans le dossier. (ignoré)`);
        return false;
    }
    try {
        console.log(`📸 "${name}" → restaurant #${resto.id} (${decodeEntities(resto.title)}) — ${imgs.length} photo(s)`);
        const photos = [];
        for (let k = 0; k < imgs.length; k++) {
            const f = path.join(dirPath, imgs[k]);
            const ext = path.extname(f).toLowerCase();
            const fileName = `resto_${resto.id}_${k + 1}_${Date.now()}${ext}`;
            const r = resizeForUpload(f);
            let url;
            try {
                ({ url } = await uploadImage(r.path, fileName, EXT_TYPE[ext]));
            } finally {
                if (r.tmp) { try { fs.unlinkSync(r.path); } catch { /* */ } }
            }
            if (!url) throw new Error('URL manquante après upload');
            photos.push(toProxyUrl(url));
            console.log(`   ✅ ${imgs[k]} → ${url}`);
            if (k < imgs.length - 1) await sleep(600); // souffle entre 2 uploads WP

        }
        writeInfo(resto.id, photos);
        let mockOk = false;
        for (const mf of MOCKDATA_FILES) mockOk = patchMockDataById(mf, resto.id, photos) || mockOk;
        console.log(`   ${mockOk ? '✅ mockData.ts patché' : '⚠️ mockData non patché → lance "node sync-recipes.js"'} · restaurants-info.json à jour (${photos.length} photo(s)).`);
        moveTo(path.join(FOLDER, 'done'), dirPath);
        return true;
    } catch (e) {
        console.error(`   ❌ ${e.message}`);
        moveTo(path.join(FOLDER, 'erreurs'), dirPath);
        return false;
    }
}

function listSubdirs() {
    if (!fs.existsSync(FOLDER)) return [];
    return fs.readdirSync(FOLDER, { withFileTypes: true })
        .filter(d => d.isDirectory() && !['done', 'erreurs'].includes(d.name) && !d.name.startsWith('.'))
        .map(d => path.join(FOLDER, d.name));
}

async function scanOnce(restaurants) {
    if (!fs.existsSync(FOLDER)) {
        ensureDir(FOLDER);
        console.log(`📁 Dossier créé : ${FOLDER}\n   Crée un sous-dossier par restaurant (ex. "Il Venezia") et dépose les photos dedans.`);
        return 0;
    }
    const dirs = listSubdirs();
    if (dirs.length === 0) { console.log('Aucun sous-dossier restaurant à traiter.'); return 0; }
    let n = 0;
    for (const d of dirs) { if (await processDir(d, restaurants)) n++; }
    return n;
}

(async () => {
    const restaurants = loadRestaurants();
    console.log(`🗂️  ${restaurants.length} restaurants indexés. Dossier : ${FOLDER}\n   WordPress : ${WP_URL} (user ${USER}) · hôte public : ${WP_PUBLIC_HOST}`);
    await scanOnce(restaurants);
    if (WATCH) {
        console.log('\n👀 Surveillance active — crée un sous-dossier resto avec des photos (Ctrl+C pour arrêter).');
        let busy = false;
        fs.watch(FOLDER, async (_evt, fname) => {
            if (busy || !fname) return;
            const full = path.join(FOLDER, fname);
            setTimeout(async () => {
                try {
                    if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) return;
                    if (['done', 'erreurs'].includes(fname)) return;
                    busy = true;
                    await processDir(full, restaurants);
                } catch { /* */ } finally { busy = false; }
            }, 2500); // laisse le temps de déposer toutes les photos
        });
    } else {
        console.log('\n🎉 Terminé.');
    }
})();
