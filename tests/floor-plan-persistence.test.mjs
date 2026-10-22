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
const plan = evaluate('../lib/floor-plan.ts');
const backup = evaluate('../lib/backup.ts');
const queue = evaluate('../lib/serial-queue.ts');
const {createDemoStore, parseDemoDocument, DEMO_STORAGE_KEY, DEFAULT_DEMO_PIN} = evaluate('../lib/demo-store.ts', {'./pos': domain, './backup': backup});
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/legacy-demo-v1.json', import.meta.url), 'utf8'));

function memory() {
  const rows = new Map();
  return {rows, getItem: async key => rows.get(key) ?? null, setItem: async (key, value) => { rows.set(key, String(value)); }};
}
const newStore = (storage = memory()) => createDemoStore(storage, queue.createSerialQueue());
const terracePlan = (pin = DEFAULT_DEMO_PIN) => ({
  pin, zoneId: 'terrace',
  tables: [
    {id: 'table-9', name: '9', layout: {seats: 6, shape: 'rectangle', x: 200, y: 150, rotation: 90}},
    {id: 'table-10', name: 'ფანჯარასთან', layout: {seats: 2, shape: 'round', x: 500, y: 150, rotation: 0}},
    {name: '13', layout: {seats: 8, shape: 'square', x: 750, y: 400, rotation: 0}},
  ],
  removeIds: ['table-12'],
});
const pick = t => ({id: t.id, name: t.name, zoneId: t.zoneId, layout: t.layout, archived: t.archived});

test('demo seed tables have valid, non-overlapping layouts inside their zone', () => {
  const s = domain.demoSeedState('2026-01-05T09:00:00.000Z');
  assert.ok(s.tables.every(t => domain.isValidTableLayout(t.layout)));
  assert.ok(domain.seedState().tables.every(t => t.layout === undefined));
  for (const zone of s.zones) {
    const rects = plan.zoneTables(s, zone.id).map(t => {
      assert.deepEqual(plan.clampPosition(t.layout, t.layout.x, t.layout.y), {x: t.layout.x, y: t.layout.y});
      const f = plan.footprint(t.layout);
      return {l: t.layout.x - f.width / 2, r: t.layout.x + f.width / 2, t: t.layout.y - f.height / 2, b: t.layout.y + f.height / 2};
    });
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      assert.ok(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t, `${zone.id} tables ${i} and ${j} overlap`);
    }
  }
});

test('demo saveFloorPlan needs the manager PIN and survives a reload', async () => {
  const storage = memory();
  const store = newStore(storage);
  const before = await store.read();
  await assert.rejects(store.act('saveFloorPlan', terracePlan('0000'), before), /მენეჯერის კოდი არასწორია/);
  const after = await store.read();
  assert.deepEqual(after.state, before.state);
  const saved = await store.act('saveFloorPlan', terracePlan(), after);
  const terrace = saved.state.tables.filter(t => t.zoneId === 'terrace');
  assert.equal(terrace.length, 5);
  assert.deepEqual(pick(terrace.find(t => t.id === 'table-9')), {id: 'table-9', name: '9', zoneId: 'terrace', layout: {seats: 6, shape: 'rectangle', x: 200, y: 150, rotation: 90}, archived: undefined});
  assert.equal(terrace.find(t => t.id === 'table-10').name, 'ფანჯარასთან');
  assert.equal(terrace.find(t => t.id === 'table-12').archived, true);
  const added = terrace.find(t => t.name === '13');
  assert.deepEqual(added.layout, {seats: 8, shape: 'square', x: 750, y: 400, rotation: 0});
  assert.deepEqual(saved.state.tables.filter(t => t.zoneId === 'hall'), before.state.tables.filter(t => t.zoneId === 'hall'));
  assert.match(saved.state.audit[0].detail, /ტერასა: განახლდა 2, დაემატა 1, ამოღებულია 1/);
  const reread = await newStore(storage).read();
  assert.deepEqual(reread.state.tables, saved.state.tables);
});

