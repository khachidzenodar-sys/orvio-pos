import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {loadDomain} from './helpers/load-domain.mjs';

// Evaluate the shipped TypeScript with explicit dependencies so the layout is tested as built.
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
const NOW = '2026-10-15T18:00:00.000Z';

function scenario() {
  let state = domain.seedState();
  const act = (action, payload = {}, manager = false) => { state = domain.applyAction(state, action, payload, manager, NOW); return state; };
  act('openOrder', {tableId: 'table-3'});
  const orderId = state.orders[0].id;
  act('addItem', {orderId, productId: 'product-1', quantity: 1, addonIds: ['extra-cheese'], quickNotes: ['კარგად დაბრაწული'], note: 'ცხელი'});
  act('addItem', {orderId, productId: 'product-1', quantity: 2, addonIds: ['extra-cheese'], quickNotes: ['კარგად დაბრაწული'], note: 'ცხელი'});
  act('addItem', {orderId, productId: 'product-5', quantity: 2});
  act('addItem', {orderId, productId: 'product-8', quantity: 1});
  act('discount', {orderId, percent: 10, reason: 'სტუმარი'}, true);
  act('sendOrder', {orderId});
  act('pay', {orderId, method: 'cash', amount: 1000});
  act('pay', {orderId, method: 'card', amount: 500});
  return {act, orderId, get state() { return state; }, get order() { return state.orders[0]; }};
}

const texts = rows => rows.filter(r => 'text' in r).map(r => [r.lead, r.text, r.right].filter(x => x !== undefined).join(' '));
function assertInOrder(lines, expected) {
  let at = -1;
  for (const text of expected) {
    const next = lines.findIndex((line, i) => i > at && line.includes(text));
    assert.ok(next > at, `"${text}" is missing or out of order in:\n${lines.join('\n')}`);
    at = next;
  }
}

test('the customer receipt carries the same content, in the same order, as the printed page', () => {
  const s = scenario();
  s.act('printReceipt', {orderId: s.orderId});
  const totals = domain.orderTotals(s.order);
  const lines = texts(layout.receiptRows(s.order, s.state));
  const khachapuri = s.order.lines.find(l => l.productId === 'product-1');
  const qty = khachapuri.quantity - khachapuri.voidQuantity;
  assertInOrder(lines, [
    'მაგიდა 3',
    `ჩეკი № ${layout.checkNumber(s.order, s.state)}`,
    'სავაჭრო დღე: ',
    'დრო: გახსნა ',
    'შეიყვანა: ',
    'არაფისკალური ანგარიში',
    'ხაჭაპური',
    `${qty} × ${format.money(khachapuri.price)} ${format.money(khachapuri.price * qty)}`,
    'საბაზო ფასი: 18.00 ₾',
    'ფასიანი დანამატი: დამატებითი ყველი +2.00 ₾ / ერთ.',
    'შენიშვნა: კარგად დაბრაწული; ცხელი',
    'ამერიკანო',
    `2 × 6.00 ₾ 12.00 ₾`,
    'წყალი',
    `სულ ${format.money(totals.subtotal)}`,
    `ფასდაკლება ${format.money(totals.discount)}`,
    `ჯამი ${format.money(totals.total)}`,
    `გადახდილია ${format.money(1500)}`,
    `დარჩენილია ${format.money(totals.due)}`,
    'ნაღდი: 10.00 ₾',
    'ბარათი: 5.00 ₾',
    'მადლობა სტუმრობისთვის!',
  ]);
  const footer = layout.receiptRows(s.order, s.state).at(-1);
  assert.deepEqual(footer, {image: '/orvio-mark.svg', caption: 'ORVIO · RESTAURANT POS'}, 'the brand line ends with the ORVIO mark before the text');
  assert.ok(totals.discount > 0 && totals.due > 0);
  assert.ok(!lines.some(l => l.includes('ასლი')), 'the first print is not a copy');

  s.act('printReceipt', {orderId: s.orderId});
  assert.ok(texts(layout.receiptRows(s.order, s.state)).includes(`ჩეკი № ${layout.checkNumber(s.order, s.state)} · ასლი`));
});

test('fully voided lines are left off the receipt', () => {
  const s = scenario();
  const water = s.order.lines.find(l => l.productId === 'product-8');
  const order = {...s.order, lines: s.order.lines.map(l => l === water ? {...l, voidQuantity: l.quantity} : l)};
  assert.ok(!texts(layout.receiptRows(order, s.state)).includes('წყალი'));
});

