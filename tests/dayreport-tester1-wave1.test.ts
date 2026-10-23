import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {applyAction, seedState, type PosState} from '../lib/pos.ts';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {computeDayReport, isValidDayCloses, parseAmount} from '../lib/day-report.ts';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {clampPosition, defaultLayout, footprint, PLAN_HEIGHT, PLAN_WIDTH, tableSize, tableStatus, applyFloorPlan} from '../lib/floor-plan.ts';

const run = (s: PosState, a: string, p: Record<string, unknown>, m = false, now = '2026-10-22T08:00:00.000Z') => applyAction(s, a, p, m, now);

test('order opened yesterday, partially paid yesterday, closed today', () => {
 let s = seedState();
 const y = '2026-10-21T15:00:00.000Z', t = '2026-10-22T09:00:00.000Z';
 s = run(s, 'openOrder', {tableId: 'table-1'}, false, y);
 const id = s.orders[0].id;
 s = run(s, 'addItem', {orderId: id, productId: 'product-1', quantity: 2}, false, y);
 s = run(s, 'sendOrder', {orderId: id}, false, y);
 s = run(s, 'pay', {orderId: id, method: 'cash', amount: 1000}, false, y);
 assert.equal(computeDayReport(s, '2026-10-21').totals.openBills, 1);
 assert.equal(computeDayReport(s, '2026-10-21').totals.payments.cash, 1000);
 s = run(s, 'pay', {orderId: id, method: 'card', amount: 2600}, false, t);
 const today = computeDayReport(s, '2026-10-22').totals;
 assert.equal(today.closedBills, 1);
 assert.equal(today.net, 3600);
 assert.equal(today.payments.card, 2600);
 assert.equal(today.payments.cash, 0);
 // yesterday: no longer open, closed today -> no bills
 const yd = computeDayReport(s, '2026-10-21').totals;
 assert.equal(yd.openBills, 0); assert.equal(yd.closedBills, 0); assert.equal(yd.payments.cash, 1000);
});

test('percent discount rounding and average rounding in integer tetri', () => {
 let s = seedState();
 for (const tbl of ['table-1', 'table-2', 'table-3']) {
  s = run(s, 'openOrder', {tableId: tbl});
  const id = s.orders.at(-1)!.id;
  s = run(s, 'addItem', {orderId: id, productId: 'product-8', quantity: 1});
  s = run(s, 'sendOrder', {orderId: id});
  if (tbl === 'table-1') s = run(s, 'discount', {orderId: id, percent: 33, reason: 'x'}, true);
  s = run(s, 'pay', {orderId: id, method: 'other', amount: s.orders.at(-1)!.lines[0].price - (tbl === 'table-1' ? 132 : 0)});
 }
 const r = computeDayReport(s, '2026-10-22').totals;
 assert.equal(r.discounts, 132); assert.equal(r.net, 1068); assert.equal(r.payments.other, 1068);
 assert.equal(r.averageCheck, 356);
 assert.ok(Object.values(r).every(v => typeof v === 'object' || Number.isInteger(v)));
});

test('100% discount bill with zero payment counts as closed bill', () => {
 let s = seedState();
 s = run(s, 'openOrder', {tableId: 'table-1'});
 const id = s.orders[0].id;
 s = run(s, 'addItem', {orderId: id, productId: 'product-1', quantity: 1});
 s = run(s, 'sendOrder', {orderId: id});
 s = run(s, 'discount', {orderId: id, percent: 100, reason: 'x'}, true);
 s = run(s, 'pay', {orderId: id, method: 'cash', amount: 0});
 const r = computeDayReport(s, '2026-10-22').totals;
 assert.equal(r.closedBills, 1); assert.equal(r.gross, 1800); assert.equal(r.discounts, 1800); assert.equal(r.net, 0);
});

