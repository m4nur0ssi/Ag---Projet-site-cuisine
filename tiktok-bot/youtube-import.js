/**
 * Import d'une recette depuis une vidéo YouTube (réutilisable).
 * Utilisé par : add-youtube-recipe.js (CLI local) ET github-runner.js (file d'attente cloud).
 *
 * importYouTubeRecipe({ url, country, status }) :
 *   - extrait titre + description (oEmbed + page)
 *   - génère la recette via Claude (FR)
 *   - publie sur WordPress (embed YouTube + miniature)
 *   → renvoie le NOM de la recette (string) en cas de succès, sinon null.
 */
const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/.env' });
const { callClaude } = require('./claude-config');
const { callGemini } = require('./gemini-config');
const { postToWordPress, extractYouTubeId } = require('./wordpress-poster');

// Appel Groq (gratuit) en JSON forcé.
async function callGroqJson(prompt) {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'Tu es un assistant culinaire qui répond UNIQUEMENT par un JSON valide.' },
                { role: 'user', content: prompt },
            ],
        }),
        timeout: 45000,
    });
    if (!res.ok) throw new Error('Groq ' + res.status + ': ' + (await res.text()).slice(0, 120));
    const j = await res.json();
    return JSON.parse(j.choices[0].message.content);
}

// Génère la recette via IA — Groq (gratuit) en priorité, puis Gemini, puis Claude.
async function generateRecipe(prompt) {
    const parse = (r) => {
        if (!r) return null;
        if (typeof r === 'object') return r;
        try { return JSON.parse(String(r).replace(/^```json\s*|\s*```$/g, '').trim()); } catch { return null; }
    };
    try { const q = parse(await callGroqJson(prompt)); if (q) return q; }
    catch (e) { console.warn('   ⚠️ Groq KO, essai suivant :', e.message); }
    if (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY) {
        try { const g = parse(await callGemini(prompt, 'gemini-2.0-flash', true)); if (g) return g; }
        catch (e) { console.warn('   ⚠️ Gemini KO, essai suivant :', e.message); }
    }
    if (process.env.ANTHROPIC_API_KEY) {
        try { const c = parse(await callClaude(prompt)); if (c) return c; }
        catch (e) { console.warn('   ⚠️ Claude KO :', e.message); }
    }
    return null;
}

async function fetchMeta(cleanUrl) {
    let title = '', author = '', description = '';
    try {
        const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`, { timeout: 15000 });
        if (r.ok) { const j = await r.json(); title = j.title || ''; author = j.author_name || ''; }
    } catch { /* noop */ }
    try {
        const r = await fetch(cleanUrl, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'fr,en' } });
        const html = await r.text();
        const m = html.match(/"shortDescription":"((?:\\.|[^"\\])*)"/);
        if (m) { try { description = JSON.parse('"' + m[1] + '"'); } catch { description = m[1]; } }
        if (!title) { const t = html.match(/<title>([^<]*)<\/title>/i); if (t) title = t[1].replace(/ - YouTube$/, '').trim(); }
    } catch { /* noop */ }
    return { title, author, description };
}

function buildPrompt(meta) {
    return `Tu es un assistant culinaire. À partir des infos d'une vidéo de recette YouTube ci-dessous, génère une recette structurée EN FRANÇAIS.
Si le contenu est dans une autre langue, traduis ingrédients et étapes en français naturel.

TITRE VIDÉO: ${meta.title}
CHAÎNE: ${meta.author}
DESCRIPTION:
${(meta.description || '').slice(0, 4000)}

Format JSON attendu (réponds UNIQUEMENT par ce JSON, sans texte autour) :
{
  "title": "Titre de recette court et appétissant en français",
  "summary": "1-2 phrases d'accroche en français",
  "category": "plats|entrees|desserts|patisserie|aperitifs|rafraichissements|glaces",
  "country": "France|Italie|Espagne|Portugal|Grèce|Liban|USA|Mexique|Orient|Asie|Afrique|Autre",
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "difficulty": "facile|moyen|difficile",
  "ingredients": [{"quantity": "", "name": "200 g de farine"}],
  "steps": ["Étape 1 détaillée", "Étape 2 détaillée"]
}
Mets toute la quantité dans "name" (laisse "quantity" vide). Si la description ne contient pas la recette complète, déduis une version plausible et fidèle au titre.`;
}

async function importYouTubeRecipe({ url, country = '', status = 'publish' }) {
    const videoId = extractYouTubeId(url);
    if (!videoId) { console.error('   ❌ URL YouTube invalide :', url); return null; }
    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`🎬 YouTube : ${cleanUrl}`);

    const meta = await fetchMeta(cleanUrl);
    if (!meta.title) { console.error('   ❌ Titre vidéo introuvable.'); return null; }
    console.log(`   Titre : ${meta.title} | description : ${meta.description ? meta.description.length + ' car.' : 'aucune'}`);

    const data = await generateRecipe(buildPrompt(meta));
    if (!data || !data.title || !Array.isArray(data.ingredients) || !Array.isArray(data.steps)) {
        console.error('   ❌ Réponse IA invalide (Gemini + Claude indisponibles).'); return null;
    }
    console.log(`   ✅ "${data.title}" — ${data.ingredients.length} ingrédients, ${data.steps.length} étapes`);

    // La catégorie choisie dans le raccourci (country) prime sur celle déduite par l'IA.
    const chosen = (country || '').trim();
    const recipe = {
        title: data.title,
        summary: data.summary || '',
        category: data.category || 'plats',
        manualCountry: chosen || (data.country && data.country !== 'Autre' ? data.country : ''),
        prepTime: data.prepTime, cookTime: data.cookTime, servings: data.servings,
        difficulty: data.difficulty || 'moyen',
        ingredients: data.ingredients,
        steps: data.steps,
        youtubeUrl: cleanUrl,
        photoUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        status,
        tags: [],
    };

    console.log(`📡 Publication WordPress (${status})…`);
    const res = await postToWordPress(recipe);
    if (res?.success) { console.log(`   ✅ Publié #${res.postId}`); return data.title; }
    console.error('   ❌ Échec publication :', res?.error || res);
    return null;
}

module.exports = { importYouTubeRecipe, fetchMeta };
