import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
import {createTauriFileStorage} from '../lib/adapters/tauri-file-storage.ts';

// US-2: the desktop (async file) storage must produce exactly the same
// business results as the browser (sync localStorage) storage.
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
const domain = evaluate('../lib/pos.ts', {'./inventory.ts': evaluate('../lib/inventory.ts')});
const queue = evaluate('../lib/serial-queue.ts');
const {createDemoStore, DEMO_STORAGE_KEY} = evaluate('../lib/demo-store.ts', {'./pos': domain});

function browserStorage() {
  const rows = new Map();
  return {rows, getItem: key => rows.get(key) ?? null, setItem: (key, value) => { rows.set(key, String(value)); }};
}
function desktopStorage(failWrites = () => false) {
  const rows = new Map();
  const invoke = async (cmd, args) => {
    await new Promise(resolve => setImmediate(resolve));
    if (cmd === 'storage_read') return rows.get(args.key) ?? null;
    if (cmd === 'storage_write') {
      if (failWrites()) throw new Error('disk full');
      rows.set(args.key, args.value);
      return null;
    }
    throw new Error(`unknown command ${cmd}`);
  };
  return {rows, ...createTauriFileStorage(invoke)};
}

async function scenario(store) {
  const act = async (action, payload = {}) => store.act(action, payload, await store.read());
  const order = (s, tableId) => s.state.orders.find(o => o.tableId === tableId);
  let s = await act('saveProduct', {id: 'product-1', name: 'ხაჭაპური', category: 'კერძები', price: 1800,
    departmentIds: ['kitchen'], active: true, addons: [{id: 'cheese', name: 'ყველი', price: 300}]});
  s = await act('openOrder', {tableId: 'table-1'});
  const first = order(s, 'table-1').id;
  await act('addItem', {orderId: first, productId: 'product-1', quantity: 2, addonIds: ['cheese']});
  await act('addItem', {orderId: first, productId: 'product-5', quantity: 3, note: 'ცხელი'});
  s = await act('addItem', {orderId: first, productId: 'product-9', quantity: 1});
  const [khachapuri, coffee] = order(s, 'table-1').lines;
  await act('sendOrder', {orderId: first});
  await act('discount', {orderId: first, percent: 10, reason: 'სტუმარი', pin: '1234'});
  await act('voidItem', {orderId: first, lineId: coffee.id, quantity: 1, reason: 'შეცდომა', pin: '1234'});
  await act('discount', {orderId: first, amount: 500, reason: 'ფიქსირებული', pin: '1234'});
  await act('pay', {orderId: first, method: 'cash', items: [{lineId: khachapuri.id, quantity: 1}]});
  s = await act('pay', {orderId: first, method: 'card', amount: 700});
  await act('pay', {orderId: first, method: 'other', amount: domain.orderTotals(order(s, 'table-1')).due});

  s = await act('openOrder', {tableId: 'table-2'});
  const second = order(s, 'table-2').id;
  await act('addItem', {orderId: second, productId: 'product-7', quantity: 2});
  await act('sendOrder', {orderId: second});
  s = await act('pay', {orderId: second, method: 'cash', amount: 1500});
  await act('pay', {orderId: second, method: 'card', amount: domain.orderTotals(order(s, 'table-2')).due});

  await act('changePin', {oldPin: '1234', newPin: '5678'});
  return store.read();
}

function summary(snapshot) {
  const {orders, tickets} = snapshot.state;
  return {
    version: snapshot.version,
    orders: orders.map(o => ({
      tableId: o.tableId, status: o.status,
      totals: domain.orderTotals(o),
      balances: domain.lineBalances(o).map(b => ({...b, lineId: undefined})),
      payments: o.payments.map(p => [p.method, p.amount, p.allocations.map(a => a.amount)]),
    })),
    tickets: tickets.map(t => [t.departmentId, t.type, t.tableName, t.lines.map(l => [l.name, l.quantity, l.note, l.addons ?? []])]),
  };
}

test('desktop file storage and browser storage give identical business results', async () => {
  const browser = browserStorage(), desktop = desktopStorage();
  const web = await scenario(createDemoStore(browser));
  const app = await scenario(createDemoStore(desktop, queue.createSerialQueue()));
  assert.deepEqual(summary(app), summary(web));
  assert.equal(web.state.orders.length, 2);
  assert.ok(web.state.orders.every(o => o.status === 'closed'));
  assert.equal(JSON.parse(desktop.rows.get(DEMO_STORAGE_KEY)).pin, '5678');
  assert.equal(JSON.parse(browser.rows.get(DEMO_STORAGE_KEY)).pin, '5678');
  assert.deepEqual(new Set(app.state.orders[0].payments.map(p => p.method)), new Set(['cash', 'card', 'other']));
});

test('a failed desktop write rejects with the desktop message and keeps the saved data', async () => {
  let failing = false;
  const desktop = desktopStorage(() => failing);
  const message = 'მონაცემების შენახვა კომპიუტერზე ვერ მოხერხდა. წინა მონაცემები უცვლელია.';
  const store = createDemoStore(desktop, queue.createSerialQueue(), message);
  const opened = await store.act('openOrder', {tableId: 'table-1'}, await store.read());
  const saved = desktop.rows.get(DEMO_STORAGE_KEY);
  failing = true;
  await assert.rejects(
    store.act('addItem', {orderId: opened.state.orders[0].id, productId: 'product-1', quantity: 1}, opened),
    error => error.message === message,
  );
  assert.equal(desktop.rows.get(DEMO_STORAGE_KEY), saved);
  failing = false;
  assert.deepEqual(await store.read(), opened);
});

test('a failed desktop read rejects with the desktop message', async () => {
  const message = 'კომპიუტერიდან წაკითხვა ვერ მოხერხდა';
  const store = createDemoStore(createTauriFileStorage(async () => { throw new Error('io'); }), undefined, message);
  await assert.rejects(store.read(), error => error.message === message);
});
