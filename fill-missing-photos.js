#!/usr/bin/env node
/**
 * fill-missing-photos.js
 * 
 * Détecte toutes les recettes WordPress sans photo (featured_media = 0)
 * et génère une image IA professionnelle pour chacune.
 * 
 * Usage :
 *   node fill-missing-photos.js          → toutes les recettes sans photo
 *   node fill-missing-photos.js --recent → seulement la première page (recettes récentes)
 */

const fs = require('fs');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config({ path: __dirname + '/tiktok-bot/.env' });

const { generateImageWithGemini } = require('./tiktok-bot/photo-search');

const WP_USER = process.env.WP_USERNAME || 'm4nu';
const WP_PASS = process.env.WP_PASSWORD || '2TlsWemp!';
const WP_LOCAL = 'http://192.168.1.200/wordpress';
const WP_XMLRPC = `${WP_LOCAL}/xmlrpc.php`;

const recentOnly = process.argv.includes('--recent');

// ─── Récupère les recettes sans photo ───────────────────────────────────────
async function getPostsWithoutPhoto() {
    const missing = [];
    let page = 1;

    while (true) {
        const url = `${WP_LOCAL}/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=id,title,featured_media`;
        const res = await fetch(url);
        if (!res.ok) break;
        const posts = await res.json();
        if (!posts || posts.length === 0) break;

        for (const post of posts) {
            if (!post.featured_media || post.featured_media === 0) {
                missing.push({ id: post.id, title: post.title.rendered.replace(/&#038;/g, '&').replace(/&amp;/g, '&').replace(/<[^>]+>/g, '') });
            }
        }

        // En mode --recent, on ne traite que la première page
        if (recentOnly || posts.length < 100) break;
        page++;
    }

    return missing;
}

// ─── Upload image locale sur WordPress ──────────────────────────────────────
async function uploadLocalImage(localPath) {
    const buffer = fs.readFileSync(localPath);
    const base64 = buffer.toString('base64');
    const ext = path.extname(localPath).replace('.', '') || 'png';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const fileName = `recipe_ai_${Date.now()}.${ext}`;

    const xml = `<?xml version="1.0"?>
    <methodCall>
        <methodName>wp.uploadFile</methodName>
        <params>
            <param><value><int>1</int></value></param>
            <param><value><string>${WP_USER}</string></value></param>
            <param><value><string>${WP_PASS}</string></value></param>
            <param><value>
                <struct>
                    <member><name>name</name><value><string>${fileName}</string></value></member>
                    <member><name>type</name><value><string>${mimeType}</string></value></member>
                    <member><name>bits</name><value><base64>${base64}</base64></value></member>
                </struct>
            </value></param>
        </params>
    </methodCall>`;

    const res = await fetch(WP_XMLRPC, { method: 'POST', body: xml });
    const text = await res.text();
    const match = text.match(/<member><name>id<\/name><value><string>(\d+)<\/string><\/value><\/member>/)
        || text.match(/<member><name>id<\/name><value><int>(\d+)<\/int><\/value><\/member>/);
    return match ? match[1] : null;
}

// ─── Attache une image à un post ────────────────────────────────────────────
async function attachImage(postId, mediaId) {
    const xml = `<?xml version="1.0"?>
    <methodCall>
        <methodName>wp.editPost</methodName>
        <params>
            <param><value><int>1</int></value></param>
            <param><value><string>${WP_USER}</string></value></param>
            <param><value><string>${WP_PASS}</string></value></param>
            <param><value><int>${postId}</int></value></param>
            <param><value>
                <struct>
                    <member><name>post_thumbnail</name><value><int>${mediaId}</int></value></member>
                </struct>
            </value></param>
        </params>
    </methodCall>`;

    const res = await fetch(WP_XMLRPC, { method: 'POST', body: xml });
    const text = await res.text();
    return text.includes('<boolean>1</boolean>');
}

// ─── Programme principal ─────────────────────────────────────────────────────
async function main() {
    console.log(`\n🔍 Recherche des recettes sans photo${recentOnly ? ' (page récente uniquement)' : ''}...`);

    const missing = await getPostsWithoutPhoto();

    if (missing.length === 0) {
        console.log('✅ Toutes les recettes ont déjà une photo !');
        return;
    }

    console.log(`📋 ${missing.length} recette(s) sans photo trouvée(s).\n`);

    let success = 0;
    let skipped = 0;

    for (const post of missing) {
        console.log(`\n🍽️  [${post.id}] "${post.title}"`);

        // 1. Générer la photo IA
        const fileUrl = await generateImageWithGemini(post.title);

        if (!fileUrl) {
            console.log(`   ⏭️  Quota IA dépassé — passage au prochain démarrage du bot.`);
            skipped++;
            // Si le quota est dépassé, inutile de continuer (même quota pour toutes les recettes)
            break;
        }

        const localPath = fileUrl.replace('file://', '');

        try {
            // 2. Uploader sur WordPress
            const mediaId = await uploadLocalImage(localPath);
            if (!mediaId) {
                console.log(`   ❌ Échec upload WordPress`);
                continue;
            }

            // 3. Attacher au post
            const ok = await attachImage(post.id, mediaId);
            if (ok) {
                console.log(`   ✅ Photo IA attachée ! (Media ID: ${mediaId})`);
                success++;
            } else {
                console.log(`   ❌ Échec attachement au post`);
            }

        } finally {
            // Nettoyer le fichier temporaire
            try { fs.unlinkSync(localPath); } catch { }
        }

        // Petite pause entre chaque génération pour ne pas saturer le quota
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`\n📊 Résultat : ${success} photo(s) ajoutée(s), ${skipped} ignorée(s) (quota dépassé).`);
    if (skipped > 0) {
        console.log(`💡 Relancez "node fill-missing-photos.js" plus tard pour compléter les recettes restantes.`);
    }
}

main().catch(e => console.error('❌ Erreur fatale:', e.message));
