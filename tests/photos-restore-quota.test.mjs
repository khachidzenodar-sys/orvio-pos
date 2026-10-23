import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
import {loadDomain} from './helpers/load-domain.mjs';

function evaluate(path, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', 'crypto', source)(name => {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  }, mod, mod.exports, webcrypto);
  return mod.exports;
}
const domain = loadDomain(evaluate);
const backup = evaluate('../lib/backup.ts');
const queue = evaluate('../lib/serial-queue.ts');
const photo = evaluate('../lib/product-photo.ts');
const {createDemoStore, DEFAULT_DEMO_PIN, DEMO_STORAGE_KEY} = evaluate('../lib/demo-store.ts', {'./pos': domain, './backup': backup});

const QUOTA_MESSAGE = 'ბრაუზერის მეხსიერება გავსებულია — ცვლილება ვერ შეინახა. წაშალეთ ზოგიერთი ფოტო.';
const PREFIX = 'orvio.before-restore.';
// localStorage-like quota: 5 MiB of UTF-16 code units for keys and values per origin.
function limitedStorage(quota = 5 * 1024 * 1024) {
  const rows = new Map();
  const used = () => [...rows].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {rows, used, getItem: async k => rows.get(k) ?? null, setItem: async (k, v) => {
    const old = rows.get(k);
    if (used() - (old === undefined ? 0 : k.length + old.length) + k.length + String(v).length > quota) throw new DOMException('full', 'QuotaExceededError');
    rows.set(k, String(v));
  }};
}
const copies = rows => [...rows].filter(([k, v]) => k.startsWith(PREFIX) && v !== '');
const head = 'data:image/jpeg;base64,';
const pic = (i, chars = photo.PHOTO_TARGET_CHARS) => head + String.fromCharCode(65 + i % 26).repeat(Math.floor((chars - head.length) / 4) * 4);

// Builds a demo document close to the 1.8M-character photo limit (33 × 54 000).
async function nearLimit(storage, keep) {
  const store = createDemoStore(storage, queue.createSerialQueue(), undefined, keep);
  let snap = await store.read();
  for (let i = snap.state.products.length; i < 33; i++) snap = await store.act('saveProduct', {name: `p${i}`, category: 'c', price: 100, departmentIds: ['kitchen'], active: true}, snap);
  for (const [i, p] of snap.state.products.entries()) snap = await store.act('setProductPhoto', {productId: p.id, photo: pic(i), pin: DEFAULT_DEMO_PIN}, snap);
  assert.ok(storage.rows.get(DEMO_STORAGE_KEY).length > 1_750_000);
  return {store, snap};
}

for (const [label, keep] of [['default store', undefined], ['browser store (keeps 1 copy)', 1]]) {
  test(`${label}: restoring the same near-limit backup again and again keeps working`, async () => {
    const storage = limitedStorage();
    const {store} = await nearLimit(storage, keep);
    const original = storage.rows.get(DEMO_STORAGE_KEY);
    const text = await store.exportBackup();
    for (let i = 0; i < 3; i++) await store.restoreBackup(text, DEFAULT_DEMO_PIN);
    // The copy of the document before the first restore is never replaced by identical data.
    assert.deepEqual(copies(storage.rows).map(([, v]) => v), [original]);
    assert.deepEqual(JSON.parse(storage.rows.get(DEMO_STORAGE_KEY)).state, JSON.parse(original).state);
  });

  test(`${label}: different near-limit backups recycle the safety copy instead of failing`, async () => {
    const storage = limitedStorage();
    const {store} = await nearLimit(storage, keep);
    const a = await store.exportBackup();
    const snap = await store.read();
    await store.act('setProductPhoto', {productId: snap.state.products[0].id, photo: pic(25), pin: DEFAULT_DEMO_PIN}, snap);
    const b = await store.exportBackup();
    for (const text of [a, b, a, b]) {
      const before = storage.rows.get(DEMO_STORAGE_KEY);
      const restored = await store.restoreBackup(text, DEFAULT_DEMO_PIN);
      assert.deepEqual(restored.state, JSON.parse(text).document.state);
      // The document that was just replaced is always kept as the safety copy.
      assert.ok(copies(storage.rows).some(([, v]) => v === before), 'the replaced document must be kept');
      assert.ok(storage.used() <= 5 * 1024 * 1024);
    }
    assert.equal(copies(storage.rows).length, 1);
  });
}

