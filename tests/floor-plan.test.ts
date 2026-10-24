import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {applyFloorPlan, chairPositions, clampPosition, defaultLayout, findFreeSpot, footprint, isValidTableLayout, nextTableName, parseTableLayout, tableSize, tableStatus, zoneLayouts, zoneTables, MAX_SEATS, PLAN_HEIGHT, PLAN_WIDTH, TABLE_SHAPES} from '../lib/floor-plan.ts';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {seedState} from '../lib/pos.ts';
import type {Order, PosState, TableLayout, TableShape} from '../lib/pos';

const layout = (over: Partial<TableLayout> = {}): TableLayout => ({seats: 4, shape: 'square', x: 500, y: 300, rotation: 0, ...over});
const rect = (l: TableLayout) => { const f = footprint(l); return {left: l.x - f.width / 2, right: l.x + f.width / 2, top: l.y - f.height / 2, bottom: l.y + f.height / 2}; };
const overlap = (a: TableLayout, b: TableLayout) => { const r = rect(a), q = rect(b); return r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom; };
const inside = (l: TableLayout) => { const r = rect(l); return r.left >= 0 && r.top >= 0 && r.right <= PLAN_WIDTH && r.bottom <= PLAN_HEIGHT; };
const ids = () => { let n = 0; return () => `new-${++n}`; };
const order = (over: Partial<Order> = {}): Order => ({id: 'o1', tableId: 'table-1', status: 'open', createdAt: '2026-10-22T10:00:00.000Z', lines: [], discountPercent: 0, payments: [], ...over});
const line = (quantity: number, sentQuantity: number, voidQuantity = 0) => ({id: `l${quantity}${sentQuantity}${voidQuantity}`, productId: 'product-1', name: 'ხაჭაპური', price: 1800, quantity, departmentIds: ['kitchen'], note: '', sentQuantity, voidQuantity});

test('table size grows with seats for every shape', () => {
    for (const shape of TABLE_SHAPES as TableShape[]) {
        const two = tableSize({seats: 2, shape}), four = tableSize({seats: 4, shape});
        assert.ok(two.width * two.height < four.width * four.height, shape);
    }
    assert.deepEqual(tableSize({seats: 4, shape: 'round'}), {width: 118, height: 118});
    assert.deepEqual(tableSize({seats: 2, shape: 'square'}), {width: 70, height: 70});
    assert.deepEqual(tableSize({seats: 8, shape: 'square'}), {width: 140, height: 140});
    assert.deepEqual(tableSize({seats: 6, shape: 'rectangle'}), {width: 170, height: 80});
    const square4 = tableSize({seats: 4, shape: 'square'}).width;
    assert.ok(tableSize({seats: 6, shape: 'rectangle'}).width > square4);
    assert.ok(tableSize({seats: 8, shape: 'rectangle'}).width > tableSize({seats: 6, shape: 'rectangle'}).width);
});

test('every seat gets exactly one chair outside the table', () => {
    for (const shape of TABLE_SHAPES as TableShape[]) for (let seats = 1; seats <= MAX_SEATS; seats++) {
        const chairs = chairPositions({seats, shape}), size = tableSize({seats, shape});
        assert.equal(chairs.length, seats, `${shape} ${seats}`);
        for (const c of chairs) assert.ok(shape === 'round' ? Math.hypot(c.x, c.y) > size.width / 2 : Math.abs(c.x) > size.width / 2 || Math.abs(c.y) > size.height / 2, `${shape} ${seats} chair outside`);
        const f = footprint(layout({seats, shape}));
        for (const c of chairs) assert.ok(Math.abs(c.x) <= f.width / 2 && Math.abs(c.y) <= f.height / 2, `${shape} ${seats} chair inside footprint`);
    }
    const rectChairs = chairPositions({seats: 5, shape: 'rectangle'});
    assert.equal(rectChairs.filter(c => c.y < 0).length, 3);
    assert.equal(rectChairs.filter(c => c.y > 0).length, 2);
    const squareChairs = chairPositions({seats: 6, shape: 'square'});
    assert.deepEqual(squareChairs.map(c => c.angle), [-90, 0, 90, 180, -90, 0]);
});

test('footprint includes chairs and swaps on rotation', () => {
    assert.deepEqual(footprint(layout()), {width: 150, height: 150});
    assert.deepEqual(footprint(layout({shape: 'rectangle', seats: 8})), {width: 280, height: 140});
    assert.deepEqual(footprint(layout({shape: 'rectangle', seats: 8, rotation: 90})), {width: 140, height: 280});
});

