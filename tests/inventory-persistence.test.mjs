import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
import {createTauriFileStorage} from '../lib/adapters/tauri-file-storage.ts';
import {loadDomain} from './helpers/load-domain.mjs';

// Inventory across the persistence boundaries: demo/desktop store, account route
// and backup files. Old documents without inventory must keep loading.
function evaluate(path, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', 'crypto', source)(name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  }, mod, mod.exports, webcrypto);
  return mod.exports;
}
const domain = loadDomain(evaluate);
const backup = evaluate('../lib/backup.ts');
const queue = evaluate('../lib/serial-queue.ts');
const {createDemoStore, DEMO_STORAGE_KEY, DEFAULT_DEMO_PIN} = evaluate('../lib/demo-store.ts', {'./pos': domain, './backup': backup});
const corrupt = /დაზიანებულია/;
const wrongPin = 'მენეჯერის კოდი არასწორია';

function memory() {
  const rows = new Map();
  return {rows, getItem: key => rows.get(key) ?? null, setItem: (key, value) => { rows.set(key, String(value)); }};
}
function slowFiles() {
  const rows = new Map();
  const invoke = async (cmd, args) => {
    await new Promise(r => setTimeout(r, 1));
    if (cmd === 'storage_read') return rows.get(args.key) ?? null;
    if (cmd === 'storage_write') { rows.set(args.key, args.value); return null; }
    throw new Error(cmd);
  };
  return {rows, storage: createTauriFileStorage(invoke)};
}
// A state as saved before inventory existed, with real order history.
function legacyState() {
  let s = domain.seedState();
  s = domain.applyAction(s, 'openOrder', {tableId: 'table-2'}, false, '2026-01-05T10:00:00.000Z');
  const orderId = s.orders[0].id;
  s = domain.applyAction(s, 'addItem', {orderId, productId: 'product-1', quantity: 2}, false, '2026-01-05T10:01:00.000Z');
  s = domain.applyAction(s, 'sendOrder', {orderId}, false, '2026-01-05T10:02:00.000Z');
  delete s.inventory;
  return s;
}
const legacyDoc = () => ({schema: 1, userId: 'legacy-user', version: 7, configured: true, state: legacyState(), pin: DEFAULT_DEMO_PIN, failures: 0, blockedUntil: 0});
const freshDoc = () => ({...legacyDoc(), state: domain.demoSeedState('2026-01-05T09:00:00.000Z')});
const unchanged = (actual, expected) => {
  for (const key of ['orders', 'tickets', 'products', 'audit', 'tables', 'zones', 'departments']) assert.deepEqual(actual[key], expected[key], key);
};

// A valid payload for every inventory action, built against the current stock.
const itemId = (state, name) => state.inventory.items.find(i => i.name === name).id;
const steps = [
  ['saveStockItem', () => ({name: 'ტესტ ფქვილი', unit: 'g', kind: 'ingredient', threshold: 100})],
  ['saveStockItem', () => ({name: 'ტესტ ცომი', unit: 'g', kind: 'semi'})],
  ['saveRecipe', s => ({productId: 'product-3', lines: [{itemId: itemId(s, 'ტესტ ფქვილი'), quantity: 120}]})],
  ['saveBatchRecipe', s => ({itemId: itemId(s, 'ტესტ ცომი'), output: 500, lines: [{itemId: itemId(s, 'ტესტ ფქვილი'), quantity: 400}]})],
  ['receiveStock', s => ({supplier: 'მომწოდებელი', lines: [{itemId: itemId(s, 'ტესტ ფქვილი'), quantity: 2000, total: 400}]})],
  ['writeOff', s => ({itemId: itemId(s, 'ტესტ ფქვილი'), quantity: 100, reason: 'გაფუჭება'})],
  ['stockCount', s => ({counts: [{itemId: itemId(s, 'ტესტ ფქვილი'), quantity: 1850}]})],
  ['produce', s => ({itemId: itemId(s, 'ტესტ ცომი'), batches: 2})],
  ['saveStockItem', () => ({name: 'ტესტ არქივი', unit: 'pcs', kind: 'ingredient'})],
  ['archiveStockItem', s => ({id: itemId(s, 'ტესტ არქივი'), archived: true})],
];
const checkFinal = state => {
  assert.equal(state.inventory.items.find(i => i.name === 'ტესტ ფქვილი').quantity, 1050);
  assert.equal(state.inventory.items.find(i => i.name === 'ტესტ ცომი').quantity, 1000);
  assert.equal(state.inventory.items.find(i => i.name === 'ტესტ არქივი').archived, true);
  assert.deepEqual(new Set(state.inventory.movements.map(m => m.type)), new Set(['receipt', 'writeoff', 'count', 'production']));
  assert.ok(domain.isValidInventory(state.inventory, state.products.map(p => p.id)));
};

