import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {applyInventoryAction, consumeSale, countPreview, emptyInventory, foodCostReport, isValidInventory, lineCost, MOVEMENT_LIMIT, recipeCost, seedInventory, stockAlerts, totalStockValue} from '../lib/inventory.ts';
import type {Inventory, InventoryAction, StockItem} from '../lib/inventory';
import type {PosState} from '../lib/pos';

const NOW = '2026-10-18T10:00:00.000Z';
function context() {
    let n = 0;
    return {now: NOW, newId: () => `id-${++n}`};
}
function item(id: string, extra: Partial<StockItem> = {}): StockItem {
    return {id, name: id, unit: 'g', kind: 'ingredient', quantity: 0, value: 0, avgCost: 0, ...extra};
}
function state(items: StockItem[] = [], extra: Partial<Inventory> = {}): PosState {
    return {
        departments: [{id: 'kitchen', name: 'სამზარეულო'}], zones: [{id: 'hall', name: 'დარბაზი'}],
        tables: [{id: 'table-1', name: '1', zoneId: 'hall'}],
        products: [{id: 'product-1', name: 'ხაჭაპური', category: 'კერძები', price: 1200, departmentIds: ['kitchen'], active: true},
            {id: 'product-2', name: 'უფასო', category: 'კერძები', price: 0, departmentIds: ['kitchen'], active: true}],
        orders: [], tickets: [], audit: [],
        inventory: {...emptyInventory(), items, ...extra},
    };
}
const ctx = context();
function act(s: PosState, action: InventoryAction, p: Record<string, unknown>) {
    const next = structuredClone(s);
    applyInventoryAction(next, action, p, ctx);
    return next;
}
const get = (s: PosState, id: string) => s.inventory.items.find((x: StockItem) => x.id === id) as StockItem;
const pick = ({quantity, value, avgCost}: StockItem) => ({quantity, value, avgCost});
const valid = (s: PosState) => isValidInventory(s.inventory, s.products.map(p => p.id));

test('weighted average receipts match the design examples', () => {
    let s = act(state([item('flour')]), 'receiveStock', {lines: [{itemId: 'flour', quantity: 2000, total: 2000}]});
    assert.deepEqual(pick(get(s, 'flour')), {quantity: 2000, value: 2000, avgCost: 1000});
    s = act(s, 'receiveStock', {lines: [{itemId: 'flour', quantity: 3000, total: 3600}]});
    assert.deepEqual(pick(get(s, 'flour')), {quantity: 5000, value: 5600, avgCost: 1120});
    const negative = act(state([item('flour', {quantity: -200, avgCost: 900})]), 'receiveStock', {lines: [{itemId: 'flour', quantity: 1000, total: 1200}]});
    assert.deepEqual(pick(get(negative, 'flour')), {quantity: 800, value: 960, avgCost: 1200});
    const stillNegative = act(state([item('flour', {quantity: -1500, avgCost: 900})]), 'receiveStock', {lines: [{itemId: 'flour', quantity: 1000, total: 1200}]});
    assert.deepEqual(pick(get(stillNegative, 'flour')), {quantity: -500, value: 0, avgCost: 1200});
    assert.ok(valid(s) && valid(negative) && valid(stillNegative));
});

test('write-off and count are valued at the average cost', () => {
    const base = state([item('cheese', {quantity: 5000, value: 5600, avgCost: 1120})]);
    const written = act(base, 'writeOff', {itemId: 'cheese', quantity: 500, reason: 'გაფუჭება'});
    assert.deepEqual(pick(get(written, 'cheese')), {quantity: 4500, value: 5040, avgCost: 1120});
    assert.deepEqual(written.inventory.movements.map(({type, quantity, value, reason}: Record<string, unknown>) => ({type, quantity, value, reason})), [{type: 'writeoff', quantity: -500, value: -560, reason: 'გაფუჭება'}]);
    const counted = act(base, 'stockCount', {counts: [{itemId: 'cheese', quantity: 4600}]});
    assert.deepEqual(pick(get(counted, 'cheese')), {quantity: 4600, value: 5152, avgCost: 1120});
    assert.equal(counted.inventory.movements[0].quantity, -400);
    assert.equal(counted.inventory.movements[0].value, -448);
    assert.deepEqual(countPreview(base.inventory, [{itemId: 'cheese', quantity: 4600}]), {lines: [{itemId: 'cheese', system: 5000, counted: 4600, diff: -400, value: -448}], surplus: 0, shortage: 448});
});

