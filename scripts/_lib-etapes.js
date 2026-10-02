#!/usr/bin/env node
/**
 * Rend leurs étapes aux recettes qui n'en ont pas.
 * ===============================================
 *
 * 177 recettes du catalogue ne portent qu'une ligne : « Suivre les instructions
 * détaillées dans la vidéo ». Leur temps de préparation tombe alors à 3 min,
 * puisqu'il est CALCULÉ depuis les étapes.
 *
 * Ce n'est pas la faute des vidéos. Le robot d'import n'envoie à l'IA que le
 * titre et la description TikTok ; quand cette description n'a pas été
 * récupérée au moment de la publication, il ne reste rien à extraire. Or la
 * description existe toujours, et l'oEmbed de TikTok la rend sans clé ni
 * cookie : mesuré sur 50 de ces recettes, 39 y portent leurs ingrédients et
 * souvent leurs étapes.
 *
 * On relit donc la description, on en tire la recette, et on la réécrit DANS
 * WORDPRESS — jamais dans le catalogue. `sync-recipes.js` reconstruit
 * `mockData` depuis les articles : corriger le catalogue seul serait effacé à
 * la synchronisation suivante.
 *
 * Les temps se corrigent d'eux-mêmes : dès que les étapes existent,
 * `estimateRecipeTiming` les relit.
 *
 * Usage
 * -----
 *   node scripts/recuperer-etapes-tiktok.js --lot 10            # propose, n'écrit rien
 *   node scripts/recuperer-etapes-tiktok.js --lot 10 --debut 10 # le lot suivant
 *   node scripts/recuperer-etapes-tiktok.js --lot 10 --ecrire   # écrit dans WordPress
 *   node scripts/recuperer-etapes-tiktok.js --ids 4117,3597
 *
 * Sans `--ecrire`, RIEN n'est modifié : le script montre ce qu'il propose.
 */
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');

function chargerEnv(fichier) {
    if (!fs.existsSync(fichier)) return;
    for (const ligne of fs.readFileSync(fichier, 'utf8').split('\n')) {
        const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
}
chargerEnv(path.join(RACINE, '.env.local'));
chargerEnv(path.join(RACINE, 'tiktok-bot', '.env'));

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const opt = (n) => process.argv.includes(n);

/* ── Les recettes concernées ─────────────────────────────────────────────── */

const REPLI = /vid[ée]o|ne sont pas d[ée]taill[ée]es|aucune [ée]tape/i;

/**
 * Lit le catalogue sans passer par TypeScript : on n'a besoin que de quatre
 * champs. Le tableau commence à `export const mockRecipes ... = [` — chercher
 * le premier crochet du fichier tombait sur un type déclaré plus haut.
 */
function catalogue() {
    const src = fs.readFileSync(path.join(RACINE, 'src', 'mobile', 'data', 'mockData.ts'), 'utf8');
    // `= [` et non `[` : le premier crochet après l'ancre est celui du TYPE
    // (`mockRecipes: Recipe[] = [`), ce qui donnait un « [] = [ » illisible.
    const ancre = src.indexOf('mockRecipes');
    const debut = src.indexOf('= [', ancre) + 2;
    return JSON.parse(src.slice(debut, src.lastIndexOf(']') + 1));
}

const idTikTok = (html) =>
    (String(html || '').match(/video\/(\d{15,25})/) || String(html || '').match(/data-video-id="(\d+)"/) || [])[1] || null;

function aRattraper(recettes) {
    return recettes.filter((r) => {
        const st = r.steps || [];
        return st.length <= 1 && st.some((s) => REPLI.test(s)) && idTikTok(r.videoHtml);
    });
}

/* ── La description TikTok ───────────────────────────────────────────────── */

async function descriptionTikTok(tiktokId) {
    const url = `https://www.tiktok.com/@t/video/${tiktokId}`;
    try {
        const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
        if (r.ok) return ((await r.json()).title || '').trim();
    } catch { /* réseau : on renonce pour cette recette */ }
    return '';
}

/* ── L'extraction, par une IA gratuite ───────────────────────────────────── */

const CONSIGNE = `Tu reçois la description d'une vidéo de cuisine TikTok, écrite par l'auteur de la recette.
Extrais-en la recette et réponds UNIQUEMENT par du JSON, sans texte autour :
{"ingredients":[{"quantity":"200 g","name":"farine"}],"steps":["Étape en français.","..."]}

Règles :
- TOUT en français, même si la description est dans une autre langue. Traduis.
- "quantity" : la quantité telle qu'écrite ("2", "200 g", "1 c. à soupe"). Vide si l'auteur n'en donne pas.
- "name" : le seul nom de l'ingrédient, sans la quantité.
- "steps" : une phrase par étape, à l'impératif, dans l'ordre. Reprends les durées et les températures quand elles sont dites.
- N'INVENTE RIEN. Si la description ne donne pas les étapes, renvoie "steps":[] — mais donne quand même les ingrédients si elle les liste.
- Ignore les mots-dièse, les mentions de comptes et les appels à s'abonner.`;

/** Extrait le premier objet JSON d'une réponse, même mal emballée. */
function lireJson(brut) {
    try { return JSON.parse(brut); } catch { /* on cherche à la main */ }
    const d = brut.indexOf('{');
    if (d < 0) return null;
    let p = 0;
    for (let i = d; i < brut.length; i++) {
        if (brut[i] === '{') p++;
        else if (brut[i] === '}' && --p === 0) {
            try { return JSON.parse(brut.slice(d, i + 1)); } catch { return null; }
        }
    }
    return null;
}

async function extraire(titre, description) {
    const compte = process.env.CF_ACCOUNT_ID;
    const jeton = process.env.CF_API_TOKEN;
    if (!compte || !jeton) throw new Error('clés Cloudflare absentes');
    const modele = process.env.CF_TEXT_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    const rep = await fetch(`https://api.cloudflare.com/client/v4/accounts/${compte}/ai/run/${modele}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
        body: JSON.stringify({
            max_tokens: 1600,
            temperature: 0.2,
            messages: [
                { role: 'system', content: CONSIGNE },
                { role: 'user', content: `Titre : ${titre}\n\nDescription :\n${description.slice(0, 4000)}` },
            ],
        }),
    });
    if (!rep.ok) throw new Error(`Cloudflare ${rep.status} — ${(await rep.text()).slice(0, 160)}`);
    const d = await rep.json();
    /*
     * Deux formes de réponse chez Cloudflare selon le modèle : les uns rendent
     * `result.response`, les autres le format OpenAI (`result.choices[0]
     * .message.content`). Llama 3.3 est du second type — on lisait donc
     * `undefined`, et chaque recette tombait en « brut.indexOf is not a
     * function ».
     */
    const texte = d?.result?.response
        ?? d?.result?.choices?.[0]?.message?.content
        ?? '';
    const parse = lireJson(texte);
    if (!parse) throw new Error('réponse illisible');
    return {
        ingredients: Array.isArray(parse.ingredients) ? parse.ingredients.filter((i) => i && i.name) : [],
        steps: Array.isArray(parse.steps) ? parse.steps.filter((s) => typeof s === 'string' && s.trim().length > 3) : [],
    };
}


module.exports={extraire,descriptionTikTok,catalogue,aRattraper,idTikTok,lireJson};
