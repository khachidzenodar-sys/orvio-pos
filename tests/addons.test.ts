import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {applyAction, seedState, getProductOptions, orderTotals, lineBalances} from '../lib/pos.ts';

const cheese = {id: 'cheese', name: 'დამატებითი ყველი', price: 200};
const sauce = {id: 'sauce', name: 'დამატებითი სოუსი', price: 150};
const notes = ['ხახვის გარეშე', 'სოუსი ცალკე'];

function fixture(routes = ['kitchen'], price = 1800) {
  let state = seedState();
  const act = (action: string, payload: Record<string, unknown> = {}, manager = false) => {
    state = applyAction(state, action, payload, manager, '2026-10-15T18:00:00.000Z');
    return state;
  };
  act('saveProduct', {id: 'options-test', name: 'ტესტის კერძი', category: 'კერძები', price,
    active: true, departmentIds: routes, quickNotes: notes, addons: [cheese, sauce]});
  act('openOrder', {tableId: 'table-1'});
  const orderId = state.orders[0].id;
  return {
    act,
    add: (payload: Record<string, unknown> = {}) => act('addItem', {orderId, productId: 'options-test', quantity: 1, ...payload}),
    save: (payload: Record<string, unknown> = {}) => act('saveProduct', {...state.products.find(p => p.id === 'options-test')!, ...payload}),
    send: () => act('sendOrder', {orderId}),
    orderId,
    get state() {return state;},
    get order() {return state.orders[0];},
  };
}

test('paid add-ons compose a per-unit catalog price and multiply with the dish quantity', () => {
  const f = fixture();
  f.add({quantity: 2, addonIds: ['cheese'], quickNotes: [notes[0]], note: 'ალერგია არაა'});
  const line = f.order.lines[0];
  assert.equal(line.basePrice, 1800);
  assert.equal(line.price, 2000);
  assert.deepEqual(line.addons, [cheese]);
  assert.equal(line.note, 'ხახვის გარეშე; ალერგია არაა');
  assert.equal(orderTotals(f.order).total, 4000);
});

test('selection order is canonical while plain taps, notes and paid variants remain distinct', () => {
  const f = fixture();
  f.add();
  f.add({addonIds: ['sauce', 'cheese'], quickNotes: [...notes].reverse()});
  f.add({addonIds: ['cheese', 'sauce'], quickNotes: notes});
  f.add({addonIds: ['cheese']});
  f.add({quickNotes: [notes[0]]});
  f.add();
  assert.equal(f.order.lines.length, 4);
  assert.deepEqual(f.order.lines.map(l => l.quantity), [2, 2, 1, 1]);
  assert.equal(f.order.lines[1].note, 'ხახვის გარეშე; სოუსი ცალკე');
  assert.deepEqual(f.order.lines[1].addons, [cheese, sauce]);
  assert.equal(orderTotals(f.order).total, 11700);
});

test('addItem ignores forged client prices and snapshots in favor of its product catalog', () => {
  const f = fixture();
  f.add({quantity: 2, addonIds: ['cheese'], price: 1, basePrice: 1,
    addons: [{id: 'cheese', name: 'უფასო ყველი', price: 0}]});
  assert.equal(f.order.lines[0].price, 2000);
  assert.deepEqual(f.order.lines[0].addons, [cheese]);
  assert.equal(orderTotals(f.order).total, 4000);
  f.add({addons: [{id: 'unknown', name: 'ყალბი', price: -100}]});
  assert.equal(f.order.lines[1].price, 1800, 'unselected payload objects must never change price');
  assert.deepEqual(f.order.lines[1].addons, []);
});

test('unknown, duplicate and malformed selections reject without mutating the original state', () => {
  const f = fixture();
  f.add();
  const original = structuredClone(f.state);
  for (const payload of [
    {addonIds: ['unknown']}, {addonIds: ['cheese', 'cheese']}, {addonIds: 'cheese'},
    {addonIds: [7]}, {quickNotes: ['unknown']}, {quickNotes: [notes[0], notes[0]]},
    {quickNotes: 'ხახვის გარეშე'}, {note: {text: 'invalid'}}, {note: 'x'.repeat(501)},
    {quickNotes: [notes[0]], note: 'x'.repeat(490)},
  ]) {
    assert.throws(() => f.add(payload));
    assert.deepEqual(f.state, original);
  }
});

