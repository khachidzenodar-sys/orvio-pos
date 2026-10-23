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
const {createDemoStore, parseDemoDocument, DEMO_STORAGE_KEY, DEFAULT_DEMO_PIN} = evaluate('../lib/demo-store.ts', {'./pos': domain, './backup': backup});
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/legacy-demo-v1.json', import.meta.url), 'utf8'));
const {PHOTO_MESSAGES} = photo;

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const WEBP = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
const sized = (chars, type = 'webp') => { const head = `data:image/${type};base64,`; return head + 'Q'.repeat(Math.floor((chars - head.length) / 4) * 4); };
const BAD = ['https://example.com/x.jpg', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:text/html;base64,PGgxPg==', 'data:image/png;base64,' + 'A'.repeat(60_001 - 22)];
const CORRUPT = /შენახული დემოს მონაცემები დაზიანებულია/;
const BACKUP_CORRUPT = /სარეზერვო ასლის მონაცემები დაზიანებულია/;

// In-memory KeyValueStore; `fail` makes the next setItem calls throw like a full localStorage.
function memory() {
  const rows = new Map();
  const m = {rows, fail: null, getItem: async key => rows.get(key) ?? null,
    setItem: async (key, value) => { if (m.fail) throw m.fail; rows.set(key, String(value)); }};
  return m;
}
const newStore = (storage = memory(), message) => createDemoStore(storage, queue.createSerialQueue(), message);
const setPhoto = (store, snap, productId, value, pin = DEFAULT_DEMO_PIN) => store.act('setProductPhoto', {productId, photo: value, pin}, snap);
const docWith = (mutate) => { const doc = {schema: 1, userId: 'u-1', version: 3, configured: true, pin: '1234', failures: 0, blockedUntil: 0, state: domain.demoSeedState('2026-10-23T09:00:00.000Z')}; mutate(doc.state); return doc; };

test('demo: wrong PIN leaves the product unchanged; the right PIN persists across a reload', async () => {
  const storage = memory();
  const store = newStore(storage);
  const before = await store.read();
  await assert.rejects(setPhoto(store, before, 'product-1', JPEG, '0000'), /მენეჯერის კოდი არასწორია/);
  await assert.rejects(store.act('setProductPhoto', {productId: 'product-1', photo: JPEG}, await store.read()), /მენეჯერის კოდი არასწორია/);
  let snap = await store.read();
  assert.deepEqual(snap.state.products, before.state.products);
  snap = await setPhoto(store, snap, 'product-1', JPEG);
  assert.equal(snap.state.products[0].photo, JPEG);
  const reloaded = await newStore(storage).read();
  assert.deepEqual(reloaded, snap);
  snap = await setPhoto(store, snap, 'product-1', null);
  assert.equal('photo' in (await newStore(storage).read()).state.products[0], false);
});

test('demo: invalid photo and unknown product are rejected without a version bump', async () => {
  const storage = memory();
  const store = newStore(storage);
  const snap = await store.read();
  const raw = storage.rows.get(DEMO_STORAGE_KEY);
  await assert.rejects(setPhoto(store, snap, 'product-1', 'https://example.com/a.jpg'), e => e.message === PHOTO_MESSAGES.invalid);
  await assert.rejects(setPhoto(store, snap, 'nope', JPEG), /პროდუქტი ვერ მოიძებნა/);
  assert.equal(storage.rows.get(DEMO_STORAGE_KEY), raw);
});

test('demo: saveProduct without a photo field keeps the stored photo', async () => {
  const store = newStore();
  let snap = await setPhoto(store, await store.read(), 'product-1', WEBP);
  const p = snap.state.products[0];
  snap = await store.act('saveProduct', {id: p.id, name: p.name, category: p.category, price: 1950, departmentIds: p.departmentIds, active: true}, snap);
  assert.equal(snap.state.products[0].photo, WEBP);
  assert.equal(snap.state.products[0].price, 1950);
});

test('parseDemoDocument rejects unsafe or oversized photos and accepts valid ones', () => {
  for (const bad of [...BAD, null, '', 42, {src: JPEG}]) {
    const doc = docWith(s => { s.products[0].photo = bad; });
    assert.throws(() => parseDemoDocument(JSON.stringify(doc)), CORRUPT, String(bad).slice(0, 30));
  }
  const ok = docWith(s => { s.products[0].photo = JPEG; s.products[1].photo = sized(60_000); });
  assert.equal(parseDemoDocument(JSON.stringify(ok)).state.products[1].photo.length <= 60_000, true);
  // Strict validation checks each photo, not the total: a document above the action limit still loads.
  const many = docWith(s => { for (let i = 0; i < 70; i++) s.products.push({id: `x-${i}`, name: `${i}`, category: 'c', price: 1, departmentIds: ['kitchen'], active: true, photo: JPEG}); });
  assert.equal(parseDemoDocument(JSON.stringify(many)).state.products.filter(p => p.photo).length, 70);
});

test('legacy documents and backups without photos keep loading', async () => {
  const storage = memory();
  storage.rows.set(DEMO_STORAGE_KEY, fixture.localStorage);
  const before = JSON.parse(fixture.localStorage);
  const store = newStore(storage);
  let snap = await store.read();
  assert.deepEqual(snap.state.products, before.state.products);
  assert.ok(snap.state.products.every(p => !('photo' in p)));
  snap = await setPhoto(store, snap, snap.state.products[0].id, JPEG);
  assert.equal((await newStore(storage).read()).state.products[0].photo, JPEG);
  const info = await newStore().inspectBackup(fixture.backup);
  assert.equal(info.summary.photos, undefined);
  const restored = await newStore().restoreBackup(fixture.backup, DEFAULT_DEMO_PIN);
  assert.ok(restored.state.products.every(p => !('photo' in p)));
});

test('30 products with 54 000-character photos stay under 2 MB and round-trip through storage', async () => {
  let state = domain.demoSeedState('2026-10-23T09:00:00.000Z');
  for (let i = state.products.length; i < 30; i++) state = domain.applyAction(state, 'saveProduct', {id: `extra-${i}`, name: `კერძი ${i}`, category: 'კერძები', price: 1000, departmentIds: ['kitchen'], active: true});
  for (const p of state.products) state = domain.applyAction(state, 'setProductPhoto', {productId: p.id, photo: sized(photo.PHOTO_TARGET_CHARS, 'jpeg')}, true);
  assert.equal(state.products.filter(p => p.photo?.length === 53_999).length, 30);
  const doc = {schema: 1, userId: 'u-1', version: 1, configured: true, pin: '1234', failures: 0, blockedUntil: 0, state};
  const raw = JSON.stringify(doc);
  assert.ok(raw.length < 2_000_000, `document is ${raw.length} characters`);
  const storage = memory();
  storage.rows.set(DEMO_STORAGE_KEY, raw);
  const snap = await newStore(storage).read();
  assert.deepEqual(snap.state.products, state.products);
});

test('quota failure while saving a photo gives the Georgian message and keeps the stored document', async () => {
  for (const error of [new DOMException('full', 'QuotaExceededError'), {name: 'QuotaExceededError'}, {name: 'NS_ERROR_DOM_QUOTA_REACHED'}, {code: 22}]) {
    const storage = memory();
    const store = newStore(storage);
    const snap = await setPhoto(store, await store.read(), 'product-2', WEBP);
    const raw = storage.rows.get(DEMO_STORAGE_KEY);
    storage.fail = error;
    await assert.rejects(setPhoto(store, snap, 'product-1', JPEG), e => e.message === PHOTO_MESSAGES.quota);
    await assert.rejects(store.act('openOrder', {tableId: 'table-1'}, snap), e => e.message === 'ბრაუზერის მეხსიერება გავსებულია — ცვლილება ვერ შეინახა. წაშალეთ ზოგიერთი ფოტო.');
    assert.equal(storage.rows.get(DEMO_STORAGE_KEY), raw);
    assert.deepEqual(await store.read(), snap);
    storage.fail = null;
    // After the user frees space the same request succeeds against the unchanged version.
    const saved = await setPhoto(store, snap, 'product-1', JPEG);
    assert.equal(saved.version, snap.version + 1);
    assert.deepEqual((await newStore(storage).read()).state.products.filter(p => p.photo).map(p => p.id), ['product-1', 'product-2']);
  }
});

test('non-quota storage failures keep the existing storage message', async () => {
  const storage = memory();
  const store = newStore(storage, 'მონაცემების ფაილი ვერ შეინახა.');
  const snap = await store.read();
  storage.fail = new Error('EACCES');
  await assert.rejects(setPhoto(store, snap, 'product-1', JPEG), /^Error: მონაცემების ფაილი ვერ შეინახა\.$/);
  const plain = memory();
  const browser = newStore(plain);
  const s2 = await browser.read();
  plain.fail = new TypeError('blocked');
  await assert.rejects(setPhoto(browser, s2, 'product-1', JPEG), /დემოს შენახვა ვერ მოხერხდა/);
});

test('backup round-trip restores identical photos and reports the photo count', async () => {
  const source = newStore();
  let snap = await source.read();
  const big = sized(photo.PHOTO_MAX_CHARS, 'png');
  snap = await setPhoto(source, snap, 'product-1', JPEG);
  snap = await setPhoto(source, snap, 'product-5', big);
  const text = await source.exportBackup();
  assert.equal(JSON.parse(text).formatVersion, backup.BACKUP_FORMAT_VERSION);
  assert.equal(backup.BACKUP_FORMAT_VERSION, 1);
  const target = newStore();
  const info = await target.inspectBackup(text);
  assert.deepEqual(info.summary, {orders: 0, products: snap.state.products.length, photos: 2});
  const restored = await target.restoreBackup(text, DEFAULT_DEMO_PIN);
  assert.deepEqual(restored.state.products, snap.state.products);
  assert.equal(restored.state.products.find(p => p.id === 'product-1').photo, JPEG);
  assert.equal(restored.state.products.find(p => p.id === 'product-5').photo, big);
  assert.deepEqual(backup.readBackup(text, parseDemoDocument).summary.photos, 2);
});

test('a backup with an unsafe photo is rejected and the current document stays', async () => {
  const storage = memory();
  const store = newStore(storage);
  await setPhoto(store, await store.read(), 'product-1', JPEG);
  const raw = storage.rows.get(DEMO_STORAGE_KEY);
  const good = JSON.parse(await store.exportBackup());
  for (const bad of BAD) {
    const envelope = structuredClone(good);
    envelope.document.state.products[1].photo = bad;
    const text = JSON.stringify(envelope);
    await assert.rejects(store.inspectBackup(text), BACKUP_CORRUPT);
    await assert.rejects(store.restoreBackup(text, DEFAULT_DEMO_PIN), BACKUP_CORRUPT);
  }
  assert.equal(storage.rows.get(DEMO_STORAGE_KEY), raw);
  assert.deepEqual([...storage.rows.keys()], [DEMO_STORAGE_KEY]);
});

test('quota failure during restore keeps the current document', async () => {
  const storage = memory();
  const store = newStore(storage);
  const text = await (async () => { const s = newStore(); await setPhoto(s, await s.read(), 'product-1', JPEG); return s.exportBackup(); })();
  await store.read();
  const raw = storage.rows.get(DEMO_STORAGE_KEY);
  storage.fail = new DOMException('full', 'QuotaExceededError');
  await assert.rejects(store.restoreBackup(text, DEFAULT_DEMO_PIN), /ბრაუზერის მეხსიერება გავსებულია/);
  assert.equal(storage.rows.get(DEMO_STORAGE_KEY), raw);
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
  const get = query => api.GET(new Request(`https://pos.test/api/pos${query ?? ''}`));
  const stored = () => JSON.parse(rows.get('owner').document).state;
  return {api, post, get, rows, stored};
}

test('route: setProductPhoto checks the hashed PIN, validates and stores the photo', async () => {
  const h = harness();
  assert.equal((await h.post('setProductPhoto', {productId: 'product-1', photo: JPEG, pin: '2468'})).status, 403);
  assert.equal((await h.post('setupPin', {pin: '2468'})).status, 200);
  const wrong = await h.post('setProductPhoto', {productId: 'product-1', photo: JPEG, pin: '1111'});
  assert.equal(wrong.status, 403);
  assert.equal((await wrong.json()).error, 'მენეჯერის კოდი არასწორია');
  assert.equal((await h.post('setProductPhoto', {productId: 'product-1', photo: JPEG})).status, 403);
  assert.equal('photo' in h.stored().products[0], false);
  for (const bad of BAD) {
    const version = h.rows.get('owner').version;
    const r = await h.post('setProductPhoto', {productId: 'product-1', photo: bad, pin: '2468'});
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, PHOTO_MESSAGES.invalid);
    assert.equal(h.rows.get('owner').version, version);
  }
  const missing = await h.post('setProductPhoto', {productId: 'nope', photo: JPEG, pin: '2468'});
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error, 'პროდუქტი ვერ მოიძებნა');
  const ok = await h.post('setProductPhoto', {productId: 'product-1', photo: JPEG, pin: '2468'});
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).state.products[0].photo, JPEG);
  assert.equal(h.stored().products[0].photo, JPEG);
  const p = h.stored().products[0];
  assert.equal((await h.post('saveProduct', {...p, price: 1999, photo: WEBP})).status, 200);
  assert.equal(h.stored().products[0].photo, JPEG);
  assert.equal(h.stored().products[0].price, 1999);
  assert.equal((await h.post('setProductPhoto', {productId: 'product-1', photo: null, pin: '2468'})).status, 200);
  assert.equal('photo' in h.stored().products[0], false);
});

