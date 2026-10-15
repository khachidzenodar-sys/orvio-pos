import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

// Evaluate the real local adapter and domain. Any attempted network access fails
// the test; demo behavior must remain independent of Supabase and account APIs.
let networkCalls = 0;
function evaluate(path, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'crypto', 'fetch', source)(name => {
    if (!(name in imports)) throw new Error(`Unexpected dependency in local demo: ${name}`);
    return imports[name];
  }, module, module.exports, webcrypto, () => {
    networkCalls++;
    throw new Error('Public local demo must never access the network');
  });
  return module.exports;
}
const domain = evaluate('../lib/pos.ts');
const queue = evaluate('../lib/serial-queue.ts');
const { createDemoStore, DEMO_STORAGE_KEY, DEFAULT_DEMO_PIN } = evaluate('../lib/demo-store.ts', {
  './pos': domain,
  '@/lib/pos': domain,
});

function memoryStorage() {
  const rows = new Map();
  return {
    rows,
    getItem(key) { return rows.get(key) ?? null; },
    setItem(key, value) { rows.set(key, String(value)); },
  };
}
function harness(storage = memoryStorage(), withLock) {
  const store = createDemoStore(storage, withLock);
  return {
    store, storage,
    read: () => store.read(),
    async act(action, payload = {}) { return store.act(action, payload, await store.read()); },
  };
}
async function opened(h) {
  const snapshot = await h.act('openOrder', { tableId: 'table-1' });
  return snapshot.state.orders[0].id;
}

test('public demo starts configured with a local browser identity and survives refresh', async () => {
  const h = harness();
  const first = await h.read();
  assert.equal(first.configured, true);
  assert.equal(DEFAULT_DEMO_PIN, '1234');
  assert.ok(first.userId);
  assert.equal(first.state.orders.length, 0);
  const orderId = await opened(h);
  await h.act('addItem', { orderId, productId: 'product-1', quantity: 2 });
  const saved = await h.read();
  assert.deepEqual(await createDemoStore(h.storage).read(), saved);
  assert.equal(saved.state.orders[0].lines[0].quantity, 2);
  assert.equal(networkCalls, 0);
});

test('different browser stores never share identity or orders', async () => {
  const a = harness(), b = harness();
  await opened(a);
  const savedA = await a.read(), savedB = await b.read();
  assert.notEqual(savedA.userId, savedB.userId);
  assert.equal(savedA.state.orders.length, 1);
  assert.equal(savedB.state.orders.length, 0);
  assert.notEqual(a.storage.rows.get(DEMO_STORAGE_KEY), b.storage.rows.get(DEMO_STORAGE_KEY));
});

test('rapid repeated taps and manual quantity additions use the latest local version', async () => {
  const h = harness();
  const orderId = await opened(h);
  const enqueue = queue.createSerialQueue();
  await Promise.all(Array.from({ length: 30 }, () => enqueue(() => h.act('addItem', {
    orderId, productId: 'product-1', quantity: 1,
  }))));
  await h.act('addItem', { orderId, productId: 'product-1', quantity: 5 });
  const order = (await h.read()).state.orders[0];
  assert.equal(order.lines.length, 1);
  assert.equal(order.lines[0].quantity, 35);
  assert.equal(domain.orderTotals(order).total, 63000);
});

