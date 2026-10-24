import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {applyAction, demoSeedState, emptyInventory, INVENTORY_ACTIONS, isValidInventory, normalizeState, seedState} from '../lib/pos.ts';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {foodCostReport} from '../lib/inventory.ts';
import type {PosState} from '../lib/pos';
import type {StockItem} from '../lib/inventory';

const cheese = (s: PosState) => s.inventory.items.find((x: StockItem) => x.id === 'cheese') as StockItem;
// Product-1 (khachapuri) uses 150 g cheese; product-5 (americano) has no recipe.
function setup(quantity = 5000) {
    let s: PosState = seedState();
    s.inventory.items.push({id: 'cheese', name: 'ყველი', unit: 'g', kind: 'ingredient', quantity: 0, value: 0, avgCost: 0});
    if (quantity) s = applyAction(s, 'receiveStock', {lines: [{itemId: 'cheese', quantity, total: quantity * 1.6}]}, true);
    s = applyAction(s, 'saveRecipe', {productId: 'product-1', lines: [{itemId: 'cheese', quantity: 150}]}, true);
    s = applyAction(s, 'openOrder', {tableId: 'table-1'});
    return s;
}
const order = (s: PosState) => s.orders.find(o => o.status === 'open') as PosState['orders'][number];
const add = (s: PosState, productId: string, quantity = 1, extra: Record<string, unknown> = {}) => applyAction(s, 'addItem', {orderId: order(s).id, productId, quantity, ...extra});
const send = (s: PosState) => applyAction(s, 'sendOrder', {orderId: order(s).id});
const sales = (s: PosState) => s.inventory.movements.filter((m: {type: string}) => m.type === 'sale');

test('sending deducts recipe × newly sent quantity once', () => {
    let s = add(setup(), 'product-1', 3);
    s = add(s, 'product-5', 2);
    s = send(s);
    assert.deepEqual({quantity: cheese(s).quantity, value: cheese(s).value, avgCost: cheese(s).avgCost}, {quantity: 4550, value: 7280, avgCost: 1600});
    const [sale] = sales(s);
    assert.deepEqual({quantity: sale.quantity, value: sale.value, orderId: sale.orderId, lineId: sale.lineId, tableName: sale.tableName, productName: sale.productName},
        {quantity: -450, value: -720, orderId: order(s).id, lineId: order(s).lines[0].id, tableName: '1', productName: 'ხაჭაპური'});
    assert.equal(sales(s).length, 1);
    s = send(s);
    assert.equal(sales(s).length, 1);
    assert.equal(cheese(s).quantity, 4550);
    s = add(s, 'product-1', 1);
    s = send(s);
    assert.equal(cheese(s).quantity, 4400);
    assert.equal(sales(s).at(-1)?.quantity, -150);
});

test('voids return nothing and unsent voids deduct nothing', () => {
    let s = send(add(setup(), 'product-1', 2));
    const sentLine = order(s).lines[0];
    s = applyAction(s, 'voidItem', {orderId: order(s).id, lineId: sentLine.id, quantity: 1, reason: 'შეცდომა'}, true);
    assert.equal(cheese(s).quantity, 4700);
    s = send(s);
    assert.equal(cheese(s).quantity, 4700);
    s = add(s, 'product-1', 2, {note: 'ცალკე'});
    const unsent = order(s).lines[order(s).lines.length - 1];
    s = applyAction(s, 'voidItem', {orderId: order(s).id, lineId: unsent.id, quantity: 2, reason: 'შეცდომა'}, true);
    s = send(s);
    assert.equal(cheese(s).quantity, 4700);
    assert.equal(sales(s).length, 1);
});

test('add-ons deduct nothing beyond the product recipe', () => {
    const s = send(add(setup(), 'product-1', 1, {addonIds: ['extra-cheese']}));
    assert.equal(cheese(s).quantity, 4850);
    assert.equal(sales(s).length, 1);
});

