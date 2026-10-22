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
const {createDemoStore, parseDemoDocument, DEMO_STORAGE_KEY, DEFAULT_DEMO_PIN} = evaluate('../lib/demo-store.ts', {'./pos': domain, './backup': backup});
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/legacy-demo-v1.json', import.meta.url), 'utf8'));
// Always in the past, so the future-date guard never depends on the test clock.
const DATE = '2026-01-15';

function memory() {
  const rows = new Map();
  return {rows, getItem: async key => rows.get(key) ?? null, setItem: async (key, value) => { rows.set(key, String(value)); }};
}
const closePayload = (pin = DEFAULT_DEMO_PIN) => ({pin, date: DATE, openingFloat: 10000, countedCash: 9950, note: 'ტესტი'});

async function closedStore() {
  const storage = memory();
  const store = createDemoStore(storage, queue.createSerialQueue());
  const snap = await store.act('closeDay', closePayload(), await store.read());
  return {storage, store, snap};
}

test('demo closeDay needs the manager PIN and saves nothing on a wrong one', async () => {
  const storage = memory();
  const store = createDemoStore(storage, queue.createSerialQueue());
  const before = await store.read();
  await assert.rejects(store.act('closeDay', closePayload('0000'), before), /მენეჯერის კოდი არასწორია/);
  const after = await store.read();
  assert.equal(after.state.dayCloses, undefined);
  assert.deepEqual(after.state, before.state);
  const saved = await store.act('closeDay', closePayload(), after);
  assert.equal(saved.state.dayCloses.length, 1);
  assert.deepEqual(
    (({date, sequence, openingFloat, expectedCash, countedCash, difference, note}) => ({date, sequence, openingFloat, expectedCash, countedCash, difference, note}))(saved.state.dayCloses[0]),
    {date: DATE, sequence: 1, openingFloat: 10000, expectedCash: 10000, countedCash: 9950, difference: -50, note: 'ტესტი'},
  );
  assert.deepEqual((await createDemoStore(storage, queue.createSerialQueue()).read()).state.dayCloses, saved.state.dayCloses);
});

test('selling keeps working after a day close and the snapshot stays unchanged', async () => {
  const {store, snap: closed} = await closedStore();
  const record = structuredClone(closed.state.dayCloses[0]);
  let snap = await store.act('openOrder', {tableId: 'table-1'}, closed);
  const orderId = snap.state.orders.at(-1).id;
  snap = await store.act('addItem', {orderId, productId: 'product-1', quantity: 2}, snap);
  snap = await store.act('sendOrder', {orderId}, snap);
  snap = await store.act('pay', {orderId, method: 'cash', amount: 3600}, snap);
  assert.equal(snap.state.orders.at(-1).status, 'closed');
  snap = await store.act('closeDay', closePayload(), snap);
  assert.deepEqual(snap.state.dayCloses[0], record);
  assert.equal(snap.state.dayCloses[1].sequence, 2);
});

test('a legacy document loads with no day-close history', async () => {
  const storage = memory();
  storage.rows.set(DEMO_STORAGE_KEY, fixture.localStorage);
  const snap = await createDemoStore(storage, queue.createSerialQueue()).read();
  assert.equal(snap.state.dayCloses, undefined);
  assert.equal(parseDemoDocument(fixture.localStorage).state.dayCloses, undefined);
  const next = await createDemoStore(storage, queue.createSerialQueue()).act('closeDay', closePayload(), snap);
  assert.equal(next.state.dayCloses.length, 1);
});

test('invalid day-close records are rejected as a corrupt document', async () => {
  const {storage} = await closedStore();
  const doc = JSON.parse(storage.rows.get(DEMO_STORAGE_KEY));
  assert.doesNotThrow(() => parseDemoDocument(JSON.stringify(doc)));
  const broken = change => { const copy = structuredClone(doc); change(copy.state.dayCloses[0], copy.state); return JSON.stringify(copy); };
  const cases = [
    c => { c.countedCash = -1; c.difference = -1 - c.expectedCash; },
    c => { c.difference += 1; },
    c => { c.expectedCash += 1; c.difference -= 1; },
    c => { c.date = '2026-13-01'; },
    c => { c.date = 'yesterday'; },
    c => { c.sequence = 0; },
    c => { c.totals.payments.cash = 1.5; },
    c => { c.note = 5; },
    (c, s) => { s.dayCloses.push(structuredClone(c)); },
    (c, s) => { s.dayCloses = {}; },
  ];
  for (const change of cases) assert.throws(() => parseDemoDocument(broken(change)), /დაზიანებულია/);
});

test('backup export and restore keep the day-close history', async () => {
  const {store} = await closedStore();
  const text = await store.exportBackup();
  const target = createDemoStore(memory(), queue.createSerialQueue());
  const restored = await target.restoreBackup(text, DEFAULT_DEMO_PIN);
  assert.deepEqual(restored.state.dayCloses, (await store.read()).state.dayCloses);
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

test('route: closeDay checks the hashed PIN and stores the record', async () => {
  const h = harness();
  assert.equal((await h.post('closeDay', closePayload('2468'))).status, 403);
  assert.equal((await h.post('setupPin', {pin: '2468'})).status, 200);
  const wrong = await h.post('closeDay', closePayload('1111'));
  assert.equal(wrong.status, 403);
  assert.equal(JSON.parse(h.rows.get('owner').document).state.dayCloses, undefined);
  const ok = await h.post('closeDay', closePayload('2468'));
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.state.dayCloses.length, 1);
  assert.equal(body.state.dayCloses[0].difference, -50);
  assert.equal(JSON.parse(h.rows.get('owner').document).state.dayCloses.length, 1);
  const future = await h.post('closeDay', {...closePayload('2468'), date: '2999-01-01'});
  assert.equal(future.status, 400);
  assert.equal((await future.json()).error, 'მომავალი დღის დახურვა შეუძლებელია');
});
