/**
 * Contrôle du Nutri-Score sur tout le catalogue.
 * =============================================
 *
 * Le score se calcule à la volée dans la fiche : rien n'est stocké, donc rien
 * ne peut « se désynchroniser ». Ce qui peut déraper, en revanche, c'est la
 * LECTURE des lignes d'ingrédients — et elle ne se voit qu'en masse. C'est ce
 * script qui a montré qu'une cuillerée de sel pesait cent grammes, qu'une livre
 * de bœuf en pesait cent, et que « 15 crevettes » en pesait quinze.
 *
 * À lancer après toute retouche de `nutriments.ts`, `quantites.ts` ou
 * `nutriscore.ts`, et après une grosse synchronisation WordPress :
 *
 *     npm run nutri:verifier              → la répartition et les anomalies
 *     npm run nutri:verifier -- "Tajine"  → le détail ligne à ligne d'une recette
 *
 * Il ne modifie rien et ne renvoie un code d'erreur que si le barème lui-même
 * s'écarte des produits de référence — là, c'est l'algorithme qui a bougé.
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

const RACINE = path.join(__dirname, '..');

/*
 * On charge les modules TypeScript de l'application tels quels.
 *
 * Pas de copie des règles ici : le script doit vérifier CE QUI TOURNE dans la
 * fiche, pas une réécriture qui pourrait diverger. Le compilateur transpile à
 * la volée, et le résolveur de `require` traduit les chemins `@/`.
 */
const cache = new Map();
const resoudre = (spec, depuis) => {
    if (spec.startsWith('@/')) return path.join(RACINE, 'src', spec.slice(2));
    if (spec.startsWith('.')) return path.resolve(path.dirname(depuis), spec);
    return null;
};
function charger(fichier) {
    for (const ext of ['', '.ts', '.tsx', '/index.ts']) {
        const p = fichier + ext;
        if (fs.existsSync(p) && fs.statSync(p).isFile()) { fichier = p; break; }
    }
    if (cache.has(fichier)) return cache.get(fichier).exports;
    if (fichier.endsWith('.json')) {
        const m = { exports: JSON.parse(fs.readFileSync(fichier, 'utf8')) };
        cache.set(fichier, m);
        return m.exports;
    }
    const source = fs.readFileSync(fichier, 'utf8');
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
        fileName: fichier,
    });
    const module_ = { exports: {} };
    cache.set(fichier, module_);
    const requerir = (spec) => {
        const cible = resoudre(spec, fichier);
        return cible ? charger(cible) : require(spec);
    };
    new Function('exports', 'require', 'module', '__filename', '__dirname', outputText)(
        module_.exports, requerir, module_, fichier, path.dirname(fichier),
    );
    return module_.exports;
}

const { nutriscoreRecette, detaillerRecette, scoreDepuisValeurs } =
    charger(path.join(RACINE, 'src/lib/nutriscore.ts'));
const { mockRecipes } = charger(path.join(RACINE, 'src/data/mockData.ts'));

/* ── 1. Le barème, contre des produits dont la note officielle est connue ──── */

const v = (kcal, prot, gluc, suc, lip, sat, fib, sel, fln) =>
    ({ kcal, kJ: kcal * 4.184, proteines: prot, glucides: gluc, sucres: suc, lipides: lip, satures: sat, fibres: fib, sel, fln });

const REPERES = [
    ['Nutella',            v(539, 6.3, 57.5, 56.3, 30.9, 10.6, 3.4, 0.107, 13), false, 'E'],
    ['Coca-Cola',          v(42, 0, 10.6, 10.6, 0, 0, 0, 0, 0),                 true,  'E'],
    ['Eau minérale',       v(0, 0, 0, 0, 0, 0, 0, 0, 0),                        true,  'A'],
    ['Lait demi-écrémé',   v(46, 3.3, 4.8, 4.8, 1.6, 1.0, 0, 0.1, 0),           false, 'B'],
    ['Haricots verts',     v(30, 1.8, 3.5, 1.8, 0.2, 0.05, 3.0, 0.3, 100),      false, 'A'],
    ['Chips',              v(540, 6, 50, 0.5, 34, 3.2, 4.5, 1.3, 0),            false, 'D'],
    ['Filet de poulet',    v(111, 23, 0, 0, 1.7, 0.5, 0, 0.15, 0),              false, 'A'],
    ['Jus d’orange 100 %', v(45, 0.7, 10, 9, 0.2, 0.03, 0.3, 0.01, 100),        true,  'C'],
    ['Limonade',           v(40, 0, 10, 10, 0, 0, 0, 0.02, 0),                  true,  'E'],
];