test('write-off beyond stock goes negative with the full remaining value', () => {
    const s = act(state([item('cheese', {quantity: 300, value: 500, avgCost: 1600})]), 'writeOff', {itemId: 'cheese', quantity: 500, reason: 'სხვა'});
    assert.deepEqual(pick(get(s, 'cheese')), {quantity: -200, value: 0, avgCost: 1600});
    assert.equal(s.inventory.movements[0].value, -(500 + 320));
    assert.ok(valid(s));
});

test('counting to zero and surplus on negative stock', () => {
    const zero = act(state([item('a', {quantity: 1000, value: 1120, avgCost: 1120})]), 'stockCount', {counts: [{itemId: 'a', quantity: 0}]});
    assert.deepEqual(pick(get(zero, 'a')), {quantity: 0, value: 0, avgCost: 1120});
    assert.equal(zero.inventory.movements[0].value, -1120);
    const surplus = act(state([item('a', {quantity: -200, avgCost: 1000})]), 'stockCount', {counts: [{itemId: 'a', quantity: 300}]});
    assert.deepEqual(pick(get(surplus, 'a')), {quantity: 300, value: 300, avgCost: 1000});
    assert.equal(surplus.inventory.movements[0].quantity, 500);
    assert.equal(surplus.inventory.movements[0].value, 500);
    const unchanged = act(state([item('a', {quantity: 10, value: 10, avgCost: 1000}), item('b')]), 'stockCount', {counts: [{itemId: 'a', quantity: 10}, {itemId: 'b', quantity: 5}]});
    assert.equal(unchanged.inventory.movements.length, 1);
    assert.throws(() => act(state([item('a')]), 'stockCount', {counts: [{itemId: 'a', quantity: 1}, {itemId: 'a', quantity: 2}]}), /მეორდება/);
    assert.throws(() => act(state([item('a')]), 'stockCount', {counts: [{itemId: 'a', quantity: -1}]}), /რაოდენობა/);
});

test('recipe cost and food cost percent', () => {
    const items = [item('flour', {avgCost: 200}), item('cheese', {avgCost: 1600}), item('egg', {unit: 'pcs', avgCost: 40000})];
    const lines = [{itemId: 'flour', quantity: 200}, {itemId: 'cheese', quantity: 250}, {itemId: 'egg', quantity: 1}];
    assert.equal(recipeCost(lines, items), 480);
    const s = state(items, {recipes: [{productId: 'product-1', lines}, {productId: 'product-2', lines: [{itemId: 'egg', quantity: 1}]}]});
    assert.deepEqual(foodCostReport(s), {rows: [
        {productId: 'product-1', name: 'ხაჭაპური', price: 1200, cost: 480, percentTenths: 400, margin: 720},
        {productId: 'product-2', name: 'უფასო', price: 0, cost: 40, percentTenths: null, margin: -40},
    ], averageTenths: 400});
    assert.deepEqual(foodCostReport(state(items)), {rows: [], averageTenths: null});
    assert.equal(lineCost(-3, 333), -1);
    assert.ok(Object.is(lineCost(0, 1000), 0) && Object.is(lineCost(-0, 1000), 0));
});