test('catalog edits preserve historical names, base and add-on prices, and department tickets', () => {
  const f = fixture(['kitchen', 'bar']);
  f.add({quantity: 2, addonIds: ['cheese'], quickNotes: [notes[0]]});
  f.send();
  const oldLine = structuredClone(f.order.lines[0]);
  const oldTickets = structuredClone(f.state.tickets);
  f.save({name: 'სხვა სახელით კერძი', price: 2100, departmentIds: ['pastry'],
    quickNotes: ['ახალი შენიშვნა'], addons: [{...cheese, name: 'სხვა ყველი', price: 500}]});
  assert.deepEqual(f.order.lines[0], oldLine);
  assert.deepEqual(f.state.tickets, oldTickets);
  f.add({addonIds: ['cheese'], quickNotes: ['ახალი შენიშვნა']});
  assert.equal(f.order.lines.length, 2);
  assert.equal(f.order.lines[1].price, 2600);
  assert.equal(orderTotals(f.order).total, 6600);
  f.act('voidItem', {orderId: f.orderId, lineId: oldLine.id, quantity: 1, reason: 'შეცდომა'}, true);
  assert.deepEqual(f.state.tickets.slice(2).map(t => t.departmentId).sort(), ['bar', 'kitchen']);
  assert.ok(f.state.tickets.slice(2).every(t => t.type === 'cancel' && t.lines[0].name === oldLine.name
    && t.lines[0].note === oldLine.note && JSON.stringify(t.lines[0].addons) === JSON.stringify([cheese])));
  assert.equal(orderTotals(f.order).total, 4600);
});

test('equal total prices do not merge different base/add-on snapshots', () => {
  const f = fixture();
  f.add({addonIds: ['cheese']});
  f.save({price: 1700, addons: [{...cheese, price: 300}, sauce]});
  f.add({addonIds: ['cheese']});
  f.save({addons: [{...cheese, name: 'შეცვლილი ყველი', price: 300}, sauce]});
  f.add({addonIds: ['cheese']});
  assert.equal(f.order.lines.length, 3);
  assert.deepEqual(f.order.lines.map(l => l.price), [2000, 2000, 2000]);
  assert.deepEqual(f.order.lines.map(l => l.basePrice), [1800, 1700, 1700]);
});

for (const routes of [['kitchen'], ['kitchen', 'bar'], ['kitchen', 'bar', 'pastry']]) {
  test(`modified dish tickets retain add-ons through delta send/cancel for ${routes.length} department(s)`, () => {
    const f = fixture(routes);
    f.add({quantity: 2, addonIds: ['cheese'], quickNotes: [notes[0]]});
    f.send();
    const first = structuredClone(f.state.tickets);
    const lineId = f.order.lines[0].id;
    f.add({quantity: 2, addonIds: ['cheese'], quickNotes: [notes[0]]});
    f.act('voidItem', {orderId: f.orderId, lineId, quantity: 1, reason: 'ზედმეტი'}, true);
    assert.deepEqual(f.state.tickets, first, 'unsent cancellation must not emit a department ticket');
    f.send();
    f.send();
    assert.equal(f.state.tickets.length, routes.length * 2, 'repeat-send must be idempotent');
    assert.ok(f.state.tickets.slice(routes.length).every(t => t.lines[0].quantity === 1));
    f.act('voidItem', {orderId: f.orderId, lineId, quantity: 2, reason: 'სტუმრის თხოვნა'}, true);
    assert.equal(f.state.tickets.length, routes.length * 3);
    assert.ok(f.state.tickets.slice(routes.length * 2).every(t => t.type === 'cancel' && t.lines[0].quantity === 2));
    assert.ok(f.state.tickets.every(t => t.lines[0].note === notes[0] && JSON.stringify(t.lines[0].addons) === JSON.stringify([cheese])));
    assert.deepEqual(f.state.tickets.slice(0, routes.length), first);
    assert.equal(orderTotals(f.order).total, 2000);
  });
}

