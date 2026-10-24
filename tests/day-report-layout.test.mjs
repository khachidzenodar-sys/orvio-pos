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
const report = evaluate('../lib/day-report.ts', {'./order-totals.ts': evaluate('../lib/order-totals.ts')});
const {dayReportRows} = evaluate('../lib/printing/day-report-layout.ts', {'@/lib/format': format, '@/lib/day-report': report});

// Reference day A–D from docs/DAY_REPORT_AND_FLOOR_PLAN.md.
const TOTALS = {
  closedBills: 3, gross: 12200, discounts: 500, net: 11700, voidCount: 1, voidValue: 800,
  payments: {cash: 2000, card: 9700, other: 0, total: 11700}, openBills: 1, openAmount: 1550, averageCheck: 3900,
};
const PRINTED = '2026-10-22T19:00:00.000Z';
const live = {date: '2026-10-22', printedAt: PRINTED, totals: TOTALS, openingFloat: 10000, expectedCash: 12000};
const closed = {...live, countedCash: 11850, difference: -150, sequence: 1, closedAt: '2026-10-22T19:05:00.000Z', closedBy: 'ნინო', note: 'ხურდა აკლია'};
const right = (rows, text) => rows.find(r => r.text === text)?.right;

test('reference day prints the documented totals and cash reconciliation', () => {
  const rows = dayReportRows(closed);
  const expected = {
    'თარიღი': '2026-10-22', 'დახურული ანგარიშები': '3', 'მთლიანი გაყიდვები': '122.00 ₾', 'ფასდაკლებები': '5.00 ₾',
    'გაუქმებები': '1 ც. / 8.00 ₾', 'წმინდა გაყიდვები': '117.00 ₾', 'ნაღდი': '20.00 ₾', 'ბარათი': '97.00 ₾', 'გადარიცხვა': '0.00 ₾',
    'სულ გადახდები': '117.00 ₾', 'ღია ანგარიშები': '1 / 15.50 ₾', 'საშუალო ჩეკი': '39.00 ₾', 'დილის თანხა სალაროში': '100.00 ₾',
    'მოსალოდნელი ნაღდი': '120.00 ₾', 'დათვლილი': '118.50 ₾', 'სხვაობა': '−1.50 დანაკლისი',
  };
  for (const [label, value] of Object.entries(expected)) assert.equal(right(rows, label), value, label);
  assert.equal(rows[0].text, 'ORVIO');
  assert.equal(rows[2].text, 'დღის დახურვა #1');
  assert.equal(right(rows, 'დაბეჭდილია'), format.when(PRINTED));
  assert.equal(right(rows, 'დახურულია'), format.when(closed.closedAt));
  assert.ok(rows.some(r => r.text === 'დახურა: ნინო'));
  assert.ok(rows.some(r => r.text === 'შენიშვნა: ხურდა აკლია'));
  assert.ok(rows.find(r => r.text === 'სხვაობა').bold);
  assert.ok(rows.find(r => r.text === 'წმინდა გაყიდვები').bold);
  assert.equal(rows.at(-1).text, 'ORVIO · RESTAURANT POS');
  for (const row of rows) if (row.right !== undefined) assert.ok([...row.text].length <= 22, row.text);
});

test('a live report without a saved close shows dashes and no close details', () => {
  const rows = dayReportRows(live);
  assert.equal(right(rows, 'დათვლილი'), '—');
  assert.equal(right(rows, 'სხვაობა'), '—');
  assert.equal(right(rows, 'მოსალოდნელი ნაღდი'), '120.00 ₾');
  assert.equal(right(rows, 'დახურულია'), undefined);
  assert.ok(!rows.some(r => /დახურვა #|დახურა:|შენიშვნა:/.test(r.text ?? '')));
  assert.equal(rows[2].text, 'თარიღი');
});

test('a repeat close is marked in the header', () => {
  const rows = dayReportRows({...closed, sequence: 2, countedCash: 12100, difference: 100, note: '', closedBy: undefined});
  assert.ok(rows.some(r => r.text === 'განმეორებითი დახურვა #2' && r.align === 'center'));
  assert.equal(right(rows, 'სხვაობა'), '+1.00 ზედმეტობა');
  assert.ok(!rows.some(r => /დახურა:|შენიშვნა:/.test(r.text ?? '')));
});
