import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {applyAction, demoSeedState, isValidInventory, seedState} from '../lib/pos.ts';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {foodCostReport, countPreview, stockAlerts} from '../lib/inventory.ts';
import type {PosState} from '../lib/pos';

// Deterministic PRNG so a failing sequence can be replayed.
function rng(seed: number) { return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; }
const valid = (s: PosState) => isValidInventory(JSON.parse(JSON.stringify(s.inventory)), s.products.map(p => p.id));

test('random inventory and order actions never produce a document validState would reject', () => {
    for (let seed = 1; seed <= 40; seed++) {
        const r = rng(seed), pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
        let s: PosState = demoSeedState('2026-01-01T00:00:00.000Z');
        const names = ['ა', 'ბ', 'გ', 'Ⴀ', 'ⴀ', 'სოუსი', 'ცომი'];
        for (let step = 0; step < 250; step++) {
            const items = s.inventory.items;
            const anyItem = () => pick(items)?.id;
            const qty = () => pick([1, 7, 333, 1000, 2500]);
            const choices: [string, Record<string, unknown>][] = [
                ['saveStockItem', {name: pick(names) + (r() < .5 ? ' ' : ''), unit: pick(['g', 'ml', 'pcs']), kind: pick(['ingredient', 'semi']), threshold: r() < .5 ? 100 : undefined}],
                ['saveStockItem', {id: anyItem(), name: pick(names), unit: pick(['g', 'ml', 'pcs']), kind: items.find(i => i.id)?.kind ?? 'ingredient'}],
                ['archiveStockItem', {id: anyItem(), archived: r() < .6}],
                ['saveRecipe', {productId: pick(s.products).id, lines: r() < .2 ? [] : [{itemId: anyItem(), quantity: qty()}, {itemId: anyItem(), quantity: qty()}]}],
                ['saveBatchRecipe', {itemId: anyItem(), output: qty(), lines: r() < .1 ? [] : [{itemId: anyItem(), quantity: qty()}]}],
                ['receiveStock', {date: '2026-02-03', lines: [{itemId: anyItem(), quantity: qty(), total: pick([0, 1, 999, 12345])}]}],
                ['writeOff', {itemId: anyItem(), quantity: qty(), reason: 'გაფუჭება'}],
                ['stockCount', {counts: [{itemId: anyItem(), quantity: pick([0, 1, 500, 4600])}]}],
                ['produce', {itemId: anyItem(), batches: pick([1, 2, 3])}],
                ['order', {}],
            ];
            const [action, payload] = pick(choices);
            try {
                if (action === 'order') {
                    s = applyAction(s, 'openOrder', {tableId: 'table-1'});
                    const o = s.orders.find(x => x.status === 'open' && x.tableId === 'table-1')!;
                    if (o.payments.length) continue;
                    s = applyAction(s, 'addItem', {orderId: o.id, productId: pick(s.products).id, quantity: pick([1, 2, 3])});
                    s = applyAction(s, 'sendOrder', {orderId: o.id});
                    if (r() < .3) {
                        const line = s.orders.find(x => x.id === o.id)!.lines.find(l => l.quantity > l.voidQuantity);
                        if (line) s = applyAction(s, 'voidItem', {orderId: o.id, lineId: line.id, quantity: 1, reason: 'x'}, true);
                    }
                    if (r() < .5) {
                        const due = s.orders.find(x => x.id === o.id)!;
                        const total = due.lines.reduce((a, l) => a + l.price * (l.quantity - l.voidQuantity), 0);
                        s = total ? applyAction(s, 'pay', {orderId: o.id, method: 'cash', amount: total}) : applyAction(s, 'closeEmptyOrder', {orderId: o.id});
                    }
                } else s = applyAction(s, action, payload, true);
            } catch (e) { if (!(e instanceof Error)) throw e; continue; }
            assert.ok(valid(s), `seed ${seed} step ${step} ${action} ${JSON.stringify(payload)}`);
            for (const item of s.inventory.items) assert.ok(item.quantity > 0 || item.value === 0);
            // Sale deductions and sent quantities must agree.
        }
    }
});

test('sale movements equal recipe × net sent quantity across add, send, void, resend', () => {
    let s: PosState = demoSeedState('2026-01-01T00:00:00.000Z');
    s = applyAction(s, 'openOrder', {tableId: 'table-2'});
    const oid = s.orders[0].id;
    const flour = () => s.inventory.items.find(i => i.id === 'stock-flour')!.quantity;
    const start = flour();
    s = applyAction(s, 'addItem', {orderId: oid, productId: 'product-1', quantity: 2});
    s = applyAction(s, 'addItem', {orderId: oid, productId: 'product-1', quantity: 1});
    // void one unsent before send: nothing deducted for it
    const lid = s.orders[0].lines[0].id;
    s = applyAction(s, 'voidItem', {orderId: oid, lineId: lid, quantity: 1, reason: 'x'}, true);
    s = applyAction(s, 'sendOrder', {orderId: oid});
    assert.equal(flour(), start - 400);
    s = applyAction(s, 'sendOrder', {orderId: oid});
    assert.equal(flour(), start - 400);
    s = applyAction(s, 'voidItem', {orderId: oid, lineId: lid, quantity: 2, reason: 'x'}, true);
    assert.equal(flour(), start - 400);
    s = applyAction(s, 'sendOrder', {orderId: oid});
    assert.equal(flour(), start - 400);
    s = applyAction(s, 'addItem', {orderId: oid, productId: 'product-1', quantity: 1});
    s = applyAction(s, 'sendOrder', {orderId: oid});
    assert.equal(flour(), start - 600);
    s = applyAction(s, 'transfer', {orderId: oid, tableId: 'table-3'});
    s = applyAction(s, 'sendOrder', {orderId: oid});
    assert.equal(flour(), start - 600);
});

test('seed food cost and spec examples', () => {
    const s = demoSeedState();
    const rows = Object.fromEntries(foodCostReport(s).rows.map((r: {productId: string; cost: number; percentTenths: number | null}) => [r.productId, [r.cost, r.percentTenths]]));
    assert.deepEqual(rows, {'product-1': [520, 289], 'product-2': [448, 187], 'product-8': [60, 150]});
    let t: PosState = seedState();
    t.inventory.items.push({id: 'x', name: 'x', unit: 'g', kind: 'ingredient', quantity: 0, value: 0, avgCost: 0});
    t = applyAction(t, 'receiveStock', {lines: [{itemId: 'x', quantity: 5000, total: 5600}]}, true);
    const prev = countPreview(t.inventory, [{itemId: 'x', quantity: 4600}]);
    assert.deepEqual([prev.lines[0].diff, prev.lines[0].value, prev.shortage, prev.surplus], [-400, -448, 448, 0]);
    t = applyAction(t, 'writeOff', {itemId: 'x', quantity: 6000, reason: 'სხვა'}, true);
    assert.equal(stockAlerts(t.inventory).negative.length, 1);
    t = applyAction(t, 'stockCount', {counts: [{itemId: 'x', quantity: 100}]}, true);
    const x = t.inventory.items.find(i => i.id === 'x')!;
    assert.deepEqual([x.quantity, x.value, x.avgCost], [100, 112, 1120]);
});