test('when no tracked copy can be recycled, restore fails safely and changes nothing', async () => {
  const storage = limitedStorage();
  const {store} = await nearLimit(storage);
  const other = createDemoStore(limitedStorage(), queue.createSerialQueue());
  const otherText = await (async () => { await other.act('openOrder', {tableId: 'table-1'}, await other.read()); return other.exportBackup(); })();
  // A copy written before copies were tracked (or by hand) fills the remaining space.
  storage.rows.set(`${PREFIX}20260101-000000`, 'x'.repeat(5 * 1024 * 1024 - storage.used() - 40));
  const rows = new Map(storage.rows);
  await assert.rejects(store.restoreBackup(otherText, DEFAULT_DEMO_PIN), {message: QUOTA_MESSAGE});
  assert.deepEqual(storage.rows, rows);
});

test('browser store keeps only the newest safety copy; older ones are cleared after a successful restore', async () => {
  const storage = limitedStorage();
  const store = createDemoStore(storage, queue.createSerialQueue(), undefined, 1);
  let snap = await store.read();
  const texts = [];
  for (let i = 1; i <= 3; i++) {
    snap = await store.act('saveProduct', {name: `extra ${i}`, category: 'c', price: 100 * i, departmentIds: ['kitchen'], active: true}, snap);
    texts.push(await store.exportBackup());
  }
  let last = '';
  for (const text of texts) { last = storage.rows.get(DEMO_STORAGE_KEY); snap = await store.restoreBackup(text, DEFAULT_DEMO_PIN); }
  assert.deepEqual(copies(storage.rows).map(([, v]) => v), [last]);
  assert.deepEqual(JSON.parse(storage.rows.get('orvio.restore-copies')), [copies(storage.rows)[0][0]]);
  assert.deepEqual(snap.state, JSON.parse(texts[2]).document.state);
});

test('desktop (default) store still keeps every pre-restore copy', async () => {
  const storage = limitedStorage(Infinity);
  const store = createDemoStore(storage, queue.createSerialQueue());
  let snap = await store.read();
  const texts = [];
  for (let i = 1; i <= 3; i++) {
    snap = await store.act('saveProduct', {name: `extra ${i}`, category: 'c', price: 100 * i, departmentIds: ['kitchen'], active: true}, snap);
    texts.push(await store.exportBackup());
  }
  const replaced = [];
  for (const text of texts) { replaced.push(storage.rows.get(DEMO_STORAGE_KEY)); await store.restoreBackup(text, DEFAULT_DEMO_PIN); }
  assert.deepEqual(copies(storage.rows).map(([, v]) => v).sort(), replaced.sort());
});

test('a corrupt copy index never blocks a restore', async () => {
  const storage = limitedStorage();
  const store = createDemoStore(storage, queue.createSerialQueue(), undefined, 1);
  await store.read();
  storage.rows.set('orvio.restore-copies', '{not json');
  const text = await store.exportBackup();
  await store.restoreBackup(text, DEFAULT_DEMO_PIN);
  storage.rows.set('orvio.restore-copies', JSON.stringify(['orvio.demo.v1', 42]));
  await store.restoreBackup(text, DEFAULT_DEMO_PIN);
  assert.ok(storage.rows.get(DEMO_STORAGE_KEY).length > 0);
  // The copy dropped from the broken index is no longer tracked, but it is never deleted.
  assert.equal(copies(storage.rows).length, 2);
  assert.equal(JSON.parse(storage.rows.get('orvio.restore-copies')).length, 1);
});

test('the browser demo store is created with a one-copy limit', () => {
  const source = fs.readFileSync(new URL('../lib/demo-store.ts', import.meta.url), 'utf8');
  assert.match(source, /return createDemoStore\(storage,lock,storageError,1\);/);
});
