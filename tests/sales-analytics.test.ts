import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {applyAction, seedState} from '../lib/pos.ts';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {salesAnalytics} from '../lib/sales-analytics.ts';
import type {PosState} from '../lib/pos';

const open = (s: PosState) => s.orders.find(o => o.status === 'open') as PosState['orders'][number];

// Khachapuri (18 ₾, kitchen) costs 3 ₾ by recipe; americano (6 ₾, bar) has no recipe.
function sold(discountPercent = 0) {
    let s: PosState = seedState();
    s = applyAction(s, 'setFeature', {key: 'waiterCode', on: false}, true);
    s.inventory.items.push({id: 'cheese', name: 'ყველი', unit: 'g', kind: 'ingredient', quantity: 0, value: 0, avgCost: 0});
    s = applyAction(s, 'receiveStock', {lines: [{itemId: 'cheese', quantity: 10000, total: 20000}]}, true);
    s = applyAction(s, 'saveRecipe', {productId: 'product-1', lines: [{itemId: 'cheese', quantity: 150}]}, true);
    s = applyAction(s, 'openOrder', {tableId: 'table-1'});
    s = applyAction(s, 'addItem', {orderId: open(s).id, productId: 'product-1', quantity: 2});
    s = applyAction(s, 'addItem', {orderId: open(s).id, productId: 'product-5', quantity: 1});
    s = applyAction(s, 'sendOrder', {orderId: open(s).id});
    if (discountPercent) s = applyAction(s, 'discount', {orderId: open(s).id, percent: discountPercent, reason: 'x'}, true);
    const o = open(s);
    return applyAction(s, 'pay', {orderId: o.id, method: 'cash', amount: 4200 - Math.round(4200 * discountPercent / 100)});
}

test('departments and dishes get revenue, recipe cost, profit and margin', () => {
    const a = salesAnalytics(sold());
    const kitchen = a.departments.find(r => r.id === 'kitchen')!, bar = a.departments.find(r => r.id === 'bar')!;
    assert.deepEqual([kitchen.revenue, kitchen.cost, kitchen.profit, kitchen.marginPercent], [3600, 600, 3000, 83.3]);
    assert.deepEqual([bar.revenue, bar.cost, bar.profit, bar.uncosted], [600, null, null, 600]);
    const khachapuri = a.products.find(r => r.id === 'product-1')!;
    assert.equal(khachapuri.quantity, 2);
    assert.deepEqual([a.total.revenue, a.total.cost, a.total.profit, a.total.uncosted], [4200, 600, 3000, 600]);
    assert.equal(a.products[0].id, 'product-1', 'dishes are ordered by revenue');
});

test('discounts reduce revenue; open bills and periods outside the filter are left out', () => {
    const a = salesAnalytics(sold(10));
    assert.equal(a.total.revenue, 3780);
    assert.equal(a.departments.find(r => r.id === 'kitchen')!.revenue, 3240);
    assert.equal(salesAnalytics(sold(), () => false).products.length, 0);
    let s: PosState = seedState();
    s = applyAction(s, 'setFeature', {key: 'waiterCode', on: false}, true);
    s = applyAction(s, 'openOrder', {tableId: 'table-1'});
    s = applyAction(s, 'addItem', {orderId: open(s).id, productId: 'product-1', quantity: 1});
    assert.equal(salesAnalytics(s).total.revenue, 0);
});

// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {menuEngineering} from '../lib/sales-analytics.ts';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {salesWorkbook} from '../lib/sales-export.ts';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {buildXlsx} from '../lib/xlsx.ts';

const row = (id: string, quantity: number, profit: number | null, revenue = 1000) => ({id, name: id, quantity, revenue, cost: profit === null ? null : revenue - profit, profit, marginPercent: null, uncosted: profit === null ? revenue : 0});

test('menu engineering sorts dishes into four groups by popularity and profit per portion', () => {
    // 5 dishes, 70 portions: popular from 9.8 portions (70% of 14); profit per portion averages 8800/40 = 220 over costed dishes.
    const m = menuEngineering([row('star', 20, 6000), row('horse', 12, 1200), row('puzzle', 4, 1200), row('dog', 4, 400), row('nofood', 30, null)]);
    const group = Object.fromEntries(m.rows.map(r => [r.id, r.group]));
    assert.deepEqual(group, {star: 'star', horse: 'plowhorse', puzzle: 'puzzle', dog: 'dog', nofood: 'unknown'});
    assert.equal(m.profitLine, 220);
    assert.equal(menuEngineering([row('x', 3, null)]).profitLine, null);
});

test('the Excel export is a valid zip with summary, department and dish sheets', () => {
    const a = salesAnalytics(sold());
    const sheets = salesWorkbook(a, menuEngineering(a.products), '2026-10-01 — 2026-10-24');
    assert.deepEqual(sheets.map((s: {name: string}) => s.name), ['შეჯამება', 'განყოფილებები', 'კერძები']);
    assert.deepEqual(sheets[0].rows[2], ['გაყიდვები (₾)', 42]);
    const bytes = buildXlsx(sheets), text = new TextDecoder().decode(bytes);
    assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
    assert.ok(text.includes('xl/worksheets/sheet3.xml') && text.includes('ხაჭაპური'));
});