test('local department tickets preserve routing, deltas, cancellation and repeat-send safety', async () => {
  const h = harness();
  const orderId = await opened(h);
  const product = (await h.read()).state.products[0];
  await h.act('saveProduct', { ...product, departmentIds: ['kitchen', 'bar', 'pastry'] });
  await h.act('addItem', { orderId, productId: product.id, quantity: 2, note: 'ხახვის გარეშე' });
  let snapshot = await h.act('sendOrder', { orderId });
  assert.deepEqual(snapshot.state.tickets.map(t => t.departmentId).sort(), ['bar', 'kitchen', 'pastry']);
  assert.ok(snapshot.state.tickets.every(t => t.lines[0].quantity === 2 && t.lines[0].note === 'ხახვის გარეშე'));
  snapshot = await h.act('sendOrder', { orderId });
  assert.equal(snapshot.state.tickets.length, 3);
  const lineId = snapshot.state.orders[0].lines[0].id;
  snapshot = await h.act('voidItem', { orderId, lineId, quantity: 1, reason: 'შეცდომა', pin: '1234' });
  assert.equal(snapshot.state.tickets.length, 6);
  assert.ok(snapshot.state.tickets.slice(3).every(t => t.type === 'cancel' && t.lines[0].quantity === 1));
  assert.equal(domain.orderTotals(snapshot.state.orders[0]).total, 1800);
});

test('default manager PIN protects discounts and management; correct PIN permits them', async () => {
  const h = harness();
  const orderId = await opened(h);
  await h.act('addItem', { orderId, productId: 'product-1', quantity: 1 });
  await assert.rejects(h.act('discount', { orderId, percent: 20, reason: 'ტესტი', pin: '9999' }));
  assert.equal((await h.read()).state.orders[0].discountPercent, 0);
  await assert.rejects(h.act('saveTable', { name: '13', zoneId: 'hall' }));
  assert.equal((await h.read()).state.tables.length, 12);
  let snapshot = await h.act('discount', { orderId, percent: 20, reason: 'ტესტი', pin: '1234' });
  assert.equal(domain.orderTotals(snapshot.state.orders[0]).due, 1440);
  snapshot = await h.act('saveTable', { name: '13', zoneId: 'hall', pin: '1234' });
  assert.equal(snapshot.state.tables.length, 13);
});

test('five wrong manager attempts lock the local demo and PIN change invalidates old PIN', async () => {
  const h = harness();
  const orderId = await opened(h);
  for (let i = 0; i < 5; i++) {
    await assert.rejects(h.act('discount', { orderId, percent: 10, reason: 'ტესტი', pin: '9999' }));
  }
  await assert.rejects(h.act('discount', { orderId, percent: 10, reason: 'ტესტი', pin: '1234' }));
  assert.equal((await h.read()).state.orders[0].discountPercent, 0);
  const unblocked = harness();
  await unblocked.act('changePin', { oldPin: '1234', newPin: '5678' });
  await assert.rejects(unblocked.act('saveDepartment', { name: 'გრილი', pin: '1234' }));
  const changed = await unblocked.act('saveDepartment', { name: 'გრილი', pin: '5678' });
  assert.ok(changed.state.departments.some(d => d.name === 'გრილი'));
  await assert.rejects(unblocked.act('setupPin', { pin: '1111' }));
});

test('demo financial flow discounts, routes order and closes it with split payment', async () => {
  const h = harness();
  const orderId = await opened(h);
  await h.act('addItem', { orderId, productId: 'product-1', quantity: 2 });
  await h.act('discount', { orderId, percent: 20, reason: 'ტესტი', pin: '1234' });
  await assert.rejects(h.act('pay', { orderId, amount: 500, method: 'cash' }));
  await h.act('sendOrder', { orderId });
  let snapshot = await h.act('pay', { orderId, amount: 500, method: 'cash' });
  assert.equal(domain.orderTotals(snapshot.state.orders[0]).due, 2380);
  await assert.rejects(h.act('addItem', { orderId, productId: 'product-1', quantity: 1 }));
  snapshot = await h.act('pay', { orderId, amount: 2380, method: 'card' });
  assert.equal(snapshot.state.orders[0].status, 'closed');
  assert.equal(snapshot.state.orders[0].payments.length, 2);
  assert.equal(domain.orderTotals(snapshot.state.orders[0]).due, 0);
  assert.deepEqual((await createDemoStore(h.storage).read()).state.orders, snapshot.state.orders);
  assert.equal(networkCalls, 0);
});

