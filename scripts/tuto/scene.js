/**
 * Filmer une scène : on joue des gestes dans la page, on ramasse les images.
 * =========================================================================
 *
 * Le doigt est DESSINÉ (un rond clair qui se resserre au contact) : sans lui,
 * la vidéo montre des choses qui bougent sans qu'on comprenne ce qui les
 * pousse. C'est toute la différence entre une capture d'écran animée et une
 * démonstration.
 */

const fs = require('fs');
const path = require('path');
const { dormir } = require('./cdp');

const DOIGT = `
(() => {
  if (window.__doigt) return;
  const d = document.createElement('div');
  d.id = '__doigt';
  d.style.cssText = 'position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;'
    + 'border-radius:999px;background:rgba(255,255,255,.28);box-shadow:0 0 0 2px rgba(255,255,255,.75),0 8px 24px rgba(0,0,0,.45);'
    + 'z-index:2147483647;pointer-events:none;opacity:0;transition:opacity .12s linear,transform .12s ease;';
  document.body.appendChild(d);
  window.__doigt = {
    montrer(x, y) { d.style.opacity = '1'; d.style.transform = \`translate(\${x}px, \${y}px)\`; },
    appuyer(on) { d.style.transform = d.style.transform.replace(/ scale\\([^)]*\\)/, '') + (on ? ' scale(.72)' : ''); },
    cacher() { d.style.opacity = '0'; },
  };
})();
`;

