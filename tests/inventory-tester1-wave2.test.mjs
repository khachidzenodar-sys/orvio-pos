import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';

function evaluate(path, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', 'crypto', source)(name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  }, mod, mod.exports, webcrypto);
  return mod.exports;
}
const inventory = evaluate('../lib/inventory.ts');
const domain = evaluate('../lib/pos.ts', {'./inventory.ts': inventory});
const backup = evaluate('../lib/backup.ts');
const {createDemoStore, DEFAULT_DEMO_PIN} = evaluate('../lib/demo-store.ts', {'./pos': domain, './backup': backup});
const memory = () => { const rows = new Map(); return {rows, getItem: k => rows.get(k) ?? null, setItem: (k, v) => { rows.set(k, String(v)); }}; };
const pin = DEFAULT_DEMO_PIN;

// Every successful action must leave a document the store can read back.
async function run(store, snap, action, payload) {
  const next = await store.act(action, payload, snap);
  const reread = await store.read();
  assert.deepEqual(reread.state, next.state);
  return next;
}

test('demo store: edge-case actions never brick the stored document', async () => {
  const mem = memory(), rows = mem.rows;
  const store = createDemoStore(mem);
  let s = await store.read();
  s = await run(store, s, 'saveStockItem', {name: '  ახალი  ყველი ', unit: 'g', kind: 'ingredient', threshold: 0, pin});
  const id = s.state.inventory.items.at(-1).id;
  s = await run(store, s, 'receiveStock', {date: '2026-02-30', supplier: '  ', note: 'x', lines: [{itemId: id, quantity: 1, total: 0}, {itemId: id, quantity: 3, total: 1}], pin});
  s = await run(store, s, 'writeOff', {itemId: id, quantity: 10, reason: ' სხვა ', pin});
  s = await run(store, s, 'stockCount', {counts: [{itemId: id, quantity: 0}], pin});
  s = await run(store, s, 'saveStockItem', {id, name: 'ახალი  ყველი', unit: 'g', kind: 'ingredient', threshold: null, pin});
  // archive semi, then archive its ingredient; the semi can come back only after the ingredient
  s = await run(store, s, 'saveStockItem', {name: 'ცომი', unit: 'g', kind: 'semi', pin});
  const semi = s.state.inventory.items.at(-1).id;
  s = await run(store, s, 'saveBatchRecipe', {itemId: semi, output: 100, lines: [{itemId: id, quantity: 50}], pin});
  s = await run(store, s, 'archiveStockItem', {id: semi, archived: true, pin});
  s = await run(store, s, 'archiveStockItem', {id, archived: true, pin});
  // Restoring the semi while its ingredient is archived is rejected; restore the ingredient first.
  await assert.rejects(store.act('archiveStockItem', {id: semi, archived: false, pin}, s), /ჯერ დააბრუნეთ რეცეპტის პოზიცია/);
  s = await run(store, s, 'archiveStockItem', {id, archived: false, pin});
  s = await run(store, s, 'archiveStockItem', {id: semi, archived: false, pin});
  s = await run(store, s, 'produce', {itemId: semi, batches: 3, pin});
  s = await run(store, s, 'saveRecipe', {productId: 'product-4', lines: [{itemId: semi, quantity: 7}], pin});
  // Sell a lot (in the pure domain) to cross the movement cap, then store and reload it.
  let st = domain.applyAction(s.state, 'openOrder', {tableId: 'table-1'});
  const orderId = st.orders[0].id;
  for (let i = 0; i < 1300; i++) {
    st = domain.applyAction(st, 'addItem', {orderId, productId: i % 2 ? 'product-1' : 'product-2', quantity: 1});
    st = domain.applyAction(st, 'sendOrder', {orderId});
  }
  const raw = JSON.parse(rows.get('orvio.demo.v1'));
  rows.set('orvio.demo.v1', JSON.stringify({...raw, state: st}));
  s = await store.read();
  assert.equal(s.state.inventory.movements.length, inventory.MOVEMENT_LIMIT);
  assert.ok(s.state.inventory.prunedBefore);
  s = await run(store, s, 'voidItem', {orderId, lineId: s.state.orders[0].lines[0].id, quantity: 1, reason: 'x', pin});
  const text = await store.exportBackup();
  const info = await store.inspectBackup(text);
  assert.equal(info.stockItems, s.state.inventory.items.length);
});

test('send deducts exactly once per sent quantity after void/re-add combinations', () => {
  let s = domain.demoSeedState('2026-01-01T00:00:00.000Z');
  const cheese = () => s.inventory.items.find(i => i.id === 'stock-cheese').quantity;
  const start = cheese();
  s = domain.applyAction(s, 'openOrder', {tableId: 'table-1'});
  const orderId = s.orders[0].id;
  s = domain.applyAction(s, 'addItem', {orderId, productId: 'product-1', quantity: 3});
  s = domain.applyAction(s, 'voidItem', {orderId, lineId: s.orders[0].lines[0].id, quantity: 1, reason: 'x'}, true);
  s = domain.applyAction(s, 'sendOrder', {orderId});
  assert.equal(start - cheese(), 500);
  s = domain.applyAction(s, 'voidItem', {orderId, lineId: s.orders[0].lines[0].id, quantity: 1, reason: 'x'}, true);
  assert.equal(start - cheese(), 500);
  s = domain.applyAction(s, 'addItem', {orderId, productId: 'product-1', quantity: 2});
  s = domain.applyAction(s, 'sendOrder', {orderId});
  s = domain.applyAction(s, 'sendOrder', {orderId});
  assert.equal(start - cheese(), 1000);
  const sold = s.orders[0].lines.reduce((a, l) => a + l.sentQuantity, 0);
  assert.equal(sold, 3);
});

test('weighted average examples', () => {
  let s = domain.seedState();
  s = domain.applyAction(s, 'saveStockItem', {name: 'a', unit: 'g', kind: 'ingredient'}, true);
  const id = s.inventory.items[0].id;
  const it = () => s.inventory.items[0];
  s = domain.applyAction(s, 'writeOff', {itemId: id, quantity: 200, reason: 'x'}, true);
  s = domain.applyAction(s, 'receiveStock', {lines: [{itemId: id, quantity: 1000, total: 1200}]}, true);
  assert.deepEqual([it().quantity, it().avgCost, it().value], [800, 1200, 960]);
  s = domain.applyAction(s, 'stockCount', {counts: [{itemId: id, quantity: 1000}]}, true);
  assert.deepEqual([it().quantity, it().avgCost, it().value], [1000, 1200, 1200]);
  assert.equal(s.inventory.movements.at(-1).value, 240);
});