test('discount, amount-first partial payment and item payments reconcile composed odd-tetri totals', () => {
  const f = fixture(['kitchen'], 101);
  f.save({addons: [{...cheese, price: 50}]});
  f.add({quantity: 3, addonIds: ['cheese']});
  f.add({quantity: 2});
  f.act('discount', {orderId: f.orderId, percent: 17, reason: 'ტესტი'}, true);
  f.send();
  assert.deepEqual(orderTotals(f.order), {subtotal: 655, discount: 111, total: 544, paid: 0, due: 544});
  f.act('pay', {orderId: f.orderId, method: 'cash', amount: 10});
  const modified = f.order.lines[0].id;
  for (let i = 0; i < 3; i++) f.act('pay', {orderId: f.orderId, method: 'card', items: [{lineId: modified, quantity: 1}]});
  const plain = f.order.lines[1].id;
  for (let i = 0; i < 2; i++) f.act('pay', {orderId: f.orderId, method: 'other', items: [{lineId: plain, quantity: 1}]});
  assert.equal(f.order.status, 'closed');
  assert.equal(orderTotals(f.order).paid, 544);
  assert.equal(orderTotals(f.order).due, 0);
  assert.ok(lineBalances(f.order).every(b => b.due === 0));
  assert.ok(f.order.payments.every(p => p.allocations.reduce((sum, a) => sum + a.amount, 0) === p.amount));
});

test('legacy plain lines still group with quick taps and saved option defaults match seed identity only', () => {
  let state = applyAction(seedState(), 'openOrder', {tableId: 'table-1'});
  const orderId = state.orders[0].id;
  state = applyAction(state, 'addItem', {orderId, productId: 'product-1', quantity: 1});
  delete state.orders[0].lines[0].addons;
  delete state.orders[0].lines[0].basePrice;
  state = applyAction(state, 'addItem', {orderId, productId: 'product-1', quantity: 1});
  assert.equal(state.orders[0].lines.length, 1);
  assert.equal(state.orders[0].lines[0].quantity, 2);
  const seed = state.products[0];
  const options = getProductOptions(seed);
  assert.ok(options.quickNotes.length > 0);
  assert.ok(options.addons.length > 0);
  assert.deepEqual(getProductOptions({...seed, name: 'მომხმარებლის კერძი'}), {quickNotes: [], addons: []});
  assert.deepEqual(getProductOptions({...seed, id: 'custom'}), {quickNotes: [], addons: []});
  assert.deepEqual(getProductOptions({...seed, quickNotes: [], addons: []}), {quickNotes: [], addons: []});
  options.addons[0].price = 999;
  assert.notEqual(getProductOptions(seed).addons[0].price, 999, 'option readers must not mutate catalog defaults');
});

test('saving an old-style product edit preserves configured options and explicit empty arrays disable them', () => {
  const f = fixture();
  const product = f.state.products.find(p => p.id === 'options-test')!;
  const {quickNotes: _notes, addons: _addons, ...legacyEdit} = product;
  f.act('saveProduct', {...legacyEdit, price: 1900});
  assert.deepEqual(getProductOptions(f.state.products.find(p => p.id === product.id)!), {quickNotes: notes, addons: [cheese, sauce]});
  f.save({quickNotes: [], addons: []});
  assert.deepEqual(getProductOptions(f.state.products.find(p => p.id === product.id)!), {quickNotes: [], addons: []});
  assert.throws(() => f.add({addonIds: ['cheese']}));
});

test('invalid add-on and quick-note catalog edits reject atomically', () => {
  const f = fixture();
  const before = structuredClone(f.state);
  const edits: Record<string, unknown>[] = [
    {addons: null}, {addons: [null]}, {addons: [{...cheese, id: ''}]}, {addons: [cheese, cheese]},
    {addons: [{...cheese, name: ''}]}, {addons: [{...cheese, price: 0}]},
    {addons: [{...cheese, price: -1}]}, {addons: [{...cheese, price: 1.5}]},
    {addons: [{...cheese, price: Infinity}]}, {addons: [{...cheese, name: 'x'.repeat(101)}]},
    {addons: Array.from({length: 21}, (_, i) => ({...cheese, id: `addon-${i}`}))},
    {quickNotes: null}, {quickNotes: ['']}, {quickNotes: [notes[0], ` ${notes[0]} `]},
    {quickNotes: ['x'.repeat(101)]}, {quickNotes: Array.from({length: 21}, (_, i) => `${i}`)},
  ];
  for (const edit of edits) {
    assert.throws(() => f.save(edit));
    assert.deepEqual(f.state, before);
  }
});
