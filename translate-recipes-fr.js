/**
 * #13 — Traduit en FRANÇAIS tout contenu de recette qui n'est pas en français
 * (anglais, espagnol, ou autre langue) : ingrédients + étapes UNIQUEMENT.
 * Le TITRE est toujours conservé tel quel (jamais traduit).
 * Le texte déjà en français est conservé tel quel.
 *
 * Moteur : Groq (GROQ_API_KEY dans .env), modèle llama-3.3-70b-versatile.
 *
 * Usage :
 *   node translate-recipes-fr.js --dry            # liste les recettes à traduire (aucun appel IA)
 *   node translate-recipes-fr.js --limit 5        # traduit seulement 5 recettes (test)
 *   node translate-recipes-fr.js                  # traduit tout le nécessaire, réécrit mockData (desktop+mobile)
 *   node translate-recipes-fr.js --all            # force la traduction de TOUTES les recettes
 *
 * Réécrit src/data/mockData.ts ET src/mobile/data/mockData.ts.
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.TRANSLATE_GROQ_MODEL || 'llama-3.3-70b-versatile';
const DRY = process.argv.includes('--dry');
const ALL = process.argv.includes('--all');
const limArg = process.argv.indexOf('--limit');
const LIMIT = limArg !== -1 ? parseInt(process.argv[limArg + 1]) : Infinity;
const FILES = ['src/data/mockData.ts', 'src/mobile/data/mockData.ts'];

// Cache persistant des traductions : évite de re-traduire à chaque sync WordPress
// (clé = id + hash du texte source ; valeur = {title, ingredients, steps} en FR).
const crypto = require('crypto');
const CACHE_PATH = path.join(__dirname, 'translate-cache.json');
let CACHE = {};
try { CACHE = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch { CACHE = {}; }
function saveCache() { try { fs.writeFileSync(CACHE_PATH, JSON.stringify(CACHE, null, 0)); } catch { /* noop */ } }
function cacheKey(r) {
    // Le titre n'est jamais traduit → exclu de la clé de cache.
    const src = JSON.stringify([(r.ingredients || []).map(i => i.name || ''), r.steps || []]);
    return String(r.id) + ':' + crypto.createHash('sha1').update(src).digest('hex').slice(0, 12);
}

function bounds(t) { const m = t.indexOf('mockRecipes: Recipe[] ='); const i = t.indexOf('[', t.indexOf('=', m)); const j = t.lastIndexOf(']'); return [i, j]; }
function loadFile(p) { const t = fs.readFileSync(p, 'utf8'); const [i, j] = bounds(t); return { t, i, j, arr: JSON.parse(t.slice(i, j + 1)) }; }
function writeFile(p, f, arr) { fs.writeFileSync(p, f.t.slice(0, f.i) + JSON.stringify(arr, null, 4) + f.t.slice(f.j + 1)); }

// --- Détection "contient du non-français" -------------------------------
const FR = /[àâäéèêëîïôöùûüç]|\b(et|de|des|du|la|le|les|une|un|avec|sans|pour|dans|sur|au|aux|cuill[èe]re|po[êe]le|oeufs?|œufs?|farine|beurre|sucre|sel|poivre|m[ée]langer|ajouter|cuire|four|jusqu|[ée]minc|hach|r[ôo]ti|pr[ée]parer|verser|fouetter|r[ée]server)\b/i;
// NB : pas de "pour" (collision avec le français), pas de "cook/heat" seuls.
const EN = /\b(the|with|and|of|for|your|you|add|stir|bake|until|then|into|cups?|tbsp|tsp|teaspoons?|tablespoons?|ounces?|chicken|beef|pork|cheese|eggs|flour|dough|chopped|sliced|whisk|salt|pepper|fresh|garlic|onion|over|white rice|chili|crispy|crunchy|grilled|wrap|bowl|spicy|sweet|sauce pan)\b/i;
const ES = /\b(con|los|las|para|una|el|del|pollo|queso|huevos?|harina|az[úu]car|mantequilla|sal|pimienta|cebolla|ajo|cucharad(?:a|ita)s?|tazas?|mezclar|a[ñn]adir|hornear|hasta|sart[ée]n|picad[oa]s?|rebanad[oa]s?|carne|arroz|frijoles)\b/i;
// Détection basée UNIQUEMENT sur ingrédients + étapes (le titre n'est jamais traduit).
const allText = r => [...(r.ingredients || []).map(i => i.name || ''), ...(r.steps || [])].join('\n');
function needsTranslation(r) {
    if (ALL) return true;
    const txt = allText(r);
    const en = (txt.match(EN) ? 1 : 0), es = (txt.match(ES) ? 1 : 0), fr = (txt.match(FR) ? 1 : 0);
    // Candidat si marqueur étranger présent ET pas clairement dominé par le français.
    if (en || es) {
        // beaucoup de français + un seul mot ambigu → on traduit quand même par sécurité,
        // Groq laissera le FR inchangé. Mais si AUCUN marqueur étranger, on saute.
        return true;
    }
    return false;
}

