import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {parseQuantity, parseMoney, lineTotal, formatQuantity, formatUnitCost, formatPercent, formatMoney, inputUnits} from '../lib/inventory-format.ts';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {money} from '../lib/format.ts';

test('parseQuantity converts kg and l to integer base units without float error', () => {
  assert.equal(parseQuantity('1.250', 'kg'), 1250);
  assert.equal(parseQuantity('1,5', 'l'), 1500);
  assert.equal(parseQuantity('0.001', 'kg'), 1);
  assert.equal(parseQuantity('4.1', 'kg'), 4100);
  assert.equal(parseQuantity(' 2 ', 'kg'), 2000);
  assert.equal(parseQuantity('100000', 'kg'), 100_000_000);
  assert.equal(parseQuantity('250', 'g'), 250);
  assert.equal(parseQuantity('12', 'pcs'), 12);
});

test('parseQuantity rejects invalid input with Georgian messages', () => {
  assert.throws(() => parseQuantity('0.3333', 'kg'), /მაქსიმუმ 3 ათწილადი/);
  assert.throws(() => parseQuantity('2.5', 'g'), /მხოლოდ მთელი რიცხვი/);
  assert.throws(() => parseQuantity('1.5', 'pcs'), /მხოლოდ მთელი რიცხვი/);
  for (const bad of ['-1', 'abc', '', '  ', 'NaN', '.', '1e3', '1.2.3']) assert.throws(() => parseQuantity(bad, 'kg'), /შეიყვანეთ დადებითი რაოდენობა/, bad);
  assert.throws(() => parseQuantity('100000.001', 'kg'), /ზღვარს/);
  assert.throws(() => parseQuantity('100000001', 'g'), /ზღვარს/);
  assert.throws(() => parseQuantity('0', 'g'), /შეიყვანეთ დადებითი რაოდენობა/);
  assert.equal(parseQuantity('0', 'g', true), 0);
  assert.equal(parseQuantity('0.000', 'kg', true), 0);
});

test('parseMoney converts lari text to tetri', () => {
  assert.equal(parseMoney('11.20'), 1120);
  assert.equal(parseMoney('0,4'), 40);
  assert.equal(parseMoney('0'), 0);
  assert.equal(parseMoney('12'), 1200);
  for (const bad of ['1.234', '-1', 'abc', '']) assert.throws(() => parseMoney(bad), /თანხა არასწორია/, bad);
});

test('lineTotal rounds half-up for weight and volume, multiplies pieces', () => {
  assert.equal(lineTotal(1000, 2000, 'g'), 2000);
  assert.equal(lineTotal(40, 3, 'pcs'), 120);
  assert.equal(lineTotal(1200, 3000, 'g'), 3600);
  assert.equal(lineTotal(1, 500, 'ml'), 1);
  assert.equal(lineTotal(1, 499, 'ml'), 0);
});

test('formatting helpers', () => {
  assert.equal(formatQuantity(4500, 'g'), '4.500 კგ');
  assert.equal(formatQuantity(450, 'g'), '450 გ');
  assert.equal(formatQuantity(-200, 'g'), '−200 გ');
  assert.equal(formatQuantity(-1250, 'ml'), '−1.250 ლ');
  assert.equal(formatQuantity(1000, 'ml'), '1.000 ლ');
  assert.equal(formatQuantity(12, 'pcs'), '12 ცალი');
  assert.equal(formatUnitCost(1120, 'g'), '11.20 ₾/კგ');
  assert.equal(formatUnitCost(1800, 'ml'), '18.00 ₾/ლ');
  assert.equal(formatUnitCost(40000, 'pcs'), '0.40 ₾/ცალი');
  assert.equal(formatPercent(400), '40.0%');
  assert.equal(formatPercent(289), '28.9%');
  assert.equal(formatPercent(null), '—');
  for (const n of [0, 5, 1005, 5600, -448, 123456789]) assert.equal(formatMoney(n), money(n));
  assert.deepEqual(inputUnits('g'), ['kg', 'g']);
  assert.deepEqual(inputUnits('ml'), ['l', 'ml']);
  assert.deepEqual(inputUnits('pcs'), ['pcs']);
});
