import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {defaultLayout, footprint, zoneLayouts, zoneTables, tableStatus, clampPosition, tableSize, PLAN_WIDTH, PLAN_HEIGHT, MAX_SEATS, TABLE_SHAPES, applyFloorPlan} from '../lib/floor-plan.ts';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {applyAction, demoSeedState} from '../lib/pos.ts';
import type {TableLayout, TableShape, PosState} from '../lib/pos';

const rect = (l: TableLayout) => { const f = footprint(l); return {left: l.x - f.width / 2, right: l.x + f.width / 2, top: l.y - f.height / 2, bottom: l.y + f.height / 2}; };
const overlap = (a: TableLayout, b: TableLayout) => { const r = rect(a), q = rect(b); return r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom; };
const ctx = {manager: true, now: '2026-10-22T10:00:00.000Z'};

function overlapsIn(state: PosState, zoneId: string) {
    const items = zoneLayouts(zoneTables(state, zoneId));
    const hits: string[] = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++)
        if (overlap(items[i].layout, items[j].layout)) hits.push(`${items[i].table.name}×${items[j].table.name}`);
    return hits;
}

test('any shape/seats/rotation clamps fully inside the canvas', () => {
    for (const shape of TABLE_SHAPES as TableShape[]) for (let seats = 1; seats <= MAX_SEATS; seats++) for (const rotation of [0, 90] as const)
        for (const [x, y] of [[0, 0], [1000, 625], [500, 300]]) {
            const l = {seats, shape, rotation, x: 0, y: 0};
            const p = clampPosition(l, x, y), r = rect({...l, ...p});
            assert.ok(r.left >= 0 && r.top >= 0 && r.right <= PLAN_WIDTH && r.bottom <= PLAN_HEIGHT, `${shape} ${seats} ${rotation}`);
        }
});

test('8-seat rectangle longer than 4-seat square', () => {
    assert.ok(tableSize({seats: 8, shape: 'rectangle'}).width > tableSize({seats: 4, shape: 'square'}).width);
    assert.ok(tableSize({seats: 6, shape: 'rectangle'}).width > tableSize({seats: 4, shape: 'square'}).width);
});

test('sent or paid orders mark the table occupied; unsent ones do not', () => {
    const base = {id: 'o', tableId: 't', status: 'open' as const, createdAt: ctx.now, discountPercent: 0};
    const l = {id: 'l', productId: 'p', name: 'x', price: 100, quantity: 2, departmentIds: [], note: '', sentQuantity: 1, voidQuantity: 0};
    assert.equal(tableStatus({...base, lines: [l], payments: [{id: 'p', method: 'cash', amount: 50, createdAt: ctx.now, allocations: []}]}), 'occupied');
    assert.equal(tableStatus({...base, lines: [l], payments: []}), 'occupied');
    assert.equal(tableStatus({...base, lines: [{...l, sentQuantity: 2}], payments: []}), 'occupied');
    assert.equal(tableStatus({...base, lines: [{...l, sentQuantity: 0}], payments: []}), 'free');
});

test('defaultLayout 24 tables never overlap', () => {
    const all = Array.from({length: 24}, (_, i) => defaultLayout(i, 24));
    for (let i = 0; i < 24; i++) for (let j = i + 1; j < 24; j++) assert.ok(!overlap(all[i], all[j]));
});

test('PROBE: table added via saveTable into a laid-out demo zone does not overlap', () => {
    let s = demoSeedState(ctx.now);
    assert.deepEqual(overlapsIn(s, 'hall'), []);
    s = applyAction(s, 'saveTable', {name: '13', zoneId: 'hall'}, ctx.manager, ctx.now);
    assert.deepEqual(overlapsIn(s, 'hall'), [], 'new table overlaps existing ones on the plan');
});

test('PROBE: table moved to another zone via saveTable does not overlap there', () => {
    let s = demoSeedState(ctx.now);
    const t = s.tables.find(x => x.zoneId === 'hall')!;
    s = applyAction(s, 'saveTable', {id: t.id, name: t.name, zoneId: 'terrace'}, ctx.manager, ctx.now);
    assert.deepEqual(overlapsIn(s, 'terrace'), [], 'moved table overlaps');
});

test('applyFloorPlan failure leaves state unchanged via applyAction', () => {
    const s = demoSeedState(ctx.now);
    const before = JSON.stringify(s);
    assert.throws(() => applyAction(s, 'saveFloorPlan', {zoneId: 'hall', tables: [{id: 'table-1', name: '1', layout: {seats: 0, shape: 'round', x: 1, y: 1, rotation: 0}}]}, ctx.manager, ctx.now));
    assert.equal(JSON.stringify(s), before);
    assert.throws(() => applyAction(s, 'saveFloorPlan', {zoneId: 'hall', tables: []}, false));
    void applyFloorPlan;
});