test('production consumes ingredients and adds the semi-finished item at consumed value', () => {
    const items = [item('tomato', {quantity: 5000, value: 1500, avgCost: 300}), item('garlic', {quantity: 50, value: 40, avgCost: 800}), item('sauce', {kind: 'semi'})];
    let s = act(state(items), 'saveBatchRecipe', {itemId: 'sauce', output: 1000, lines: [{itemId: 'tomato', quantity: 600}, {itemId: 'garlic', quantity: 50}]});
    s = act(s, 'produce', {itemId: 'sauce', batches: 2});
    const moves = s.inventory.movements.map(({type, itemId, quantity, value}: Record<string, unknown>) => ({type, itemId, quantity, value}));
    assert.deepEqual(moves, [
        {type: 'production', itemId: 'tomato', quantity: -1200, value: -360},
        {type: 'production', itemId: 'garlic', quantity: -100, value: -80},
        {type: 'production', itemId: 'sauce', quantity: 2000, value: 440},
    ]);
    assert.equal(new Set(s.inventory.movements.map((m: {group: string}) => m.group)).size, 1);
    assert.deepEqual(pick(get(s, 'sauce')), {quantity: 2000, value: 440, avgCost: 220});
    assert.deepEqual(pick(get(s, 'garlic')), {quantity: -50, value: 0, avgCost: 800});
    assert.ok(valid(s));
    assert.throws(() => act(s, 'produce', {itemId: 'tomato', batches: 1}), /ნახევარფაბრიკატ/);
    assert.throws(() => act(s, 'produce', {itemId: 'sauce', batches: 1001}), /1–1000/);
    assert.throws(() => act(state([item('x', {kind: 'semi'})]), 'produce', {itemId: 'x', batches: 1}), /რეცეპტი არ აქვს/);
});

test('batch recipes reject self references and cycles', () => {
    const s = state([item('a', {kind: 'semi'}), item('b', {kind: 'semi', batch: {output: 100, lines: [{itemId: 'a', quantity: 10}]}}), item('c')]);
    assert.throws(() => act(s, 'saveBatchRecipe', {itemId: 'a', output: 100, lines: [{itemId: 'a', quantity: 1}]}), /თავის თავს/);
    assert.throws(() => act(s, 'saveBatchRecipe', {itemId: 'a', output: 100, lines: [{itemId: 'b', quantity: 1}]}), /ციკლური/);
    assert.throws(() => act(s, 'saveBatchRecipe', {itemId: 'c', output: 100, lines: [{itemId: 'a', quantity: 1}]}), /ნახევარფაბრიკატს/);
    const cleared = act(s, 'saveBatchRecipe', {itemId: 'b', lines: []});
    assert.equal(get(cleared, 'b').batch, undefined);
    assert.equal(isValidInventory({...s.inventory, items: [item('a', {kind: 'semi', batch: {output: 1, lines: [{itemId: 'b', quantity: 1}]}}), get(s, 'b')]}, []), false);
});