function verifierBareme() {
    let ecarts = 0;
    console.log('\x1b[1mBarème — produits de référence\x1b[0m');
    for (const [nom, valeurs, boisson, attendu] of REPERES) {
        const { lettre, points } = scoreDepuisValeurs(valeurs, boisson);
        const ok = lettre === attendu;
        if (!ok) ecarts++;
        console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nom.padEnd(20)} ${lettre} (${String(points).padStart(3)} pts)   officiel ${attendu}`);
    }
    return ecarts;
}

/* ── 2. Le catalogue ───────────────────────────────────────────────────────── */

function verifierCatalogue() {
    const recettes = mockRecipes.filter((r) => r.category !== 'restaurant');
    const dist = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    const sans = [];
    const sales = [];
    const inconnus = new Map();

    for (const r of recettes) {
        // Seules comptent les lignes qui PÈSENT : celles qu'on n'a ni reconnues
        // ni chiffrées sont écartées du calcul, les signaler n'apprendrait rien.
        for (const d of detaillerRecette(r)) if (!d.connu && d.g > 0) inconnus.set(d.produit ?? d.brut.replace(/\s+/g, ' ').slice(0, 40), (inconnus.get(d.produit ?? d.brut.replace(/\s+/g, ' ').slice(0, 40)) || 0) + 1);
        const n = nutriscoreRecette(r);
        if (!n) { sans.push(r.title); continue; }
        dist[n.lettre]++;
        // Au-delà de 3 g de sel pour 100 g, un plat cuisiné est presque toujours
        // le signe d'une ligne mal lue — pas d'une recette vraiment salée.
        if (n.pour100g.sel > 3) sales.push([r.title, n.pour100g.sel]);
    }

    const notees = Object.values(dist).reduce((a, b) => a + b, 0);
    console.log(`\n\x1b[1mCatalogue\x1b[0m — ${recettes.length} recettes (hors restaurants)`);
    console.log(`  notées ${notees}  ·  sans score ${sans.length} (${Math.round((sans.length / recettes.length) * 100)} %)`);
    console.log('  ' + Object.entries(dist).map(([l, n]) => `${l} ${n} (${Math.round((n / notees) * 100)} %)`).join('   '));

    if (sales.length) {
        console.log(`\n\x1b[33mSel > 3 g/100 g — à vérifier (${sales.length})\x1b[0m`);
        sales.sort((a, b) => b[1] - a[1]).slice(0, 12)
            .forEach(([t, s]) => console.log(`  ${s.toFixed(2)} g   ${t.slice(0, 60)}`));
    }

    const tri = [...inconnus.entries()].sort((a, b) => b[1] - a[1]).filter(([, c]) => c >= 3);
    if (tri.length) {
        console.log(`\n\x1b[33mIngrédients non reconnus, vus au moins 3 fois (${tri.length})\x1b[0m`);
        console.log('  → les ajouter à src/lib/nutriments.ts améliore la couverture');
        tri.slice(0, 20).forEach(([n, c]) => console.log(`  ${String(c).padStart(3)} × ${n}`));
    }
}

/* ── 3. Le détail d'une recette, sur demande ───────────────────────────────── */

function detailler(motif) {
    const trouvees = mockRecipes.filter((r) => r.title.toLowerCase().includes(motif.toLowerCase()));
    if (!trouvees.length) return console.log(`Aucune recette ne contient « ${motif} ».`);
    for (const r of trouvees.slice(0, 5)) {
        console.log(`\n\x1b[1m${r.title}\x1b[0m — ${r.servings} parts, ${r.category}`);
        for (const d of detaillerRecette(r)) {
            console.log(`  ${String(d.g).padStart(5)} g  ${d.connu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${(d.produit || '—').padEnd(22)} ⟵ ${d.brut.replace(/\s+/g, ' ').slice(0, 60)}`);
        }
        const n = nutriscoreRecette(r);
        console.log(n
            ? `  → \x1b[1m${n.lettre}\x1b[0m (${n.points} pts) · ${Math.round(n.pour100g.kcal)} kcal · sucres ${n.pour100g.sucres.toFixed(1)} · saturés ${n.pour100g.satures.toFixed(1)} · sel ${n.pour100g.sel.toFixed(2)} · f/l ${Math.round(n.pour100g.fln)} % · ${n.poidsTotal} g`
            : '  → pas de score (trop d’inconnues)');
    }
}

const motif = process.argv.slice(2).join(' ').trim();
if (motif) {
    detailler(motif);
} else {
    const ecarts = verifierBareme();
    verifierCatalogue();
    if (ecarts) {
        console.log(`\n\x1b[31m${ecarts} produit(s) de référence hors barème — l’algorithme a changé.\x1b[0m`);
        process.exit(1);
    }
    console.log('\n\x1b[32mBarème conforme aux produits de référence.\x1b[0m');
}
