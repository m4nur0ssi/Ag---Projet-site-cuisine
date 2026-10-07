const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
function load(file, deps = {}, globals = {}) {
    const module = { exports: {} };
    const requireLocal = name => name in deps ? deps[name] : load(name.startsWith('@/') ? 'src/' + name.slice(2) + '.ts' : path.posix.join(path.posix.dirname(file), name) + '.ts', deps, globals);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(root + '/' + file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
        { module, exports: module.exports, require: requireLocal, ...globals });
    return module.exports;
}
const i = load('src/lib/ingredients.ts');
const rec = (...names) => ({ ingredients: names.map(name => ({ name })) });
for (const lib of [i, load('src/mobile/lib/ingredients.ts')]) {
    const plan = { Lun: { m: rec('1 ail') }, Mar: { m: rec('1 ail') }, Mer: { m: rec('1 ail') } };
    const total = lib.buildConsolidatedItems(plan, new Set(), {});
    assert.equal(total[0].qty, 3);
    const done = new Set(['Lun|m|0|0']);
    const rest = lib.buildConsolidatedItems(plan, new Set(), {}, true, true, done);
    assert.equal(rest[0].qty, 2);
    assert(lib.sourceLineDone('Lun|m|0|0', total, done));
    assert(!lib.sourceLineDone('Mar|m|0', total, done));
    lib.doneKeysOf(rest[0]).forEach(k => done.add(k));
    assert.equal(lib.buildConsolidatedItems(plan, new Set(), {}, true, true, done).length, 0);
    done.delete('Mar|m|0|0');
    assert.equal(lib.buildConsolidatedItems(plan, new Set(), {}, true, true, done)[0].qty, 1);
    const extras = { manuel: { source: 'manuel', ingredients: [{ name: '1 ail' }, { name: '2 tomates' }] }, A: { ingredients: [{ name: '1 ail' }] } };
    const combined = lib.buildConsolidatedItems(plan, new Set(), extras);
    const garlic = combined.find(x => x.name.toLowerCase() === 'ail');
    assert.equal(garlic.qty, 5);
    const extraKey = lib.extraLineKey('A', '1 ail');
    assert.equal(lib.buildConsolidatedItems(plan, new Set(), extras, true, true, new Set([extraKey + '|0'])).find(x => x.name.toLowerCase() === 'ail').qty, 4);
    const all = new Set(lib.doneKeysOf(garlic));
    assert(lib.sourceLineDone(extraKey, combined, all));
    assert(lib.sourceLineDone(lib.extraLineKey('manuel', '1 ail'), combined, all));
    assert.equal(lib.buildConsolidatedItems({}, new Set(), extras, false, false, all).length, 1);
    assert.equal(lib.buildConsolidatedItems({ JourJ: { m: rec('1 ail') } }, new Set(), {}, true, false)[0].qty, 1);
    const weights = { Lun: { m: rec('1 kg farine') }, Mar: { m: rec('200 g farine') } };
    assert.equal(lib.buildConsolidatedItems(weights, new Set(), {})[0].qty, 1200);
    assert.equal(lib.buildConsolidatedItems(weights, new Set(), {}, true, true, new Set(['Lun|m|0|0']))[0].qty, 200);
    const mixed = lib.buildConsolidatedItems({ Lun: { m: rec('1 tomate', '200 g tomate') } }, new Set(), {})[0];
    assert.equal(mixed.qty, null); assert(mixed.mixedUnits); assert.match(mixed.display, /200 g/);
    assert.equal(lib.buildConsolidatedItems({ Lun: { m: rec('2 gousses ail', '1 gousse ail') } }, new Set(), {})[0].qty, 3);
    assert.equal(lib.parseIngredient('2 cuillères à soupe huile').unit, 'cas');
    assert.equal(lib.parseIngredient('🥣 ½ cuillère à café farine').qty, .5);
    assert.equal(lib.parseIngredient('1/2 tasse lait').unit, 'tasse');
    assert.equal(lib.parseIngredient('1 brique crème').unit, 'brique');
    const interval = lib.parseIngredient('🥣 4 à 5 patates');
    assert.equal(interval.qty, null); assert.equal(interval.range[0], 4); assert.equal(interval.range[1], 5); assert.equal(interval.name, 'patates');
    const sumRange = lib.buildConsolidatedItems({ Lun: { m: rec('4 à 5 patates', '2 patates') } }, new Set(), {})[0];
    assert.equal(sumRange.range[0], 6); assert.equal(sumRange.range[1], 7); assert.match(sumRange.display, /6 à 7/);
    assert.equal(lib.parseIngredient('Mozzarella - 150 g, râpée').qty, 150);
    const side = { Lun: { m: { ...rec('1 ail'), side: rec('1 tomate') } } };
    assert.equal(lib.buildConsolidatedItems(side, new Set(['Lun|m|0', 'Lun|m|s0']), {}).length, 0);
    assert.equal(lib.buildConsolidatedItems(plan, new Set(['Lun|m|0|0']), {})[0].qty, 2);
    assert.equal(lib.buildConsolidatedItems({ Lun: { m: rec("1 grand bol d'eau froide avec 2 tasses de glaçons") } }, new Set(), {}).length, 0);
    assert.equal(lib.buildConsolidatedItems({}, new Set(), { manuel: { ingredients: [{ name: '1 eau froide' }] } }).length, 1);
    const forms = lib.buildConsolidatedItems({ Lun: { m: rec('1 ail', '1 ail en poudre', '1 citron', '1 citron confit') } }, new Set(), {});
    assert.equal(forms.length, 4);
    const r = load('src/lib/rayons.ts', { './ingredients': lib });
    assert.equal(r.autoRayon('Fécule de maïs'), 'epicerie'); assert.equal(r.autoRayon('Sucre glace'), 'epicerie');
}
const model = load('src/lib/shoppingState.ts', { './ingredients': i });
const plan = { Lun: { m: { id: 'A', ...rec('1 ail'), side: { id: 'S', ...rec('200 g riz') } } }, Mar: { m: { id: 'B', ...rec('1 ail') } } };
const initial = model.reconcileShoppingState(plan, {}, new Set(['Lun|m|0|0']), new Set(['Lun|m|s0']), { 'ail|': 4 }, {}, {});
assert.equal(initial.edits['ail|'], 4);
const nextPlan = { ...plan, Lun: { m: { id: 'A2', ...rec('1 ail'), side: { id: 'S2', ...rec('300 g riz') } } } };
const changed = model.reconcileShoppingState(nextPlan, {}, initial.done, initial.mask, initial.edits, initial.slots, initial.quantities);
assert.equal(changed.done.size, 0); assert.equal(changed.mask.size, 0); assert.equal(changed.edits['ail|'], undefined);
const total = i.buildConsolidatedItems(plan, new Set(), {}).find(x => x.name.toLowerCase() === 'ail');
const remaining = i.buildConsolidatedItems(plan, new Set(), {}, true, true, new Set(['Lun|m|0|0'])).find(x => x.name.toLowerCase() === 'ail');
assert.equal(model.displayRemaining(total, remaining, 5).qty, 4);
const mixed = i.buildConsolidatedItems({ Lun: { m: rec('1 tomate', '200 g tomate') } }, new Set(), {})[0];
assert.equal(model.displayRemaining(mixed, mixed, 5).qty, null);
const grouped = { manuel: { source: 'manuel', ingredients: [{ name: '1 ail, 2 tomates', checked: false }] } };
const removed = model.removeShoppingProduct(grouped, 'ail');
assert.equal(i.buildConsolidatedItems({}, new Set(), removed).length, 1);
assert.match(removed.manuel.ingredients[0].name, /tomate/);