test('clampPosition keeps the footprint on the canvas with integer results', () => {
    assert.deepEqual(clampPosition(layout(), -50, 9999), {x: 75, y: 550});
    assert.deepEqual(clampPosition(layout(), 333.6, 200.2), {x: 334, y: 200});
    const rotated = layout({shape: 'rectangle', seats: 20, rotation: 90});
    const spot = clampPosition(rotated, 0, 0);
    assert.ok(Number.isInteger(spot.x) && Number.isInteger(spot.y));
    assert.ok(inside({...rotated, ...spot}));
    const odd = layout({shape: 'round', seats: 3});
    const far = clampPosition(odd, 2000, 2000);
    assert.ok(inside({...odd, ...far}));
});

test('default grid never overlaps for up to 24 tables', () => {
    for (let n = 1; n <= 24; n++) {
        const all = Array.from({length: n}, (_, i) => defaultLayout(i, n));
        for (const l of all) {
            assert.ok(isValidTableLayout(l));
            assert.ok(inside(l), `n=${n} inside`);
        }
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(!overlap(all[i], all[j]), `n=${n} ${i}/${j}`);
    }
    assert.deepEqual(defaultLayout(0, 12), {seats: 4, shape: 'square', rotation: 0, x: 83, y: 78});
});

test('zoneTables and zoneLayouts keep stored order and fill missing layouts', () => {
    const s = seedState() as PosState;
    s.tables[1].archived = true;
    s.tables[2].layout = layout({x: 900, y: 500, shape: 'round'});
    const hall = zoneTables(s, 'hall');
    assert.deepEqual(hall.map(t => t.id), ['table-1', 'table-3', 'table-4', 'table-5', 'table-6', 'table-7', 'table-8']);
    const placed = zoneLayouts(hall);
    assert.deepEqual(placed[0].layout, defaultLayout(0, 7));
    assert.equal(placed[1].layout.shape, 'round');
    assert.deepEqual(placed[2].layout, defaultLayout(2, 7));
});

test('a table without layout never lands on a saved table', () => {
    const s = seedState() as PosState;
    const hall = zoneTables(s, 'hall');
    const slots = hall.map((_, i) => defaultLayout(i, hall.length));
    hall.forEach((t, i) => { if (i > 0) t.layout = slots[i - 1]; });
    const placed = zoneLayouts(hall);
    for (let i = 0; i < placed.length; i++) {
        assert.ok(inside(placed[i].layout));
        for (let j = i + 1; j < placed.length; j++) assert.ok(!overlap(placed[i].layout, placed[j].layout), `${i}×${j}`);
    }
});

test('a table is occupied only once something was sent or paid', () => {
    const pay = {id: 'p', method: 'cash' as const, amount: 100, createdAt: '2026-10-22T10:00:00.000Z', allocations: []};
    assert.equal(tableStatus(undefined), 'free');
    assert.equal(tableStatus(order()), 'free');
    assert.equal(tableStatus(order({lines: [line(2, 2)]})), 'occupied');
    assert.equal(tableStatus(order({lines: [line(2, 1, 1)]})), 'occupied');
    assert.equal(tableStatus(order({lines: [line(2, 1)]})), 'occupied');
    assert.equal(tableStatus(order({lines: [line(2, 1)], payments: [pay]})), 'occupied');
    assert.equal(tableStatus(order({lines: [line(2, 2)], payments: [pay]})), 'occupied');
});

test('findFreeSpot avoids existing tables and falls back to the centre', () => {
    const first = defaultLayout(0, 24);
    const spot = findFreeSpot([first], {seats: 4, shape: 'square', rotation: 0});
    assert.ok(!overlap(first, layout(spot)));
    assert.deepEqual(findFreeSpot([], {seats: 4, shape: 'square', rotation: 0}), {x: first.x, y: first.y});
    const wide = {seats: 8, shape: 'rectangle' as const, rotation: 0 as const};
    const wideSpot = findFreeSpot([first], wide);
    assert.ok(inside({...wide, ...wideSpot}) && !overlap(first, {...wide, ...wideSpot}));
    const full = [layout({shape: 'rectangle', seats: 20, x: 300, y: 150}), layout({shape: 'rectangle', seats: 20, x: 300, y: 470}), layout({shape: 'rectangle', seats: 20, x: 700, y: 150}), layout({shape: 'rectangle', seats: 20, x: 700, y: 470})];
    assert.deepEqual(findFreeSpot(full, {seats: 20, shape: 'round', rotation: 0}), {x: 500, y: 312});
});

test('nextTableName continues numbering of active tables', () => {
    const s = seedState() as PosState;
    assert.equal(nextTableName(s.tables), '13');
    s.tables[11].archived = true;
    assert.equal(nextTableName(s.tables), '12');
    assert.equal(nextTableName([{id: 'a', name: 'VIP', zoneId: 'hall'}, {id: 'b', name: 'ბარი', zoneId: 'hall'}]), '3');
    assert.equal(nextTableName([]), '1');
});