test('stock items: unique names, immutable kind, guarded unit, archive rules', () => {
    let s = act(state([item('flour', {name: 'ფქვილი'})]), 'saveStockItem', {name: '  ყველი ', unit: 'g', kind: 'ingredient', threshold: 100});
    const cheese = s.inventory.items[1];
    assert.deepEqual({name: cheese.name, quantity: cheese.quantity, value: cheese.value, avgCost: cheese.avgCost, threshold: cheese.threshold}, {name: 'ყველი', quantity: 0, value: 0, avgCost: 0, threshold: 100});
    assert.throws(() => act(s, 'saveStockItem', {name: 'ფქვილი', unit: 'g', kind: 'ingredient'}), /უკვე არსებობს/);
    assert.throws(() => act(s, 'saveStockItem', {id: cheese.id, name: 'ყველი', unit: 'g', kind: 'semi'}), /ტიპის/);
    s = act(s, 'saveStockItem', {id: cheese.id, name: 'ყველი', unit: 'pcs', kind: 'ingredient', threshold: null});
    assert.equal(get(s, cheese.id).unit, 'pcs');
    assert.equal(get(s, cheese.id).threshold, undefined);
    s = act(s, 'receiveStock', {lines: [{itemId: 'flour', quantity: 10, total: 10}]});
    assert.throws(() => act(s, 'saveStockItem', {id: 'flour', name: 'ფქვილი', unit: 'ml', kind: 'ingredient'}), /ერთეულის/);
    s = act(s, 'saveRecipe', {productId: 'product-1', lines: [{itemId: cheese.id, quantity: 1}]});
    assert.throws(() => act(s, 'saveStockItem', {id: cheese.id, name: 'ყველი', unit: 'g', kind: 'ingredient'}), /ერთეულის/);
    assert.throws(() => act(s, 'archiveStockItem', {id: cheese.id, archived: true}), /ჯერ ამოიღეთ კალკულაციებიდან/);
    s = act(s, 'archiveStockItem', {id: 'flour', archived: true});
    assert.equal(get(s, 'flour').archived, true);
    assert.throws(() => act(s, 'saveStockItem', {id: 'flour', name: 'ფქვილი', unit: 'g', kind: 'ingredient'}), /ამოღებულია/);
    assert.throws(() => act(s, 'receiveStock', {lines: [{itemId: 'flour', quantity: 1, total: 1}]}), /ამოღებულია/);
    assert.throws(() => act(s, 'saveRecipe', {productId: 'product-2', lines: [{itemId: 'flour', quantity: 1}]}), /ამოღებულია/);
    const written = act(s, 'writeOff', {itemId: 'flour', quantity: 5, reason: 'დაზიანება'});
    assert.equal(get(written, 'flour').quantity, 5);
    const counted = act(s, 'stockCount', {counts: [{itemId: 'flour', quantity: 0}]});
    assert.equal(get(counted, 'flour').quantity, 0);
    s = act(s, 'archiveStockItem', {id: 'flour', archived: false});
    assert.equal(get(s, 'flour').archived, undefined);
    const semi = state([item('a'), item('b', {kind: 'semi', archived: true, batch: {output: 1, lines: [{itemId: 'a', quantity: 1}]}}), item('c', {kind: 'semi', batch: {output: 1, lines: [{itemId: 'a', quantity: 1}]}})]);
    assert.throws(() => act(semi, 'archiveStockItem', {id: 'a', archived: true}), /ჯერ ამოიღეთ/);
    assert.equal(get(act({...semi, inventory: {...semi.inventory, items: semi.inventory.items.slice(0, 2)}}, 'archiveStockItem', {id: 'a', archived: true}), 'a').archived, true);
});

test('product recipes validate lines and empty lines delete the recipe', () => {
    const s = state([item('a'), item('b')]);
    assert.throws(() => act(s, 'saveRecipe', {productId: 'missing', lines: []}), /პროდუქტი/);
    assert.throws(() => act(s, 'saveRecipe', {productId: 'product-1', lines: [{itemId: 'a', quantity: 1}, {itemId: 'a', quantity: 2}]}), /მეორდება/);
    assert.throws(() => act(s, 'saveRecipe', {productId: 'product-1', lines: [{itemId: 'a', quantity: 0}]}), /1–1 000 000/);
    assert.throws(() => act(s, 'saveRecipe', {productId: 'product-1', lines: [{itemId: 'a', quantity: 1000001}]}), /1–1 000 000/);
    assert.throws(() => act(s, 'saveRecipe', {productId: 'product-1', lines: [{itemId: 'zzz', quantity: 1}]}), /ვერ მოიძებნა/);
    assert.throws(() => act(state(Array.from({length: 51}, (_, i) => item(`i${i}`))), 'saveRecipe', {productId: 'product-1', lines: Array.from({length: 51}, (_, i) => ({itemId: `i${i}`, quantity: 1}))}), /50/);
    let next = act(s, 'saveRecipe', {productId: 'product-1', lines: [{itemId: 'a', quantity: 5}]});
    next = act(next, 'saveRecipe', {productId: 'product-1', lines: [{itemId: 'b', quantity: 7}]});
    assert.deepEqual(next.inventory.recipes, [{productId: 'product-1', lines: [{itemId: 'b', quantity: 7}]}]);
    assert.deepEqual(act(next, 'saveRecipe', {productId: 'product-1', lines: []}).inventory.recipes, []);
});

