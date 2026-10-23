// Tester 1 probes for product photos: validator edge cases, domain invariants,
// printing isolation, backup/restore and the API route's ?since path.
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
const photo = evaluate('../lib/product-photo.ts');
const backup = evaluate('../lib/backup.ts');
const queue = evaluate('../lib/serial-queue.ts');
const format = evaluate('../lib/format.ts', {'./pos': domain});
const layout = evaluate('../lib/printing/receipt-layout.ts', {'@/lib/pos': domain, '@/lib/format': format});
const {createDemoStore, parseDemoDocument, DEMO_STORAGE_KEY, DEFAULT_DEMO_PIN} = evaluate('../lib/demo-store.ts', {'./pos': domain, './backup': backup});
const {isValidProductPhoto, PHOTO_MESSAGES} = photo;

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const WEBP = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

function memory() {
  const rows = new Map();
  const m = {rows, fail: null, getItem: async key => rows.get(key) ?? null,
    setItem: async (key, value) => { if (m.fail) throw m.fail; rows.set(key, String(value)); }};
  return m;
}
const newStore = (storage = memory()) => createDemoStore(storage, queue.createSerialQueue());
const setPhoto = (store, snap, productId, value, pin = DEFAULT_DEMO_PIN) => store.act('setProductPhoto', {productId, photo: value, pin}, snap);

test('validator accepts jpeg/png/webp data URLs', () => {
  for (const ok of [JPEG, PNG, WEBP]) assert.equal(isValidProductPhoto(ok), true, ok.slice(0, 20));
});

test('validator rejects URLs, other types, odd syntax and malformed base64', () => {
  const bad = [
    'javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'http://x/a.jpg', 'https://x/a.jpg', '//x/a.jpg', '/a.jpg', 'blob:https://x/1',
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:image/svg+xml,<svg onload=alert(1)>', 'data:text/html;base64,PGgxPg==',
    'data:image/gif;base64,R0lGODlhAQABAAAAACw=', 'data:image/jpg;base64,AAAA', 'data:image/JPEG;base64,AAAA', 'DATA:image/jpeg;base64,AAAA',
    'data:image/jpeg,AAAA', 'data:image/jpeg;charset=utf-8;base64,AAAA', 'data:image/jpeg;base64,', 'data:image/jpeg;base64,AAA',
    'data:image/jpeg;base64,AAAAA', 'data:image/jpeg;base64,A===', 'data:image/jpeg;base64,AA=A', 'data:image/jpeg;base64,AA AA',
    'data:image/jpeg;base64,AAAA\n', 'data:image/jpeg;base64,AAAA\nBBBB', ' data:image/jpeg;base64,AAAA', 'data:image/jpeg;base64,AAAA ',
    'data:image/jpeg;base64,AA-_', 'data:image/jpeg;base64,AA%3D', 'data:image/jpeg;base64,AAAA"><script>', '',
    'data:image/jpeg;base64,' + 'A'.repeat(60_000),
  ];
  for (const value of bad) assert.equal(isValidProductPhoto(value), false, JSON.stringify(value.slice(0, 50)));
  for (const value of [null, undefined, 0, {}, [], ['data:image/jpeg;base64,AAAA'], new String(JPEG)]) assert.equal(isValidProductPhoto(value), false, String(value));
  // Exactly at the 60 000-character limit is allowed, one block more is not.
  const head = 'data:image/png;base64,';
  const at = head + 'A'.repeat(Math.floor((60_000 - head.length) / 4) * 4);
  assert.ok(at.length <= 60_000 && isValidProductPhoto(at));
  assert.equal(isValidProductPhoto(at + 'AAAA'), at.length + 4 <= 60_000);
});

