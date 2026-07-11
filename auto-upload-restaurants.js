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
const { execFileSync, execSync } = require('child_process');
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

// Renomme les fichiers du dossier en 1,2,3… selon l'ordre voulu (ordre de dépôt).
// La photo « 1 » devient l'image principale + l'image à la une. Renommage en 2 temps
// (noms temporaires d'abord) pour éviter d'écraser un fichier déjà nommé "1.jpg".
// Renvoie la liste des nouveaux noms dans l'ordre ; en cas d'échec, renvoie l'entrée.
function renumberFiles(dir, orderedNames) {
    try {
        const tmps = orderedNames.map((f, k) => {
            const ext = path.extname(f).toLowerCase();
            const tmp = `.__reorder_${k}${ext}`;
            fs.renameSync(path.join(dir, f), path.join(dir, tmp));
            return { tmp, ext };
        });
        return tmps.map((x, k) => {
            const final = `${k + 1}${x.ext}`;
            fs.renameSync(path.join(dir, x.tmp), path.join(dir, final));
            return final;
        });
    } catch (e) {
        console.log('   ⚠️ renommage 1/2/3 impossible :', e.message);
        return orderedNames;
    }
}

// Normalisation photo AVANT upload (sips, natif macOS).
// CONTRAINTE CLÉ : le serveur WP hangue (timeout) au-delà de ~150-200KB par image.
// → on vise une TAILLE DE FICHIER cible (TARGET_BYTES) en baissant la qualité JPEG par
//   paliers jusqu'à passer sous le budget. On RÉDUIT les images trop grandes, mais on
//   n'AGRANDIT JAMAIS (un upscale ne gagne aucun détail et ne fait qu'alourdir le poids
//   → repassait au-dessus de la limite WP → c'était la cause des timeouts).
//   Le cadre d'affichage fait ~544px (desktop) / ~340px (mobile) : ~1280px de grand côté
//   reste net en retina tout en tenant sous le budget.
// Renvoie {path, tmp, ext, mime} ; tmp=true → fichier temporaire à supprimer.
const MAX_DIM = Number(process.env.RESTO_MAX_DIM) || 1280;
const TARGET_BYTES = Number(process.env.RESTO_MAX_BYTES) || 200 * 1024; // plafond upload WP fiable
// Candidats (grand côté, qualité) du meilleur au plus léger : on prend le PREMIER qui
// tient sous TARGET_BYTES. sips ré-encode assez lourd → une seule baisse de qualité ne
// suffit pas pour les grandes photos, il faut aussi réduire la dimension.
const DIMS = [1280, 1080, 950, 820, 700];
const QS = [80, 68, 58];

function imgLongSide(src) {
    try {
        const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', src], { encoding: 'utf8' });
        const w = Number((out.match(/pixelWidth:\s*(\d+)/) || [])[1]);
        const h = Number((out.match(/pixelHeight:\s*(\d+)/) || [])[1]);
        if (w && h) return Math.max(w, h);
    } catch { /* sips absent */ }
    return 0;
}

function encodeJpeg(src, dim, q) {
    const tmp = path.join(os.tmpdir(), `resto_up_${Date.now()}_${dim}_${q}.jpg`);
    const args = ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(q)];
    if (dim > 0) args.push('-Z', String(dim));
    args.push(src, '--out', tmp);
    execFileSync('sips', args, { stdio: 'ignore' });
    if (fs.existsSync(tmp) && fs.statSync(tmp).size > 0) return { path: tmp, tmp: true, ext: '.jpg', mime: 'image/jpeg', bytes: fs.statSync(tmp).size };
    return null;
}

function resizeForUpload(src) {
    try {
        const long = imgLongSide(src);
        // Déjà sous le budget ET pas trop grande → garder l'original tel quel.
        if (fs.statSync(src).size <= TARGET_BYTES && (!long || long <= MAX_DIM)) return { path: src, tmp: false };
        // Balaye (dimension, qualité) du meilleur au plus léger ; garde le 1er ≤ budget.
        let best = null; // plus petit obtenu (repli si aucun ne tient le budget)
        for (const d of DIMS) {
            if (long && d > long) continue; // jamais d'upscale
            for (const q of QS) {
                const cand = encodeJpeg(src, d, q);
                if (!cand) continue;
                if (cand.bytes <= TARGET_BYTES) {
                    if (best && best.tmp) { try { fs.unlinkSync(best.path); } catch { /* */ } }
                    return cand; // 1er sous le budget = meilleur compromis qualité/poids
                }
                if (!best || cand.bytes < best.bytes) {
                    if (best && best.tmp) { try { fs.unlinkSync(best.path); } catch { /* */ } }
                    best = cand;
                } else if (cand.tmp) { try { fs.unlinkSync(cand.path); } catch { /* */ } }
            }
        }
        if (best) return best; // aucun sous budget → le plus léger obtenu
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
    const TIMEOUT = Number(process.env.WP_TIMEOUT_MS) || 120000; // WP lent/instable → 120s
    const MAX_TRIES = Number(process.env.WP_MAX_TRIES) || 5;     // hangs aléatoires → plus de tentatives
    let lastErr;
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
        try {
            return await uploadImageOnce(base64, fileName, mimeType, TIMEOUT);
        } catch (e) {
            lastErr = e;
            const why = e.name === 'AbortError' ? `timeout ${TIMEOUT}ms` : e.message;
            console.log(`   ⏳ tentative ${attempt}/${MAX_TRIES} échouée (${why})${attempt < MAX_TRIES ? ' — nouvel essai…' : ''}`);
            if (attempt < MAX_TRIES) await sleep(3000 * attempt); // backoff croissant : laisse WP respirer
        }
    }
    throw lastErr;
}

