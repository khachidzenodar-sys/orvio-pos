import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {applyAction, demoSeedState, isValidInventory, seedState} from '../lib/pos.ts';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {countPreview, foodCostReport, recipeCost, stockAlerts, MOVEMENT_LIMIT} from '../lib/inventory.ts';
import type {PosState} from '../lib/pos';
import type {StockItem} from '../lib/inventory';

const ids = (s: PosState) => s.products.map(p => p.id);
const item = (s: PosState, id: string) => s.inventory.items.find((x: StockItem) => x.id === id) as StockItem;
const valid = (s: PosState) => assert.ok(isValidInventory(JSON.parse(JSON.stringify(s.inventory)), ids(s)), 'state after action must validate');

function base() {
    let s: PosState = seedState();
    for (const [name, unit] of [['ყველი', 'g'], ['ფქვილი', 'g'], ['კვერცხი', 'pcs'], ['პომიდორი', 'g'], ['ნიორი', 'g']] as const)
        s = applyAction(s, 'saveStockItem', {name, unit, kind: 'ingredient'}, true);
    s = applyAction(s, 'saveStockItem', {name: 'სოუსი', unit: 'g', kind: 'semi'}, true);
    return s;
}
const byName = (s: PosState, name: string) => s.inventory.items.find((x: StockItem) => x.name === name) as StockItem;

test('US1-US8 numeric walkthrough through applyAction, document stays valid after every step', () => {
    let s = base();
    valid(s);
    const cheese = byName(s, 'ყველი').id;
    s = applyAction(s, 'receiveStock', {date: '2026-10-01', supplier: ' ', lines: [{itemId: cheese, quantity: 2000, total: 2000}]}, true); valid(s);
    s = applyAction(s, 'receiveStock', {lines: [{itemId: cheese, quantity: 3000, total: 3600}]}, true); valid(s);
    assert.deepEqual([item(s, cheese).quantity, item(s, cheese).value, item(s, cheese).avgCost], [5000, 5600, 1120]);
    assert.equal(s.inventory.movements[0].supplier, undefined);
    s = applyAction(s, 'writeOff', {itemId: cheese, quantity: 500, reason: 'გაფუჭება'}, true); valid(s);
    assert.deepEqual([item(s, cheese).quantity, item(s, cheese).value], [4500, 5040]);
    assert.equal(s.inventory.movements.at(-1)!.value, -560);
    const preview = countPreview(s.inventory, [{itemId: cheese, quantity: 4100}]);
    assert.equal(preview.lines[0].value, -448);
    assert.equal(preview.shortage, 448);
    s = applyAction(s, 'stockCount', {counts: [{itemId: cheese, quantity: 4100}]}, true); valid(s);
    assert.deepEqual([item(s, cheese).quantity, item(s, cheese).avgCost, item(s, cheese).value], [4100, 1120, 4592]);
    s = applyAction(s, 'stockCount', {counts: [{itemId: cheese, quantity: 4100}]}, true);
    assert.equal(s.inventory.movements.filter(m => m.type === 'count').length, 1);
    // write-off beyond stock -> negative, value 0, valid
    s = applyAction(s, 'writeOff', {itemId: cheese, quantity: 5000, reason: 'სხვა'}, true); valid(s);
    assert.deepEqual([item(s, cheese).quantity, item(s, cheese).value], [-900, 0]);
    assert.equal(s.inventory.movements.at(-1)!.value, -(4592 + 1008));
    // surplus count on negative stock valued at last avg
    s = applyAction(s, 'stockCount', {counts: [{itemId: cheese, quantity: 100}]}, true); valid(s);
    assert.equal(s.inventory.movements.at(-1)!.value, 1120);
    assert.equal(item(s, cheese).value, 112);
    assert.equal(stockAlerts(s.inventory).negative.length, 0);
});

test('US3 negative-stock receipt and US6 production example', () => {
    let s = base();
    const tomato = byName(s, 'პომიდორი').id, garlic = byName(s, 'ნიორი').id, sauce = byName(s, 'სოუსი').id;
    s = applyAction(s, 'receiveStock', {lines: [{itemId: tomato, quantity: 5000, total: 1500}, {itemId: garlic, quantity: 1000, total: 800}]}, true);
    s = applyAction(s, 'saveBatchRecipe', {itemId: sauce, output: 1000, lines: [{itemId: tomato, quantity: 600}, {itemId: garlic, quantity: 50}]}, true); valid(s);
    s = applyAction(s, 'produce', {itemId: sauce, batches: 2}, true); valid(s);
    assert.deepEqual([item(s, sauce).quantity, item(s, sauce).value, item(s, sauce).avgCost], [2000, 440, 220]);
    assert.deepEqual([item(s, tomato).quantity, item(s, garlic).quantity], [3800, 900]);
    const prod = s.inventory.movements.filter(m => m.type === 'production');
    assert.equal(new Set(prod.map(m => m.group)).size, 1);
    assert.deepEqual(prod.map(m => m.value), [-360, -80, 440]);
    // dish with semi deducts only semi
    s = applyAction(s, 'saveRecipe', {productId: 'product-3', lines: [{itemId: sauce, quantity: 80}]}, true);
    s = applyAction(s, 'openOrder', {tableId: 'table-2'});
    const o = s.orders[0].id;
    s = applyAction(s, 'addItem', {orderId: o, productId: 'product-3', quantity: 2});
    s = applyAction(s, 'sendOrder', {orderId: o}); valid(s);
    assert.deepEqual([item(s, sauce).quantity, item(s, tomato).quantity], [1840, 3800]);
    // negative receipt example
    const flour = byName(s, 'ფქვილი').id;
    s = applyAction(s, 'writeOff', {itemId: flour, quantity: 200, reason: 'x'}, true);
    s = applyAction(s, 'receiveStock', {lines: [{itemId: flour, quantity: 1000, total: 1200}]}, true); valid(s);
    assert.deepEqual([item(s, flour).quantity, item(s, flour).avgCost, item(s, flour).value], [800, 1200, 960]);
});