test('domain: setProductPhoto needs the manager flag, rejects bad input and leaves state intact', () => {
  const s = domain.seedState();
  assert.throws(() => domain.applyAction(s, 'setProductPhoto', {productId: 'product-1', photo: JPEG}, false), /მენეჯერის კოდი/);
  for (const value of [undefined, '', 'https://x/a.jpg', 42]) assert.throws(() => domain.applyAction(s, 'setProductPhoto', {productId: 'product-1', photo: value}, true), e => e.message === PHOTO_MESSAGES.invalid);
  assert.throws(() => domain.applyAction(s, 'setProductPhoto', {productId: 'product-1', photo: null}, true), /ფოტო არ აქვს/);
  assert.throws(() => domain.applyAction(s, 'setProductPhoto', {productId: 'nope', photo: JPEG}, true), /პროდუქტი ვერ მოიძებნა/);
  assert.ok(s.products.every(p => !('photo' in p)));
  const withPhoto = domain.applyAction(s, 'setProductPhoto', {productId: 'product-1', photo: JPEG}, true);
  assert.ok(!('photo' in s.products[0]), 'original state must not be mutated');
  assert.equal(withPhoto.products[0].photo, JPEG);
  assert.ok(!withPhoto.audit.some(a => a.detail.includes('base64')), 'audit must not hold the data URL');
  const replaced = domain.applyAction(withPhoto, 'setProductPhoto', {productId: 'product-1', photo: PNG}, true);
  assert.equal(replaced.products[0].photo, PNG);
  const removed = domain.applyAction(replaced, 'setProductPhoto', {productId: 'product-1', photo: null}, true);
  assert.ok(!('photo' in removed.products[0]));
  assert.equal(JSON.stringify(removed.products[0]).includes('photo'), false);
});

test('domain: saveProduct keeps the photo, ignores a photo field, and new products never get one', () => {
  let s = domain.applyAction(domain.seedState(), 'setProductPhoto', {productId: 'product-1', photo: JPEG}, true);
  const p = s.products[0];
  s = domain.applyAction(s, 'saveProduct', {id: p.id, name: 'ახალი სახელი', category: p.category, price: 777, departmentIds: p.departmentIds, active: false, photo: null});
  assert.equal(s.products[0].photo, JPEG);
  assert.equal(s.products[0].name, 'ახალი სახელი');
  s = domain.applyAction(s, 'saveProduct', {id: p.id, name: p.name, category: p.category, price: 777, departmentIds: p.departmentIds, active: true, photo: ''});
  assert.equal(s.products[0].photo, JPEG);
  s = domain.applyAction(s, 'saveProduct', {name: 'სხვა', category: 'c', price: 1, departmentIds: ['kitchen'], active: true, photo: JPEG});
  assert.ok(!('photo' in s.products.at(-1)));
});

test('domain: photo limits count replacements correctly', () => {
  let s = domain.seedState();
  for (let i = 0; i < 60; i++) s = domain.applyAction(s, 'saveProduct', {id: `x-${i}`, name: `x${i}`, category: 'c', price: 1, departmentIds: ['kitchen'], active: true});
  for (let i = 0; i < 60; i++) s = domain.applyAction(s, 'setProductPhoto', {productId: `x-${i}`, photo: JPEG}, true);
  assert.throws(() => domain.applyAction(s, 'setProductPhoto', {productId: 'product-1', photo: JPEG}, true), e => e.message === PHOTO_MESSAGES.countLimit);
  s = domain.applyAction(s, 'setProductPhoto', {productId: 'x-0', photo: PNG}, true);
  s = domain.applyAction(s, 'setProductPhoto', {productId: 'x-0', photo: null}, true);
  s = domain.applyAction(s, 'setProductPhoto', {productId: 'product-1', photo: JPEG}, true);
  assert.equal(s.products.filter(p => p.photo).length, 60);
});

test('photos never reach order lines, tickets, receipts or ticket print rows', () => {
  const NOW = '2026-10-15T18:00:00.000Z';
  let s = domain.seedState();
  for (const p of s.products) s = domain.applyAction(s, 'setProductPhoto', {productId: p.id, photo: JPEG}, true);
  const act = (action, payload = {}, manager = false) => { s = domain.applyAction(s, action, payload, manager, NOW); };
  act('openOrder', {tableId: 'table-3'});
  const orderId = s.orders[0].id;
  act('addItem', {orderId, productId: 'product-1', quantity: 2});
  act('addItem', {orderId, productId: 'product-2', quantity: 1});
  act('sendOrder', {orderId});
  act('voidItem', {orderId, lineId: s.orders[0].lines[0].id, quantity: 1, reason: 'test'}, true);
  const order = s.orders[0];
  for (const thing of [order, ...s.tickets, s.audit]) assert.ok(!JSON.stringify(thing).includes('base64'), JSON.stringify(thing).slice(0, 80));
  const rows = [layout.receiptRows(order, s), ...s.tickets.map(t => layout.ticketRows(t, s))];
  for (const r of rows) assert.ok(!JSON.stringify(r).includes('data:image'));
  // Printed output is identical with and without photos.
  const strip = st => ({...st, products: st.products.map(p => { const copy = {...p}; delete copy.photo; return copy; })});
  assert.deepEqual(layout.receiptRows(order, strip(s)), layout.receiptRows(order, s));
  assert.deepEqual(s.tickets.map(t => layout.ticketRows(t, strip(s))), s.tickets.map(t => layout.ticketRows(t, s)));
});