test('closeDay through applyAction: non-manager refused, record valid, repeat sequence', () => {
 let s = seedState();
 assert.throws(() => run(s, 'closeDay', {date: '2026-10-22', openingFloat: 0, countedCash: 0}));
 s = run(s, 'closeDay', {date: '2026-10-22', openingFloat: 10000, countedCash: 9850, closedBy: '  '}, true);
 s = run(s, 'closeDay', {date: '2026-10-22', openingFloat: 10000, countedCash: 10000}, true);
 assert.deepEqual(s.dayCloses!.map(c => c.sequence), [1, 2]);
 assert.equal(s.dayCloses![0].difference, -150);
 assert.equal(s.dayCloses![0].closedBy, undefined);
 assert.ok(isValidDayCloses(s.dayCloses));
 assert.equal(s.audit.filter(a => a.action === 'closeDay').length, 2);
 // date with Tbilisi tomorrow but UTC today
 assert.throws(() => run(s, 'closeDay', {date: '2026-10-23', openingFloat: 0, countedCash: 0}, true, '2026-10-22T19:00:00.000Z'));
 run(s, 'closeDay', {date: '2026-10-23', openingFloat: 0, countedCash: 0}, true, '2026-10-22T20:30:00.000Z');
 assert.throws(() => run(s, 'closeDay', {date: '2026-02-30', openingFloat: 0, countedCash: 0}, true));
 assert.throws(() => run(s, 'closeDay', {date: '2026-10-22', openingFloat: '100', countedCash: 0}, true));
 assert.throws(() => run(s, 'closeDay', {date: '2026-10-22', openingFloat: 0, countedCash: Infinity}, true));
});

test('isValidDayCloses rejects tampered records', () => {
 let s = seedState();
 s = run(s, 'closeDay', {date: '2026-10-22', openingFloat: 100, countedCash: 50}, true);
 const base = s.dayCloses![0];
 const bad = (patch: Record<string, unknown>) => assert.equal(isValidDayCloses([{...base, ...patch}]), false, JSON.stringify(patch));
 bad({sequence: 1.5}); bad({difference: 1}); bad({countedCash: -1}); bad({date: '2026-13-01'}); bad({closedAt: 'x'});
 bad({totals: {...base.totals, net: -1}}); bad({totals: {...base.totals, payments: {...base.totals.payments, cash: 5}}});
 bad({note: 5}); bad({closedBy: 7}); bad({id: 5});
 assert.equal(isValidDayCloses([base, base]), false);
 assert.equal(isValidDayCloses({}), false);
 assert.equal(isValidDayCloses([]), true);
});

test('parseAmount edge cases', () => {
 assert.deepEqual(parseAmount('118.5'), {ok: true, value: 11850});
 assert.deepEqual(parseAmount('118,05'), {ok: true, value: 11805});
 assert.deepEqual(parseAmount(' 0 '), {ok: true, value: 0});
 for (const bad of ['-1', 'abc', '1.234', '1e3', '.5', '1.', '+1', 'Infinity']) assert.equal(parseAmount(bad).ok, false, bad);
});