test('legacy demo document loads with memory and async file storage without losing data', async () => {
  for (const {rows, storage} of [(() => { const m = memory(); return {rows: m.rows, storage: m}; })(), slowFiles()]) {
    const doc = legacyDoc();
    const raw = JSON.stringify(doc);
    rows.set(DEMO_STORAGE_KEY, raw);
    const store = createDemoStore(storage, queue.createSerialQueue());
    const loaded = await store.read();
    assert.equal(loaded.version, 7);
    assert.deepEqual(loaded.state.inventory, domain.emptyInventory());
    unchanged(loaded.state, doc.state);
    assert.equal(rows.get(DEMO_STORAGE_KEY), raw, 'reading never rewrites the stored document');
    // Acting on it keeps history and does not gain sample stock.
    const acted = await store.act('openOrder', {tableId: 'table-5'}, loaded);
    assert.equal(acted.state.orders.length, 2);
    assert.deepEqual(acted.state.orders[0], doc.state.orders[0]);
    assert.deepEqual(acted.state.inventory, domain.emptyInventory());
    const sent = await store.act('addItem', {orderId: acted.state.orders[1].id, productId: 'product-1', quantity: 1}, acted);
    const afterSend = await store.act('sendOrder', {orderId: sent.state.orders[1].id}, sent);
    assert.equal(afterSend.state.inventory.items.length, 0);
    assert.equal(afterSend.state.inventory.movements.length, 0);
    const saved = JSON.parse(rows.get(DEMO_STORAGE_KEY));
    assert.deepEqual(saved.state.inventory, domain.emptyInventory());
    unchanged({...saved.state, orders: saved.state.orders.slice(0, 1), tickets: saved.state.tickets.slice(0, doc.state.tickets.length), audit: saved.state.audit.slice(0, doc.state.audit.length)}, doc.state);
  }
});

test('fresh demo document has sample stock; reset reseeds it', async () => {
  const storage = memory();
  const store = createDemoStore(storage);
  const s = (await store.read()).state;
  assert.equal(s.inventory.items.length, 11);
  assert.deepEqual(s.inventory.recipes.find(r => r.productId === 'product-1').lines.map(l => l.itemId), ['stock-flour', 'stock-cheese', 'stock-egg', 'stock-butter']);
  assert.equal(s.inventory.items.find(i => i.id === 'stock-caesar-sauce').kind, 'semi');
  assert.ok(domain.isValidInventory(s.inventory, s.products.map(p => p.id)));
  assert.equal((await store.reset()).state.inventory.items.length, 11);
});