test('department tickets group lines like the screen and mark reprints as copies', () => {
  const s = scenario();
  const kitchen = s.state.tickets.find(t => t.departmentId === 'kitchen');
  const bar = s.state.tickets.find(t => t.departmentId === 'bar');
  const groups = format.grouped(kitchen.lines);
  const rows = layout.ticketRows(kitchen, s.state);
  const lines = texts(rows);
  assertInOrder(lines, [
    'სამზარეულო',
    'მაგიდა 3',
    'შეკვეთა',
    format.when(kitchen.createdAt),
    ...groups.flatMap(g => [`${g.quantity} × ${g.name}`, ...(g.addons || []).map(a => `ფასიანი დანამატი: ${a.name}`), ...(g.note ? [`შენიშვნა: ${g.note}`] : [])]),
    `#${kitchen.id.slice(0, 8)}`,
  ]);
  const itemRows = rows.filter(r => 'text' in r && r.size === 'large').map(r => r.text);
  assert.deepEqual(itemRows, groups.map(g => `${g.quantity} × ${g.name}`));
  assert.deepEqual(rows.filter(r => r.size === 'huge').map(r => r.text), ['სამზარეულო', 'მაგიდა 3']);
  assert.ok(!lines.some(l => /\d+\.\d\d ₾/.test(l)), 'preparation tickets never show prices');
  assert.ok(texts(layout.ticketRows(bar, s.state)).includes('2 × ამერიკანო'));

  s.act('printTicket', {ticketId: kitchen.id});
  assert.ok(texts(layout.ticketRows(s.state.tickets.find(t => t.id === kitchen.id), s.state)).includes('შეკვეთა'));
  s.act('printTicket', {ticketId: kitchen.id});
  assert.ok(texts(layout.ticketRows(s.state.tickets.find(t => t.id === kitchen.id), s.state)).includes('შეკვეთა · ასლი'));
});

test('cancellation tickets are labelled as such', () => {
  const s = scenario();
  const ticket = {...s.state.tickets[0], type: 'cancel', printCount: 2};
  assert.ok(texts(layout.ticketRows(ticket, s.state)).includes('გაუქმების ჩეკი · ასლი'));
});

test('the test page shows Georgian text, the lari sign and edge markers', () => {
  const now = new Date(NOW);
  const rows = layout.testPageRows(now);
  assertInOrder(texts(rows), ['ORVIO — საცდელი ბეჭდვა', format.when(NOW), 'ქართული ტექსტი: აბგდევზთ', '₾ 12.50', '|< 80 მმ >|']);
  assert.ok(rows.some(r => r.rule));
});

// Labels the browser print page (.printarea in pos-workspace.tsx and the line details in product-options.tsx) renders.
// Right-hand amounts must fit beside the label on one 80 mm line (the renderer wraps only the left text).
const MAX_RIGHT_CHARS = 16;

test('the browser print of the guest check uses the same rows as the thermal printer', () => {
  const ui = fs.readFileSync(new URL('../components/pos-workspace.tsx', import.meta.url), 'utf8');
  assert.match(ui, /doc\.kind==='receipt'\?\{rows:receiptRows\(doc\.order,doc\.state\)\}/);
  const rows = layout.receiptRows(scenario().order, scenario().state);
  for (const row of rows.filter(r => 'right' in r)) assert.ok([...row.right].length <= MAX_RIGHT_CHARS, `"${row.right}" is too wide for the right column`);
});

test('receipt header follows the owner order: logo, table, check number, trading day, time, who', () => {
  const s = scenario();
  const logo = 'data:image/png;base64,iVBORw0KGgo=';
  const state = {...s.state, receipt: {logo}};
  const printedAt = new Date(2026, 9, 23, 16, 58);
  const rows = layout.receiptRows(s.order, state, printedAt);
  assert.deepEqual(rows[0], {image: logo});
  const head = rows.slice(1, 6).map(r => r.text);
  const opened = new Date(s.order.createdAt), pad = n => String(n).padStart(2, '0');
  assert.deepEqual(head, [
    'მაგიდა 3',
    'ჩეკი № 1',
    `სავაჭრო დღე: ${pad(opened.getDate())}/${pad(opened.getMonth() + 1)}/${String(opened.getFullYear()).slice(2)}`,
    `დრო: გახსნა ${pad(opened.getHours())}:${pad(opened.getMinutes())} · დაიბეჭდა 16:58`,
    'შეიყვანა: მოლარე',
  ]);
  assert.ok(!('image' in layout.receiptRows(s.order, s.state)[0]), 'no logo row without a logo');
});

test('check numbers follow the order in which bills were opened', () => {
  const s = scenario();
  s.act('openOrder', {tableId: 'table-5'});
  const second = s.state.orders[1];
  assert.equal(layout.checkNumber(s.state.orders[0], s.state), 1);
  assert.equal(layout.checkNumber(second, s.state), 2);
});

test('the ticket copy marker appears only from the second print, like the UI', () => {
  const s = scenario();
  for (const type of ['order', 'cancel']) {
    const label = type === 'cancel' ? 'გაუქმების ჩეკი' : 'შეკვეთა';
    for (const printCount of [0, 1, 2, 3]) {
      const lines = texts(layout.ticketRows({...s.state.tickets[0], type, printCount}, s.state));
      assert.ok(lines.includes(printCount > 1 ? `${label} · ასლი` : label), `${type} printed ${printCount}x`);
      assert.equal(lines.some(l => l.includes('ასლი')), printCount > 1);
    }
  }
});

test('only the quantity is bold on a dish line; price and total stay regular', () => {
  const s = scenario();
  const rows = layout.receiptRows(s.order, s.state).filter(r => 'lead' in r);
  assert.ok(rows.length >= 3);
  for (const row of rows) { assert.match(row.lead, /^\d+ ×$/); assert.ok(!row.bold); assert.match(row.text, /₾$/); }
});