test('demo store: wrong PIN on photo removal changes nothing but the failure counter', async () => {
  const storage = memory();
  const store = newStore(storage);
  let snap = await setPhoto(store, await store.read(), 'product-1', JPEG);
  await assert.rejects(setPhoto(store, snap, 'product-1', null, '9999'), /მენეჯერის კოდი არასწორია/);
  snap = await store.read();
  assert.equal(snap.state.products[0].photo, JPEG);
  // Five wrong PINs lock out photo changes like any manager action.
  for (let i = 0; i < 4; i++) { await assert.rejects(setPhoto(store, snap, 'product-1', null, '9999')); snap = await store.read(); }
  await assert.rejects(setPhoto(store, snap, 'product-1', null, DEFAULT_DEMO_PIN), /დაბლოკილია/);
  assert.equal((await store.read()).state.products[0].photo, JPEG);
});

test('demo store: restore keeps photos and a stale snapshot cannot overwrite them', async () => {
  const source = newStore();
  await setPhoto(source, await source.read(), 'product-3', WEBP);
  const text = await source.exportBackup();
  const storage = memory();
  const store = newStore(storage);
  const before = await store.read();
  const restored = await store.restoreBackup(text, DEFAULT_DEMO_PIN);
  assert.equal(restored.state.products.find(p => p.id === 'product-3').photo, WEBP);
  await assert.rejects(setPhoto(store, before, 'product-3', null), /სხვა ფანჯარაში/);
  assert.equal((await newStore(storage).read()).state.products.find(p => p.id === 'product-3').photo, WEBP);
  assert.equal(parseDemoDocument(storage.rows.get(DEMO_STORAGE_KEY)).state.products.find(p => p.id === 'product-3').photo, WEBP);
});

function harness() {
  const rows = new Map();
  let current = 'owner-a';
  const api = evaluate('../app/api/pos/route.ts', {
    '@/lib/server/auth': {getUser: async () => (current ? {userId: current} : null)},
    '@/lib/server/config': {ServiceUnavailable: class extends Error {}, sameOrigin: request => request.headers.get('origin') === new URL(request.url).origin},
    '@/lib/server/store': {
      async readStore(key, document) { if (!rows.has(key)) rows.set(key, {version: 0, document}); return structuredClone(rows.get(key)); },
      async saveStore(key, version, document) { const row = rows.get(key); if (!row || row.version !== version) return false; rows.set(key, {version: version + 1, document}); return true; },
    },
    '@/lib/pos': domain,
  });
  const post = (action, payload = {}, user = current) => api.POST(new Request('https://pos.test/api/pos', {method: 'POST', headers: {'content-type': 'application/json', origin: 'https://pos.test'}, body: JSON.stringify({action, payload, version: rows.get(user)?.version ?? 0, requestId: webcrypto.randomUUID(), ownerId: user})}));
  const get = query => api.GET(new Request(`https://pos.test/api/pos${query ?? ''}`));
  return {api, post, get, rows, as: user => { current = user; }};
}

test('route: photo PIN is enforced for set and remove', async () => {
  const h = harness();
  assert.equal((await h.post('setupPin', {pin: '2468'})).status, 200);
  assert.equal((await h.post('setProductPhoto', {productId: 'product-1', photo: JPEG, pin: '2468'})).status, 200);
  for (const pin of ['1111', '', undefined, 2468, '2468 ']) {
    const r = await h.post('setProductPhoto', {productId: 'product-1', photo: null, pin});
    assert.equal(r.status, 403, String(pin));
  }
  assert.equal(JSON.parse(h.rows.get('owner-a').document).state.products[0].photo, JPEG);
});

test('route: ?since is per account and never answers unchanged for a newer version', async () => {
  const h = harness();
  await h.post('setupPin', {pin: '2468'});
  const v = h.rows.get('owner-a').version;
  assert.equal((await (await h.get(`?since=${v}`)).json()).unchanged, true);
  assert.equal((await (await h.get(`?since=${v + 1}`)).json()).unchanged, undefined);
  assert.equal((await (await h.get(`?since=${v - 1}`)).json()).unchanged, undefined);
  h.as(null);
  assert.equal((await h.get(`?since=${v}`)).status, 401);
});