test('US2 khachapuri food cost example', () => {
    let s = base();
    const [flour, cheese, egg] = ['ფქვილი', 'ყველი', 'კვერცხი'].map(n => byName(s, n).id);
    s = applyAction(s, 'receiveStock', {lines: [{itemId: flour, quantity: 1000, total: 200}, {itemId: cheese, quantity: 1000, total: 1600}, {itemId: egg, quantity: 10, total: 400}]}, true);
    s = applyAction(s, 'saveProduct', {...s.products[0], price: 1200}, true);
    s = applyAction(s, 'saveRecipe', {productId: 'product-1', lines: [{itemId: flour, quantity: 200}, {itemId: cheese, quantity: 250}, {itemId: egg, quantity: 1}]}, true);
    const row = foodCostReport(s).rows.find(r => r.productId === 'product-1')!;
    assert.deepEqual([row.price, row.cost, row.percentTenths, row.margin], [1200, 480, 400, 720]);
    assert.equal(recipeCost([{itemId: cheese, quantity: 1}], s.inventory.items), 2);
});

test('cycles through other semis are rejected; archive guards', () => {
    let s = base();
    s = applyAction(s, 'saveStockItem', {name: 'ცომი', unit: 'g', kind: 'semi'}, true);
    const a = byName(s, 'სოუსი').id, b = byName(s, 'ცომი').id, flour = byName(s, 'ფქვილი').id;
    s = applyAction(s, 'saveBatchRecipe', {itemId: a, output: 100, lines: [{itemId: b, quantity: 10}]}, true);
    assert.throws(() => applyAction(s, 'saveBatchRecipe', {itemId: b, output: 100, lines: [{itemId: a, quantity: 10}]}, true), /ციკლ/);
    assert.throws(() => applyAction(s, 'saveBatchRecipe', {itemId: a, output: 100, lines: [{itemId: a, quantity: 10}]}, true), /თავის თავს/);
    assert.throws(() => applyAction(s, 'archiveStockItem', {id: b, archived: true}, true), /კალკულაციებიდან/);
    s = applyAction(s, 'archiveStockItem', {id: flour, archived: true}, true); valid(s);
    assert.throws(() => applyAction(s, 'saveRecipe', {productId: 'product-1', lines: [{itemId: flour, quantity: 1}]}, true), /ამოღებულია/);
    assert.throws(() => applyAction(s, 'receiveStock', {lines: [{itemId: flour, quantity: 1, total: 1}]}, true), /ამოღებულია/);
    assert.throws(() => applyAction(s, 'saveStockItem', {name: '  ყველი ', unit: 'g', kind: 'ingredient'}, true), /უკვე არსებობს/);
    assert.throws(() => applyAction(s, 'saveStockItem', {id: flour, name: 'ფქვილი2', unit: 'g', kind: 'ingredient'}, true));
});

test('receipt is atomic on a bad later line', () => {
    const s = base();
    const cheese = byName(s, 'ყველი').id;
    assert.throws(() => applyAction(s, 'receiveStock', {lines: [{itemId: cheese, quantity: 1000, total: 100}, {itemId: cheese, quantity: 0, total: 1}]}, true));
    assert.throws(() => applyAction(s, 'receiveStock', {lines: [{itemId: cheese, quantity: 1000, total: -1}]}, true));
    assert.equal(item(s, cheese).quantity, 0);
    assert.equal(s.inventory.movements.length, 0);
});

test('long sale sequences stay valid and prune at the limit', () => {
    let s = demoSeedState('2026-10-01T10:00:00.000Z');
    valid(s);
    s = applyAction(s, 'openOrder', {tableId: 'table-3'});
    const o = s.orders[0].id;
    for (let i = 0; i < 1300; i++) {
        s = applyAction(s, 'addItem', {orderId: o, productId: i % 2 ? 'product-1' : 'product-2', quantity: 1});
        s = applyAction(s, 'sendOrder', {orderId: o});
    }
    assert.equal(s.inventory.movements.length, MOVEMENT_LIMIT);
    assert.ok(s.inventory.prunedBefore);
    valid(s);
    for (const x of s.inventory.items) assert.ok(x.quantity > 0 || x.value === 0);
});

test('validation rejects a recipe pointing to an unknown product and corrupt inventory', () => {
    const s = demoSeedState();
    const inv = JSON.parse(JSON.stringify(s.inventory));
    assert.ok(isValidInventory(inv, ids(s)));
    assert.equal(isValidInventory(inv, ids(s).filter((id: string) => id !== 'product-1')), false);
    assert.equal(isValidInventory(null, ids(s)), false);
    assert.equal(isValidInventory({...inv, items: inv.items.map((x: StockItem, i: number) => i ? x : {...x, quantity: 1.5})}, ids(s)), false);
    assert.equal(isValidInventory({...inv, movements: [{...inv.movements[0], quantity: 0}]}, ids(s)), false);
    assert.equal(isValidInventory({...inv, items: inv.items.map((x: StockItem, i: number) => i ? x : {...x, batch: {output: 1, lines: [{itemId: x.id, quantity: 1}]}})}, ids(s)), false);
});