test('receipt validates every line and writes one movement per line with a shared group', () => {
    const s = state([item('a'), item('b')]);
    const next = act(s, 'receiveStock', {date: '2026-10-17', supplier: ' შპს ფერმა ', note: '', lines: [{itemId: 'a', quantity: 100, total: 250}, {itemId: 'b', quantity: 1, total: 0}]});
    assert.equal(next.inventory.movements.length, 2);
    assert.deepEqual(next.inventory.movements.map(({type, supplier, date, note}: Record<string, unknown>) => ({type, supplier, date, note})), [
        {type: 'receipt', supplier: 'შპს ფერმა', date: '2026-10-17', note: undefined}, {type: 'receipt', supplier: 'შპს ფერმა', date: '2026-10-17', note: undefined}]);
    assert.equal(next.inventory.movements[0].group, next.inventory.movements[1].group);
    assert.ok(!('note' in next.inventory.movements[0]));
    for (const lines of [[], [{itemId: 'a', quantity: 0, total: 1}], [{itemId: 'a', quantity: 1, total: -1}], [{itemId: 'a', quantity: 1e8 + 1, total: 1}], [{itemId: 'a', quantity: 1, total: 1e10 + 1}], [{itemId: 'a', quantity: 1.5, total: 1}], Array.from({length: 101}, () => ({itemId: 'a', quantity: 1, total: 1}))])
        assert.throws(() => act(s, 'receiveStock', {lines}));
    assert.throws(() => act(s, 'receiveStock', {date: '17.10.2026', lines: [{itemId: 'a', quantity: 1, total: 1}]}), /თარიღი/);
    // A failing later line leaves the first line unapplied on the original state.
    const original = structuredClone(s);
    assert.throws(() => act(s, 'receiveStock', {lines: [{itemId: 'a', quantity: 10, total: 10}, {itemId: 'missing', quantity: 1, total: 1}]}));
    assert.deepEqual(s, original);
    assert.throws(() => act(s, 'writeOff', {itemId: 'a', quantity: 1, reason: '  '}), /მიზეზი/);
    assert.throws(() => act(s, 'writeOff', {itemId: 'a', quantity: 1, reason: 'x'.repeat(201)}), /მიზეზი/);
});

test('safe-integer overflow is rejected with the limit error', () => {
    const s = state([item('a', {quantity: 1e15, value: 1, avgCost: 1})]);
    assert.throws(() => act(s, 'receiveStock', {lines: [{itemId: 'a', quantity: 1e8, total: 1}]}), /დასაშვებ ზღვარს აღემატება/);
    assert.throws(() => lineCost(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), /დასაშვებ ზღვარს აღემატება/);
});

test('sale consumption follows recipes, never throws on missing stock and shares a group', () => {
    const s = state([item('cheese', {quantity: 300, value: 480, avgCost: 1600}), item('flour', {avgCost: 200})], {recipes: [{productId: 'product-1', lines: [{itemId: 'cheese', quantity: 150}, {itemId: 'flour', quantity: 200}]}]});
    const order = {id: 'o1', tableId: 'table-1', status: 'open' as const, createdAt: NOW, lines: [], discountPercent: 0, payments: []};
    const line = (id: string, productId: string, name: string) => ({id, productId, name, price: 1200, quantity: 3, departmentIds: ['kitchen'], note: '', sentQuantity: 0, voidQuantity: 0});
    consumeSale(s, order, [{line: line('l1', 'product-1', 'ხაჭაპური'), quantity: 3}, {line: line('l2', 'product-2', 'უფასო'), quantity: 2}, {line: line('l3', 'product-1', 'ხაჭაპური'), quantity: 0}], ctx);
    assert.deepEqual(pick(get(s, 'cheese')), {quantity: -150, value: 0, avgCost: 1600});
    assert.deepEqual(pick(get(s, 'flour')), {quantity: -600, value: 0, avgCost: 200});
    assert.deepEqual(s.inventory.movements.map(({type, itemId, quantity, value, orderId, lineId, tableName, productName}: Record<string, unknown>) => ({type, itemId, quantity, value, orderId, lineId, tableName, productName})), [
        {type: 'sale', itemId: 'cheese', quantity: -450, value: -720, orderId: 'o1', lineId: 'l1', tableName: '1', productName: 'ხაჭაპური'},
        {type: 'sale', itemId: 'flour', quantity: -600, value: -120, orderId: 'o1', lineId: 'l1', tableName: '1', productName: 'ხაჭაპური'},
    ]);
    assert.equal(s.inventory.movements[0].group, s.inventory.movements[1].group);
    assert.ok(valid(s));
});