test('stale tabs cannot overwrite a newer local save', async () => {
  const storage = memoryStorage();
  const a = createDemoStore(storage), b = createDemoStore(storage);
  const original = await a.read();
  const updated = await b.act('openOrder', { tableId: 'table-1' }, original);
  const rawSaved = storage.getItem(DEMO_STORAGE_KEY);
  await assert.rejects(a.act('openOrder', { tableId: 'table-2' }, original));
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), rawSaved);
  assert.deepEqual(await a.read(), updated);
});

test('cross-tab critical section rejects one simultaneous stale writer without losing the saved order', async () => {
  const storage = memoryStorage();
  const withLock = queue.createSerialQueue();
  const a = createDemoStore(storage, withLock), b = createDemoStore(storage, withLock);
  const original = await a.read();
  const results = await Promise.allSettled([
    a.act('openOrder', { tableId: 'table-1' }, original),
    b.act('openOrder', { tableId: 'table-2' }, original),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  assert.equal((await a.read()).state.orders.length, 1);
});

test('reset creates a new browser identity and prevents queued old writes from restoring old data', async () => {
  const h = harness();
  const orderId = await opened(h);
  await h.act('addItem', { orderId, productId: 'product-1', quantity: 2 });
  const previous = await h.read();
  const reset = await h.store.reset();
  assert.notEqual(reset.userId, previous.userId);
  assert.equal(reset.state.orders.length, 0);
  assert.equal(reset.state.tickets.length, 0);
  assert.equal(reset.configured, true);
  await assert.rejects(h.store.act('addItem', { orderId, productId: 'product-1', quantity: 1 }, previous));
  assert.deepEqual(await createDemoStore(h.storage).read(), reset);
  await h.act('saveDepartment', { name: 'გრილი', pin: '1234' });
});

test('malformed persisted demo data is reported and never silently erased', async () => {
  for (const invalid of ['{bad json', 'null', '{}', '[]']) {
    const storage = memoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, invalid);
    const store = createDemoStore(storage);
    await assert.rejects(store.read());
    assert.equal(storage.getItem(DEMO_STORAGE_KEY), invalid);
  }
  const h = harness();
  await h.read();
  const document = JSON.parse(h.storage.getItem(DEMO_STORAGE_KEY));
  document.state.orders = 'not-an-array';
  const invalid = JSON.stringify(document);
  h.storage.setItem(DEMO_STORAGE_KEY, invalid);
  await assert.rejects(h.read());
  assert.equal(h.storage.getItem(DEMO_STORAGE_KEY), invalid);
});

test('unavailable or full browser storage never reports a successful persistent save', async () => {
  const denied = createDemoStore({
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('SecurityError'); },
  });
  await assert.rejects(denied.read());
  const fresh = createDemoStore({
    getItem() { return null; },
    setItem() { throw new Error('QuotaExceededError'); },
  });
  await assert.rejects(fresh.read());
  const h = harness();
  const original = await h.read();
  const raw = h.storage.getItem(DEMO_STORAGE_KEY);
  h.storage.setItem = () => { throw new Error('QuotaExceededError'); };
  await assert.rejects(h.store.act('openOrder', { tableId: 'table-1' }, original));
  assert.equal(h.storage.getItem(DEMO_STORAGE_KEY), raw);
  assert.deepEqual(await h.read(), original);
});

test('invalid demo transitions preserve the stored state and public snapshots contain no account tokens', async () => {
  const h = harness();
  const orderId = await opened(h);
  const original = await h.read();
  await assert.rejects(h.act('addItem', { orderId, productId: 'product-1', quantity: -1 }));
  assert.deepEqual(await h.read(), original);
  const snapshot = JSON.stringify(await h.read());
  assert.ok(!snapshot.includes('access_token'));
  assert.ok(!snapshot.includes('refresh_token'));
  assert.ok(!snapshot.includes('service_role'));
  assert.equal(networkCalls, 0);
});
