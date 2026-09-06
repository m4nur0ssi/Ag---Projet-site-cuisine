#!/usr/bin/env node
/**
 * Renvoie sur WordPress les photos générées par generate-recipe-images.js.
 *
 * Pourquoi ce script existe
 * -------------------------
 * Les photos générées finissent dans `public/recipes-ia`, donc dans le dépôt,
 * donc sur le site — et NULLE PART AILLEURS. WordPress, lui, ne recevait rien :
 * le bot TikTok y crée l'article sans image, et rien ne repassait derrière.
 * D'où des dizaines d'articles sans image à la une côté NAS, alors que le site
 * les affiche parfaitement. Le seul chemin de renvoi existant, `auto-upload-wp.js`,
 * se lance à la main, depuis le Mac, et rapproche les fichiers des recettes PAR
 * LE TITRE — un renommage dans WordPress suffit à le faire dérailler.
 *
 * Ici on travaille par IDENTIFIANT : dans ce projet, l'id d'une recette EST
 * l'id du post WordPress (sync-recipes.js les recopie tels quels). Aucun
 * rapprochement approximatif, donc rien à casser.
 *
 * Ce qui est envoyé : la GRANDE version (`<id>.webp`, 1200 px). WordPress
 * fabrique ses propres vignettes derrière.
 *
 * Ce que ça ne change pas : l'affichage du site. sync-recipes.js fait toujours
 * gagner le fichier local sur l'image à la une WordPress — le site reste servi
 * en statique par Vercel, indépendant du NAS.
 *
 * Usage
 * -----
 *   node scripts/pousser-photo-wp.js --manquantes 20   # articles sans image à la une
 *   node scripts/pousser-photo-wp.js --ids 7402,6608   # des recettes précises
 *   node scripts/pousser-photo-wp.js --all             # tout le catalogue (long)
 *   node scripts/pousser-photo-wp.js --manquantes 5 --dry-run
 *
 * Options
 *   --manquantes N  les N recettes dont la photo existe ici mais dont l'article
 *                   WordPress n'a pas d'image à la une. La plus récente d'abord.
 *   --ids a,b,c     recettes visées, par identifiant
 *   --all           toutes celles dont la photo existe ici
 *   --force         réenvoie même si l'article a déjà une image à la une
 *   --dry-run       n'envoie rien, dit seulement ce qui partirait
 *
 * Identifiants : WP_USERNAME / WP_PASSWORD, et WP_URL (ou WP_XMLRPC_URL).
 * Lus dans l'environnement, puis dans tiktok-bot/.env, puis dans .env.local.
 *
 * NAS injoignable = sortie 0, pas 1. Ce script est un confort : le site n'en
 * dépend pas, et il ne doit jamais faire échouer la synchronisation.
 */
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const DOSSIER = path.join(RACINE, 'public', 'recipes-ia');