test('order actions other than send leave inventory unchanged', () => {
    let s = setup();
    const empty = applyAction(s, 'closeEmptyOrder', {orderId: order(s).id});
    assert.deepEqual(empty.inventory, s.inventory);
    s = send(add(s, 'product-1', 2));
    const before = structuredClone(s.inventory);
    s = applyAction(s, 'discount', {orderId: order(s).id, percent: 10, reason: 'მეგობარი'}, true);
    s = applyAction(s, 'transfer', {orderId: order(s).id, tableId: 'table-2'});
    s = applyAction(s, 'printReceipt', {orderId: order(s).id});
    s = applyAction(s, 'pay', {orderId: order(s).id, method: 'cash', amount: 3240});
    assert.equal(s.orders[0].status, 'closed');
    assert.deepEqual(s.inventory, before);
});

test('sending without stock goes negative instead of blocking the sale', () => {
    const s = send(add(setup(0), 'product-1', 2));
    assert.deepEqual({quantity: cheese(s).quantity, value: cheese(s).value}, {quantity: -300, value: 0});
    assert.equal(order(s).lines[0].sentQuantity, 2);
});

test('inventory actions require the manager', () => {
    const s = setup();
    assert.equal(INVENTORY_ACTIONS.length, 8);
    for (const action of INVENTORY_ACTIONS)
        assert.throws(() => applyAction(s, action, {}, false), /მენეჯერის კოდი აუცილებელია/);
    const next = applyAction(s, 'writeOff', {itemId: 'cheese', quantity: 100, reason: 'გაფუჭება'}, true, '2026-10-18T09:00:00.000Z');
    assert.deepEqual({action: next.audit.at(-1)?.action, at: next.audit.at(-1)?.at}, {action: 'writeOff', at: '2026-10-18T09:00:00.000Z'});
    assert.equal(next.inventory.movements.at(-1)?.at, '2026-10-18T09:00:00.000Z');
    assert.throws(() => applyAction(s, 'unknownStockAction', {}, true), /უცნობი მოქმედება/);
});

test('legacy state without inventory keeps working', () => {
    const legacy = seedState() as Partial<PosState>;
    delete legacy.inventory;
    let s = applyAction(legacy as PosState, 'openOrder', {tableId: 'table-1'});
    assert.deepEqual(s.inventory, emptyInventory());
    s = applyAction(legacy as PosState, 'openOrder', {tableId: 'table-1'});
    s = send(add(s, 'product-1', 2));
    s = applyAction(s, 'pay', {orderId: order(s).id, method: 'card', amount: 3600});
    assert.equal(s.orders[0].status, 'closed');
    assert.deepEqual(s.inventory, emptyInventory());
    assert.equal('inventory' in legacy, false);
    const stocked = applyAction(legacy as PosState, 'saveStockItem', {name: 'ფქვილი', unit: 'g', kind: 'ingredient'}, true);
    assert.equal(stocked.inventory.items.length, 1);
});

test('normalizeState is idempotent and touches nothing else', () => {
    const base = send(add(setup(), 'product-1', 1));
    const legacy = structuredClone(base) as Partial<PosState>;
    delete legacy.inventory;
    const normalized = normalizeState(legacy as PosState);
    assert.deepEqual(normalized.inventory, emptyInventory());
    for (const key of ['orders', 'tickets', 'products', 'audit', 'tables', 'zones', 'departments'] as const)
        assert.deepEqual(normalized[key], base[key]);
    assert.deepEqual(normalizeState(normalized), normalized);
    assert.deepEqual(normalizeState(base), base);
    assert.equal(normalizeState(base), base);
});

test('demo seed state has valid sample stock with documented food costs', () => {
    const s = demoSeedState('2026-10-18T08:00:00.000Z');
    assert.deepEqual(seedState().inventory, emptyInventory());
    assert.ok(isValidInventory(s.inventory, s.products.map(p => p.id)));
    assert.deepEqual(foodCostReport(s).rows.map((row: {productId: string; cost: number}) => [row.productId, row.cost]), [['product-1', 520], ['product-2', 448], ['product-8', 60]]);
    assert.ok(s.inventory.movements.every((m: {at: string}) => m.at === '2026-10-18T08:00:00.000Z'));
    const sold = send(add(applyAction(s, 'openOrder', {tableId: 'table-3'}), 'product-2', 1));
    const sauce = sold.inventory.items.find((x: StockItem) => x.id === 'stock-caesar-sauce') as StockItem;
    assert.equal(sauce.quantity, 960);
});
