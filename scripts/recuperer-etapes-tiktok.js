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

/**
 * Celles qui n'ont même pas leurs INGRÉDIENTS.
 *
 * Elles portent « Ingrédients détaillés dans la vidéo » : la liste de courses,
 * le calcul du prix et le Nutri-Score les ignorent purement et simplement. Or
 * la description TikTok, elle, les liste presque toujours — c'est le rattrapage
 * qui rapporte le plus pour le moins de risque.
 */
function sansIngredients(recettes) {
    return aRattraper(recettes).filter((r) => {
        const ing = r.ingredients || [];
        return ing.length <= 1 && ing.some((i) => /vid[ée]o/i.test(i.name || ''));
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

/**
 * Extrait le premier objet JSON d'une réponse, même mal emballée.
 *
 * Cloudflare rend parfois l'objet DÉJÀ construit — quand le modèle a produit
 * du JSON valide, il le parse pour nous. Il n'y a alors rien à faire.
 */
function lireJson(brut) {
    if (brut && typeof brut === 'object') return brut;
    if (typeof brut !== 'string') return null;
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

/* ── L'écriture dans WordPress ───────────────────────────────────────────── */

/*
 * On écrit par XML-RPC, comme tout le reste du robot : l'API REST d'écriture
 * réclame des mots de passe d'application, que ce WordPress n'a pas activés.
 *
 * Et on ne touche QUE le contenu des deux listes du plugin Magic Post Parser,
 * qui existent déjà dans l'article mais sont vides. Le reste de la page — le
 * chapeau, la mise en forme, la vidéo — n'est pas relu ni réécrit.
 */
const BASE = (process.env.WP_URL || `http://${process.env.WP_PUBLIC_IP || '109.221.250.122'}/wordpress`).replace(/\/$/, '');
const XMLRPC = process.env.WP_XMLRPC_URL || `${BASE}/xmlrpc.php`;
const REST = process.env.WP_API_URL || `${BASE}/wp-json/wp/v2`;
const USER = process.env.WP_USERNAME;
const PASS = process.env.WP_PASSWORD;

/** Un identifiant ou un texte peut contenir & ou < : sans ça, le XML casse. */
const xmlEchappe = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function contenuDe(postId) {
    const rep = await fetch(`${REST}/posts/${postId}?_fields=content`);
    if (!rep.ok) throw new Error(`lecture de l'article ${postId} : HTTP ${rep.status}`);
    return (await rep.json())?.content?.rendered || '';
}

/** Remplit une liste du plugin, en gardant ses attributs d'origine. */
function remplirListe(html, balise, id, elements) {
    const motif = new RegExp(`(<${balise}[^>]*id=["']${id}["'][^>]*>)([\\s\\S]*?)(</${balise}>)`, 'i');
    if (!motif.test(html)) return null;
    const lis = elements.map((t) => `<li>${xmlEchappe(t)}</li>`).join('');
    return html.replace(motif, `$1${lis}$3`);
}

async function ecrireContenu(postId, html) {
    const corps = `<?xml version="1.0"?>
<methodCall><methodName>wp.editPost</methodName><params>
<param><value><int>1</int></value></param>
<param><value><string>${xmlEchappe(USER)}</string></value></param>
<param><value><string>${xmlEchappe(PASS)}</string></value></param>
<param><value><int>${postId}</int></value></param>
<param><value><struct>
<member><name>post_content</name><value><string>${xmlEchappe(html)}</string></value></member>
</struct></value></param>
</params></methodCall>`;
    const rep = await fetch(XMLRPC, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: corps });
    const texte = await rep.text();
    if (texte.includes('<boolean>1</boolean>')) return true;
    const faute = texte.match(/faultString<\/name>\s*<value>\s*<string>([^<]*)/);
    throw new Error(faute ? faute[1] : `refus de WordPress (${texte.replace(/\s+/g, ' ').slice(0, 140)})`);
}

/* ── Marche ──────────────────────────────────────────────────────────────── */

(async () => {
    const recettes = catalogue();
    const tous = opt('--sans-ingredients') ? sansIngredients(recettes) : aRattraper(recettes);
    let cibles = tous;
    if (arg('--ids')) {
        const voulus = arg('--ids').split(',').map((s) => s.trim());
        cibles = tous.filter((r) => voulus.includes(String(r.id)));
    } else {
        const debut = parseInt(arg('--debut') || '0', 10);
        const lot = parseInt(arg('--lot') || '10', 10);
        cibles = tous.slice(debut, debut + lot);
    }

    console.log(`${tous.length} recette(s) ${opt('--sans-ingredients') ? 'sans ingrédients' : 'sans étapes'} au total — ${cibles.length} examinée(s) ici.`);
    console.log(opt('--ecrire') ? '⚠️  MODE ÉCRITURE : WordPress sera modifié.\n' : 'Mode proposition : rien ne sera modifié.\n');

    const retenues = [];
    let sansEtapes = 0, ratees = 0;

    for (const r of cibles) {
        const desc = await descriptionTikTok(idTikTok(r.videoHtml));
        if (!desc) { console.log(`— ${r.id} ${r.title}\n   description TikTok introuvable.\n`); ratees++; continue; }
        let res;
        try { res = await extraire(r.title, desc); }
        catch (e) { console.log(`— ${r.id} ${r.title}\n   ✗ ${e.message}\n`); ratees++; continue; }

        console.log(`— ${r.id} ${r.title}`);
        console.log(`   description : ${desc.replace(/\s+/g, ' ').slice(0, 100)}…`);
        if (!res.steps.length && !opt('--sans-ingredients')) {
            console.log(`   ⚠️  aucune étape dans la description (${res.ingredients.length} ingrédient(s) trouvé(s)) — à revoir à la main.\n`);
            sansEtapes++;
            continue;
        }
        if (!res.ingredients.length) {
            console.log(`   ⚠️  la description ne liste rien d'exploitable — à revoir à la main.\n`);
            sansEtapes++;
            continue;
        }
        console.log(`   ✓ ${res.ingredients.length} ingrédient(s), ${res.steps.length} étape(s) :`);
        res.ingredients.slice(0, 4).forEach((i) => console.log(`       · ${[i.quantity, i.name].filter(Boolean).join(' ')}`));
        if (res.ingredients.length > 4) console.log(`       · … et ${res.ingredients.length - 4} autre(s)`);
        res.steps.forEach((s, n) => console.log(`       ${n + 1}. ${s.slice(0, 92)}`));
        console.log('');
        retenues.push({ id: r.id, titre: r.title, ...res });

        if (opt('--ecrire')) {
            try {
                const html = await contenuDe(r.id);
                let neuf = remplirListe(html, 'ul', 'mpprecipe-ingredients-list',
                    res.ingredients.map((i) => [i.quantity, i.name].filter(Boolean).join(' ').trim()));
                if (!neuf) throw new Error('liste d\'ingrédients introuvable dans l\'article');
                if (res.steps.length) {
                    const avecEtapes = remplirListe(neuf, 'ol', 'mpprecipe-instructions-list', res.steps);
                    if (avecEtapes) neuf = avecEtapes;
                }
                await ecrireContenu(r.id, neuf);
                console.log('   → écrit dans WordPress.\n');
            } catch (e) {
                console.log(`   ✗ écriture refusée : ${e.message}\n`);
            }
        }
        await new Promise((res2) => setTimeout(res2, 700));
    }

    fs.writeFileSync('/tmp/etapes-proposees.json', JSON.stringify(retenues, null, 1));
    console.log(`\n${retenues.length} recette(s) récupérable(s), ${sansEtapes} sans étapes dans la description, ${ratees} en échec.`);
    console.log('Proposition écrite dans /tmp/etapes-proposees.json');
    if (!opt('--ecrire')) console.log('Rien n\'a été modifié. Relance avec --ecrire pour appliquer.');
})();
