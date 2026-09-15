/*
 * Télécharge les polices Google et les installe DANS le site.
 *
 * Pourquoi : un <link> vers fonts.googleapis.com envoie l'adresse IP de chaque
 * visiteur à Google avant tout consentement (RGPD, jurisprudence allemande de
 * 2022, recommandations CNIL). Servies depuis notre domaine, plus de transfert.
 *
 * Le script recopie à l'identique ce que Google renvoie — mêmes graisses, mêmes
 * plages Unicode — et déduplique les fichiers (les familles variables servent le
 * même .woff2 pour toutes les graisses). Résultat : src/app/fonts.css.
 *
 *   node scripts/telecharger-polices.js
 *
 * Ajouter une famille : compléter FAMILLES ci-dessous, relancer, c'est tout.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FAMILLES = [
    'family=Dancing+Script:wght@700&family=Outfit:wght@400;600;800;900',
    'family=Noto+Serif:wght@400;600;700&family=Space+Grotesk:wght@400;500;600;700',
];

// Sans user-agent moderne, Google renvoie des .ttf au lieu des .woff2.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const dossier = path.join(__dirname, '..', 'public', 'fonts');
const sortie = path.join(__dirname, '..', 'src', 'app', 'fonts.css');

async function texte(url) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.text();
}

async function octets(url) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
}

async function main() {
    fs.mkdirSync(dossier, { recursive: true });
    const parEmpreinte = new Map();
    const blocs = [];

    for (const famille of FAMILLES) {
        const css = await texte(`https://fonts.googleapis.com/css2?${famille}&display=swap`);
        const faces = css.matchAll(/\/\* ([\w-]+) \*\/\s*@font-face \{(.*?)\}/gs);
        for (const [, sousEnsemble, corps] of faces) {
            const nomFamille = /font-family: '([^']+)'/.exec(corps)[1];
            const graisse = /font-weight: (\d+)/.exec(corps)[1];
            const url = /src: url\((https:\/\/[^)]+)\)/.exec(corps)[1];
            const plage = /unicode-range: ([^;]+);/.exec(corps)[1];

            const donnees = await octets(url);
            const empreinte = crypto.createHash('sha1').update(donnees).digest('hex');
            let fichier = parEmpreinte.get(empreinte);
            if (!fichier) {
                fichier = `${nomFamille.toLowerCase().replace(/ /g, '-')}-${graisse}-${sousEnsemble}.woff2`;
                fs.writeFileSync(path.join(dossier, fichier), donnees);
                parEmpreinte.set(empreinte, fichier);
            }

            blocs.push(`@font-face {
  font-family: '${nomFamille}';
  font-style: normal;
  font-weight: ${graisse};
  font-display: swap;
  src: url('/fonts/${fichier}') format('woff2');
  unicode-range: ${plage};
}`);
        }
    }

    const entete = fs.readFileSync(sortie, 'utf8').split('@font-face')[0];
    fs.writeFileSync(sortie, entete + blocs.join('\n') + '\n');
    console.log(`${blocs.length} déclarations, ${parEmpreinte.size} fichiers dans public/fonts`);
}

main().catch((e) => { console.error(e); process.exit(1); });