test('movement history is pruned to the limit without touching stock', () => {
    const movements = Array.from({length: MOVEMENT_LIMIT}, (_, i) => ({id: `m${i}`, at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(), type: 'receipt', group: 'g', itemId: 'a', quantity: 1, value: 1}));
    const s = state([item('a', {quantity: 5000, value: 5000, avgCost: 1000})], {movements: movements as Inventory['movements']});
    assert.ok(valid(s));
    const next = act(s, 'writeOff', {itemId: 'a', quantity: 1, reason: 'სხვა'});
    assert.equal(next.inventory.movements.length, MOVEMENT_LIMIT);
    assert.equal(next.inventory.movements[0].id, 'm1');
    assert.equal(next.inventory.prunedBefore, movements[0].at);
    assert.equal(get(next, 'a').quantity, 4999);
    assert.ok(valid(next));
    assert.equal(isValidInventory({...s.inventory, movements: [...movements, movements[0]]}, ['product-1']), false);
});

test('stock alerts and total value cover active items only', () => {
    const inv = {...emptyInventory(), items: [
        item('neg', {quantity: -1}), item('low', {quantity: 10, value: 10, threshold: 10}), item('ok', {quantity: 11, value: 50, threshold: 10}),
        item('zero', {threshold: 0}), item('archived', {quantity: -5, archived: true}), item('stocked-archived', {quantity: 1, value: 99, archived: true}),
    ]};
    const alerts = stockAlerts(inv);
    assert.deepEqual(alerts.negative.map((x: StockItem) => x.id), ['neg']);
    assert.deepEqual(alerts.low.map((x: StockItem) => x.id), ['low', 'zero']);
    assert.equal(alerts.count, 3);
    assert.equal(totalStockValue(inv), 60);
});