test('demo store: every inventory action needs the manager PIN', async () => {
  for (const make of [() => memory(), () => slowFiles().storage]) {
    const storage = make();
    const store = createDemoStore(storage, queue.createSerialQueue());
    let snap = await store.read();
    const seen = new Set();
    for (const [action, payload] of steps) {
      const body = payload(snap.state);
      const before = JSON.stringify(snap.state);
      for (const pin of ['9999', undefined]) {
        await assert.rejects(store.act(action, {...body, pin}, await store.read()), {message: wrongPin});
      }
      snap = await store.read();
      assert.equal(JSON.stringify(snap.state), before, `${action} without a valid PIN changed nothing`);
      snap = await store.act(action, {...body, pin: DEFAULT_DEMO_PIN}, snap);
      seen.add(action);
    }
    assert.deepEqual([...seen].sort(), [...domain.INVENTORY_ACTIONS].sort());
    checkFinal(snap.state);
  }
});

test('demo store: an inventory action sent without a PIN is never trusted from the client', async () => {
  const store = createDemoStore(memory());
  const snap = await store.read();
  await assert.rejects(store.act('receiveStock', {lines: [{itemId: 'stock-flour', quantity: 1000, total: 1}]}, snap), {message: wrongPin});
  assert.equal((await store.read()).state.inventory.items.find(i => i.id === 'stock-flour').quantity, snap.state.inventory.items.find(i => i.id === 'stock-flour').quantity);
});

test('malformed inventory makes read() report the document as corrupt', async () => {
  const mutations = {
    'bad unit': s => { s.inventory.items[0].unit = 'kg'; },
    'fractional quantity': s => { s.inventory.items[0].quantity = 10.5; },
    'unknown recipe itemId': s => { s.inventory.recipes[0].lines[0].itemId = 'stock-missing'; },
    'unknown movement itemId': s => { s.inventory.movements[0].itemId = 'stock-missing'; },
    'semi-finished cycle': s => { s.inventory.items.find(i => i.id === 'stock-caesar-sauce').batch.lines.push({itemId: 'stock-caesar-sauce', quantity: 1}); },
    'inventory null': s => { s.inventory = null; },
    'recipe for unknown product': s => { s.inventory.recipes[0].productId = 'product-missing'; },
    'items not an array': s => { s.inventory.items = {}; },
  };
  const control = memory();
  control.setItem(DEMO_STORAGE_KEY, JSON.stringify(freshDoc()));
  assert.equal((await createDemoStore(control).read()).state.inventory.items.length, 11, 'unmutated document is valid');
  for (const [name, mutate] of Object.entries(mutations)) {
    for (const {rows, storage} of [(() => { const m = memory(); return {rows: m.rows, storage: m}; })(), slowFiles()]) {
      const doc = freshDoc();
      mutate(doc.state);
      const raw = JSON.stringify(doc);
      rows.set(DEMO_STORAGE_KEY, raw);
      await assert.rejects(createDemoStore(storage).read(), corrupt, name);
      assert.equal(rows.get(DEMO_STORAGE_KEY), raw, `${name}: corrupt document is not overwritten`);
    }
  }
});

test('legacy backup restores with empty stock; inspect reports zero stock items', async () => {
  const doc = legacyDoc();
  const text = backup.createBackup(doc, new Date('2026-02-01T10:00:00.000Z'));
  const storage = memory();
  const store = createDemoStore(storage);
  const info = await store.inspectBackup(text);
  assert.deepEqual(info.summary, {orders: 1, products: doc.state.products.length});
  assert.equal(info.stockItems, 0);
  const restored = await store.restoreBackup(text, DEFAULT_DEMO_PIN);
  assert.deepEqual(restored.state.inventory, domain.emptyInventory());
  unchanged(restored.state, doc.state);
  const next = await store.act('openOrder', {tableId: 'table-9'}, restored);
  assert.equal(next.state.orders.length, 2);
});

