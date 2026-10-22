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
const {createDemoStore, DEMO_STORAGE_KEY, DEFAULT_DEMO_PIN} = evaluate('../lib/demo-store.ts', {'./pos': domain, './backup': backup});

function memory() {
  const rows = new Map();
  return {rows, getItem: async key => rows.get(key) ?? null, setItem: async (key, value) => { rows.set(key, String(value)); }};
}
async function busyStore() {
  const storage = memory();
  const store = createDemoStore(storage, queue.createSerialQueue());
  let d = await store.read();
  d = await store.act('openOrder', {tableId: d.state.tables[0].id}, d);
  const order = d.state.orders[0];
  d = await store.act('addItem', {orderId: order.id, productId: d.state.products[0].id, quantity: 2}, d);
  return {storage, store};
}
const stored = storage => JSON.parse(storage.rows.get(DEMO_STORAGE_KEY));

test('export then restore into another store reproduces the state and pin', async () => {
  const source = await busyStore();
  await source.store.act('changePin', {oldPin: DEFAULT_DEMO_PIN, newPin: '5678'}, await source.store.read());
  const text = await source.store.exportBackup();
  const envelope = JSON.parse(text);
  assert.equal(envelope.app, 'orvio-pos');
  assert.equal(envelope.kind, 'backup');
  assert.equal(envelope.formatVersion, 1);
  assert.deepEqual(envelope.document, stored(source.storage));

  const targetStorage = memory();
  const target = createDemoStore(targetStorage, queue.createSerialQueue());
  const info = await target.inspectBackup(text);
  assert.equal(info.createdAt, envelope.createdAt);
  assert.deepEqual(info.summary, {orders: 1, products: envelope.document.state.products.length});

  const before = await target.read();
  const restored = await target.restoreBackup(text, DEFAULT_DEMO_PIN);
  assert.deepEqual(restored.state, envelope.document.state);
  assert.equal(restored.version, Math.max(before.version, envelope.document.version) + 1);
  const again = await target.read();
  assert.deepEqual(again.state, envelope.document.state);
  assert.equal(stored(targetStorage).pin, '5678');
});

test('invalid files are rejected and leave stored data unchanged', async () => {
  const {storage, store} = await busyStore();
  const valid = JSON.parse(await store.exportBackup());
  const broken = {...valid, document: {...valid.document, state: {...valid.document.state, orders: 'x'}}};
  const cases = [
    ['', 'ფაილი ცარიელია'],
    ['{', 'ფაილი დაზიანებულია ან არ არის ORVIO-ს სარეზერვო ასლი'],
    ['{"app":"other"}', 'ეს ფაილი ORVIO-ს სარეზერვო ასლი არ არის'],
    [JSON.stringify({...valid, formatVersion: 2}), 'ფაილი უფრო ახალი ვერსიითაა შექმნილი'],
    [JSON.stringify(broken), 'სარეზერვო ასლის მონაცემები დაზიანებულია'],
  ];
  const snapshot = new Map(storage.rows);
  for (const [text, message] of cases) {
    await assert.rejects(store.inspectBackup(text), {message});
    await assert.rejects(store.restoreBackup(text, DEFAULT_DEMO_PIN), {message});
    assert.deepEqual(storage.rows, snapshot);
  }
});

test('wrong PIN rejects without changing the data', async () => {
  const {storage, store} = await busyStore();
  const before = stored(storage);
  const other = createDemoStore(memory());
  await other.read();
  await assert.rejects(store.restoreBackup(await other.exportBackup(), '0000'), {message: 'მენეჯერის კოდი არასწორია'});
  const after = stored(storage);
  assert.deepEqual(after.state, before.state);
  assert.equal(after.pin, before.pin);
  assert.equal(after.failures, 1);
  assert.equal([...storage.rows.keys()].filter(k => k.startsWith('orvio.before-restore.')).length, 0);
});

test('repeated wrong PINs lock restore like other manager actions', async () => {
  const {store} = await busyStore();
  const text = await store.exportBackup();
  for (let i = 0; i < 5; i++) await assert.rejects(store.restoreBackup(text, '0000'), {message: 'მენეჯერის კოდი არასწორია'});
  await assert.rejects(store.restoreBackup(text, DEFAULT_DEMO_PIN), {message: 'კოდი დროებით დაბლოკილია. სცადეთ 5 წუთში.'});
});

test('successful restore keeps a copy of the previous document', async () => {
  const {storage, store} = await busyStore();
  const previousRaw = storage.rows.get(DEMO_STORAGE_KEY);
  const fresh = createDemoStore(memory());
  await fresh.read();
  const restored = await store.restoreBackup(await fresh.exportBackup(), DEFAULT_DEMO_PIN);
  assert.equal(restored.state.orders.length, 0);
  const copies = [...storage.rows.keys()].filter(k => k.startsWith('orvio.before-restore.'));
  assert.equal(copies.length, 1);
  assert.match(copies[0], /^orvio\.before-restore\.\d{8}-\d{6}$/);
  assert.equal(storage.rows.get(copies[0]), previousRaw);
  const now = stored(storage);
  assert.equal(now.failures, 0);
  assert.equal(now.blockedUntil, 0);
});

test('a failed safety copy aborts the restore before the main data is touched', async () => {
  const {storage, store} = await busyStore();
  const before = storage.rows.get(DEMO_STORAGE_KEY);
  const text = await store.exportBackup();
  const failing = {...storage, setItem: async (key, value) => {
    if (key.startsWith('orvio.before-restore.')) throw new Error('disk full');
    storage.rows.set(key, value);
  }};
  const guarded = createDemoStore(failing, queue.createSerialQueue(), 'saving failed');
  await assert.rejects(guarded.restoreBackup(text, DEFAULT_DEMO_PIN), {message: 'saving failed'});
  assert.equal(storage.rows.get(DEMO_STORAGE_KEY), before);
});

test('backup file name uses the Tbilisi date', () => {
  assert.equal(backup.backupFileName(new Date('2026-10-18T21:30:00Z')), 'orvio-backup-2026-10-19.json');
  assert.equal(backup.backupStamp(new Date('2026-10-18T08:05:09Z')), '20261018-120509');
});
