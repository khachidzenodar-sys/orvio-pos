import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {applyAction, seedState, type PosState} from '../lib/pos.ts';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {businessDay, closeDay, computeDayReport, parseAmount, differenceText} from '../lib/day-report.ts';

const run = (s: PosState, a: string, p: Record<string, unknown>, m = false, now = '2026-10-22T08:00:00.000Z') => applyAction(s, a, p, m, now);

test('Tbilisi day boundary: 19:59:59Z is still the same day, 20:00Z is next day', () => {
 assert.equal(businessDay('2026-10-21T19:59:59.999Z'), '2026-10-21');
 assert.equal(businessDay('2026-10-21T20:00:00.000Z'), '2026-10-22');
 let s = seedState();
 s = run(s, 'openOrder', {tableId: 'table-1'}, false, '2026-10-21T19:00:00.000Z');
 const id = s.orders[0].id;
 s = run(s, 'addItem', {orderId: id, productId: 'product-1', quantity: 1}, false, '2026-10-21T19:00:00.000Z');
 s = run(s, 'sendOrder', {orderId: id}, false, '2026-10-21T19:00:00.000Z');
 s = run(s, 'pay', {orderId: id, method: 'cash', amount: s.orders[0].lines[0].price}, false, '2026-10-21T20:30:00.000Z');
 assert.equal(computeDayReport(s, '2026-10-21').totals.closedBills, 0);
 assert.equal(computeDayReport(s, '2026-10-22').totals.closedBills, 1);
 assert.equal(computeDayReport(s, '2026-10-22').totals.payments.cash, s.orders[0].lines[0].price);
});

test('parseAmount max limit, comma decimals, and closeDay limit agree', () => {
 assert.deepEqual(parseAmount('1000000'), {ok: true, value: 100000000});
 assert.equal(parseAmount('1000000.01').ok, false);
 assert.deepEqual(parseAmount('118,5'), {ok: true, value: 11850});
 assert.equal(parseAmount('-1').ok, false);
 assert.equal(parseAmount('abc').ok, false);
 assert.equal(parseAmount('1.234').ok, false);
 const s = seedState();
 assert.throws(() => closeDay(s, {date: '2026-10-22', openingFloat: 0, countedCash: 100000001}, {now: '2026-10-22T10:00:00Z', newId: () => 'x'}));
 assert.doesNotThrow(() => closeDay(s, {date: '2026-10-22', openingFloat: 0, countedCash: 100000000}, {now: '2026-10-22T10:00:00Z', newId: () => 'x'}));
});

test('closeDay does not alter orders and selling continues; later sales appear', () => {
 let s = seedState();
 s = run(s, 'openOrder', {tableId: 'table-1'});
 const id = s.orders[0].id;
 s = run(s, 'addItem', {orderId: id, productId: 'product-1', quantity: 2});
 const ordersBefore = JSON.stringify(s.orders), tablesBefore = JSON.stringify(s.tables);
 s = run(s, 'closeDay', {date: '2026-10-22', openingFloat: 10000, countedCash: 11850, note: ''}, true, '2026-10-22T18:00:00.000Z');
 assert.equal(JSON.stringify(s.orders), ordersBefore);
 assert.equal(JSON.stringify(s.tables), tablesBefore);
 assert.equal(s.dayCloses!.length, 1);
 s = run(s, 'sendOrder', {orderId: id});
 s = run(s, 'pay', {orderId: id, method: 'card', amount: s.orders[0].lines[0].price * 2}, false, '2026-10-22T18:30:00.000Z');
 assert.equal(computeDayReport(s, '2026-10-22').totals.closedBills, 1);
 assert.equal(s.dayCloses![0].totals.closedBills, 0);
 s = run(s, 'closeDay', {date: '2026-10-22', openingFloat: 0, countedCash: 0}, true, '2026-10-22T19:00:00.000Z');
 assert.deepEqual(s.dayCloses!.map(c => c.sequence), [1, 2]);
 assert.equal(differenceText(-150), '−1.50 დანაკლისი');
 assert.equal(differenceText(100), '+1.00 ზედმეტობა');
 assert.equal(differenceText(0), '0.00 ემთხვევა');
});