test('new backup round-trips inventory exactly and reports stock items', async () => {
  const source = createDemoStore(memory());
  let snap = await source.read();
  snap = await source.act('writeOff', {itemId: 'stock-cheese', quantity: 250, reason: 'გაფუჭება', pin: DEFAULT_DEMO_PIN}, snap);
  const text = await source.exportBackup();
  const target = createDemoStore(memory());
  const info = await target.inspectBackup(text);
  assert.deepEqual(Object.keys(info).sort(), ['createdAt', 'stockItems', 'summary']);
  assert.deepEqual(info.summary, {orders: 0, products: snap.state.products.length});
  assert.equal(info.stockItems, 11);
  const restored = await target.restoreBackup(text, DEFAULT_DEMO_PIN);
  assert.deepEqual(restored.state.inventory, snap.state.inventory);
  assert.deepEqual(restored.state, snap.state);
  const direct = backup.readBackup(text, raw => JSON.parse(raw));
  assert.deepEqual(direct.summary, {orders: 0, products: snap.state.products.length});
  assert.equal(direct.stockItems, 11);
});

test('backup with corrupt inventory is refused before anything is replaced', async () => {
  const doc = freshDoc();
  doc.state.inventory.items[0].quantity = 1.5;
  const text = backup.createBackup(doc, new Date());
  const storage = memory();
  const store = createDemoStore(storage);
  const before = await store.read();
  await assert.rejects(store.inspectBackup(text), /დაზიანებულია/);
  await assert.rejects(store.restoreBackup(text, DEFAULT_DEMO_PIN), /დაზიანებულია/);
  assert.deepEqual((await store.read()).state, before.state);
});

function harness() {
  const rows = new Map();
  const api = evaluate('../app/api/pos/route.ts', {
    '@/lib/server/auth': {getUser: async () => ({userId: 'owner'})},
    '@/lib/server/config': {ServiceUnavailable: class extends Error {}, sameOrigin: request => request.headers.get('origin') === new URL(request.url).origin},
    '@/lib/server/store': {
      async readStore(key, document) { if (!rows.has(key)) rows.set(key, {version: 0, document}); return structuredClone(rows.get(key)); },
      async saveStore(key, version, document) { const row = rows.get(key); if (!row || row.version !== version) return false; rows.set(key, {version: version + 1, document}); return true; }
    },
    '@/lib/pos': domain
  });
  const post = (action, payload = {}) => api.POST(new Request('https://pos.test/api/pos', {method: 'POST', headers: {'content-type': 'application/json', origin: 'https://pos.test'}, body: JSON.stringify({action, payload, version: rows.get('owner')?.version ?? 0, requestId: webcrypto.randomUUID(), ownerId: 'owner'})}));
  return {api, post, rows};
}

test('route: legacy Supabase document reads with empty stock and keeps working', async () => {
  const h = harness();
  const state = legacyState();
  h.rows.set('owner', {version: 3, document: JSON.stringify({state, failures: 0, blockedUntil: 0, requests: []})});
  const response = await h.api.GET();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.version, 3);
  assert.deepEqual(body.state.inventory, domain.emptyInventory());
  unchanged(body.state, state);
  const opened = await h.post('openOrder', {tableId: 'table-4'});
  assert.equal(opened.status, 200);
  const orderId = (await opened.json()).state.orders[1].id;
  assert.equal((await h.post('addItem', {orderId, productId: 'product-1', quantity: 1})).status, 200);
  const sent = await h.post('sendOrder', {orderId});
  assert.equal(sent.status, 200);
  const sentBody = await sent.json();
  assert.equal(sentBody.state.orders[1].lines[0].sentQuantity, 1);
  assert.deepEqual(sentBody.state.inventory, domain.emptyInventory());
  assert.deepEqual(sentBody.state.orders[0], state.orders[0]);
});

test('route: new accounts start with empty stock', async () => {
  const h = harness();
  const body = await (await h.api.GET()).json();
  assert.deepEqual(body.state.inventory, domain.emptyInventory());
});

