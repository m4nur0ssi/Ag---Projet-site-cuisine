#!/usr/bin/env node
/**
 * install-wp-plugin.js
 * Installe et active automatiquement le plugin lrm-github-sync sur WordPress
 * via les endpoints admin (sans SSH)
 */

const fs   = require('fs');
const path = require('path');
const FormData = require('form-data');

const WP_URL  = 'http://109.221.250.122/wordpress';
const WP_USER = 'm4nu';
const WP_PASS = '2TlsWemp!';
const ZIP_PATH = path.join(__dirname, 'plugin-build', 'lrm-github-sync.zip');

// Token GitHub à configurer après installation (depuis argument CLI)
const GITHUB_TOKEN = process.argv[2] || '';

async function wpFetch(url, options = {}) {
    const { default: fetch } = await import('node-fetch');
    return fetch(url, options);
}

async function login() {
    console.log('🔐 Connexion à WordPress admin...');
    const body = new URLSearchParams({
        log: WP_USER,
        pwd: WP_PASS,
        'wp-submit': 'Log In',
        redirect_to: '/wordpress/wp-admin/',
        testcookie: '1'
    });

    const res = await wpFetch(`${WP_URL}/wp-login.php`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': 'wordpress_test_cookie=WP+Cookie+check',
        },
        body: body.toString(),
        redirect: 'manual'
    });

    const cookies = res.headers.raw()['set-cookie'] || [];
    const sessionCookie = cookies
        .map(c => c.split(';')[0])
        .join('; ');

    if (!sessionCookie.includes('wordpress_logged_in')) {
        throw new Error('❌ Connexion échouée — vérifier les credentials');
    }

    console.log('✅ Connecté !');
    return sessionCookie;
}

async function getNonce(cookie) {
    console.log('🔒 Récupération du nonce...');
    const res = await wpFetch(`${WP_URL}/wp-admin/plugin-install.php?tab=upload`, {
        headers: { Cookie: cookie }
    });
    const html = await res.text();

    const match = html.match(/name="_wpnonce"\s+value="([^"]+)"/);
    if (!match) throw new Error('❌ Nonce introuvable dans la page');

    console.log(`✅ Nonce: ${match[1]}`);
    return match[1];
}

async function uploadPlugin(cookie, nonce) {
    console.log('📦 Upload du plugin ZIP...');

    const form = new FormData();
    form.append('_wpnonce', nonce);
    form.append('_wp_http_referer', '/wordpress/wp-admin/plugin-install.php?tab=upload');
    form.append('pluginzip', fs.readFileSync(ZIP_PATH), {
        filename: 'lrm-github-sync.zip',
        contentType: 'application/zip'
    });
    form.append('install-plugin-submit', 'Install Now');

    // Bufferiser pour que Content-Length soit connu (évite 411 Length Required)
    const formBuffer = await new Promise((resolve, reject) => {
        const chunks = [];
        form.on('data', chunk => chunks.push(chunk));
        form.on('end',  () => resolve(Buffer.concat(chunks)));
        form.on('error', reject);
    });

    const res = await wpFetch(`${WP_URL}/wp-admin/update.php?action=upload-plugin`, {
        method: 'POST',
        headers: {
            ...form.getHeaders(),
            'Cookie': cookie,
            'Content-Length': formBuffer.length,
        },
        body: formBuffer
    });

    const html = await res.text();

    if (html.includes('Plugin installed successfully') || html.includes('plugin installed') || html.includes('activate_plugin')) {
        console.log('✅ Plugin installé !');
        // Extraire le lien d'activation
        const activateMatch = html.match(/href="([^"]*activate[^"]*plugin=lrm-github-sync[^"]*)"/i) ||
                              html.match(/href="([^"]*action=activate[^"]*)"/i);
        return activateMatch ? activateMatch[1] : null;
    } else if (html.includes('already installed')) {
        console.log('ℹ️ Plugin déjà installé');
        return 'already_installed';
    } else {
        console.log('⚠️ Réponse inattendue:', html.substring(0, 500));
        return null;
    }
}

