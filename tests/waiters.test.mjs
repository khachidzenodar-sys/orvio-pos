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
const run = (state, action, payload = {}, manager = false) => domain.applyAction(state, action, payload, manager, NOW);
const texts = rows => rows.filter(r => 'text' in r).map(r => r.text);

test('without waiters a table opens as before and the check says the cashier entered it', () => {
  let s = run(domain.seedState(), 'openOrder', {tableId: 'table-1'});
  assert.equal(s.orders[0].waiterName, undefined);
  assert.ok(texts(layout.receiptRows(s.orders[0], s)).includes('შეიყვანა: მოლარე'));
});

test('managers add, edit and remove waiters; codes are unique 4–8 digits', () => {
  let s = domain.seedState();
  assert.throws(() => run(s, 'saveStaff', {name: 'ნინო', code: '1111'}), /მენეჯერის/);
  s = run(s, 'saveStaff', {name: 'ნინო', code: '1111'}, true);
  s = run(s, 'saveStaff', {name: 'გიორგი', code: '2222'}, true);
  assert.throws(() => run(s, 'saveStaff', {name: 'ლუკა', code: '1111'}, true), /სხვა მიმტანს/);
  assert.throws(() => run(s, 'saveStaff', {name: 'ლუკა', code: '12'}, true), /4–8/);
  const nino = s.staff.find(x => x.name === 'ნინო');
  s = run(s, 'saveStaff', {id: nino.id, name: 'ნინო ბ.', code: '3333'}, true);
  assert.equal(s.staff.find(x => x.id === nino.id).name, 'ნინო ბ.');
  s = run(s, 'archiveStaff', {id: nino.id}, true);
  assert.deepEqual(domain.activeStaff(s).map(x => x.name), ['გიორგი']);
  s = run(s, 'saveStaff', {name: 'ლუკა', code: '3333'}, true);
  assert.equal(domain.activeStaff(s).length, 2, "an archived waiter's code can be reused");
});

test("with waiters, a new table needs a valid waiter code and the name goes on the check and tickets", () => {
  let s = run(domain.seedState(), 'saveStaff', {name: 'ნინო', code: '1111'}, true);
  assert.throws(() => run(s, 'openOrder', {tableId: 'table-1'}), /მიმტნის კოდი/);
  assert.throws(() => run(s, 'openOrder', {tableId: 'table-1', waiterPin: '9999'}), /მიმტნის კოდი/);
  s = run(s, 'openOrder', {tableId: 'table-1', waiterPin: '1111'});
  const order = s.orders[0];
  assert.equal(order.waiterName, 'ნინო');
  assert.doesNotThrow(() => run(s, 'openOrder', {tableId: 'table-1'}), 'reopening an occupied table needs no code');
  s = run(s, 'addItem', {orderId: order.id, productId: 'product-1', quantity: 1});
  s = run(s, 'sendOrder', {orderId: order.id});
  assert.ok(texts(layout.receiptRows(s.orders[0], s)).includes('შეიყვანა: ნინო'));
  assert.ok(texts(layout.ticketRows(s.tickets[0], s)).includes('მიმტანი: ნინო'));
});

test('stored waiters and order waiter names are validated; old documents load', () => {
  const store = evaluate('../lib/demo-store.ts', {'./pos': domain});
  const doc = state => JSON.stringify({schema: 1, userId: 'u', version: 1, configured: true, state, pin: '1234', failures: 0, blockedUntil: 0});
  const base = domain.seedState();
  assert.doesNotThrow(() => store.parseDemoDocument(doc(base)));
  assert.doesNotThrow(() => store.parseDemoDocument(doc({...base, staff: [{id: 'a', name: 'ნინო', pin: '1111'}]})));
  assert.throws(() => store.parseDemoDocument(doc({...base, staff: [{id: 'a', name: 'ნინო', pin: 'abcd'}]})));
  for (const file of ['../lib/demo-store.ts', '../app/api/pos/route.ts']) {
    const src = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.ok(src.includes("'saveStaff'") && src.includes("'archiveStaff'"), file);
  }
});
