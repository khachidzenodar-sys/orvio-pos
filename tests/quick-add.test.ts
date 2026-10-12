import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore Node's strip-types runner requires explicit extensions.
import { applyAction, seedState, orderTotals } from '../lib/pos.ts';

function fixture(routes = ['kitchen']) {
    let state = applyAction(seedState(), 'openOrder', { tableId: 'table-1' });
    const orderId = state.orders[0].id;
    const productId = 'product-1';
    const act = (action: string, payload: Record<string, unknown> = {}, manager = false) => {
        state = applyAction(state, action, { orderId, ...payload }, manager);
    };
    const saveProduct = (changes: Record<string, unknown> = {}) => act('saveProduct', {
        ...state.products.find(p => p.id === productId)!, ...changes,
    });
    saveProduct({ departmentIds: routes });
    return {
        act, saveProduct,
        add: (note = '') => act('addItem', { productId, quantity: 1, note }),
        get state() { return state; },
        get order() { return state.orders[0]; },
    };
}

test('repeated product taps group quantities and multiply the stored unit price', () => {
    const f = fixture();
    for (let tap = 0; tap < 9; tap++) f.add();
    assert.equal(f.order.lines.length, 1);
    assert.equal(f.order.lines[0].quantity, 9);
    assert.equal(f.order.lines[0].price, 1800);
    assert.equal(orderTotals(f.order).total, 16200);
});

test('grouped taps preserve sent deltas and cancel only already-sent quantities', () => {
    const f = fixture(['kitchen', 'bar', 'pastry']);
    f.add(); f.add();
    f.act('sendOrder');
    assert.equal(f.state.tickets.length, 3);
    const lineId = f.order.lines[0].id;
    f.add(); f.add();
    f.act('voidItem', { lineId, quantity: 1, reason: 'Extra tap' }, true);
    assert.equal(f.state.tickets.length, 3, 'unsent cancellation must not reach departments');
    f.act('sendOrder');
    assert.equal(f.state.tickets.length, 6);
    assert.ok(f.state.tickets.slice(3).every(t => t.lines.length === 1 && t.lines[0].quantity === 1));
    f.act('sendOrder');
    assert.equal(f.state.tickets.length, 6, 'sending twice must not duplicate kitchen tickets');
    f.act('voidItem', { lineId, quantity: 2, reason: 'Guest changed order' }, true);
    assert.equal(f.state.tickets.length, 9);
    assert.ok(f.state.tickets.slice(6).every(t => t.type === 'cancel' && t.lines[0].quantity === 2));
    f.add();
    f.act('sendOrder');
    assert.ok(f.state.tickets.slice(9).every(t => t.type === 'order' && t.lines[0].quantity === 1));
    assert.equal(f.order.lines.length, 1);
    assert.equal(f.order.lines[0].sentQuantity, 2);
    assert.equal(orderTotals(f.order).total, 3600);
});

test('different notes, price snapshots, product names and department routes stay separate', () => {
    const f = fixture();
    f.add();
    f.add('ხახვის გარეშე');
    f.saveProduct({ price: 2000 }); f.add();
    f.saveProduct({ name: 'ახალი ხაჭაპური' }); f.add();
    f.saveProduct({ departmentIds: ['bar'] }); f.add();
    assert.equal(f.order.lines.length, 5);
    assert.deepEqual(f.order.lines.map(l => l.price), [1800, 1800, 2000, 2000, 2000]);
    assert.equal(orderTotals(f.order).total, 9600);
});

test('the same set of routes in a different order still groups into one line', () => {
    const f = fixture(['kitchen', 'bar']);
    f.add();
    f.saveProduct({ departmentIds: ['bar', 'kitchen'] });
    f.add();
    assert.equal(f.order.lines.length, 1);
    assert.equal(f.order.lines[0].quantity, 2);
});

// @ts-ignore Node's strip-types runner requires explicit extensions.
import { createSerialQueue } from '../lib/serial-queue.ts';

test('rapid queued taps read the latest saved state and finish before a queued send', async () => {
    const enqueue = createSerialQueue();
    const f = fixture(['kitchen', 'bar']);
    let version = 0;
    let active = 0;
    let maxActive = 0;
    const seenVersions: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const tasks = Array.from({ length: 30 }, (_, tap) => enqueue(async () => {
        active++;
        maxActive = Math.max(active, maxActive);
        seenVersions.push(version);
        if (tap === 0) await gate;
        await Promise.resolve();
        f.add();
        version++;
        active--;
        return version;
    }));
    const sent = enqueue(async () => f.act('sendOrder'));
    await Promise.resolve();
    assert.deepEqual(seenVersions, [0], 'all later writes must wait on the first in-flight write');
    release();
    assert.deepEqual(await Promise.all(tasks), Array.from({ length: 30 }, (_, i) => i + 1));
    await sent;
    assert.equal(maxActive, 1);
    assert.deepEqual(seenVersions, Array.from({ length: 30 }, (_, i) => i));
    assert.equal(f.order.lines.length, 1);
    assert.equal(f.order.lines[0].quantity, 30);
    assert.equal(orderTotals(f.order).total, 54000);
    assert.equal(f.state.tickets.length, 2);
    assert.ok(f.state.tickets.every(t => t.lines[0].quantity === 30));
});

test('a failed queued mutation rejects its caller without stalling subsequent taps', async () => {
    const enqueue = createSerialQueue();
    const f = fixture();
    const first = enqueue(async () => f.add());
    const failed = enqueue(async () => { throw new Error('Storage unavailable'); });
    const later = enqueue(async () => { f.add(); return 'saved'; });
    const rejected = assert.rejects(failed, /Storage unavailable/);
    await first;
    await rejected;
    assert.equal(await later, 'saved');
    assert.equal(f.order.lines[0].quantity, 2);
});

test('adding after a fully cancelled line creates a fresh line without reviving its history', () => {
    const f = fixture();
    f.add();
    f.act('sendOrder');
    const lineId = f.order.lines[0].id;
    f.act('voidItem', { lineId, quantity: 1, reason: 'Cancelled' }, true);
    f.add();
    assert.equal(f.order.lines.length, 2);
    assert.equal(f.order.lines[0].quantity, f.order.lines[0].voidQuantity);
    assert.notEqual(f.order.lines[1].id, lineId);
    assert.equal(orderTotals(f.order).total, 1800);
    f.act('sendOrder');
    assert.equal(f.state.tickets.length, 3);
    assert.equal(f.state.tickets[2].lines[0].lineId, f.order.lines[1].id);
});

test('manual quantity addition combines with quick taps and updates the total', () => {
    const f = fixture();
    f.add();
    f.act('addItem', { productId: 'product-1', quantity: 5 });
    f.add();
    assert.equal(f.order.lines.length, 1);
    assert.equal(f.order.lines[0].quantity, 7);
    assert.equal(orderTotals(f.order).total, 12600);
});
