/*
 * Efface un compte et TOUT ce qui y est rattaché (RGPD, art. 17).
 *
 * La politique de confidentialité promet une suppression sous trente jours sur
 * simple e-mail à contact@lesrecettesmagiques.fr. Ce script est ce qui rend la
 * promesse tenable : sans lui, il faudrait vider douze tables à la main dans
 * l'interface Supabase, et on oublierait la douzième.
 *
 *   node scripts/supprimer-compte.js quelquun@exemple.fr          → inventaire seul
 *   node scripts/supprimer-compte.js quelquun@exemple.fr --confirmer → efface
 *
 * L'inventaire est le mode PAR DÉFAUT, et volontairement : on regarde ce qu'on
 * s'apprête à détruire avant de le détruire. Rien n'est récupérable ensuite.
 *
 * Demande SUPABASE_SERVICE_ROLE_KEY (la clé secrète du projet, celle de Vercel —
 * la clé publique ne peut pas toucher aux comptes des autres). À mettre dans
 * .env.local le temps de l'opération, ou devant la commande.
 */
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');

/** Lit .env.local sans dépendance : le script tourne hors de Next. */
function chargerEnv(fichier) {
    if (!fs.existsSync(fichier)) return;
    for (const ligne of fs.readFileSync(fichier, 'utf8').split('\n')) {
        const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
}
chargerEnv(path.join(RACINE, '.env.local'));

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/*
 * Les tables qui portent des données personnelles, toutes rattachées au compte
 * par `user_id`. La liste vit dans src/lib/tables-personnelles.json, lue AUSSI
 * par le bouton « Supprimer mon compte » du site (api/supprimer-compte) : une
 * seule liste, pas deux à tenir d'accord. Une table ajoutée au site doit y être
 * ajoutée le jour même — une table oubliée, c'est une donnée qui survit.
 */
const TABLES = require('../src/lib/tables-personnelles.json');

const entetes = {
    'apikey': CLE,
    'Authorization': `Bearer ${CLE}`,
    'Content-Type': 'application/json',
};

async function trouverCompte(email) {
    // L'API admin filtre déjà côté serveur ; la comparaison locale évite de
    // tomber sur un compte dont l'adresse ne fait que contenir la nôtre.
    const r = await fetch(`${URL_BASE}/auth/v1/admin/users?page=1&per_page=200`, { headers: entetes });
    if (!r.ok) throw new Error(`liste des comptes : ${r.status} ${await r.text()}`);
    const { users } = await r.json();
    return users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) || null;
}

async function compter(table, id) {
    const r = await fetch(`${URL_BASE}/rest/v1/${table}?user_id=eq.${id}&select=*`, {
        headers: { ...entetes, Prefer: 'count=exact', Range: '0-0' },
    });
    if (r.status === 404) return null;               // table absente du projet
    if (!r.ok) throw new Error(`${table} : ${r.status} ${await r.text()}`);
    const plage = r.headers.get('content-range') || '';  // « 0-0/12 »
    return Number(plage.split('/')[1] || 0);
}

async function effacer(table, id) {
    const r = await fetch(`${URL_BASE}/rest/v1/${table}?user_id=eq.${id}`, {
        method: 'DELETE',
        headers: entetes,
    });
    if (!r.ok && r.status !== 404) throw new Error(`${table} : ${r.status} ${await r.text()}`);
}

async function main() {
    const email = process.argv[2];
    const confirme = process.argv.includes('--confirmer');

    if (!email) {
        console.error('Usage : node scripts/supprimer-compte.js <email> [--confirmer]');
        process.exit(1);
    }
    if (!URL_BASE || !CLE) {
        console.error('Il manque NEXT_PUBLIC_SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY.');
        console.error('La clé secrète se récupère dans Supabase → Settings → API (service_role).');
        process.exit(1);
    }

    const compte = await trouverCompte(email);
    if (!compte) {
        console.error(`Aucun compte pour ${email}. Rien à faire.`);
        process.exit(1);
    }

    console.log(`Compte ${compte.email} (${compte.id}), créé le ${compte.created_at.slice(0, 10)}`);
    let total = 0;
    for (const table of TABLES) {
        const n = await compter(table, compte.id);
        if (n === null) { console.log(`  ${table.padEnd(16)} — table absente`); continue; }
        total += n;
        console.log(`  ${table.padEnd(16)} ${n} ligne(s)`);
    }
    console.log(`Total : ${total} ligne(s) + le compte lui-même.`);

    if (!confirme) {
        console.log('\nInventaire seul. Pour effacer pour de bon, relancer avec --confirmer.');
        return;
    }

    for (const table of TABLES) {
        await effacer(table, compte.id);
        console.log(`  ${table} vidé`);
    }
    const r = await fetch(`${URL_BASE}/auth/v1/admin/users/${compte.id}`, {
        method: 'DELETE',
        headers: entetes,
    });
    if (!r.ok) throw new Error(`suppression du compte : ${r.status} ${await r.text()}`);
    console.log(`\nCompte ${compte.email} supprimé. Répondre à la personne, la demande est close.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
