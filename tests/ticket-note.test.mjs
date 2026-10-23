import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {loadDomain} from './helpers/load-domain.mjs';

function evaluate(path, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', source)(name => {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  }, mod, mod.exports);
  return mod.exports;
}

const domain = loadDomain(evaluate);
const format = evaluate('../lib/format.ts', {'./pos': domain});
const layout = evaluate('../lib/printing/receipt-layout.ts', {'@/lib/pos': domain, '@/lib/format': format});
const NOW = '2026-10-23T12:00:00.000Z';

function order() {
  let state = domain.seedState();
  const act = (action, payload = {}) => { state = domain.applyAction(state, action, payload, false, NOW); return state; };
  act('openOrder', {tableId: 'table-3'});
  const orderId = state.orders[0].id;
  act('addItem', {orderId, productId: 'product-1', quantity: 1});
  act('addItem', {orderId, productId: 'product-5', quantity: 1});
  return {act, orderId, get state() { return state; }};
}

test('a special request goes on every ticket of that send, trimmed, and not on later sends', () => {
  const s = order();
  s.act('sendOrder', {orderId: s.orderId, note: '  ალერგია თხილზე  '});
  assert.equal(s.state.tickets.length, 2);
  assert.ok(s.state.tickets.every(t => t.note === 'ალერგია თხილზე'));
  s.act('addItem', {orderId: s.orderId, productId: 'product-1', quantity: 1});
  s.act('sendOrder', {orderId: s.orderId});
  assert.equal(s.state.tickets.at(-1).note, undefined);
  assert.ok(!('note' in s.state.tickets.at(-1)));
});

test('blank notes are ignored; long or non-text notes are refused without sending', () => {
  const s = order();
  const before = s.state;
  assert.throws(() => s.act('sendOrder', {orderId: s.orderId, note: 'x'.repeat(201)}), /200/);
  assert.throws(() => s.act('sendOrder', {orderId: s.orderId, note: 5}), /შენიშვნა/);
  assert.equal(s.state, before);
  s.act('sendOrder', {orderId: s.orderId, note: '   '});
  assert.ok(s.state.tickets.every(t => !('note' in t)));
});

test('the printed ticket shows the request at the top, above the dishes', () => {
  const s = order();
  s.act('sendOrder', {orderId: s.orderId, note: 'ერთად გამოიტანეთ'});
  const kitchen = s.state.tickets.find(t => t.departmentId === 'kitchen');
  const rows = layout.ticketRows(kitchen, s.state).filter(r => 'text' in r);
  const noteAt = rows.findIndex(r => r.text === '! ერთად გამოიტანეთ');
  const firstDish = rows.findIndex(r => / × /.test(r.text));
  assert.ok(noteAt > 0 && noteAt < firstDish, 'note is printed before the first dish');
  assert.equal(rows[noteAt].bold, true);
  assert.equal(rows[noteAt].size, 'large');
});

test('stored tickets with and without a note pass demo validation; bad notes are rejected', () => {
  const store = evaluate('../lib/demo-store.ts', {'./pos': domain});
  const s = order();
  s.act('sendOrder', {orderId: s.orderId, note: 'უმარილოდ'});
  const doc = {schema: 1, userId: 'u', version: 1, configured: true, state: s.state, pin: '1234', failures: 0, blockedUntil: 0};
  assert.doesNotThrow(() => store.parseDemoDocument(JSON.stringify(doc)));
  const bad = structuredClone(doc); bad.state.tickets[0].note = 'x'.repeat(201);
  assert.throws(() => store.parseDemoDocument(JSON.stringify(bad)));
  const legacy = structuredClone(doc); for (const t of legacy.state.tickets) delete t.note;
  assert.doesNotThrow(() => store.parseDemoDocument(JSON.stringify(legacy)));
});
