/**
 * WordPress répond-il, et nos identifiants sont-ils encore bons ?
 * ==============================================================
 *
 * Trois choses différentes peuvent casser, et elles se ressemblent de loin :
 * le NAS est éteint, son adresse publique a changé, ou le mot de passe ne vaut
 * plus rien. Ce script les distingue.
 *
 *   node scripts/verifier-wordpress.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const BASE = (process.env.WP_XMLRPC_URL || 'http://109.221.250.122/wordpress/xmlrpc.php')
    .replace(/\/xmlrpc\.php.*$/, '');
const U = process.env.WP_USERNAME || '';
const P = process.env.WP_PASSWORD || '';
const masque = (t) => String(t).replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '<ip>');

(async () => {
    console.log('Adresse :', masque(BASE));

    // 1. Le serveur répond-il ?
    try {
        const r = await fetch(`${BASE}/wp-json/`, { signal: AbortSignal.timeout(15000) });
        if (r.status >= 500) {
            const t = (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            console.log(`❌ Le serveur répond ${r.status} — ${t.slice(0, 80)}`);
            console.log('   WordPress tourne mais quelque chose sous lui est cassé (souvent la base de données).');
            return;
        }
        console.log('✅ Le serveur répond (' + r.status + ')');
    } catch (e) {
        console.log('❌ Injoignable :', masque(e.message));
        console.log('   NAS éteint, ou adresse publique changée. Vérifie WP_XMLRPC_URL dans .env.local.');
        return;
    }

    // 2. Les identifiants valent-ils encore quelque chose ?
    if (!U || !P) { console.log('❌ WP_USERNAME ou WP_PASSWORD absent de .env.local'); return; }
    const auth = 'Basic ' + Buffer.from(`${U}:${P}`).toString('base64');
    const r = await fetch(`${BASE}/wp-json/wp/v2/users/me?context=edit`, {
        headers: { Authorization: auth }, signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
        const j = await r.json();
        console.log('✅ Identifiants acceptés — connecté en tant que', j.name);
        return;
    }
    let msg = String(r.status);
    try { msg = (await r.json()).message || msg; } catch { /* page HTML */ }
    console.log('❌ Identifiants refusés :', masque(msg));
    console.log('   Crée un MOT DE PASSE D\'APPLICATION dans WordPress');
    console.log('   (Utilisateurs → ton profil → Mots de passe d\'application),');
    console.log('   puis remplace WP_PASSWORD dans .env.local.');
})();