// Définit l'IMAGE À LA UNE du post <postId> = pièce jointe <attachmentId> (photo n°1).
// → la vignette de la CARTE (recipe.image = featured media WP) affiche la 1re photo,
//   de façon DURABLE : sync-recipes.js relit le featured media à chaque synchro.
async function setFeaturedImage(postId, attachmentId) {
    const xml = `<?xml version="1.0"?>
<methodCall><methodName>wp.editPost</methodName><params>
<param><value><int>1</int></value></param>
<param><value><string>${USER}</string></value></param>
<param><value><string>${PASS}</string></value></param>
<param><value><int>${postId}</int></value></param>
<param><value><struct>
<member><name>post_thumbnail</name><value><int>${attachmentId}</int></value></member>
</struct></value></param>
</params></methodCall>`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Number(process.env.WP_TIMEOUT_MS) || 90000);
    try {
        const res = await fetch(WP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml, signal: ctrl.signal });
        const text = await res.text();
        if (/<fault>/.test(text)) throw new Error('WP fault: ' + (text.match(/<string>([^<]+)<\/string>/) || [])[1]);
        return true;
    } finally {
        clearTimeout(timer);
    }
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

// Met à jour l'objet "restaurant" du post <id> dans mockData.ts en re-sérialisant
// (parse → set restaurant = restaurants-info[id] → JSON.stringify). Robuste quel
// que soit le formatage (single ou multi-ligne) — l'ancien regex single-line
// échouait quand un linter dépliait les objets en multi-ligne.
function patchMockDataById(file, id /*, photos (déjà dans restaurants-info) */) {
    if (!fs.existsSync(file)) return false;
    try {
        const info = JSON.parse(fs.readFileSync(INFO_PATH, 'utf8'));
        const t = fs.readFileSync(file, 'utf8');
        const mi = t.indexOf('export const mockRecipes: Recipe[] =');
        const b = t.indexOf('[', t.indexOf('=', mi));
        const e = t.lastIndexOf(']');
        const arr = JSON.parse(t.slice(b, e + 1));
        const r = arr.find(x => String(x.id) === String(id));
        if (!r) return false;
        const inf = info[String(id)];
        r.restaurant = inf;
        if (inf && inf.address) r.address = inf.address;
        // Vignette carte immédiate = photo mise en avant (champ `cover`, défaut 1).
        if (inf && Array.isArray(inf.photos) && inf.photos.length) {
            const idx = Math.min(Math.max(1, inf.cover || 1), inf.photos.length) - 1;
            r.image = inf.photos[idx];
        }
        fs.writeFileSync(file, t.slice(0, b) + JSON.stringify(arr, null, 4) + t.slice(e + 1));
        return true;
    } catch (err) {
        console.log('   ⚠️ patch mockData :', err.message);
        return false;
    }
}

