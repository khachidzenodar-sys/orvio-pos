import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Evaluate the shipped TypeScript with explicit dependencies (type-only imports are erased).
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

const domain = evaluate('../lib/pos.ts', {'./inventory.ts': evaluate('../lib/inventory.ts')});
const format = evaluate('../lib/format.ts', {'./pos': domain});
const layout = evaluate('../lib/printing/receipt-layout.ts', {'@/lib/pos': domain, '@/lib/format': format});
const escpos = evaluate('../lib/printing/escpos.ts');
const {createEscPosPrinter} = evaluate('../lib/adapters/escpos-printer.ts', {
  '@/lib/printing/receipt-layout': layout,
  '@/lib/printing/escpos': escpos,
});

const BITMAP = {width: 8, height: 2, data: Uint8Array.from([0xF0, 0x0F])};

function setup({fail} = {}) {
  const calls = [];
  const rendered = [];
  const rows = new Map();
  const store = {getItem: key => rows.get(key) ?? null, setItem: async (key, value) => { rows.set(key, value); }};
  const invoke = async (cmd, args) => {
    calls.push({cmd, args});
    if (fail) throw fail;
    return cmd === 'list_printers' ? ['XP-80C', 'Microsoft Print to PDF'] : null;
  };
  const render = async r => { rendered.push(r); return BITMAP; };
  return {calls, rendered, rows, printer: createEscPosPrinter({invoke, store, render})};
}

function receiptDoc() {
  let state = domain.seedState();
  state = domain.applyAction(state, 'openOrder', {tableId: 'table-3'}, false);
  const orderId = state.orders[0].id;
  state = domain.applyAction(state, 'addItem', {orderId, productId: 'product-5', quantity: 2}, false);
  return {kind: 'receipt', order: state.orders[0], state};
}

test('without a selected printer, print falls back to the dialog and never calls Rust', async () => {
  const s = setup();
  assert.equal(await s.printer.selected(), null);
  assert.equal(await s.printer.print(receiptDoc()), 'dialog');
  assert.deepEqual(s.calls, []);
  assert.equal(s.rendered.length, 0);
});

test('the selected printer is stored under orvio.printer.v1 and read back; invalid data reads as none', async () => {
  const s = setup();
  await s.printer.select('XP-80C');
  assert.equal(s.rows.get('orvio.printer.v1'), JSON.stringify({name: 'XP-80C'}));
  assert.equal(await s.printer.selected(), 'XP-80C');
  await s.printer.select(null);
  assert.equal(s.rows.get('orvio.printer.v1'), JSON.stringify({name: null}));
  assert.equal(await s.printer.selected(), null);
  s.rows.set('orvio.printer.v1', '{broken');
  assert.equal(await s.printer.selected(), null);
  s.rows.set('orvio.printer.v1', JSON.stringify({name: 42}));
  assert.equal(await s.printer.selected(), null);
  assert.deepEqual(await s.printer.list(), ['XP-80C', 'Microsoft Print to PDF']);
  assert.deepEqual(s.calls.map(c => c.cmd), ['list_printers']);
});

test('print renders the receipt rows and sends the exact ESC/POS job to the selected printer', async () => {
  const s = setup();
  await s.printer.select('XP-80C');
  const doc = receiptDoc();
  assert.equal(await s.printer.print(doc), 'printed');
  assert.deepEqual(s.rendered, [layout.receiptRows(doc.order, doc.state)]);
  assert.deepEqual(s.calls, [{cmd: 'print_raw', args: {printer: 'XP-80C', data: Array.from(escpos.buildPrintJob(BITMAP))}}]);
  assert.ok(Array.isArray(s.calls[0].args.data), 'data is a plain number[] for Tauri');
});

test('a string rejection from Rust surfaces as an Error with the same Georgian message', async () => {
  const s = setup({fail: 'პრინტერი გათიშულია ან მზად არ არის'});
  await s.printer.select('XP-80C');
  await assert.rejects(s.printer.print(receiptDoc()), error => error instanceof Error && error.message === 'პრინტერი გათიშულია ან მზად არ არის');
  await assert.rejects(s.printer.list(), error => error instanceof Error && error.message === 'პრინტერი გათიშულია ან მზად არ არის');
});

test('test print needs a selected printer and then sends the test page', async () => {
  const s = setup();
  await assert.rejects(s.printer.testPrint(), {message: 'ჯერ აირჩიეთ პრინტერი'});
  assert.deepEqual(s.calls, []);
  await s.printer.select('XP-80C');
  await s.printer.testPrint();
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].args.printer, 'XP-80C');
  assert.ok(s.rendered[0].some(row => row.text?.includes('80 მმ')));
});
