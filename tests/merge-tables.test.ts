import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {applyAction, orderTotals, seedState} from '../lib/pos.ts';
import type {PosState} from '../lib/pos';

const open = (s: PosState, tableId: string) => s.orders.find(o => o.status === 'open' && o.tableId === tableId) as PosState['orders'][number];

function twoTables() {
    let s: PosState = seedState();
    s = applyAction(s, 'setFeature', {key: 'waiterCode', on: false}, true);
    for (const [table, product] of [['table-1', 'product-1'], ['table-2', 'product-5']]) {
        s = applyAction(s, 'openOrder', {tableId: table});
        s = applyAction(s, 'addItem', {orderId: open(s, table).id, productId: product, quantity: 1});
    }
    s = applyAction(s, 'sendOrder', {orderId: open(s, 'table-2').id, note: 'ერთად გამოიტანეთ'});
    return s;
}

test('merging moves the other table\'s items onto this bill and frees that table', () => {
    let s = twoTables();
    const target = open(s, 'table-1'), source = open(s, 'table-2');
    s = applyAction(s, 'mergeOrders', {orderId: target.id, sourceOrderId: source.id});
    const merged = open(s, 'table-1');
    assert.equal(open(s, 'table-2'), undefined);
    assert.deepEqual(merged.lines.map(l => l.productId).sort(), ['product-1', 'product-5']);
    assert.equal(orderTotals(merged).total, 1800 + 600);
    assert.equal(merged.lines.find(l => l.productId === 'product-5')!.sentQuantity, 1, 'already-sent items stay sent');
    assert.ok(s.tickets.filter(t => t.note).every(t => t.orderId === merged.id), 'ticket notes follow to the merged bill');
});

test('merging refuses paid, discounted or missing tables', () => {
    const s = twoTables();
    const target = open(s, 'table-1'), source = open(s, 'table-2');
    assert.throws(() => applyAction(s, 'mergeOrders', {orderId: target.id, sourceOrderId: target.id}));
    assert.throws(() => applyAction(s, 'mergeOrders', {orderId: target.id, sourceOrderId: 'nope'}));
    const discounted = applyAction(s, 'discount', {orderId: source.id, percent: 10, reason: 'x'}, true);
    assert.throws(() => applyAction(discounted, 'mergeOrders', {orderId: target.id, sourceOrderId: source.id}), /ფასდაკლება/);
    const paid = applyAction(s, 'pay', {orderId: source.id, method: 'cash', amount: 100});
    assert.throws(() => applyAction(paid, 'mergeOrders', {orderId: target.id, sourceOrderId: source.id}), /გადახდილ/);
});
