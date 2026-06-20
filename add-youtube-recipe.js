/**
 * Ajoute une recette depuis une vidéo YouTube — usage EXCEPTIONNEL, en local sur Mac.
 * Même logique que le raccourci TikTok : extrait titre + description + (sous-titres si
 * dispo) → l'IA génère titre/résumé/ingrédients/étapes → publie sur WordPress (statut
 * "publish") avec l'embed YouTube + la miniature en image à la une.
 * Le webhook WordPress déclenche ensuite la sync → mockData → site Vercel.
 *
 * Usage :
 *   node add-youtube-recipe.js "https://www.youtube.com/watch?v=XXXXXXXXXXX"
 *   node add-youtube-recipe.js "https://youtu.be/XXXXXXXXXXX" --draft   # brouillon
 *
 * Clés : tiktok-bot/.env (ANTHROPIC_API_KEY, WP_USERNAME, WP_PASSWORD, WP_URL).
 */
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: path.join(__dirname, 'tiktok-bot', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { callClaude } = require('./tiktok-bot/claude-config');
const { postToWordPress, extractYouTubeId } = require('./tiktok-bot/wordpress-poster');
if (!process.env.WP_URL) process.env.WP_URL = 'http://109.221.250.122/wordpress';

const url = process.argv[2];
const DRAFT = process.argv.includes('--draft');
if (!url || !extractYouTubeId(url)) {
    console.error('Usage : node add-youtube-recipe.js "<url YouTube>" [--draft]');
    process.exit(1);
}
const videoId = extractYouTubeId(url);
const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

async function fetchMeta() {
    let title = '', author = '', description = '';
    // Titre + auteur via oEmbed (fiable, sans clé)
    try {
        const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`, { timeout: 15000 });
        if (r.ok) { const j = await r.json(); title = j.title || ''; author = j.author_name || ''; }
    } catch { /* noop */ }
    // Description depuis la page (shortDescription dans le JSON intégré)
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

(async () => {
    if (!process.env.ANTHROPIC_API_KEY) { console.error('❌ ANTHROPIC_API_KEY manquante (tiktok-bot/.env).'); process.exit(1); }
    console.log(`🎬 YouTube : ${cleanUrl}`);
    const meta = await fetchMeta();
    if (!meta.title) { console.error('❌ Impossible de lire la vidéo (titre introuvable).'); process.exit(1); }
    console.log(`   Titre vidéo : ${meta.title}`);
    console.log(`   Description : ${meta.description ? meta.description.length + ' caractères' : 'aucune'}`);

    console.log('🤖 Génération de la recette via Claude…');
    let data = await callClaude(buildPrompt(meta));
    if (typeof data === 'string') { try { data = JSON.parse(data.replace(/^```json\s*|\s*```$/g, '')); } catch { data = null; } }
    if (!data || !data.title || !Array.isArray(data.ingredients) || !Array.isArray(data.steps)) {
        console.error('❌ Réponse IA invalide.'); console.error(data); process.exit(1);
    }
    console.log(`   ✅ "${data.title}" — ${data.ingredients.length} ingrédients, ${data.steps.length} étapes`);

    const recipe = {
        title: data.title,
        summary: data.summary || '',
        category: data.category || 'plats',
        manualCountry: data.country && data.country !== 'Autre' ? data.country : '',
        prepTime: data.prepTime, cookTime: data.cookTime, servings: data.servings,
        difficulty: data.difficulty || 'moyen',
        ingredients: data.ingredients,
        steps: data.steps,
        youtubeUrl: cleanUrl,
        photoUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        status: DRAFT ? 'draft' : 'publish',
        tags: [],
    };

    console.log(`📡 Publication sur WordPress (${recipe.status})…`);
    const res = await postToWordPress(recipe);
    if (res?.success) {
        console.log(`\n✅ Publié ! Post WordPress #${res.postId}`);
        console.log('   → Le webhook WordPress va déclencher la sync vers le site (Vercel).');
        console.log('   → Sinon, force la propagation : node sync-recipes.js');
    } else {
        console.error('❌ Échec publication :', res?.error || res);
        process.exit(1);
    }
})();
