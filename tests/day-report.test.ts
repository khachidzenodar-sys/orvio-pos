import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {applyAction, seedState, type PosState} from '../lib/pos.ts';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {businessDay, cashCheck, computeDayReport, differenceText, parseAmount, signedAmount} from '../lib/day-report.ts';

const T = '2026-10-22T08:00:00.000Z';
const DAY = '2026-10-22';

function shop() {
 let state: PosState = seedState();
 const act = (action: string, p: Record<string, unknown> = {}, manager = false, now = T) => { state = applyAction(state, action, p, manager, now); return state; };
 for (const [id, price] of [['p42', 4200], ['p26', 2600], ['p8', 800], ['p20', 2000], ['p155', 1550]] as const)
  act('saveProduct', {id, name: id, category: 'Test', price, departmentIds: ['kitchen'], active: true});
 const open = (tableId: string, items: [string, number][], now = T) => {
  act('openOrder', {tableId}, false, now);
  const orderId = state.orders.find(o => o.tableId === tableId && o.status === 'open')!.id;
  for (const [productId, quantity] of items) act('addItem', {orderId, productId, quantity}, false, now);
  act('sendOrder', {orderId}, false, now);
  return orderId;
 };
 return {act, open, get state() { return state; }};
}

function referenceDay() {
 const f = shop();
 const a = f.open('table-1', [['p42', 1]]);
 f.act('splitPay', {orderId: a, cash: 2000, card: 2200});
 const b = f.open('table-2', [['p26', 2], ['p8', 2]]);
 const coffee = f.state.orders.find(o => o.id === b)!.lines.find(l => l.productId === 'p8')!;
 f.act('voidItem', {orderId: b, lineId: coffee.id, quantity: 1, reason: 'სტუმარმა გადაიფიქრა'}, true);
 f.act('discount', {orderId: b, amount: 500, reason: 'მუდმივი სტუმარი'}, true);
 f.act('pay', {orderId: b, method: 'card', amount: 5500});
 const c = f.open('table-3', [['p20', 1]]);
 f.act('pay', {orderId: c, method: 'card', amount: 2000});
 const d = f.open('table-9', [['p155', 1]]);
 return {act: f.act, d, get state() { return f.state; }};
}

test('reference day A–D matches the documented totals', () => {
 const f = referenceDay();
 const report = computeDayReport(f.state, DAY);
 assert.deepEqual(report.totals, {
  closedBills: 3, gross: 12200, discounts: 500, net: 11700, voidCount: 1, voidValue: 800,
  payments: {cash: 2000, card: 9700, other: 0, total: 11700}, openBills: 1, openAmount: 1550, averageCheck: 3900,
 });
 assert.equal(report.openBills.length, 1);
 assert.deepEqual(report.openBills[0], {orderId: f.d, tableName: '9', total: 1550, paid: 0, due: 1550, voidCount: 0, voidValue: 0});
});

test('an empty day reports zeros and a zero average', () => {
 const report = computeDayReport(referenceDay().state, '2026-10-20');
 assert.deepEqual(report.totals, {closedBills: 0, gross: 0, discounts: 0, net: 0, voidCount: 0, voidValue: 0, payments: {cash: 0, card: 0, other: 0, total: 0}, openBills: 0, openAmount: 0, averageCheck: 0});
 assert.deepEqual(computeDayReport(seedState(), DAY).totals.averageCheck, 0);
});

test('business day follows Tbilisi midnight, not UTC', () => {
 assert.equal(businessDay('2026-10-21T20:00:00.000Z'), '2026-10-22');
 assert.equal(businessDay('2026-10-22T19:59:59.999Z'), '2026-10-22');
 assert.equal(businessDay('2026-10-22T20:30:00.000Z'), '2026-10-23');
 const f = shop();
 const o = f.open('table-1', [['p20', 1]], '2026-10-22T19:50:00.000Z');
 f.act('pay', {orderId: o, method: 'cash', amount: 2000}, false, '2026-10-22T20:30:00.000Z');
 assert.equal(computeDayReport(f.state, DAY).totals.closedBills, 0);
 assert.equal(computeDayReport(f.state, DAY).totals.payments.cash, 0);
 assert.equal(computeDayReport(f.state, '2026-10-23').totals.closedBills, 1);
 assert.equal(computeDayReport(f.state, '2026-10-23').totals.payments.cash, 2000);
});

test('a partial payment on an open bill counts in payments and reduces the open amount', () => {
 const f = referenceDay();
 f.act('pay', {orderId: f.d, method: 'cash', amount: 500});
 const report = computeDayReport(f.state, DAY);
 assert.equal(report.totals.payments.cash, 2500);
 assert.equal(report.totals.payments.total, 12200);
 assert.equal(report.totals.closedBills, 3);
 assert.equal(report.totals.openAmount, 1050);
 assert.deepEqual(report.openBills.map(b => [b.paid, b.due]), [[500, 1050]]);
});