test('layout validation is strict and parse errors are Georgian', () => {
    assert.ok(isValidTableLayout(layout()));
    assert.ok(isValidTableLayout(layout({x: 0, y: 625, rotation: 90, seats: 20, shape: 'rectangle'})));
    const bad: unknown[] = [null, [], 'x', layout({seats: 0}), layout({seats: 21}), layout({seats: 2.5}), {...layout(), seats: 'abc'}, {...layout(), shape: 'oval'}, layout({x: 1001}), layout({y: -1}), layout({x: 10.5}), {...layout(), rotation: 45}, {...layout(), extra: 1}, {seats: 4, shape: 'square', x: 1, y: 1}];
    for (const value of bad) {
        assert.equal(isValidTableLayout(value), false, JSON.stringify(value));
        assert.throws(() => parseTableLayout(value), (e: Error) => /[Ⴀ-ჿ]/.test(e.message));
    }
    assert.throws(() => parseTableLayout(layout({seats: 0})), /ადგილების რაოდენობა/);
    assert.deepEqual(parseTableLayout(layout()), layout());
});

function planState() {
    const s = seedState() as PosState;
    s.orders.push(order({id: 'open-1', tableId: 'table-2'}));
    return s;
}

test('applyFloorPlan updates, adds and archives tables of one zone', () => {
    const s = planState();
    const detail = applyFloorPlan(s, {zoneId: 'hall', tables: [{id: 'table-1', name: ' 1A ', layout: layout({x: 120, y: 100, shape: 'round', seats: 2})}, {name: 'VIP', layout: layout({shape: 'rectangle', seats: 8, x: 600, y: 400})}], removeIds: ['table-3']}, {newId: ids()});
    assert.equal(detail, 'დარბაზი: განახლდა 1, დაემატა 1, ამოღებულია 1');
    const t1 = s.tables.find(t => t.id === 'table-1')!;
    assert.equal(t1.name, '1A');
    assert.deepEqual(t1.layout, layout({x: 120, y: 100, shape: 'round', seats: 2}));
    assert.deepEqual(s.tables.find(t => t.id === 'new-1'), {id: 'new-1', name: 'VIP', zoneId: 'hall', layout: layout({shape: 'rectangle', seats: 8, x: 600, y: 400})});
    assert.equal(s.tables.find(t => t.id === 'table-3')!.archived, true);
    assert.equal(s.tables.find(t => t.id === 'table-4')!.layout, undefined, 'tables outside the payload stay unchanged');
    assert.deepEqual(s.orders, planState().orders);
});

test('applyFloorPlan refuses invalid drafts atomically', () => {
    const cases: [Record<string, unknown>, RegExp][] = [
        [{zoneId: 'nowhere', tables: []}, /ზონა ვერ მოიძებნა/],
        [{zoneId: 'hall', tables: 'x'}, /მაგიდების სია/],
        [{zoneId: 'hall', tables: Array.from({length: 201}, () => ({name: 'x', layout: layout()}))}, /მაგიდების სია/],
        [{zoneId: 'hall', tables: [{name: 'ok', layout: layout()}], removeIds: ['table-2']}, /ჯერ დახურეთ ან გადაიტანეთ მაგიდის შეკვეთა/],
        [{zoneId: 'hall', tables: [{id: 'table-9', name: '9', layout: layout()}]}, /მაგიდა ვერ მოიძებნა/],
        [{zoneId: 'hall', tables: [], removeIds: ['table-10']}, /მაგიდა ვერ მოიძებნა/],
        [{zoneId: 'hall', tables: [{id: 'table-1', name: '1', layout: layout()}, {id: 'table-1', name: '1', layout: layout()}]}, /ორჯერ/],
        [{zoneId: 'hall', tables: [{id: 'table-1', name: '1', layout: layout()}], removeIds: ['table-1']}, /ორჯერ/],
        [{zoneId: 'hall', tables: [{name: '   ', layout: layout()}]}, /1–40 სიმბოლოს/],
        [{zoneId: 'hall', tables: [{name: 'x'.repeat(41), layout: layout()}]}, /1–40 სიმბოლოს/],
        [{zoneId: 'hall', tables: [{id: 'table-1', name: 'first', layout: layout()}, {name: 'bad', layout: layout({x: 1001})}]}, /მდებარეობა/],
        [{zoneId: 'hall', tables: [{name: 'new', layout: layout()}], removeIds: 'table-3'}, /მაგიდების სია/],
    ];
    for (const [payload, message] of cases) {
        const s = planState(), before = structuredClone(s);
        assert.throws(() => applyFloorPlan(s, payload, {newId: ids()}), message, JSON.stringify(payload).slice(0, 80));
        assert.deepEqual(s, before);
    }
    const archived = planState();
    archived.zones[1].archived = true;
    assert.throws(() => applyFloorPlan(archived, {zoneId: 'terrace', tables: []}, {newId: ids()}), /ზონა ვერ მოიძებნა/);
});