// Pousse les données mises à jour sur GitHub → déploiement Vercel automatique.
// Sûr : commit + push ; si rejeté (le bot a poussé), rebase puis retry ; en cas
// de conflit, abort propre (jamais d'état git cassé) + message.
const updatedRestos = [];
function pushToGithub(summary) {
    const opts = { cwd: __dirname, stdio: 'pipe', encoding: 'utf8' };
    const run = (c) => execSync(c, opts);
    console.log('\n🔄 Synchronisation GitHub (déploiement Vercel)…');
    try {
        run('git add src/data/mockData.ts src/mobile/data/mockData.ts src/data/restaurants-info.json');
        try { run('git diff --cached --quiet'); console.log('   (aucun changement à pousser)'); return; } catch { /* il y a des changements */ }
        run(`git commit -m ${JSON.stringify('📸 Photos resto: ' + summary)}`);
    } catch (e) {
        console.log('   ⚠️ commit échoué :', (e.message || '').split('\n')[0]);
        return;
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            run('git push origin main');
            console.log('   ✅ Poussé sur GitHub → Vercel déploie (~2 min).');
            return;
        } catch {
            try {
                run('git pull --rebase origin main'); // le bot a poussé entre-temps → rejoue par-dessus
            } catch {
                try { run('git rebase --abort'); } catch { /* */ }
                console.log('   ⚠️ Conflit git : photos enregistrées en local, mais push auto impossible.\n      → fais un "git push" manuel plus tard.');
                return;
            }
        }
    }
    console.log('   ⚠️ Push non abouti après 3 essais — pousse manuellement.');
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
    // Ordre = ordre de DÉPÔT dans le dossier (date de création), pas alphabétique.
    // → tu déposes les photos dans l'ordre voulu, la 1re devient la photo principale.
    const dropped = fs.readdirSync(dirPath)
        .filter(f => EXT_TYPE[path.extname(f).toLowerCase()] && !f.startsWith('.'))
        .map(f => { let t = 0; try { const s = fs.statSync(path.join(dirPath, f)); t = s.birthtimeMs || s.mtimeMs || 0; } catch { /* */ } return { f, t }; })
        .sort((a, b) => (a.t - b.t) || naturalSort(a.f, b.f))
        .map(x => x.f);
    if (dropped.length === 0) {
        console.log(`⚠️  "${name}" → aucune image dans le dossier. (ignoré)`);
        return false;
    }
    // Renomme physiquement en 1,2,3… dans l'ordre de dépôt (photo 1 = à la une).
    const imgs = renumberFiles(dirPath, dropped);
    try {
        console.log(`📸 "${name}" → restaurant #${resto.id} (${decodeEntities(resto.title)}) — ${imgs.length} photo(s)`);
        const photos = [];
        let firstMediaId = null;
        for (let k = 0; k < imgs.length; k++) {
            const f = path.join(dirPath, imgs[k]);
            const r = resizeForUpload(f);
            const upExt = r.ext || path.extname(f).toLowerCase();
            const upMime = r.mime || EXT_TYPE[upExt] || 'image/jpeg';
            const fileName = `resto_${resto.id}_${k + 1}_${Date.now()}${upExt}`;
            let up;
            try {
                up = await uploadImage(r.path, fileName, upMime);
            } finally {
                if (r.tmp) { try { fs.unlinkSync(r.path); } catch { /* */ } }
            }
            if (!up || !up.url) throw new Error('URL manquante après upload');
            if (k === 0) firstMediaId = up.id; // photo 1 → image à la une
            photos.push(toProxyUrl(up.url));
            console.log(`   ✅ ${imgs[k]} → ${up.url}`);
            if (k < imgs.length - 1) await sleep(1500); // souffle entre 2 uploads (WP se surcharge si trop rapide)

        }
        // Image à la une du post = photo 1 → vignette de la carte (durable au sync).
        if (firstMediaId) {
            try {
                await setFeaturedImage(resto.id, firstMediaId);
                console.log(`   🖼️ Image à la une définie (photo 1, média #${firstMediaId}) → vignette carte.`);
            } catch (e) {
                console.log(`   ⚠️ Image à la une non définie (${e.message}). Vignette locale posée quand même.`);
            }
        }
        writeInfo(resto.id, photos);
        let mockOk = false;
        for (const mf of MOCKDATA_FILES) mockOk = patchMockDataById(mf, resto.id, photos) || mockOk;
        console.log(`   ${mockOk ? '✅ mockData.ts patché' : '⚠️ mockData non patché → lance "node sync-recipes.js"'} · restaurants-info.json à jour (${photos.length} photo(s)).`);
        moveTo(path.join(FOLDER, 'done'), dirPath);
        updatedRestos.push(decodeEntities(resto.title));
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
    // Push auto des restos traités → le site se met à jour tout seul.
    if (updatedRestos.length) pushToGithub(updatedRestos.join(', '));
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
                    const before = updatedRestos.length;
                    await processDir(full, restaurants);
                    if (updatedRestos.length > before) pushToGithub(updatedRestos[updatedRestos.length - 1]);
                } catch { /* */ } finally { busy = false; }
            }, 2500); // laisse le temps de déposer toutes les photos
        });
    } else if (updatedRestos.length) {
        console.log('\n🎉 Terminé.');
    } else {
        // Rien n'a été uploadé : soit aucun sous-dossier, soit tout a échoué.
        // On sort en code 3 → le .command GARDE la fenêtre ouverte (au lieu de la
        // fermer automatiquement) pour que tu puisses lire ce qui s'est passé.
        console.log('\n⚠️  Rien à uploader.');
        console.log(`   → Vérifie qu'un sous-dossier resto (avec ses photos) est bien dans :\n     ${FOLDER}`);
        console.log('   (les dossiers déjà traités sont dans "done", les échecs dans "erreurs")');
        process.exitCode = 3;
    }
})();
