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
 *   node scripts/recuperer-etapes-tiktok.js --maigres --lot 30 # celles à 1 ou 2 étapes
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
 * Les recettes trop maigres : une ou deux étapes, mais de VRAIES étapes.
 *
 * Elles ne relèvent pas du même traitement. Ici on ne répare pas un trou, on
 * complète un résumé — et l'on n'a le droit de le remplacer que s'il en
 * ressort plus détaillé. Cf. `--maigres`.
 */
function tropMaigres(recettes) {
    return recettes.filter((r) => {
        const vraies = (r.steps || []).filter((s) => typeof s === 'string' && s.trim().length > 3 && !REPLI.test(s));
        return vraies.length > 0 && vraies.length <= 2 && idTikTok(r.videoHtml);
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

/* ── Ce que dit la vidéo, transcrit par TikTok ───────────────────────────── */

/*
 * TikTok sous-titre lui-même ses vidéos, et publie ces sous-titres dans la
 * page : `subtitleInfos` porte l'adresse d'un fichier WebVTT, en clair, sans
 * clé ni cookie ni requête signée. `Source: "ASR"` désigne la piste faite par
 * sa reconnaissance vocale — c'est-à-dire la recette dictée par l'auteur.
 *
 * C'est ce qui manquait. La description ne dit souvent que le titre ; la voix,
 * elle, dit toujours les gestes. Et cette transcription-là est FAITE PAR
 * TIKTOK : rien à télécharger, rien à transcrire, aucun quota. Elle est aussi
 * plus fidèle que le bloc recette affiché dans l'application, qui reformule
 * (sur le croque McDo il annonçait du pain de mie et du cheddar quand la voix
 * dit un pain à burger et de l'emmental).
 */

/** Le tableau JSON qui suit `"cle":[` — repéré en comptant les crochets. */
function tableauJson(page, cle) {
    const i = page.indexOf(`"${cle}":[`);
    if (i < 0) return null;
    const debut = page.indexOf('[', i);
    let p = 0, ech = false, chaine = false;
    for (let j = debut; j < page.length; j++) {
        const c = page[j];
        if (ech) { ech = false; continue; }
        if (c === '\\') { ech = true; continue; }
        if (c === '"') { chaine = !chaine; continue; }
        if (chaine) continue;
        if (c === '[') p++;
        else if (c === ']' && --p === 0) {
            try { return JSON.parse(page.slice(debut, j + 1)); } catch { return null; }
        }
    }
    return null;
}

const NAVIGATEUR = {
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'accept-language': 'fr-FR,fr;q=0.9',
};

/** Les pistes de sous-titres, la meilleure d'abord : voix française avant tout. */
function pistes(page) {
    const t = tableauJson(page, 'subtitleInfos') || [];
    const rang = (p) => {
        const fr = String(p.LanguageCodeName || '').startsWith('fr');
        const voix = p.Source === 'ASR';
        return fr && voix ? 0 : fr ? 1 : voix ? 2 : 3;
    };
    return t.slice().sort((a, b) => rang(a) - rang(b));
}

/** Le WebVTT débarrassé de ses horodatages : un texte suivi. */
function vttEnTexte(vtt) {
    return vtt.split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && l !== 'WEBVTT' && !l.includes('-->') && !/^\d+$/.test(l))
        .join(' ');
}

async function transcriptionTikTok(tiktokId) {
    const url = `https://www.tiktok.com/@t/video/${tiktokId}`;
    let page;
    try {
        const r = await fetch(url, { headers: NAVIGATEUR });
        if (!r.ok) return null;
        page = await r.text();
    } catch { return null; }

    for (const p of pistes(page)) {
        if (!p.Url) continue;
        try {
            const r = await fetch(p.Url, { headers: { ...NAVIGATEUR, referer: 'https://www.tiktok.com/' } });
            if (!r.ok) continue;
            const texte = vttEnTexte(await r.text());
            if (texte.length > 40) return { texte, source: p.Source, langue: p.LanguageCodeName };
        } catch { /* piste suivante */ }
    }
    return null;
}

/* ── L'extraction, par une IA gratuite ───────────────────────────────────── */

const CONSIGNE = `Tu reçois une vidéo de cuisine TikTok sous deux formes : la description écrite par l'auteur, et la transcription de ce qu'il DIT dans la vidéo.
Extrais-en la recette et réponds UNIQUEMENT par du JSON, sans texte autour :
{"ingredients":[{"quantity":"200 g","name":"farine"}],"steps":["Étape en français.","..."]}

Règles :
- TOUT en français, même si la description est dans une autre langue. Traduis.
- "quantity" : la quantité telle qu'écrite ("2", "200 g", "1 c. à soupe"). Vide si l'auteur n'en donne pas.
- "name" : le seul nom de l'ingrédient, sans la quantité.
- "steps" : une phrase par étape, dans l'ordre. Reprends les durées et les températures quand elles sont dites.
- Les étapes s'écrivent à l'impératif de politesse, comme le reste du site : « Préchauffez le four à 210 °C », « Mélangez », « Versez ». Jamais « Prends » ni « Mélanger ».
- N'INVENTE RIEN : pas d'ingrédient qui n'est ni écrit ni dit, pas de température devinée. Si rien ne donne les étapes, renvoie "steps":[].
- La transcription est de l'oral, dicté en cuisinant : elle décrit les gestes dans l'ordre mais sans ponctuation fiable, avec des tics de langue et parfois un mot mal entendu. Récris-la en phrases propres ; corrige l'évident ("1" pour "un", "p'tit" pour "petit").
- Elle donne rarement les quantités : laisse "quantity" vide plutôt que d'en inventer une.
- "quantity" garde son unité entière : "2 tranches" et name "emmental", jamais "2" et name "emmental". Une quantité floue à l'oral ("un peu", "quelques", "une pincée") n'est pas une quantité : laisse "quantity" vide.
- "name" s'écrit comme sur une liste de courses, au singulier et sans élision ("jambon", pas "p'tit peu jambon").
- La voix DICTE les nombres en toutes lettres, et c'est là qu'on se trompe : « cent-quatre-vingts degrés » fait 180 °C, pas 144 ; « deux cent dix » fait 210 ; « quarante-cinq minutes » fait 45. Relis chaque nombre que tu écris.
- Un four se règle par paliers de 10 (140, 180, 210, 240). Si tu obtiens 144 ou 184, c'est que tu as mal converti : reprends la phrase.
- Une étape est un GESTE de cuisine. L'auteur finit presque toujours par vanter son plat ou demander un abonnement : ce n'est pas une étape, ne la garde pas ("Régalez-vous", "Dites-moi en commentaire", "C'est trop bon"). Un vrai dressage ou service, si, ("Servez bien chaud avec du persil").
- Quand la description et la voix se contredisent, LA VOIX A RAISON : c'est l'auteur qui cuisine.
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

/*
 * Deux moteurs, l'un derrière l'autre.
 *
 * Cloudflare offre 10 000 neurones par jour — une trentaine de recettes, puis
 * un 429 sec pour toutes les suivantes. Groq prend le relais : 8 000 jetons
 * par minute, mille appels par jour, de quoi finir le catalogue le même soir.
 * Les deux sont gratuits ; aucun n'est indispensable seul.
 */
const quotaEpuise = (message) => /429|neurons|rate.?limit|quota/i.test(message || '');

/* Une fois Cloudflare à sec pour la journée, on cesse de l'appeler : sinon
 * chaque recette paie un aller-retour pour un 429 connu d'avance. */
let cloudflareASec = false;

async function extraire(titre, description, transcription) {
    const messages = [
        { role: 'system', content: CONSIGNE },
        {
            role: 'user',
            content: [
                `Titre : ${titre}`,
                `Description :\n${(description || '(vide)').slice(0, 3000)}`,
                transcription
                    ? `Transcription de la vidéo :\n${transcription.slice(0, 5000)}`
                    : 'Transcription de la vidéo : indisponible.',
            ].join('\n\n'),
        },
    ];

    const moteur = arg('--moteur');
    const chaine = moteur === 'groq' ? [parGroq]
        : moteur === 'cloudflare' ? [parCloudflare]
        : cloudflareASec ? [parGroq]
        : [parCloudflare, parGroq];

    let derniere;
    for (const appeler of chaine) {
        try { return ranger(await appeler(messages)); }
        catch (e) {
            derniere = e;
            if (appeler === parCloudflare && quotaEpuise(e.message)) {
                if (!cloudflareASec) console.log('   · Cloudflare a épuisé sa journée — on passe à Groq.');
                cloudflareASec = true;
            }
        }
    }
    throw derniere;
}

/** Met en forme ce que le modèle a rendu, quel qu'il soit. */
function ranger(texte) {
    const parse = lireJson(texte);
    if (!parse) throw new Error('réponse illisible');
    return {
        ingredients: Array.isArray(parse.ingredients) ? parse.ingredients.filter((i) => i && i.name) : [],
        steps: Array.isArray(parse.steps) ? parse.steps.filter((s) => typeof s === 'string' && s.trim().length > 3) : [],
    };
}

const patienter = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * Le débit, dicté par Groq lui-même.
 *
 * Premier essai : un compteur maison des jetons de la dernière minute. Erreur.
 * Il comptait aussi les appels REFUSÉS — qui ne consomment rien — si bien qu'à
 * chaque relance il s'enfonçait un peu plus dans un quota imaginaire : une
 * recette toutes les trois minutes, quand Groq annonçait 7 907 jetons libres.
 *
 * Or Groq dit exactement ce qu'il reste et quand il recharge, à chaque réponse
 * (`x-ratelimit-remaining-tokens`, `x-ratelimit-reset-tokens`). On le croit lui,
 * plutôt que de tenir un double des comptes.
 */
let resteJetons = null;    // ce que Groq annonçait à la dernière réponse
let quandRecharge = 0;     // l'instant où sa fenêtre se rouvre

/*
 * Le quota de Groq ne se compte pas seulement à la minute : chaque modèle a
 * aussi sa journée — 200 000 jetons, soit environ quatre-vingts recettes. Le
 * refus le dit en toutes lettres (« tokens per day (TPD) »), là où l'entête ne
 * parle que de la minute ; on lisait donc « attendez 65 s » pour une porte
 * fermée jusqu'au lendemain.
 *
 * Ces journées sont propres à chaque modèle. On en tient donc plusieurs, et on
 * passe au suivant quand l'un a fini la sienne.
 */
const GROQ_MODELES = (process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-20b,openai/gpt-oss-120b,qwen/qwen3.8-27b').split(',');
const journeeFinie = new Set();

const quotaDuJour = (corps) => /tokens per day|TPD/i.test(corps || '');

/** « 697ms », « 2.775s », « 2h9m36s » → millisecondes. */
function dureeEnMs(texte) {
    if (!texte) return 0;
    const ms = texte.match(/([\d.]+)ms/);
    if (ms) return parseFloat(ms[1]);
    let total = 0;
    for (const [, n, unite] of texte.matchAll(/([\d.]+)(h|m|s)/g)) {
        total += parseFloat(n) * (unite === 'h' ? 3600000 : unite === 'm' ? 60000 : 1000);
    }
    return total;
}

async function parGroq(messages, essai = 0) {
    const jeton = process.env.GROQ_API_KEY;
    if (!jeton) throw new Error('clé Groq absente');
    const modele = GROQ_MODELES.find((m) => !journeeFinie.has(m));
    if (!modele) throw new Error('Groq : tous les modèles ont fini leur journée');

    // Le prompt se mesure, la réponse s'estime : une recette détaillée tient en
    // un millier de jetons, réflexion écourtée comprise.
    const prevus = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4) + 1000;

    // Si Groq a dit qu'il ne reste pas la place, on attend sa recharge — elle se
    // compte en secondes, pas en minutes.
    if (resteJetons !== null && resteJetons < prevus) {
        await patienter(Math.min(Math.max(quandRecharge - Date.now(), 300), 65000));
    }

    const rep = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
        /*
         * `reasoning_effort: low` n'est pas un réglage de confort : sans lui,
         * gpt-oss-20b dépensait 2 398 jetons à réfléchir sur 2 400 autorisés et
         * rendait une réponse VIDE — d'où les « réponse illisible ». La tâche
         * ne demande aucune réflexion : le texte est là, il faut le mettre en
         * forme.
         */
        body: JSON.stringify({
            model: modele,
            max_tokens: 4000,
            temperature: 0.2,
            // Qwen n'accepte que « none » ou « default » ; gpt-oss veut « low ».
            reasoning_effort: modele.startsWith('qwen') ? 'none' : 'low',
            messages,
        }),
    });

    // Ce que Groq annonce fait foi, refus compris.
    const reste = parseFloat(rep.headers.get('x-ratelimit-remaining-tokens'));
    if (!Number.isNaN(reste)) resteJetons = reste;
    quandRecharge = Date.now() + dureeEnMs(rep.headers.get('x-ratelimit-reset-tokens'));

    if (rep.status === 429) {
        const corps = await rep.text();
        if (quotaDuJour(corps)) {
            journeeFinie.add(modele);
            const suivant = GROQ_MODELES.find((m) => !journeeFinie.has(m));
            console.log(`   · ${modele} a fini sa journée${suivant ? ` — on passe à ${suivant}.` : '.'}`);
            if (!suivant) throw new Error('Groq : tous les modèles ont fini leur journée');
            return parGroq(messages, essai);
        }
        if (essai < 8) {
            const dit = parseFloat(rep.headers.get('retry-after') || '0');
            const attente = Math.min(Math.max(dit ? dit * 1000 : 8000 * (essai + 1), 2000), 65000);
            console.log(`   · Groq demande ${Math.round(attente / 1000)} s de pause.`);
            await patienter(attente);
            return parGroq(messages, essai + 1);
        }
        throw new Error(`Groq 429 — ${corps.slice(0, 160)}`);
    }

    if (!rep.ok) throw new Error(`Groq ${rep.status} — ${(await rep.text()).slice(0, 160)}`);
    const d = await rep.json();
    return d?.choices?.[0]?.message?.content ?? '';
}

async function parCloudflare(messages) {
    const compte = process.env.CF_ACCOUNT_ID;
    const jeton = process.env.CF_API_TOKEN;
    if (!compte || !jeton) throw new Error('clés Cloudflare absentes');
    const modele = process.env.CF_TEXT_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    const rep = await fetch(`https://api.cloudflare.com/client/v4/accounts/${compte}/ai/run/${modele}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
        body: JSON.stringify({ max_tokens: 1600, temperature: 0.2, messages }),
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
    return d?.result?.response
        ?? d?.result?.choices?.[0]?.message?.content
        ?? '';
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
function motifListe(balise, id) {
    return new RegExp(`(<${balise}[^>]*id=["']${id}["'][^>]*>)([\\s\\S]*?)(</${balise}>)`, 'i');
}

/**
 * Une liste ne compte que si elle porte autre chose que le pis-aller.
 *
 * Beaucoup de ces recettes ont déjà de VRAIS ingrédients, relus, parfois
 * corrigés à la main — seules leurs étapes manquent. Les remplacer par ce que
 * l'IA entend dans la bande-son serait une perte sèche. On ne réécrit donc une
 * liste que si elle est vide ou remplie du « voir la vidéo » d'origine.
 */
function listeGarnie(html, balise, id) {
    const m = html.match(motifListe(balise, id));
    if (!m) return false;
    const lignes = [...m[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((l) => l[1].replace(/<[^>]+>/g, '').trim())
        .filter((t) => t.length > 2 && !REPLI.test(t));
    return lignes.length > 0;
}

function remplirListe(html, balise, id, elements) {
    const motif = motifListe(balise, id);
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
    const tous = opt('--maigres') ? tropMaigres(recettes)
        : opt('--sans-ingredients') ? sansIngredients(recettes)
        : aRattraper(recettes);
    let cibles = tous;
    if (arg('--ids')) {
        const voulus = arg('--ids').split(',').map((s) => s.trim());
        cibles = tous.filter((r) => voulus.includes(String(r.id)));
    } else {
        const debut = parseInt(arg('--debut') || '0', 10);
        const lot = parseInt(arg('--lot') || '10', 10);
        cibles = tous.slice(debut, debut + lot);
    }

    const quoi = opt('--maigres') ? 'à une ou deux étapes' : opt('--sans-ingredients') ? 'sans ingrédients' : 'sans étapes';
    console.log(`${tous.length} recette(s) ${quoi} au total — ${cibles.length} examinée(s) ici.`);
    console.log(opt('--ecrire') ? '⚠️  MODE ÉCRITURE : WordPress sera modifié.\n' : 'Mode proposition : rien ne sera modifié.\n');

    const retenues = [];
    let sansEtapes = 0, ratees = 0;

    for (const r of cibles) {
        const tiktokId = idTikTok(r.videoHtml);
        const [desc, voix] = await Promise.all([
            descriptionTikTok(tiktokId),
            transcriptionTikTok(tiktokId),
        ]);
        /*
         * Une description vide n'est plus un échec : la voix suffit. On ne
         * renonce que si les deux manquent.
         */
        if (!desc && !voix) { console.log(`— ${r.id} ${r.title}\n   ni description ni transcription chez TikTok.\n`); ratees++; continue; }
        let res;
        try { res = await extraire(r.title, desc, voix && voix.texte); }
        catch (e) { console.log(`— ${r.id} ${r.title}\n   ✗ ${e.message}\n`); ratees++; continue; }

        console.log(`— ${r.id} ${r.title}`);
        if (desc) console.log(`   description : ${desc.replace(/\s+/g, ' ').slice(0, 100)}…`);
        if (voix) console.log(`   voix (${voix.source}/${voix.langue}) : ${voix.texte.replace(/\s+/g, ' ').slice(0, 100)}…`);
        if (!res.steps.length && !opt('--sans-ingredients')) {
            console.log(`   ⚠️  aucune étape exploitable (${res.ingredients.length} ingrédient(s) trouvé(s)) — à revoir à la main.\n`);
            sansEtapes++;
            continue;
        }
        if (!res.ingredients.length) {
            console.log(`   ⚠️  ni la description ni la voix ne listent d'ingrédient — à revoir à la main.\n`);
            sansEtapes++;
            continue;
        }
        /*
         * Une recette déjà pourvue ne se laisse remplacer que par mieux : sinon
         * on troquerait des étapes relues contre une paraphrase de la bande-son.
         */
        if (opt('--maigres')) {
            const avant = (r.steps || []).filter((x) => typeof x === 'string' && x.trim().length > 3 && !REPLI.test(x)).length;
            if (res.steps.length <= avant) {
                console.log(`   ${res.steps.length} étape(s) contre ${avant} déjà en place : on garde l'existant.\n`);
                sansEtapes++;
                continue;
            }
            console.log(`   (${avant} étape(s) en place, la voix en donne ${res.steps.length})`);
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
                let neuf = html;
                if (listeGarnie(html, 'ul', 'mpprecipe-ingredients-list')) {
                    console.log('   · ingrédients déjà renseignés : gardés tels quels.');
                } else {
                    neuf = remplirListe(html, 'ul', 'mpprecipe-ingredients-list',
                        res.ingredients.map((i) => [i.quantity, i.name].filter(Boolean).join(' ').trim()));
                    if (!neuf) throw new Error('liste d\'ingrédients introuvable dans l\'article');
                }
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
    console.log(`\n${retenues.length} recette(s) récupérable(s), ${sansEtapes} sans étapes exploitables, ${ratees} en échec.`);
    console.log('Proposition écrite dans /tmp/etapes-proposees.json');
    if (!opt('--ecrire')) console.log('Rien n\'a été modifié. Relance avec --ecrire pour appliquer.');
})();