/** Charge un fichier d'environnement sans dépendance (le script tourne hors de Next). */
function chargerEnv(fichier) {
    if (!fs.existsSync(fichier)) return;
    for (const ligne of fs.readFileSync(fichier, 'utf8').split('\n')) {
        const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
}
/*
 * `.env.local` d'ABORD, `tiktok-bot/.env` seulement en repli.
 *
 * Les deux fichiers portent un WP_PASSWORD, et ils ne sont pas d'accord : celui
 * de `tiktok-bot/.env` est périmé (XML-RPC répond « Identifiant ou mot de passe
 * incorrect »). Ça ne se voyait pas, parce que le bot tourne sur GitHub avec le
 * secret, pas avec ce fichier. En lisant tiktok-bot en premier, ce script-ci
 * aurait hérité du mauvais et n'aurait jamais rien envoyé depuis le Mac.
 * Sur un runner, les variables d'environnement sont déjà posées : `chargerEnv`
 * ne remplit que les trous, donc les secrets l'emportent dans tous les cas.
 */
chargerEnv(path.join(RACINE, '.env.local'));
chargerEnv(path.join(RACINE, 'tiktok-bot', '.env'));

const args = process.argv.slice(2);
const aOption = (nom) => args.includes(nom);
const valeur = (nom) => {
    const i = args.indexOf(nom);
    return i >= 0 ? args[i + 1] : null;
};

const USER = process.env.WP_USERNAME;
const PASS = process.env.WP_PASSWORD;

// Les deux points d'entrée WordPress, déduits l'un de l'autre : REST pour LIRE
// (savoir qui a déjà une image), XML-RPC pour ÉCRIRE (l'API REST d'écriture
// demande des mots de passe d'application, que ce WordPress n'a pas activés —
// tout le bot passe déjà par XML-RPC).
const BASE = (process.env.WP_URL || `http://${process.env.WP_PUBLIC_IP || '109.221.250.122'}/wordpress`).replace(/\/$/, '');
const XMLRPC = process.env.WP_XMLRPC_URL || `${BASE}/xmlrpc.php`;
const REST = process.env.WP_API_URL || `${BASE}/wp-json/wp/v2`;

/** Un identifiant ou un mot de passe peut contenir & ou < : sans ça, le XML casse. */
function xml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function lireRecettes() {
    const source = fs.readFileSync(path.join(RACINE, 'src', 'data', 'mockData.ts'), 'utf8');
    const debut = source.indexOf('= [', source.indexOf('mockRecipes')) + 2;
    return JSON.parse(source.slice(debut, source.lastIndexOf('];') + 1));
}

/** Appel HTTP avec délai maximal : un NAS qui ne répond pas ne doit pas figer le job. */
async function requete(url, options = {}, delai = 60000) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), delai);
    try {
        return await fetch(url, { ...options, signal: c.signal });
    } finally { clearTimeout(t); }
}

/** { id du post → id de son image à la une (0 si aucune) }, lu en REST. */
async function imagesALaUne() {
    const etat = new Map();
    for (let page = 1; page <= 30; page++) {
        const url = `${REST}/posts?per_page=100&page=${page}&status=publish&_fields=id,featured_media&nocache=${Date.now()}`;
        const rep = await requete(url);
        if (rep.status === 400) break;                 // au-delà de la dernière page
        if (!rep.ok) throw new Error(`lecture WordPress HTTP ${rep.status}`);
        const posts = await rep.json();
        if (!Array.isArray(posts) || !posts.length) break;
        posts.forEach((p) => etat.set(String(p.id), Number(p.featured_media) || 0));
        if (posts.length < 100) break;
    }
    return etat;
}

/** source_url du média : sert à réécrire SOUS LE MÊME NOM (même URL publique). */
async function urlDuMedia(mediaId) {
    try {
        const rep = await requete(`${REST}/media/${mediaId}?_fields=source_url&nocache=${Date.now()}`);
        if (!rep.ok) return null;
        return (await rep.json())?.source_url || null;
    } catch { return null; }
}

async function envoyerFichier(chemin, nom) {
    const base64 = fs.readFileSync(chemin).toString('base64');
    const corps = `<?xml version="1.0"?>
<methodCall><methodName>wp.uploadFile</methodName><params>
<param><value><int>1</int></value></param>
<param><value><string>${xml(USER)}</string></value></param>
<param><value><string>${xml(PASS)}</string></value></param>
<param><value><struct>
<member><name>name</name><value><string>${xml(nom)}</string></value></member>
<member><name>type</name><value><string>image/webp</string></value></member>
<member><name>bits</name><value><base64>${base64}</base64></value></member>
<member><name>overwrite</name><value><boolean>1</boolean></value></member>
</struct></value></param>
</params></methodCall>`;
    // Une image de 270 ko en base64 sur un NAS domestique : on laisse du temps.
    const rep = await requete(XMLRPC, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: corps }, 120000);
    const texte = await rep.text();
    const m = texte.match(/<member><name>id<\/name><value><(?:string|int)>(\d+)<\/(?:string|int)><\/value><\/member>/);
    if (!m) {
        // WordPress met en forme sa réponse XML : la raison de l'échec est
        // séparée de son étiquette par des retours-ligne et de l'indentation.
        const faute = texte.match(/faultString<\/name>\s*<value>\s*<string>([^<]*)/);
        throw new Error(faute ? faute[1] : `envoi refusé (${texte.replace(/\s+/g, ' ').slice(0, 140)})`);
    }
    return m[1];
}

