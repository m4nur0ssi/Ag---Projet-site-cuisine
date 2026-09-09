#!/usr/bin/env node
/**
 * Tourner les vidéos du tutoriel.
 * ===============================
 *
 *   npm run tuto:videos            → toutes les scènes
 *   npm run tuto:videos recherche  → une seule
 *
 * Il faut que le serveur de développement tourne (npm run dev, port 3007) et,
 * pour les écrans réservés aux membres, que `NEXT_PUBLIC_FAUX_COMPTE=1` soit
 * dans `.env.local` — sinon la caméra filme un écran de connexion.
 *
 * Sortie : `public/tuto/<scène>.webm` (+ une image d'attente `.jpg`).
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { lancerChrome, ouvrirPage, dormir } = require('./tuto/cdp');
const { pilote, filmer } = require('./tuto/scene');
const { SCENES } = require('./tuto/scenes');

const BASE = process.env.TUTO_BASE || 'http://localhost:3007';
const SORTIE = path.join(__dirname, '..', 'public', 'tuto');

async function tourner(nom, scene) {
    // Le décor d'une scène peut être calculé (de vraies recettes tirées du
    // catalogue, voir tuto/recettes.js) : on accepte donc aussi une fonction.
    const avant = typeof scene.avant === 'function' ? scene.avant() : (scene.avant || '');
    const chrome = await lancerChrome({ largeur: 390, hauteur: 844 });
    const brut = fs.mkdtempSync(path.join(os.tmpdir(), `tuto-${nom}-`));
    try {
        const page = await ouvrirPage(chrome.port);
        await page.envoyer('Emulation.setDeviceMetricsOverride', {
            width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
        });
        await page.envoyer('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
        /*
         * On déblaie l'écran AVANT le premier rendu : bulles d'astuce, bandeau
         * des cookies, invitation à installer l'application. Ces panneaux sont
         * utiles à un visiteur, mais dans une vidéo de démonstration ils
         * couvrent précisément ce qu'on veut montrer — et avalent les gestes.
         */
        await page.envoyer('Page.addScriptToEvaluateOnNewDocument', {
            source: `try {
                localStorage.setItem('magic-tips-seen-v1', JSON.stringify(
                    ['accueil','cave','planner','courses','favoris','palmares','resto','fiche','recherche']));
                localStorage.setItem('cookie-consent-v1', 'refuse');
                localStorage.setItem('magic-install-refus-v1', 'oui');
                localStorage.setItem('magic-tuto-vu', 'oui');
                // Un trophée se déclenche dès qu'une semaine est planifiée — or
                // les scènes en posent une. Sa fanfare couvre tout l'écran
                // pendant trois secondes. (Les noms : src/lib/trophies.ts.)
                localStorage.setItem('trophies-seen-v1', JSON.stringify(
                    ['Première flamme', 'Apprenti', 'Chef de maison', 'Collectionneur', 'Tour du monde', 'Organisé']));
                // L'écran d'accueil animé (« Explorer ») passe une fois par session :
                // dans une vidéo, il masque l'application pendant dix secondes.
                sessionStorage.setItem('hasSeenMagicSplash-v8', 'true');
            } catch (e) {}
            ${avant}`,
        });

        const p = pilote(page);
        await p.allerA(BASE + scene.page);
        // Le bandeau des cookies mangerait le bas de l'image.
        await p.evaluer(`(() => {
            const b = [...document.querySelectorAll('button')].find(x => /Accepter|Tout accepter|Refuser/i.test(x.textContent));
            if (b) b.click();
        })()`);
        await dormir(900);
        await p.poserLeDoigt();

        const images = await filmer(page, brut, () => scene.jouer(p));
        if (!images) throw new Error('aucune image capturée');

        // Montage : chaque image garde sa vraie durée (voir scene.js).
        const minutage = JSON.parse(fs.readFileSync(path.join(brut, 'minutage.json'), 'utf8'));
        const liste = minutage.map((img, i) => {
            const suivant = minutage[i + 1];
            const duree = suivant ? Math.min(Math.max(suivant.t - img.t, 0.03), 1.2) : 0.6;
            return `file '${path.join(brut, img.nom)}'\nduration ${duree.toFixed(3)}`;
        }).join('\n') + `\nfile '${path.join(brut, minutage[minutage.length - 1].nom)}'\n`;
        const fichierListe = path.join(brut, 'liste.txt');
        fs.writeFileSync(fichierListe, liste);

        fs.mkdirSync(SORTIE, { recursive: true });
        const webm = path.join(SORTIE, `${nom}.webm`);
        execFileSync('ffmpeg', [
            '-y', '-f', 'concat', '-safe', '0', '-i', fichierListe,
            '-vf', 'scale=390:-2:flags=lanczos,fps=24',
            '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1',
            '-an', webm,
        ], { stdio: 'pipe' });
        execFileSync('ffmpeg', ['-y', '-i', webm, '-frames:v', '1', '-q:v', '5', path.join(SORTIE, `${nom}.jpg`)], { stdio: 'pipe' });

        const ko = Math.round(fs.statSync(webm).size / 1024);
        console.log(`✅ ${nom} — ${images} images, ${ko} ko`);
    } finally {
        chrome.arreter();
        fs.rmSync(brut, { recursive: true, force: true });
    }
}

(async () => {
    const demandees = process.argv.slice(2);
    const noms = demandees.length ? demandees : Object.keys(SCENES);
    for (const nom of noms) {
        const scene = SCENES[nom];
        if (!scene) { console.error(`✖ scène inconnue : ${nom}`); process.exitCode = 1; continue; }
        try { await tourner(nom, scene); }
        catch (e) { console.error(`✖ ${nom} — ${e.message}`); process.exitCode = 1; }
    }
})();