// --- Appel Groq ---------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Sépare un préfixe non-textuel (emoji + retours/espaces) du texte à traduire,
// pour que Groq ne touche jamais aux emojis (il les corrompt/supprime sinon).
const splitPrefix = (s) => {
    const m = String(s || '').match(/^([^\p{L}\p{N}]*)([\s\S]*)$/u);
    return m ? [m[1], m[2]] : ['', String(s || '')];
};
async function translateRecipe(r, attempt = 0) {
    const ingParts = (r.ingredients || []).map(i => splitPrefix(i.name || ''));
    const stepParts = (r.steps || []).map(s => splitPrefix(s));
    const payload = {
        ingredients: ingParts.map(p => p[1]),
        steps: stepParts.map(p => p[1]),
    };
    const sys = "Tu es traducteur culinaire FR. On te donne un JSON {ingredients[], steps[]}. "
        + "Traduis en FRANÇAIS naturel TOUT ce qui n'est pas déjà en français (anglais, espagnol ou autre langue). "
        + "Ce qui est DÉJÀ en français : recopie-le À L'IDENTIQUE, ne le reformule pas. "
        + "Conserve EXACTEMENT le même nombre d'éléments dans ingredients et steps, et le même ordre. "
        + "Garde les quantités/nombres/unités. Ne traduis pas les noms propres de marques. "
        + "Réponds UNIQUEMENT par un JSON valide de la même forme {ingredients, steps}, sans texte autour.";
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
            model: GROQ_MODEL,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify(payload) }],
        }),
    });
    if (res.status === 429 || res.status >= 500) {
        if (attempt < 5) { await sleep(2000 * (attempt + 1)); return translateRecipe(r, attempt + 1); }
        throw new Error(`Groq ${res.status} (abandon après retries)`);
    }
    if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const data = await res.json();
    const out = JSON.parse(data.choices[0].message.content);
    // Validation stricte : mêmes longueurs, sinon on garde l'original.
    if (!out
        || !Array.isArray(out.ingredients) || out.ingredients.length !== payload.ingredients.length
        || !Array.isArray(out.steps) || out.steps.length !== payload.steps.length) {
        throw new Error('réponse de forme invalide');
    }
    // Réattache les préfixes (emoji + espaces) d'origine. Le titre n'est jamais touché.
    return {
        ingredients: out.ingredients.map((v, k) => ingParts[k][0] + String(v)),
        steps: out.steps.map((v, k) => stepParts[k][0] + String(v)),
    };
}

// --- Concurrence limitée ------------------------------------------------
async function pool(items, n, worker) {
    const ret = []; let idx = 0;
    const runners = Array.from({ length: n }, async () => {
        while (idx < items.length) { const k = idx++; ret[k] = await worker(items[k], k); }
    });
    await Promise.all(runners);
    return ret;
}