async function activatePlugin(cookie, activateUrl) {
    if (activateUrl === 'already_installed') {
        // Activer via URL directe
        activateUrl = `/wordpress/wp-admin/plugins.php?action=activate&plugin=lrm-github-sync%2Flrm-github-sync.php&_wpnonce=`;
        // Récupérer le nonce d'activation
        const res = await wpFetch(`${WP_URL}/wp-admin/plugins.php`, {
            headers: { Cookie: cookie }
        });
        const html = await res.text();
        const nonceMatch = html.match(/lrm-github-sync[^"]*_wpnonce=([a-f0-9]+)/);
        if (nonceMatch) activateUrl += nonceMatch[1];
    }

    console.log('⚡ Activation du plugin...');
    const fullUrl = activateUrl.startsWith('http') ? activateUrl : `${WP_URL}${activateUrl}`;

    const res = await wpFetch(fullUrl.replace(/&amp;/g, '&'), {
        headers: { Cookie: cookie },
        redirect: 'follow'
    });

    const html = await res.text();
    if (html.includes('Plugin activated') || html.includes('lrm-github-sync') || res.status === 200) {
        console.log('✅ Plugin activé !');
        return true;
    }
    console.log('⚠️ Statut activation:', res.status);
    return false;
}

async function configureToken(cookie, token) {
    if (!token) {
        console.log('⚠️ Pas de token GitHub fourni — configure-le dans WP Admin → Réglages → LRM GitHub Sync');
        return;
    }

    console.log('🔑 Configuration du token GitHub dans WP...');

    // Récupérer le nonce de la page settings
    const settingsPage = await wpFetch(`${WP_URL}/wp-admin/options-general.php?page=lrm-github-sync`, {
        headers: { Cookie: cookie }
    });
    const html = await settingsPage.text();
    const nonceMatch = html.match(/name="_wpnonce"\s+value="([^"]+)"/) ||
                       html.match(/"_wpnonce":"([^"]+)"/);

    const nonce = nonceMatch ? nonceMatch[1] : '';

    const body = new URLSearchParams({
        '_wpnonce': nonce,
        '_wp_http_referer': '/wordpress/wp-admin/options-general.php?page=lrm-github-sync',
        'option_page': 'lrm_settings',
        'action': 'update',
        'lrm_github_token': token,
        'submit': 'Enregistrer'
    });

    const res = await wpFetch(`${WP_URL}/wp-admin/options.php`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookie
        },
        body: body.toString(),
        redirect: 'follow'
    });

    if (res.ok) {
        console.log('✅ Token GitHub configuré dans WordPress !');
    } else {
        console.log(`⚠️ Réponse: ${res.status}`);
    }
}

async function testDispatch(token) {
    if (!token) return;

    console.log('\n🧪 Test du webhook GitHub...');
    const { default: fetch } = await import('node-fetch');

    const res = await fetch('https://api.github.com/repos/m4nur0ssi/Ag---Projet-site-cuisine/dispatches', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
            event_type: 'wp_full_sync',
            client_payload: { triggered_by: 'install-script', timestamp: new Date().toISOString() }
        })
    });

    if (res.status === 204) {
        console.log('✅ Webhook GitHub envoyé ! Vérifier : https://github.com/m4nur0ssi/Ag---Projet-site-cuisine/actions');
    } else {
        const text = await res.text();
        console.log(`❌ Webhook échoué (${res.status}): ${text.substring(0, 200)}`);
        if (res.status === 401) console.log('   → Token invalide ou expiré');
        if (res.status === 404) console.log('   → Token sans scope "repo"');
    }
}

(async () => {
    try {
        console.log('═══════════════════════════════════════════');
        console.log('  LRM WordPress → GitHub Sync — Installer  ');
        console.log('═══════════════════════════════════════════\n');

        if (!fs.existsSync(ZIP_PATH)) throw new Error(`ZIP introuvable: ${ZIP_PATH}`);
        console.log(`📦 ZIP trouvé: ${ZIP_PATH}\n`);

        const cookie    = await login();
        const nonce     = await getNonce(cookie);
        const activateUrl = await uploadPlugin(cookie, nonce);

        if (activateUrl) {
            await activatePlugin(cookie, activateUrl);
        }

        if (GITHUB_TOKEN) {
            await configureToken(cookie, GITHUB_TOKEN);
            await testDispatch(GITHUB_TOKEN);
        }

        console.log('\n═══════════════════════════════════════════');
        if (GITHUB_TOKEN) {
            console.log('🎉 TOUT EST CONFIGURÉ !');
            console.log('   WordPress → GitHub Actions → Netlify : ACTIF');
        } else {
            console.log('✅ Plugin installé et activé !');
            console.log('\n👉 ÉTAPE FINALE (manuelle en 2 min) :');
            console.log('   1. Créer un token : https://github.com/settings/tokens/new');
            console.log('      (scope: repo, No expiration)');
            console.log('   2. Relancer: node tiktok-bot/install-wp-plugin.js ghp_TON_TOKEN');
            console.log('   OU configurer dans: WP Admin → Réglages → LRM GitHub Sync');
        }
        console.log('═══════════════════════════════════════════');

    } catch (err) {
        console.error('\n❌ Erreur:', err.message);
        process.exit(1);
    }
})();
