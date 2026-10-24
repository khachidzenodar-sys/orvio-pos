import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {applyAction, seedState} from '../lib/pos.ts';

const NOW = '2026-10-23T12:00:00.000Z';
const act = (s: ReturnType<typeof seedState>, assignments: unknown) => applyAction(s, 'setProductDepartments', {assignments}, false, NOW);

test('dishes can be routed to one or several departments in one save', () => {
  const s = act(seedState(), {'product-5': ['bar'], 'product-1': ['kitchen', 'pastry']});
  assert.deepEqual(s.products.find(p => p.id === 'product-5')!.departmentIds, ['bar']);
  assert.deepEqual(s.products.find(p => p.id === 'product-1')!.departmentIds, ['kitchen', 'pastry']);
});

test('sending an order follows the new routing', () => {
  let s = act(seedState(), {'product-9': ['bar']});
  s = applyAction(s, 'openOrder', {tableId: 'table-1'}, false, NOW);
  const orderId = s.orders[0].id;
  s = applyAction(s, 'addItem', {orderId, productId: 'product-9', quantity: 1}, false, NOW);
  s = applyAction(s, 'sendOrder', {orderId}, false, NOW);
  assert.deepEqual(s.tickets.map(t => t.departmentId), ['bar']);
});

test('a dish never ends up without a department, and bad input changes nothing', () => {
  const base = seedState();
  assert.throws(() => act(base, {'product-1': []}), /ერთი განყოფილება მაინც/);
  assert.throws(() => act(base, {'product-1': ['nowhere']}), /განყოფილება ვერ მოიძებნა/);
  assert.throws(() => act(base, {'missing': ['bar']}), /პროდუქტი ვერ მოიძებნა/);
  assert.throws(() => act(base, {'product-1': ['bar'], 'product-2': []}));
  assert.throws(() => act(base, {}));
  assert.deepEqual(base.products.find(p => p.id === 'product-1')!.departmentIds, ['kitchen']);
});