test('route: every inventory action needs the manager PIN', async () => {
  const h = harness();
  assert.equal((await h.post('setupPin', {pin: '2468'})).status, 200);
  let state = (await (await h.api.GET()).json()).state;
  for (const [action, payload] of steps) {
    const body = payload(state);
    const before = JSON.stringify(state);
    for (const pin of ['1111', undefined]) {
      const rejected = await h.post(action, {...body, pin});
      assert.equal(rejected.status, 403, action);
      assert.equal((await rejected.json()).error, wrongPin);
    }
    assert.equal(JSON.stringify((await (await h.api.GET()).json()).state), before);
    const ok = await h.post(action, {...body, pin: '2468'});
    assert.equal(ok.status, 200, action);
    state = (await ok.json()).state;
  }
  checkFinal(state);
  assert.ok(JSON.parse(h.rows.get('owner').document).state.inventory.movements.length > 0);
});

test('route: inventory actions are refused before a PIN is set up', async () => {
  const h = harness();
  const response = await h.post('saveStockItem', {name: 'ფქვილი', unit: 'g', kind: 'ingredient', pin: '1234'});
  assert.equal(response.status, 403);
  assert.deepEqual((await (await h.api.GET()).json()).state.inventory.items, []);
});

// Fixture written by the pre-inventory code (localStorage document and its backup file).
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/legacy-demo-v1.json', import.meta.url), 'utf8'));

test('pre-inventory localStorage document survives load -> act -> reload', async () => {
  for (const {rows, storage} of [(() => { const m = memory(); return {rows: m.rows, storage: m}; })(), slowFiles()]) {
    rows.set(DEMO_STORAGE_KEY, fixture.localStorage);
    const before = JSON.parse(fixture.localStorage);
    assert.equal('inventory' in before.state, false);
    let snap = await createDemoStore(storage, queue.createSerialQueue()).read();
    unchanged(snap.state, before.state);
    assert.equal(rows.get(DEMO_STORAGE_KEY), fixture.localStorage);
    const store = createDemoStore(storage, queue.createSerialQueue());
    snap = await store.act('openOrder', {tableId: 'table-5'}, snap);
    const orderId = snap.state.orders.at(-1).id;
    snap = await store.act('addItem', {orderId, productId: 'product-1', quantity: 1}, snap);
    snap = await store.act('sendOrder', {orderId}, snap);
    snap = await store.act('saveStockItem', {name: 'ფქვილი', unit: 'g', kind: 'ingredient', pin: DEFAULT_DEMO_PIN}, snap);
    snap = await store.act('receiveStock', {lines: [{itemId: snap.state.inventory.items[0].id, quantity: 1000, total: 250}], pin: DEFAULT_DEMO_PIN}, snap);
    // A new store instance (app restart) reads the saved document back.
    const reloaded = await createDemoStore(storage, queue.createSerialQueue()).read();
    assert.deepEqual(reloaded, snap);
    const s = reloaded.state;
    for (const key of ['orders', 'tickets', 'audit']) assert.deepEqual(s[key].slice(0, before.state[key].length), before.state[key], key);
    for (const key of ['products', 'tables', 'zones', 'departments']) assert.deepEqual(s[key], before.state[key], key);
    assert.equal(s.orders.length, before.state.orders.length + 1);
    assert.deepEqual(s.inventory.items.map(i => [i.quantity, i.value, i.avgCost]), [[1000, 250, 250]]);
    assert.ok(domain.isValidInventory(s.inventory, s.products.map(p => p.id)));
  }
});

test('pre-inventory backup file restores with all history and empty stock', async () => {
  const store = createDemoStore(memory());
  const info = await store.inspectBackup(fixture.backup);
  assert.equal(info.stockItems, 0);
  const restored = await store.restoreBackup(fixture.backup, DEFAULT_DEMO_PIN);
  const {document} = JSON.parse(fixture.backup);
  assert.equal('inventory' in document.state, false);
  unchanged(restored.state, document.state);
  assert.deepEqual(restored.state.inventory, domain.emptyInventory());
});