(async () => {
    if (!DRY && !GROQ_KEY) { console.error('❌ GROQ_API_KEY manquant dans .env'); process.exit(1); }

    // Charge desktop comme source de vérité, mobile pour réappliquer par id.
    const desk = loadFile(FILES[0]);
    const mob = loadFile(FILES[1]);

    // Sélection des recettes à traduire (sur desktop), dédupliquées.
    const idsArg = process.argv.indexOf('--ids');
    let candidates;
    if (idsArg !== -1 && process.argv[idsArg + 1]) {
        const set = new Set(process.argv[idsArg + 1].split(','));
        candidates = desk.arr.filter(r => set.has(String(r.id)));
    } else {
        candidates = desk.arr.filter(needsTranslation);
    }
    console.log(`🌍 ${candidates.length}/${desk.arr.length} recettes à traduire (non-FR détecté).`);
    if (DRY) {
        candidates.slice(0, 60).forEach(r => console.log('  -', r.id, '|', r.title));
        if (candidates.length > 60) console.log(`  … +${candidates.length - 60} autres`);
        return;
    }
    candidates = candidates.slice(0, LIMIT);

    const cache = new Map(); // id → {title, ingredients, steps} (à appliquer)
    let okN = 0, errN = 0, hitN = 0, done = 0;
    const CONC = parseInt(process.env.TRANSLATE_CONCURRENCY || '2');
    const THROTTLE = parseInt(process.env.TRANSLATE_THROTTLE_MS || '900'); // anti-429 (free tier)

    // 1) Cache hits d'abord (gratuit, instantané) → ne reste que le vrai nouveau à traduire via Groq.
    const toTranslate = [];
    candidates.forEach(r => {
        const hit = CACHE[cacheKey(r)];
        if (hit) { cache.set(String(r.id), hit); hitN++; }
        else toTranslate.push(r);
    });
    if (hitN) console.log(`  ⚡ ${hitN} depuis le cache (aucun appel IA).`);
    console.log(`  🤖 ${toTranslate.length} à traduire via Groq.`);

    const translatedIds = []; // recettes réellement traduites ce run → à pousser sur WordPress
    await pool(toTranslate, CONC, async (r) => {
        try {
            const tr = await translateRecipe(r);
            cache.set(String(r.id), tr);
            CACHE[cacheKey(r)] = tr; // mémorise pour les prochaines syncs
            saveCache();
            translatedIds.push(String(r.id));
            okN++;
        } catch (e) {
            console.error(`  ❌ #${r.id} "${r.title}" : ${e.message}`);
            errN++;
        }
        await sleep(THROTTLE);
        if (++done % 10 === 0) console.log(`  … ${done}/${toTranslate.length}`);
    });
    saveCache();

    // Applique aux deux fichiers (par id).
    const apply = (arr) => {
        arr.forEach(r => {
            const tr = cache.get(String(r.id));
            if (!tr) return;
            // Le titre est volontairement laissé intact.
            (r.ingredients || []).forEach((ing, k) => { if (tr.ingredients[k] != null) ing.name = tr.ingredients[k]; });
            if (Array.isArray(r.steps)) r.steps = r.steps.map((s, k) => (tr.steps[k] != null ? tr.steps[k] : s));
        });
    };
    apply(desk.arr); apply(mob.arr);
    writeFile(FILES[0], desk, desk.arr);
    writeFile(FILES[1], mob, mob.arr);
    // Liste des ids traduits ce run → consommée par translate-wp-content.js pour
    // répercuter la traduction (ingrédients + étapes) sur WordPress lui-même.
    // Union avec l'éventuel fichier existant (cas des 2 passes successives en CI).
    try {
        const wbPath = path.join(__dirname, 'wp-writeback-ids.txt');
        let prev = [];
        try { prev = fs.readFileSync(wbPath, 'utf8').split(',').map(s => s.trim()).filter(Boolean); } catch { /* fichier absent */ }
        const merged = [...new Set([...prev, ...translatedIds])];
        fs.writeFileSync(wbPath, merged.join(','));
    } catch { /* noop */ }
    console.log(`\n✅ Traduit : ${okN} | erreurs : ${errN}. Fichiers mockData (desktop+mobile) mis à jour.`);
    if (translatedIds.length) console.log(`   → ${translatedIds.length} id(s) à répercuter sur WordPress : wp-writeback-ids.txt`);
})();