test('route: GET ?since skips the state only when the version is unchanged', async () => {
  const h = harness();
  const full = await (await h.get()).json();
  assert.ok(full.state && full.version === 0 && full.userId === 'owner');
  const same = await h.get('?since=0');
  assert.equal(same.status, 200);
  assert.equal(same.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await same.json(), {unchanged: true, version: 0, userId: 'owner'});
  assert.equal((await h.post('setupPin', {pin: '2468'})).status, 200);
  assert.equal((await h.post('setProductPhoto', {productId: 'product-1', photo: JPEG, pin: '2468'})).status, 200);
  const stale = await (await h.get('?since=0')).json();
  assert.equal(stale.unchanged, undefined);
  assert.equal(stale.version, 2);
  assert.equal(stale.state.products[0].photo, JPEG);
  assert.equal((await (await h.get('?since=2')).json()).unchanged, true);
  for (const q of ['?since=', '?since=abc', '?since=-2', '?since=2.0', '?since=1e0', '?since=99999999999999999999']) {
    const body = await (await h.get(q)).json();
    assert.equal(body.unchanged, undefined, q);
    assert.ok(body.state, q);
  }
  // Calls without a request (older callers) still return the full state.
  assert.ok((await (await h.api.GET()).json()).state);
});

test('the desktop CSP is unchanged', () => {
  const conf = JSON.parse(fs.readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  assert.equal(conf.app.security.csp, "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'");
});

test('setProductPhoto is a manager action in both the demo store and the route', () => {
  for (const file of ['../lib/demo-store.ts', '../app/api/pos/route.ts']) {
    const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    const list = source.match(/const managerActions[^=]*=\s*\[([^\]]*)\]/)[1];
    assert.match(list, /'setProductPhoto'/, file);
  }
});