const splitPlan = { Lun: { m: rec('1 ail, 2 tomates') } };
const splitSources = i.buildConsolidatedItems(splitPlan, new Set(), {});
const reopen = model.toggleSources(new Set(['Lun|m|0']), ['Lun|m|0|0'], splitSources, true);
assert(!reopen.has('Lun|m|0|0')); assert(reopen.has('Lun|m|0|1'));
const keptMarks = new Set([i.extraLineKey('manuel', '1 ail, 2 tomates') + '|1']);
const keptExtras = model.removeShoppingProduct(grouped, 'ail', keptMarks);
assert(keptMarks.has(i.extraLineKey('manuel', '2 tomates') + '|0'));
assert.equal(i.buildConsolidatedItems({}, new Set(), keptExtras, true, true, keptMarks).length, 0);

function extensionTest({ last = false, manual = false, failure = false, noOpener = false, noAck = false, close = false } = {}) {
    let now = 0, timerId = 0, quantity = 0;
    const timers = new Map(), messages = [], listeners = new Map(), elements = new Map();
    const element = key => {
        if (!elements.has(key)) elements.set(key, { textContent: '', callbacks: {}, addEventListener(type, cb) { this.callbacks[type] = cb; }, remove() {} });
        return elements.get(key);
    };
    const box = { querySelector: element, remove() {} };
    const product = { querySelectorAll: () => [{ value: String(quantity), getAttribute: () => null }] };
    const origin = 'https://lesrecettesmagiques.fr';
    const payload = { session: 'test-session', terms: ['ail', 'tomate'], labels: ['3 ail', '2 tomates'] };
    const location = { hostname: 'www.carrefour.fr', hash: '#mlist=' + encodeURIComponent(Buffer.from(JSON.stringify(payload)).toString('base64')) + '&mi=' + (last ? 1 : 0) + '&mo=' + encodeURIComponent(origin), href: '', pathname: '/s', origin: 'https://www.carrefour.fr' };
    const opener = { closed: false, postMessage(message) { messages.push(message); if (!noAck) {
        listeners.get('message')?.({ origin, source: opener, data: { source: 'courses-magiques', type: 'item-done-ack', index: message.index, session: message.session } });
    } } };
    const window = { opener: noOpener ? null : opener, addEventListener: (type, cb) => listeners.set(type, cb), removeEventListener: type => listeners.delete(type) };
    const storage = { getItem: () => null, setItem() {}, removeItem() {} };
    let click;
    const runTo = target => { while (true) { const next = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; now = next[1].at; timers.delete(next[0]); next[1].cb(); } now = target; };
    vm.runInNewContext(fs.readFileSync(root + '/chrome-extension-courses/content.js', 'utf8'), {
        location, window, document: { createElement: () => box, documentElement: { appendChild() {} }, querySelector: () => null, querySelectorAll: () => [], addEventListener: (type, cb) => click = cb },
        localStorage: storage, sessionStorage: storage, URLSearchParams, atob: s => Buffer.from(s, 'base64').toString('binary'), escape, encodeURIComponent, decodeURIComponent,
        setInterval() {}, clearInterval() {}, setTimeout: (cb, ms) => { timers.set(++timerId, { cb, at: now + ms }); return timerId; }, clearTimeout: id => timers.delete(id),
    });
    const add = { nodeType: 1, id: '', textContent: 'Ajouter au panier', className: '', getAttribute: () => null, matches: () => true, closest: selector => selector.includes('magic-courses-widget') ? null : product };
    if (manual) element('.mcw-next').callbacks.click(); else { click({ composedPath: () => [add] }); if (!failure) quantity = 1; }
    runTo(1500);
    if (manual) element('.mcw-next').callbacks.click(); else { click({ composedPath: () => [add] }); if (!failure) quantity = 2; }
    if (close) element('.mcw-close').callbacks.click();
    runTo(3499); assert.equal(messages.length, 0);
    runTo(3500);
    if (failure || noOpener || close) { assert.equal(messages.length, 0); assert.equal(location.href, ''); return; }
    assert.equal(messages.length, 1); assert.equal(messages[0].session, 'test-session'); assert.equal(messages[0].index, last ? 1 : 0);
    if (noAck) { assert.equal(location.href, ''); runTo(7000); assert.match(element('.mcw-hint').textContent, /pas confirmé/); }
    else if (last) assert.equal(element('.mcw-item').textContent, '✅ Liste terminée !');
    else assert.match(location.href, /mi=1/);
}
for (const options of [{}, { last: true }, { manual: true }, { failure: true }, { noOpener: true }, { noAck: true }, { close: true }]) extensionTest(options);
console.log('PASS: remaining quantities, shared views, units, preparation filters, plan changes, overrides, grouped deletion and confirmed store transitions');