test('voids on a table released empty count, but the table is not a bill', () => {
 const f = shop();
 f.act('openOrder', {tableId: 'table-4'});
 const orderId = f.state.orders[0].id;
 f.act('addItem', {orderId, productId: 'p8', quantity: 1});
 f.act('voidItem', {orderId, lineId: f.state.orders[0].lines[0].id, quantity: 1, reason: 'შეცდომა'}, true);
 f.act('closeEmptyOrder', {orderId});
 const totals = computeDayReport(f.state, DAY).totals;
 assert.equal(totals.closedBills, 0);
 assert.equal(totals.voidCount, 1);
 assert.equal(totals.voidValue, 800);
 assert.equal(totals.openBills, 0);
});

test('bills opened after the chosen day are not open bills of that day', () => {
 const f = referenceDay();
 assert.equal(computeDayReport(f.state, '2026-10-21').totals.openBills, 0);
 assert.equal(computeDayReport(f.state, '2026-10-23').totals.openBills, 1);
});

test('cashCheck compares counted cash with float plus cash payments', () => {
 assert.deepEqual(cashCheck(10000, 2000, 11850), {expected: 12000, difference: -150, status: 'short'});
 assert.deepEqual(cashCheck(10000, 2000, 12100), {expected: 12000, difference: 100, status: 'over'});
 assert.deepEqual(cashCheck(10000, 2000, 12000), {expected: 12000, difference: 0, status: 'even'});
 assert.deepEqual(cashCheck(10000, 2000, null), {expected: 12000, difference: null, status: null});
 assert.equal(differenceText(-150), '−1.50 დანაკლისი');
 assert.equal(differenceText(100), '+1.00 ზედმეტობა');
 assert.equal(differenceText(0), '0.00 ემთხვევა');
 assert.equal(signedAmount(-12345), '−123.45');
});

test('parseAmount accepts tetri-exact amounts only', () => {
 assert.deepEqual(parseAmount('118.50'), {ok: true, value: 11850});
 assert.deepEqual(parseAmount('118,5'), {ok: true, value: 11850});
 assert.deepEqual(parseAmount(' 120 '), {ok: true, value: 12000});
 assert.deepEqual(parseAmount('0'), {ok: true, value: 0});
 assert.deepEqual(parseAmount(''), {ok: true, value: null});
 assert.deepEqual(parseAmount('   '), {ok: true, value: null});
 for (const bad of ['-5', '1.234', 'abc', '1.', '.5', '1 000', '1234567890'])
  assert.equal(parseAmount(bad).ok, false, bad);
 assert.deepEqual(parseAmount('1000000'), {ok: true, value: 100000000});
 assert.deepEqual(parseAmount('1000000.01'), {ok: false, error: 'თანხა არ უნდა აღემატებოდეს 1 000 000 ₾-ს'});
 assert.equal(parseAmount('999999999').ok, false);
});

test('closeDay stores numbered snapshots without touching orders', () => {
 const f = referenceDay();
 const before = structuredClone(f.state);
 const payload = {pin: '1234', date: DAY, openingFloat: 10000, countedCash: 11850, note: ' სალარო ', closedBy: 'ნინო'};
 f.act('closeDay', payload, true, '2026-10-22T19:00:00.000Z');
 f.act('closeDay', {...payload, closedBy: '', note: undefined}, true, '2026-10-22T19:05:00.000Z');
 for (const key of ['orders', 'tables', 'tickets', 'products', 'inventory'] as const) assert.deepEqual(f.state[key], before[key]);
 const [first, second] = f.state.dayCloses!;
 assert.equal(first.sequence, 1);
 assert.equal(second.sequence, 2);
 assert.equal(first.expectedCash, 12000);
 assert.equal(first.difference, -150);
 assert.equal(first.note, 'სალარო');
 assert.equal(first.closedBy, 'ნინო');
 assert.equal('closedBy' in second, false);
 assert.equal(second.note, '');
 assert.deepEqual(first.totals, computeDayReport(before, DAY).totals);
 assert.match(f.state.audit.at(-1)!.detail, /^2026-10-22: მოსალოდნელი 12000, დათვლილი 11850, სხვაობა -150$/);
 f.act('closeDay', {...payload, date: '2026-10-21'}, true);
 assert.equal(f.state.dayCloses!.at(-1)!.sequence, 1);
});

test('closeDay rejects bad input and non-managers without changes', () => {
 const f = referenceDay();
 const ok = {pin: '1234', date: DAY, openingFloat: 0, countedCash: 2000};
 const rejects = (payload: Record<string, unknown>, manager = true, message?: RegExp) =>
  assert.throws(() => applyAction(f.state, 'closeDay', payload, manager, T), message ?? /./);
 rejects(ok, false, /მენეჯერის კოდი აუცილებელია/);
 rejects({...ok, date: '2026-10-23'}, true, /მომავალი დღის დახურვა შეუძლებელია/);
 rejects({...ok, date: '2026-02-30'}, true, /თარიღი არასწორია/);
 rejects({...ok, date: '22.10.2026'}, true, /თარიღი არასწორია/);
 rejects({...ok, countedCash: -1}, true, /თანხა არასწორია/);
 rejects({...ok, countedCash: 1.5}, true, /თანხა არასწორია/);
 rejects({...ok, openingFloat: '100'}, true, /თანხა არასწორია/);
 rejects({...ok, countedCash: undefined}, true, /თანხა არასწორია/);
 rejects({...ok, note: 'x'.repeat(501)});
 rejects({...ok, closedBy: 'x'.repeat(101)});
 assert.equal(f.state.dayCloses, undefined);
});