test('isValidInventory rejects every malformed field', () => {
    const good = state([item('a', {quantity: 10, value: 10, avgCost: 1000, threshold: 5}), item('s', {kind: 'semi', batch: {output: 10, lines: [{itemId: 'a', quantity: 1}]}})],
        {recipes: [{productId: 'product-1', lines: [{itemId: 'a', quantity: 2}]}],
            movements: [{id: 'm', at: NOW, type: 'receipt', group: 'g', itemId: 'a', quantity: 10, value: 10, date: '2026-10-18', supplier: 'x'}]}).inventory;
    assert.equal(isValidInventory(good, ['product-1']), true);
    assert.equal(isValidInventory(emptyInventory(), []), true);
    const mutate = (fn: (inv: Record<string, any>) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const copy = structuredClone(good);
        fn(copy);
        return isValidInventory(copy, ['product-1']);
    };
    const bad: ((inv: Record<string, any>) => void)[] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
        inv => { inv.items = null; }, inv => { delete inv.recipes; }, inv => { inv.movements = {}; }, inv => { inv.prunedBefore = 'yesterday'; },
        inv => { inv.items[1].id = 'a'; }, inv => { inv.items[0].name = ' a'; }, inv => { inv.items[0].name = ''; }, inv => { inv.items[0].name = 'x'.repeat(101); },
        inv => { inv.items[1].name = 'A'; }, inv => { inv.items[0].unit = 'kg'; }, inv => { inv.items[0].kind = 'raw'; }, inv => { inv.items[0].quantity = 1.5; },
        inv => { inv.items[0].quantity = 1e15 + 1; }, inv => { inv.items[0].value = -1; }, inv => { inv.items[0].avgCost = '1'; }, inv => { inv.items[0].quantity = 0; },
        inv => { inv.items[0].threshold = -1; }, inv => { inv.items[0].archived = 'yes'; }, inv => { inv.items[0].batch = {output: 1, lines: [{itemId: 's', quantity: 1}]}; },
        inv => { inv.items[1].batch.output = 0; }, inv => { inv.items[1].batch.lines = []; }, inv => { inv.items[1].batch.lines[0].itemId = 'missing'; },
        inv => { inv.items[1].batch.lines.push({itemId: 'a', quantity: 3}); }, inv => { inv.items[1].batch.lines = [{itemId: 's', quantity: 1}]; },
        inv => { inv.recipes[0].productId = 'product-9'; }, inv => { inv.recipes.push(structuredClone(inv.recipes[0])); }, inv => { inv.recipes[0].lines = []; },
        inv => { inv.recipes[0].lines[0].quantity = 1e6 + 1; }, inv => { inv.recipes[0].lines[0].quantity = 0; }, inv => { inv.recipes[0].lines = Array.from({length: 51}, () => ({itemId: 'a', quantity: 1})); },
        inv => { inv.movements[0].type = 'gift'; }, inv => { inv.movements[0].itemId = 'missing'; }, inv => { inv.movements[0].quantity = 0; }, inv => { inv.movements[0].value = 0.5; },
        inv => { inv.movements[0].at = 'now'; }, inv => { inv.movements[0].group = 1; }, inv => { inv.movements[0].date = '2026/10/18'; }, inv => { inv.movements[0].reason = 5; },
        inv => { inv.movements[0] = null; },
    ];
    bad.forEach((fn, index) => assert.equal(mutate(fn), false, `case ${index}`));
    assert.equal(isValidInventory(null, []), false);
    assert.equal(isValidInventory([], []), false);
});

test('seed inventory has the documented costs and valid structure', () => {
    const inv = seedInventory(context());
    const s = {...state(), products: [1, 2, 8].map(n => ({id: `product-${n}`, name: `p${n}`, category: 'c', price: {1: 1800, 2: 2400, 8: 400}[n] as number, departmentIds: ['kitchen'], active: true})), inventory: inv};
    assert.ok(valid(s));
    const sauce = inv.items.find((x: StockItem) => x.id === 'stock-caesar-sauce') as StockItem;
    assert.deepEqual(pick(sauce), {quantity: 1000, value: 1706, avgCost: 1706});
    assert.equal(sauce.threshold, 300);
    assert.deepEqual(foodCostReport(s).rows.map(({productId, cost, percentTenths, margin}: Record<string, unknown>) => ({productId, cost, percentTenths, margin})), [
        {productId: 'product-1', cost: 520, percentTenths: 289, margin: 1280},
        {productId: 'product-2', cost: 448, percentTenths: 187, margin: 1952},
        {productId: 'product-8', cost: 60, percentTenths: 150, margin: 340},
    ]);
    const avg = Object.fromEntries(inv.items.map((x: StockItem) => [x.id, x.avgCost]));
    assert.deepEqual(avg, {'stock-flour': 200, 'stock-cheese': 1600, 'stock-egg': 40000, 'stock-butter': 2000, 'stock-chicken': 1400, 'stock-lettuce': 800, 'stock-parmesan': 4500, 'stock-oil': 1800, 'stock-garlic': 800, 'stock-water': 60000, 'stock-caesar-sauce': 1706});
    assert.equal(get({...s}, 'stock-egg').quantity, 56);
    assert.ok(inv.movements.every((m: {at: string}) => m.at === NOW));
    assert.deepEqual(seedInventory({now: NOW, newId: () => 'x'}).items, seedInventory({now: NOW, newId: () => 'y'}).items);
});