async function syncTests() {
    let now = 1000, cloud = { data: { 'magic-shopping-list': { manuel: { ingredients: [{ name: '1 ail' }] } }, 'week-in-fused': false }, updated_at: new Date(500).toISOString() };
    const entries = new Map([['shop-qty', '{"ail|":3}']]), callbacks = new Map(), timers = new Map(), pushes = [];
    let timer = 0;
    const localStorage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
    const window = { addEventListener: (type, cb) => callbacks.set(type, cb), dispatchEvent: event => callbacks.get(event.type)?.(event) };
    class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
    const supabase = { auth: { getSession: async () => ({ data: { session: { user: { id: 'test' } } } }) }, from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: cloud }), upsert: async value => pushes.push(value) }) };
    const sync = load('src/lib/shoppingSync.ts', { './supabase': { supabase }, '@/lib/stockage': { ecrireStock: (key, value) => localStorage.setItem(key, value) } },
        { window, localStorage, Date: FakeDate, Event: class { constructor(type) { this.type = type; } }, setTimeout: cb => { timers.set(++timer, cb); return timer; }, clearTimeout: id => timers.delete(id) });
    sync.startShoppingSync();
    await sync.pullShoppingState();
    assert.equal(entries.has('shop-qty'), false); assert.equal(entries.get('week-in-fused'), 'false'); assert.equal(timers.size, 0);
    entries.set('shop-done', '["Lun|m|0|0"]'); window.dispatchEvent({ type: 'shoppingListUpdated' });
    cloud = { data: { 'shop-done': [] }, updated_at: new Date(900).toISOString() };
    await sync.pullShoppingState(); assert.equal(entries.get('shop-done'), '["Lun|m|0|0"]');
    assert.equal(timers.size, 1);
    for (const cb of timers.values()) cb();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(pushes.length, 1); assert.equal(pushes[0].data['week-in-fused'], false);
    console.log('PASS: cloud deletions, preference sync, recent local gesture protection and no hydration echo');
}
syncTests().catch(error => { console.error(error); process.exitCode = 1; });