/** Une page pilotée : gestes de haut niveau, tous « filmables ». */
function pilote(page) {
    const evaluer = async (expr) => {
        const r = await page.envoyer('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' — ' + (r.exceptionDetails.exception?.description || ''));
        return r.result?.value;
    };
    const doigt = (methode, ...args) => evaluer(`window.__doigt && window.__doigt.${methode}(${args.join(',')})`);

    const toucher = async (type, x, y) => {
        await page.envoyer('Input.dispatchTouchEvent', {
            type,
            touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 12, radiusY: 12, force: 1 }],
        });
    };

    /*
     * Ne retenir que ce qui est réellement à l'écran : un élément hors du
     * cadre (carrousel, liste déroulée) a bien une position, mais le doigt qui
     * s'y rend touche ce qui occupe la place.
     */
    const centreParTexte = async (motif, dansQuoi = 'button') => {
        const r = await evaluer(`(() => {
            const re = new RegExp(${JSON.stringify(motif)}, 'i');
            const vu = (b) => b.width && b.height && b.top >= 0 && b.bottom <= window.innerHeight
                && b.left >= 0 && b.right <= window.innerWidth;
            const e = [...document.querySelectorAll(${JSON.stringify(dansQuoi)})]
                .filter(x => vu(x.getBoundingClientRect()))
                .find(x => re.test(x.textContent || '') || re.test(x.getAttribute('aria-label') || ''));
            if (!e) return null;
            const b = e.getBoundingClientRect();
            return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
        })()`);
        if (!r) throw new Error('rien de visible qui ressemble à « ' + motif + ' »');
        return r;
    };

    return {
        evaluer,
        poserLeDoigt: () => evaluer(DOIGT),
        async allerA(url) {
            await page.envoyer('Page.navigate', { url });
            await dormir(2500);
            await evaluer(DOIGT);
        },
        async attendre(ms) { await dormir(ms); },
        /** Un appui bref, doigt visible. */
        async tap(x, y, { avant = 260, apres = 700 } = {}) {
            await doigt('montrer', x, y); await dormir(avant);
            await doigt('appuyer', 'true');
            await toucher('touchStart', x, y); await dormir(90);
            await toucher('touchEnd', x, y);
            await doigt('appuyer', 'false'); await dormir(apres);
            await doigt('cacher');
        },
        /** Un appui TENU : c'est le geste de l'application, il doit se voir. */
        async appuiLong(x, y, duree = 900) {
            await doigt('montrer', x, y); await dormir(250);
            await doigt('appuyer', 'true');
            await toucher('touchStart', x, y);
            await dormir(duree);
            await toucher('touchEnd', x, y);
            await doigt('appuyer', 'false'); await dormir(500);
            await doigt('cacher');
        },
        /**
         * Un glissé qui suit un TRAJET, en douceur — le doigt passe par chaque
         * point sans jamais se relever.
         *
         * Un trait droit ne suffit pas partout : la cave ne décolle une
         * bouteille qu'au premier mouvement LATÉRAL (vers le haut ou le bas,
         * c'est la page qui défile). Il faut donc partir de côté, puis
         * descendre — deux glissés séparés relèveraient le doigt entre les deux
         * et le geste serait perdu.
         */
        async glisserPar(points, { pas = 18, tenirAvant = 0, pause = 24 } = {}) {
            const [depart, ...suite] = points;
            let courant = depart;
            await doigt('montrer', courant.x, courant.y); await dormir(220);
            await doigt('appuyer', 'true');
            await toucher('touchStart', courant.x, courant.y);
            if (tenirAvant) await dormir(tenirAvant);
            for (const cible of suite) {
                const { x: x0, y: y0 } = courant;
                for (let i = 1; i <= pas; i++) {
                    const x = Math.round(x0 + (cible.x - x0) * (i / pas));
                    const y = Math.round(y0 + (cible.y - y0) * (i / pas));
                    await toucher('touchMove', x, y);
                    await doigt('montrer', x, y);
                    await dormir(pause);
                }
                courant = cible;
            }
            await toucher('touchEnd', courant.x, courant.y);
            await doigt('appuyer', 'false'); await dormir(600);
            await doigt('cacher');
        },
        /** Un glissé, en douceur — le doigt suit vraiment le trajet. */
        async glisser(x0, y0, x1, y1, { pas = 24, tenirAvant = 0, pause = 22 } = {}) {
            return this.glisserPar([{ x: x0, y: y0 }, { x: x1, y: y1 }], { pas, tenirAvant, pause });
        },
        /**
         * Frapper un mot lettre à lettre dans un champ.
         *
         * D'un bloc, le champ se remplirait d'un coup et la vidéo ne montrerait
         * rien du rafraîchissement à chaque lettre — qui est justement ce qu'on
         * veut montrer. On passe par le mutateur natif : React n'entend pas une
         * affectation directe de `value`.
         */
        async taper(selecteur, mot, { cadence = 155 } = {}) {
            await evaluer(`(() => {
                const champ = document.querySelector(${JSON.stringify(selecteur)});
                if (!champ) throw new Error('champ introuvable');
                const poser = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                let n = 0;
                const mot = ${JSON.stringify(mot)};
                const frappe = setInterval(() => {
                    n++;
                    poser.call(champ, mot.slice(0, n));
                    champ.dispatchEvent(new Event('input', { bubbles: true }));
                    if (n >= mot.length) clearInterval(frappe);
                }, ${cadence});
            })()`);
            await dormir(mot.length * cadence + 400);
        },
        /**
         * Une vraie touche du clavier. L'assistant, lui, ne se valide qu'ainsi :
         * pas de bouton « envoyer », c'est « Entrée » qui pose la question.
         */
        async touche(nom = 'Enter', selecteur = null) {
            if (selecteur) await evaluer(`document.querySelector(${JSON.stringify(selecteur)}).focus()`);
            const commun = { key: nom, code: nom, windowsVirtualKeyCode: nom === 'Enter' ? 13 : 0, nativeVirtualKeyCode: nom === 'Enter' ? 13 : 0 };
            await page.envoyer('Input.dispatchKeyEvent', { type: 'keyDown', ...commun });
            await page.envoyer('Input.dispatchKeyEvent', { type: 'keyUp', ...commun });
            await dormir(300);
        },
        /** Position d'un élément, pour viser sans coordonnées en dur. */
        async centre(selecteur) {
            const r = await evaluer(`(() => {
                const e = document.querySelector(${JSON.stringify(selecteur)});
                if (!e) return null;
                const b = e.getBoundingClientRect();
                return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
            })()`);
            if (!r) throw new Error('élément introuvable : ' + selecteur);
            return r;
        },
        centreParTexte,
        /**
         * Amène un élément sous les yeux, puis rend sa position.
         *
         * Les longues listes (le menu et ses filtres, la liste de courses) ont
         * presque toujours leur cible hors de l'écran : viser sans l'amener,
         * c'est toucher ce qui se trouvait là par hasard. Le déroulé se voit
         * dans la vidéo, et c'est très bien : c'est ce que fait un vrai doigt.
         */
        async amener(motif, dansQuoi = 'button', { attente = 800 } = {}) {
            const trouve = await evaluer(`(() => {
                const re = new RegExp(${JSON.stringify(motif)}, 'i');
                const e = [...document.querySelectorAll(${JSON.stringify(dansQuoi)})]
                    .filter(x => x.getBoundingClientRect().width)
                    .find(x => re.test(x.textContent || '') || re.test(x.getAttribute('aria-label') || ''));
                if (!e) return false;
                e.scrollIntoView({ block: 'center', behavior: 'smooth' });
                return true;
            })()`);
            if (!trouve) throw new Error('rien qui ressemble à « ' + motif + ' »');
            await dormir(attente);
            return centreParTexte(motif, dansQuoi);
        },
    };
}

/**
 * Filme pendant que la scène se joue, et rend le dossier d'images.
 *
 * Chrome n'envoie une image que lorsque quelque chose bouge : on note donc
 * l'HEURE de chaque image, sinon le montage étire les moments immobiles et
 * précipite les gestes.
 */
async function filmer(page, dossier, jouer) {
    fs.mkdirSync(dossier, { recursive: true });
    let n = 0;
    const minutage = [];
    page.sur('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
        const nom = `f${String(++n).padStart(5, '0')}.jpg`;
        fs.writeFileSync(path.join(dossier, nom), Buffer.from(data, 'base64'));
        minutage.push({ nom, t: metadata?.timestamp ?? Date.now() / 1000 });
        try { await page.envoyer('Page.screencastFrameAck', { sessionId }); } catch { /* fin de film */ }
    });
    await page.envoyer('Page.startScreencast', { format: 'jpeg', quality: 82, everyNthFrame: 1, maxWidth: 780, maxHeight: 1688 });
    await jouer();
    await page.envoyer('Page.stopScreencast');
    fs.writeFileSync(path.join(dossier, 'minutage.json'), JSON.stringify(minutage, null, 1));
    return n;
}

module.exports = { pilote, filmer };