test('saveTable keeps the layout on rename and drops it on a zone change', async () => {
  const store = newStore();
  let snap = await store.act('saveFloorPlan', terracePlan(), await store.read());
  const layout = snap.state.tables.find(t => t.id === 'table-9').layout;
  snap = await store.act('saveTable', {pin: DEFAULT_DEMO_PIN, id: 'table-9', name: 'VIP', zoneId: 'terrace'}, snap);
  assert.deepEqual(pick(snap.state.tables.find(t => t.id === 'table-9')), {id: 'table-9', name: 'VIP', zoneId: 'terrace', layout, archived: undefined});
  snap = await store.act('saveTable', {pin: DEFAULT_DEMO_PIN, id: 'table-9', name: 'VIP', zoneId: 'hall'}, snap);
  const moved = snap.state.tables.find(t => t.id === 'table-9');
  assert.equal(moved.zoneId, 'hall');
  assert.equal(moved.layout, undefined);
  snap = await store.act('saveTable', {pin: DEFAULT_DEMO_PIN, name: 'ახალი', zoneId: 'hall'}, snap);
  assert.equal(snap.state.tables.at(-1).layout, undefined);
});

test('removing a table with an open order is refused and nothing changes', async () => {
  const store = newStore();
  let snap = await store.act('openOrder', {tableId: 'table-12'}, await store.read());
  const before = structuredClone(snap.state);
  await assert.rejects(store.act('saveFloorPlan', terracePlan(), snap), /ჯერ დახურეთ ან გადაიტანეთ მაგიდის შეკვეთა/);
  assert.deepEqual((await store.read()).state, before);
});

test('invalid table layouts are rejected as a corrupt document', async () => {
  const storage = memory();
  await newStore(storage).act('saveFloorPlan', terracePlan(), await newStore(storage).read());
  const doc = JSON.parse(storage.rows.get(DEMO_STORAGE_KEY));
  assert.doesNotThrow(() => parseDemoDocument(JSON.stringify(doc)));
  const broken = change => { const copy = structuredClone(doc); change(copy.state.tables.find(t => t.id === 'table-9').layout); return JSON.stringify(copy); };
  const cases = [
    l => { l.seats = 0; },
    l => { l.seats = 'abc'; },
    l => { l.seats = 21; },
    l => { l.shape = 'oval'; },
    l => { l.x = 1001; },
    l => { l.y = 1.5; },
    l => { l.rotation = 45; },
    l => { l.extra = true; },
  ];
  for (const change of cases) assert.throws(() => parseDemoDocument(broken(change)), /დაზიანებულია/);
  const nullLayout = structuredClone(doc);
  nullLayout.state.tables[0].layout = null;
  assert.throws(() => parseDemoDocument(JSON.stringify(nullLayout)), /დაზიანებულია/);
});

test('a legacy document loads with tables that have no layout', async () => {
  const storage = memory();
  storage.rows.set(DEMO_STORAGE_KEY, fixture.localStorage);
  const snap = await newStore(storage).read();
  assert.ok(snap.state.tables.length > 0);
  assert.ok(snap.state.tables.every(t => t.layout === undefined));
  assert.ok(parseDemoDocument(fixture.localStorage).state.tables.every(t => t.layout === undefined));
});

test('backup export and restore keep table layouts', async () => {
  const store = newStore();
  await store.act('saveFloorPlan', terracePlan(), await store.read());
  const restored = await newStore().restoreBackup(await store.exportBackup(), DEFAULT_DEMO_PIN);
  assert.deepEqual(restored.state.tables, (await store.read()).state.tables);
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
  return {post, rows};
}

test('route: saveFloorPlan checks the hashed PIN and stores the layout', async () => {
  const h = harness();
  assert.equal((await h.post('saveFloorPlan', terracePlan('2468'))).status, 403);
  assert.equal((await h.post('setupPin', {pin: '2468'})).status, 200);
  assert.equal((await h.post('saveFloorPlan', terracePlan('1111'))).status, 403);
  assert.ok(JSON.parse(h.rows.get('owner').document).state.tables.every(t => t.layout === undefined));
  const ok = await h.post('saveFloorPlan', terracePlan('2468'));
  assert.equal(ok.status, 200);
  const stored = JSON.parse(h.rows.get('owner').document).state.tables;
  assert.deepEqual(stored.find(t => t.id === 'table-9').layout, {seats: 6, shape: 'rectangle', x: 200, y: 150, rotation: 90});
  assert.equal(stored.find(t => t.id === 'table-12').archived, true);
  const bad = await h.post('saveFloorPlan', {...terracePlan('2468'), tables: [{id: 'table-10', name: '10', layout: {seats: 0, shape: 'round', x: 1, y: 1, rotation: 0}}], removeIds: []});
  assert.equal(bad.status, 400);
});