test('edge cases: prune boundary, zero-total receipts, archived counts and archive through archived semis', () => {
    // Exactly MOVEMENT_LIMIT entries are kept without a prune marker.
    const movements = Array.from({length: MOVEMENT_LIMIT - 1}, (_, i) => ({id: `m${i}`, at: NOW, type: 'receipt', group: 'g', itemId: 'a', quantity: 1, value: 1}));
    const full = act(state([item('a', {quantity: 10, value: 10, avgCost: 1000})], {movements: movements as Inventory['movements']}), 'writeOff', {itemId: 'a', quantity: 1, reason: 'სხვა'});
    assert.equal(full.inventory.movements.length, MOVEMENT_LIMIT);
    assert.equal(full.inventory.prunedBefore, undefined);
    assert.ok(valid(full));
    const over = act(full, 'writeOff', {itemId: 'a', quantity: 1, reason: 'სხვა'});
    assert.equal(over.inventory.movements.length, MOVEMENT_LIMIT);
    assert.equal(over.inventory.prunedBefore, NOW);
    assert.ok(valid(over));

    // A free receipt (total 0) into empty stock gives avg 0; into positive stock it dilutes the average.
    let s = act(state([item('a'), item('b', {quantity: 1000, value: 1000, avgCost: 1000})]), 'receiveStock', {lines: [{itemId: 'a', quantity: 500, total: 0}, {itemId: 'b', quantity: 1000, total: 0}]});
    assert.deepEqual(pick(get(s, 'a')), {quantity: 500, value: 0, avgCost: 0});
    assert.deepEqual(pick(get(s, 'b')), {quantity: 2000, value: 1000, avgCost: 500});
    assert.deepEqual(s.inventory.movements.map((m: {value: number}) => m.value), [0, 0]);
    assert.ok(valid(s));

    // Counting an archived item is allowed and revalues at its average.
    s = act(state([item('c', {quantity: 100, value: 120, avgCost: 1200, archived: true})]), 'stockCount', {counts: [{itemId: 'c', quantity: 150}]});
    assert.deepEqual(pick(get(s, 'c')), {quantity: 150, value: 180, avgCost: 1200});
    assert.equal(s.inventory.movements.at(-1)?.value, 60);

    // An ingredient used only by an archived semi can be archived; the semi then cannot be restored until it is.
    s = state([item('x'), item('dough', {kind: 'semi', archived: true, batch: {output: 100, lines: [{itemId: 'x', quantity: 50}]}})]);
    s = act(s, 'archiveStockItem', {id: 'x', archived: true});
    assert.equal(get(s, 'x').archived, true);
    assert.throws(() => act(s, 'archiveStockItem', {id: 'dough', archived: false}), /ჯერ დააბრუნეთ რეცეპტის პოზიცია: x/);
    assert.throws(() => act(s, 'produce', {itemId: 'dough', batches: 1}), /ამოღებულია/);
    s = act(act(s, 'archiveStockItem', {id: 'x', archived: false}), 'archiveStockItem', {id: 'dough', archived: false});
    s = act(s, 'produce', {itemId: 'dough', batches: 1});
    assert.equal(get(s, 'dough').quantity, 100);
    assert.equal(get(s, 'x').quantity, -50);
    assert.ok(valid(s));
});

test('overflow guards reject before any change', () => {
    const near = state([item('a', {quantity: -1e15}), item('s', {kind: 'semi', batch: {output: 1e8, lines: [{itemId: 'a', quantity: 1}]}, quantity: 1e15 - 1, value: 1, avgCost: 0})]);
    const original = structuredClone(near);
    assert.throws(() => act(near, 'writeOff', {itemId: 'a', quantity: 1, reason: 'სხვა'}), /დასაშვებ ზღვარს აღემატება/);
    assert.throws(() => act(near, 'produce', {itemId: 's', batches: 1}), /დასაშვებ ზღვარს აღემატება/);
    assert.throws(() => act(near, 'receiveStock', {lines: [{itemId: 'a', quantity: 1, total: 1e10}, {itemId: 's', quantity: 1e8, total: 1}]}), /დასაშვებ ზღვარს აღემატება/);
    assert.deepEqual(near, original);
    assert.ok(valid(near));
});