// Produit reconnu indépendamment des indications de découpe et des anciennes images.
const visualDeps = Object.fromEntries(['ingredient-cache', 'marmiton-ingredients', 'pic-nic-ingredients'].map(n => [`../data/${n}.json`, JSON.parse(fs.readFileSync(root + `/src/data/${n}.json`, 'utf8'))]));
const visuals = load('src/lib/ingredient-utils.ts', visualDeps);
const fiche = load('src/lib/recipe-ingredients.ts', { './ingredients': i, './ingredient-utils': visuals, './utils': load('src/lib/utils.ts') });
const onion = fiche.recipeIngredients([{ name: 'oignon rouge', quantity: '0,5 pièce' }, { name: 'oignon rouge finement émincé', quantity: '75 g' }]);
assert.equal(onion.length, 1);
assert.equal(onion[0].name, 'oignon rouge');
assert.equal(onion[0].quantity, '0,5 pièce + 75 g');
assert.equal(fiche.shoppingNames(onion[0], 2).join(';'), '1 pièce oignon rouge;150 g oignon rouge');
const onionCart = i.buildConsolidatedItems({}, new Set(), { test: { ingredients: fiche.shoppingNames(onion[0], 1).map(name => ({ name })) } });
assert.equal(onionCart.length, 1);
assert.equal(i.canonicalIng('oignon rouge finement').name, 'oignon rouge');
assert.equal(i.canonicalIng('cébette finement').name, 'cebette');
assert.notEqual(i.canonicalIng('ail en poudre').name, i.canonicalIng('ail').name);
assert.equal(fiche.recipeIngredients([{ name: '75g de oignon rouge finement', quantity: '1' }])[0].quantity, '75 g');
assert.equal(fiche.recipeIngredients([{ name: '4 à 5 pommes de terre', quantity: '' }])[0].quantity, '4 à 5');
for (const [name, file] of [['pâtes', 'pasta-package.jpeg'], ['polenta', 'polenta-package.jpg'], ['pignons de pin', 'pine-nuts.jpg'], ['cébette finement', 'meal-spring-onion.png'], ['guanciale', 'guanciale.jpg']]) {
    assert.equal(visuals.getIngredientVisual(name), '/ingredients/' + file);
    assert(fs.existsSync(root + '/public/ingredients/' + file));
}
assert.notEqual(visuals.getIngredientVisual('pâte feuilletée'), visuals.getIngredientVisual('pâtes'));
assert.notEqual(visuals.getIngredientVisual('spaghetti'), visuals.getIngredientVisual('pâtes'));
console.log('PASS : fiches sans doublons, quantités conservées et visuels précis');

assert.equal(i.buildConsolidatedItems({}, new Set(), { test: { ingredients: [{ name: fiche.shoppingNames(onion[0], 1).join(' + ') }] } }).length, 1);