test('floor plan: sizes grow with seats, defaults never leave the canvas', () => {
 assert.ok(tableSize({seats: 2, shape: 'square'}).width < tableSize({seats: 4, shape: 'square'}).width);
 assert.ok(tableSize({seats: 2, shape: 'round'}).width < tableSize({seats: 4, shape: 'round'}).width);
 assert.ok(tableSize({seats: 6, shape: 'rectangle'}).width > tableSize({seats: 4, shape: 'square'}).width);
 assert.ok(tableSize({seats: 8, shape: 'rectangle'}).width > tableSize({seats: 6, shape: 'rectangle'}).width);
 for (let n = 1; n <= 24; n++) for (let i = 0; i < n; i++) {
  const l = defaultLayout(i, n), f = footprint(l);
  assert.ok(l.x - f.width / 2 >= 0 && l.x + f.width / 2 <= PLAN_WIDTH && l.y - f.height / 2 >= 0 && l.y + f.height / 2 <= PLAN_HEIGHT, `${i}/${n}`);
 }
 for (const shape of ['round', 'square', 'rectangle'] as const) for (let seats = 1; seats <= 20; seats++) for (const rotation of [0, 90] as const) {
  const l = {seats, shape, rotation, x: 0, y: 0};
  for (const [x, y] of [[-500, -500], [5000, 5000], [500.4, 312.6]]) {
   const c = clampPosition(l, x, y), f = footprint(l);
   assert.ok(Number.isInteger(c.x) && Number.isInteger(c.y));
   assert.ok(c.x >= 0 && c.x <= PLAN_WIDTH && c.y >= 0 && c.y <= PLAN_HEIGHT);
   if (f.width <= PLAN_WIDTH) assert.ok(c.x - f.width / 2 >= 0 && c.x + f.width / 2 <= PLAN_WIDTH, `${shape}${seats}r${rotation}`);
   if (f.height <= PLAN_HEIGHT) assert.ok(c.y - f.height / 2 >= 0 && c.y + f.height / 2 <= PLAN_HEIGHT, `${shape}${seats}r${rotation} y`);
  }
 }
});

test('floor plan status and applyFloorPlan on a real state', () => {
 let s = seedState();
 assert.equal(tableStatus(undefined), 'free');
 s = run(s, 'openOrder', {tableId: 'table-1'});
 const id = s.orders[0].id;
 assert.equal(tableStatus(s.orders[0]), 'occupied');
 s = run(s, 'addItem', {orderId: id, productId: 'product-1', quantity: 2});
 assert.equal(tableStatus(s.orders[0]), 'occupied');
 s = run(s, 'sendOrder', {orderId: id});
 assert.equal(tableStatus(s.orders[0]), 'occupied');
 s = run(s, 'pay', {orderId: id, method: 'cash', amount: 100});
 assert.equal(tableStatus(s.orders[0]), 'occupied');
 const copy = structuredClone(s);
 assert.throws(() => applyFloorPlan(copy, {zoneId: 'hall', tables: [], removeIds: ['table-1']}, {newId: () => 'n'}));
 assert.deepEqual(copy, s);
 assert.throws(() => applyFloorPlan(copy, {zoneId: 'hall', tables: [{id: 'table-9', name: '9', layout: {seats: 4, shape: 'square', x: 100, y: 100, rotation: 0}}]}, {newId: () => 'n'}));
 assert.throws(() => applyFloorPlan(copy, {zoneId: 'hall', tables: [{name: 'x', layout: {seats: 0, shape: 'square', x: 100, y: 100, rotation: 0}}]}, {newId: () => 'n'}));
 assert.throws(() => applyFloorPlan(copy, {zoneId: 'hall', tables: [{name: 'x', layout: {seats: 4, shape: 'oval', x: 100, y: 100, rotation: 0}}]}, {newId: () => 'n'}));
 assert.throws(() => applyFloorPlan(copy, {zoneId: 'hall', tables: [{name: 'x', layout: {seats: 4, shape: 'square', x: 1001, y: 100, rotation: 0}}]}, {newId: () => 'n'}));
 assert.deepEqual(copy, s);
 const detail = applyFloorPlan(copy, {zoneId: 'hall', tables: [{id: 'table-2', name: '2', layout: {seats: 6, shape: 'rectangle', x: 300, y: 200, rotation: 90}}, {name: 'VIP', layout: {seats: 8, shape: 'round', x: 500, y: 300, rotation: 0}}], removeIds: ['table-3']}, {newId: () => 'new-1'});
 assert.match(detail, /განახლდა 1, დაემატა 1, ამოღებულია 1/);
 assert.equal(copy.tables.find(t => t.id === 'table-3')!.archived, true);
 assert.equal(copy.tables.find(t => t.id === 'new-1')!.zoneId, 'hall');
});