async function definirImageALaUne(postId, mediaId) {
    const corps = `<?xml version="1.0"?>
<methodCall><methodName>wp.editPost</methodName><params>
<param><value><int>1</int></value></param>
<param><value><string>${xml(USER)}</string></value></param>
<param><value><string>${xml(PASS)}</string></value></param>
<param><value><int>${postId}</int></value></param>
<param><value><struct>
<member><name>post_thumbnail</name><value><int>${mediaId}</int></value></member>
</struct></value></param>
</params></methodCall>`;
    const rep = await requete(XMLRPC, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: corps });
    return (await rep.text()).includes('<boolean>1</boolean>');
}

(async () => {
    if (!USER || !PASS) {
        console.log('WP_USERNAME / WP_PASSWORD manquants — rien envoyé à WordPress.');
        return;
    }

    const recettes = lireRecettes();
    // Les fiches restaurant ont leurs propres photos (import-restaurant-photos.js).
    const avecPhoto = recettes.filter((r) => r.category !== 'restaurant'
        && fs.existsSync(path.join(DOSSIER, `${r.id}.webp`)));

    let etat;
    try {
        etat = await imagesALaUne();
    } catch (e) {
        // NAS éteint, adresse publique changée, WordPress en vrac : ce n'est pas
        // une erreur du pipeline. Les photos restent sur le site, et le passage
        // suivant rattrapera — c'est tout l'intérêt de raisonner en « manquantes ».
        console.log(`WordPress injoignable (${e.message}) — on réessaiera au prochain passage.`);
        return;
    }
    console.log(`${etat.size} article(s) lus sur WordPress, ${avecPhoto.length} photo(s) disponibles ici.`);

    let cibles;
    if (valeur('--ids')) {
        const ids = valeur('--ids').split(',').map((s) => s.trim());
        cibles = avecPhoto.filter((r) => ids.includes(String(r.id)));
    } else if (aOption('--all')) {
        cibles = avecPhoto;
    } else {
        const combien = parseInt(valeur('--manquantes'), 10) || 20;
        // Sans image à la une côté WordPress. `etat` ne connaît que les articles
        // publiés : une recette absente (brouillon, supprimée) est ignorée.
        cibles = avecPhoto
            .filter((r) => etat.has(String(r.id)) && !etat.get(String(r.id)))
            .slice(0, combien);
    }
    // Une image à la une déjà posée a pu être choisie à la main dans WordPress :
    // on ne l'écrase que si on le demande. (Sans effet sur --manquantes, qui ne
    // retient déjà que les articles sans image.)
    if (!aOption('--force')) cibles = cibles.filter((r) => !etat.get(String(r.id)));

    if (!cibles.length) {
        console.log('Aucun article à compléter — tous ceux qui ont une photo ici en ont une là-bas.');
        return;
    }
    console.log(`${cibles.length} article(s) à compléter.\n`);

    if (aOption('--dry-run')) {
        cibles.forEach((r) => console.log(`— #${r.id} ${r.title}`));
        return;
    }

    let faites = 0, ratees = 0;
    for (const r of cibles) {
        const fichier = path.join(DOSSIER, `${r.id}.webp`);
        try {
            /*
             * Réécrire SOUS LE MÊME NOM quand une image à la une existe déjà
             * (cas --force) : WordPress garde alors la même URL publique, donc
             * rien d'autre n'a à être mis à jour derrière. Un nom neuf créerait
             * une deuxième entrée dans la médiathèque à chaque passage.
             */
            let nom = `recette-${r.id}.webp`;
            const actuelle = etat.get(String(r.id));
            if (actuelle) {
                const url = await urlDuMedia(actuelle);
                if (url && /\.webp$/i.test(url)) nom = decodeURIComponent(path.basename(new URL(url).pathname));
            }
            const mediaId = await envoyerFichier(fichier, nom);
            const ok = await definirImageALaUne(r.id, mediaId);
            console.log(`${ok ? '✓' : '~'} #${r.id} ${r.title}${ok ? '' : ' (envoyée, image à la une non confirmée)'}`);
            faites++;
        } catch (e) {
            console.log(`✗ #${r.id} ${r.title} — ${e.message}`);
            ratees++;
        }
        // Un NAS domestique encaisse mal une rafale d'envois de 300 ko.
        await new Promise((res) => setTimeout(res, 1200));
    }

    console.log(`\n${faites} article(s) complété(s), ${ratees} en échec.`);
})();
