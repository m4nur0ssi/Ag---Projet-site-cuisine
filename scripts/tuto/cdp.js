/**
 * Un pilote de Chrome, réduit à ce qu'il faut pour filmer l'application.
 * =====================================================================
 *
 * Pas de bibliothèque : Chrome expose déjà tout par son protocole de débogage,
 * et Node sait parler WebSocket tout seul depuis la version 21. On lance donc
 * un Chrome sans fenêtre, on lui demande d'ouvrir une page, on lui envoie des
 * gestes, et on récupère le film image par image (`Page.startScreencast`).
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function attendreLeDebogueur(port, essais = 60) {
    for (let i = 0; i < essais; i++) {
        try {
            const r = await fetch(`http://127.0.0.1:${port}/json/version`);
            if (r.ok) return await r.json();
        } catch { /* pas encore là */ }
        await dormir(250);
    }
    throw new Error("Chrome n'a pas ouvert son port de débogage");
}

/** Lance un Chrome sans fenêtre, isolé (aucun profil personnel touché). */
async function lancerChrome({ port = 9333, largeur = 390, hauteur = 844 } = {}) {
    const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-tuto-'));
    const chrome = spawn(CHROME, [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profil}`,
        `--window-size=${largeur},${hauteur}`,
        '--hide-scrollbars',
        '--force-device-scale-factor=2',
        '--autoplay-policy=no-user-gesture-required',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        'about:blank',
    ], { stdio: 'ignore' });
    await attendreLeDebogueur(port);
    return {
        /*
         * Chrome écrit encore son cache au moment où on le tue : effacer son
         * profil dans la foulée échoue une fois sur trois (« ENOTEMPTY »). Cette
         * exception-là partait du `finally` du tournage et emportait la vidéo
         * qui venait d'être montée. Un dossier temporaire oublié ne coûte rien ;
         * une prise perdue, si.
         */
        arreter() {
            try { chrome.kill('SIGKILL'); } catch { /* déjà parti */ }
            for (let essai = 0; essai < 5; essai++) {
                try { fs.rmSync(profil, { recursive: true, force: true }); return; } catch { /* il écrit encore */ }
            }
        },
        port,
    };
}

/** Une page ouverte, avec de quoi lui parler. */
async function ouvrirPage(port) {
    const cibles = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    let cible = cibles.find((c) => c.type === 'page');
    if (!cible) {
        cible = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    }
    const ws = new WebSocket(cible.webSocketDebuggerUrl);
    await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = () => ko(new Error('WebSocket refusé')); });

    let id = 0;
    const attentes = new Map();
    const abonnes = new Map();
    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && attentes.has(msg.id)) {
            const { ok, ko } = attentes.get(msg.id);
            attentes.delete(msg.id);
            msg.error ? ko(new Error(msg.error.message)) : ok(msg.result);
        } else if (msg.method && abonnes.has(msg.method)) {
            abonnes.get(msg.method).forEach((f) => f(msg.params));
        }
    };

    const envoyer = (method, params = {}) => new Promise((ok, ko) => {
        const n = ++id;
        attentes.set(n, { ok, ko });
        ws.send(JSON.stringify({ id: n, method, params }));
    });
    const sur = (method, f) => {
        if (!abonnes.has(method)) abonnes.set(method, []);
        abonnes.get(method).push(f);
    };

    await envoyer('Page.enable');
    await envoyer('Runtime.enable');
    return { envoyer, sur, fermer: () => ws.close() };
}

module.exports = { lancerChrome, ouvrirPage, dormir };
