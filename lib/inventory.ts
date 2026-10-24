import type {Line, Order, PosState} from './pos';

export type StockUnit = 'g' | 'ml' | 'pcs';
export type StockKind = 'ingredient' | 'semi';
export type RecipeLine = {itemId: string; quantity: number};
export type BatchRecipe = {output: number; lines: RecipeLine[]};
// Quantities are integer base units (g, ml, pcs); money is integer tetri.
// avgCost is tetri per 1000 base units, so 11.20 GEL/kg = 1120.
export type StockItem = {
    id: string;
    name: string;
    unit: StockUnit;
    kind: StockKind;
    quantity: number;
    value: number;
    avgCost: number;
    threshold?: number;
    batch?: BatchRecipe;
    archived?: boolean;
};
export type ProductRecipe = {productId: string; lines: RecipeLine[]};
export type MovementType = 'receipt' | 'sale' | 'writeoff' | 'count' | 'production';
export type Movement = {
    id: string;
    at: string;
    type: MovementType;
    group: string;
    itemId: string;
    quantity: number;
    value: number;
    orderId?: string; lineId?: string; tableName?: string; productName?: string;
    reason?: string;
    supplier?: string; note?: string; date?: string;
};
export type Inventory = {
    items: StockItem[];
    recipes: ProductRecipe[];
    movements: Movement[];
    prunedBefore?: string;
};

export const INVENTORY_ACTIONS = ['saveStockItem', 'archiveStockItem', 'saveRecipe', 'saveBatchRecipe', 'receiveStock', 'writeOff', 'stockCount', 'produce'] as const;
export type InventoryAction = typeof INVENTORY_ACTIONS[number];
export const MOVEMENT_LIMIT = 5000;
export const WRITE_OFF_REASONS = ['გაფუჭება', 'დაზიანება', 'პერსონალის კვება', 'სხვა'];
export type InventoryContext = {now: string; newId: () => string};

const UNITS: StockUnit[] = ['g', 'ml', 'pcs'];
const KINDS: StockKind[] = ['ingredient', 'semi'];
const TYPES: MovementType[] = ['receipt', 'sale', 'writeoff', 'count', 'production'];
const UNIT_SHORT: Record<StockUnit, string> = {g: 'გ', ml: 'მლ', pcs: 'ც'};
const LIMIT_ERROR = 'რაოდენობა ან თანხა დასაშვებ ზღვარს აღემატება';
const MAX_QUANTITY = 1e15;

function assert(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}
function safe(value: number) {
    assert(Number.isSafeInteger(value), LIMIT_ERROR);
    return value;
}
// Half-up round of a·b/d for non-negative integers.
function mulDiv(a: number, b: number, d: number) {
    safe(a); safe(b); safe(d);
    if (!d) return 0;
    const den = BigInt(d);
    return safe(Number((BigInt(a) * BigInt(b) * BigInt(2) + den) / (BigInt(2) * den)));
}
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const isDate = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const isDay = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v));

export function emptyInventory(): Inventory {
    return {items: [], recipes: [], movements: []};
}
export function lineCost(quantity: number, avgCost: number): number {
    return quantity < 0 ? 0 - mulDiv(-quantity, avgCost, 1000) : mulDiv(quantity, avgCost, 1000);
}
export function stockValue(item: StockItem): number {
    return item.quantity > 0 ? item.value : 0;
}
export function totalStockValue(inventory: Inventory): number {
    return safe(inventory.items.reduce((sum, item) => item.archived ? sum : sum + stockValue(item), 0));
}
export function recipeCost(lines: RecipeLine[], items: StockItem[]): number {
    return safe(lines.reduce((sum, line) => sum + lineCost(line.quantity, items.find(item => item.id === line.itemId)?.avgCost ?? 0), 0));
}
export function productRecipe(inventory: Inventory, productId: string): RecipeLine[] | undefined {
    return inventory.recipes.find(recipe => recipe.productId === productId)?.lines;
}
export type FoodCostRow = {productId: string; name: string; price: number; cost: number; percentTenths: number | null; margin: number};
export function foodCostReport(state: PosState): {rows: FoodCostRow[]; averageTenths: number | null} {
    const rows: FoodCostRow[] = [];
    for (const product of state.products) {
        const lines = productRecipe(state.inventory, product.id);
        if (!lines) continue;
        const cost = recipeCost(lines, state.inventory.items);
        rows.push({productId: product.id, name: product.name, price: product.price, cost, percentTenths: product.price > 0 ? mulDiv(cost, 1000, product.price) : null, margin: product.price - cost});
    }
    const percents = rows.map(row => row.percentTenths).filter((value): value is number => value !== null);
    return {rows, averageTenths: percents.length ? mulDiv(percents.reduce((a, b) => a + b, 0), 1, percents.length) : null};
}
export function stockAlerts(inventory: Inventory): {low: StockItem[]; negative: StockItem[]; count: number} {
    const active = inventory.items.filter(item => !item.archived);
    const negative = active.filter(item => item.quantity < 0);
    const low = active.filter(item => item.threshold !== undefined && item.quantity >= 0 && item.quantity <= item.threshold);
    return {low, negative, count: low.length + negative.length};
}
export type CountLine = {itemId: string; system: number; counted: number; diff: number; value: number};
// Lists only changed items, matching the movements stockCount would write.
export function countPreview(inventory: Inventory, counts: {itemId: string; quantity: number}[]): {lines: CountLine[]; surplus: number; shortage: number} {
    const lines: CountLine[] = [];
    let surplus = 0, shortage = 0;
    for (const count of counts) {
        const item = inventory.items.find(x => x.id === count.itemId);
        if (!item || count.quantity === item.quantity) continue;
        const diff = safe(count.quantity - item.quantity), value = lineCost(diff, item.avgCost);
        lines.push({itemId: item.id, system: item.quantity, counted: count.quantity, diff, value});
        if (value > 0) surplus += value;
        else shortage -= value;
    }
    return {lines, surplus: safe(surplus), shortage: safe(shortage)};
}

function hasCycle(items: StockItem[]) {
    const state = new Map<string, 1 | 2>();
    const visit = (item: StockItem): boolean => {
        const seen = state.get(item.id);
        if (seen) return seen === 1;
        state.set(item.id, 1);
        for (const line of item.batch?.lines ?? []) {
            const next = items.find(x => x.id === line.itemId);
            if (next && visit(next)) return true;
        }
        state.set(item.id, 2);
        return false;
    };
    return items.some(visit);
}
export function isValidInventory(value: unknown, productIds: string[]): value is Inventory {
    if (!isRecord(value) || !Array.isArray(value.items) || !Array.isArray(value.recipes) || !Array.isArray(value.movements)) return false;
    if (value.prunedBefore !== undefined && !isDate(value.prunedBefore)) return false;
    const items: unknown[] = value.items, recipes: unknown[] = value.recipes, movements: unknown[] = value.movements;
    const ids = new Set<string>(), names = new Set<string>();
    for (const item of items) {
        if (!isRecord(item) || typeof item.id !== 'string' || ids.has(item.id)) return false;
        if (typeof item.name !== 'string' || item.name !== item.name.trim() || !item.name.length || item.name.length > 100 || names.has(item.name.toLowerCase())) return false;
        ids.add(item.id);
        names.add(item.name.toLowerCase());
    }
    const validLines = (lines: unknown) => Array.isArray(lines) && lines.length >= 1 && lines.length <= 50
        && lines.every(line => isRecord(line) && typeof line.itemId === 'string' && ids.has(line.itemId) && isInt(line.quantity, 1, 1e6))
        && new Set(lines.map(line => (line as RecipeLine).itemId)).size === lines.length;
    const validItem = (item: Record<string, unknown>) => UNITS.includes(item.unit as StockUnit) && KINDS.includes(item.kind as StockKind)
        && isInt(item.quantity, -MAX_QUANTITY, MAX_QUANTITY) && isInt(item.value, 0, Number.MAX_SAFE_INTEGER) && isInt(item.avgCost, 0, Number.MAX_SAFE_INTEGER)
        && (item.quantity > 0 || item.value === 0)
        && (item.threshold === undefined || isInt(item.threshold, 0, Number.MAX_SAFE_INTEGER))
        && (item.archived === undefined || typeof item.archived === 'boolean')
        && (item.batch === undefined || (item.kind === 'semi' && isRecord(item.batch) && isInt(item.batch.output, 1, 1e8) && validLines(item.batch.lines)));
    if (!items.every(item => validItem(item as Record<string, unknown>)) || hasCycle(items as StockItem[])) return false;
    const products = new Set(productIds), recipeProducts = new Set<string>();
    for (const recipe of recipes) {
        if (!isRecord(recipe) || typeof recipe.productId !== 'string' || !products.has(recipe.productId) || recipeProducts.has(recipe.productId) || !validLines(recipe.lines)) return false;
        recipeProducts.add(recipe.productId);
    }
    const optional = ['orderId', 'lineId', 'tableName', 'productName', 'reason', 'supplier', 'note', 'date'];
    return movements.length <= MOVEMENT_LIMIT && movements.every(m => isRecord(m) && typeof m.id === 'string' && typeof m.group === 'string' && isDate(m.at)
        && TYPES.includes(m.type as MovementType) && typeof m.itemId === 'string' && ids.has(m.itemId)
        && isInt(m.quantity, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) && m.quantity !== 0 && isInt(m.value, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
        && optional.every(key => m[key] === undefined || typeof m[key] === 'string') && (m.date === undefined || isDay(m.date)));
}

function settle(item: StockItem) {
    assert(Math.abs(safe(item.quantity)) <= MAX_QUANTITY, LIMIT_ERROR);
    safe(item.value);
}
function inflow(item: StockItem, quantity: number, total: number) {
    if (item.quantity > 0) {
        item.quantity = safe(item.quantity + quantity);
        item.value = safe(item.value + total);
        item.avgCost = mulDiv(item.value, 1000, item.quantity);
    } else {
        item.avgCost = mulDiv(total, 1000, quantity);
        item.quantity = safe(item.quantity + quantity);
        item.value = item.quantity > 0 ? lineCost(item.quantity, item.avgCost) : 0;
    }
    settle(item);
}
// Returns the cost of the outflow; avgCost never changes.
function outflow(item: StockItem, quantity: number) {
    const amount = item.quantity > 0 && quantity >= item.quantity
        ? safe(item.value + lineCost(quantity - item.quantity, item.avgCost))
        : lineCost(quantity, item.avgCost);
    item.quantity = safe(item.quantity - quantity);
    item.value = item.quantity > 0 ? Math.max(0, item.value - amount) : 0;
    settle(item);
    return amount;
}
function record(inv: Inventory, ctx: InventoryContext, group: string, item: StockItem, type: MovementType, quantity: number, value: number, extra: Partial<Movement> = {}) {
    inv.movements.push({id: ctx.newId(), at: ctx.now, type, group, itemId: item.id, quantity, value, ...extra});
}
function produceBatches(inv: Inventory, ctx: InventoryContext, semi: StockItem, batches: number, group: string) {
    const batch = semi.batch;
    assert(batch, 'ნახევარფაბრიკატს რეცეპტი არ აქვს');
    let total = 0;
    for (const line of batch.lines) {
        const item = inv.items.find(x => x.id === line.itemId);
        assert(item, 'პოზიცია ვერ მოიძებნა');
        const quantity = safe(line.quantity * batches), amount = outflow(item, quantity);
        total = safe(total + amount);
        record(inv, ctx, group, item, 'production', 0 - quantity, 0 - amount);
    }
    const output = safe(batch.output * batches);
    inflow(semi, output, total);
    record(inv, ctx, group, semi, 'production', output, total);
    return output;
}
function prune(inv: Inventory) {
    if (inv.movements.length <= MOVEMENT_LIMIT) return;
    const dropped = inv.movements.splice(0, inv.movements.length - MOVEMENT_LIMIT);
    inv.prunedBefore = dropped[dropped.length - 1].at;
}

function text(value: unknown, message: string, max: number) {
    assert(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, message);
    return value.trim();
}
function optionalText(value: unknown, message: string) {
    if (value === undefined || value === null) return undefined;
    assert(typeof value === 'string' && value.trim().length <= 200, message);
    return value.trim() || undefined;
}
function int(value: unknown, min: number, max: number, message: string) {
    assert(isInt(value, min, max), message);
    return value;
}
function findItem(inv: Inventory, id: unknown, allowArchived = false) {
    const item = inv.items.find(x => x.id === id);
    assert(item, 'პოზიცია ვერ მოიძებნა');
    assert(allowArchived || !item.archived, `${item.name}: პოზიცია ამოღებულია`);
    return item;
}
function recipeLines(inv: Inventory, value: unknown): RecipeLine[] {
    assert(Array.isArray(value), 'კალკულაციის ხაზები არასწორია');
    assert(value.length <= 50, 'კალკულაციაში მაქსიმუმ 50 ხაზია');
    const lines = value.map(raw => {
        assert(isRecord(raw), 'კალკულაციის ხაზები არასწორია');
        const item = findItem(inv, raw.itemId);
        return {itemId: item.id, quantity: int(raw.quantity, 1, 1e6, 'კალკულაციის რაოდენობა უნდა იყოს 1–1 000 000')};
    });
    assert(new Set(lines.map(line => line.itemId)).size === lines.length, 'პოზიცია კალკულაციაში მეორდება');
    return lines;
}
const usedInRecipes = (inv: Inventory, itemId: string, activeBatchesOnly: boolean) =>
    inv.recipes.some(recipe => recipe.lines.some(line => line.itemId === itemId))
    || inv.items.some(item => item.id !== itemId && !(activeBatchesOnly && item.archived) && !!item.batch?.lines.some(line => line.itemId === itemId));
const qtyText = (item: StockItem, quantity: number) => `${quantity} ${UNIT_SHORT[item.unit]}`;

// Mutates s.inventory of an already cloned state; returns the audit detail.
export function applyInventoryAction(s: PosState, action: InventoryAction, p: Record<string, unknown>, ctx: InventoryContext): string {
    const inv = s.inventory;
    let detail: string;
    switch (action) {
        case 'saveStockItem': {
            const name = text(p.name, 'მიუთითეთ სახელი (1–100 სიმბოლო)', 100);
            assert(UNITS.includes(p.unit as StockUnit), 'ერთეული არასწორია');
            assert(KINDS.includes(p.kind as StockKind), 'ტიპი არასწორია');
            const unit = p.unit as StockUnit, kind = p.kind as StockKind;
            const existing = p.id === undefined || p.id === null ? undefined : findItem(inv, p.id);
            assert(!inv.items.some(item => item !== existing && item.name.trim().toLowerCase() === name.toLowerCase()), 'ასეთი სახელით პოზიცია უკვე არსებობს');
            assert(p.threshold === undefined || p.threshold === null || isInt(p.threshold, 0, 1e8), 'მინიმალური ნაშთი არასწორია');
            if (existing) {
                assert(existing.kind === kind, 'პოზიციის ტიპის შეცვლა შეუძლებელია');
                const used = existing.quantity !== 0 || inv.movements.some(m => m.itemId === existing.id) || usedInRecipes(inv, existing.id, false);
                assert(existing.unit === unit || !used, 'ერთეულის შეცვლა შეუძლებელია: პოზიციას აქვს მოძრაობა ან გამოიყენება კალკულაციაში');
                existing.name = name;
                existing.unit = unit;
                if (p.threshold === null) delete existing.threshold;
                else if (p.threshold !== undefined) existing.threshold = p.threshold as number;
                detail = `${name}: პოზიცია შეიცვალა`;
            } else {
                const item: StockItem = {id: ctx.newId(), name, unit, kind, quantity: 0, value: 0, avgCost: 0};
                if (typeof p.threshold === 'number') item.threshold = p.threshold;
                inv.items.push(item);
                detail = `${name}: პოზიცია დაემატა`;
            }
            break;
        }
        case 'archiveStockItem': {
            assert(typeof p.archived === 'boolean', 'მოქმედება არასწორია');
            const item = findItem(inv, p.id, true);
            if (p.archived) {
                assert(!usedInRecipes(inv, item.id, true), 'ჯერ ამოიღეთ კალკულაციებიდან');
                item.archived = true;
            } else {
                // A restored semi must not produce from archived ingredients.
                const archived = (item.batch?.lines ?? []).map(line => inv.items.find(x => x.id === line.itemId)).find(x => x?.archived);
                assert(!archived, `ჯერ დააბრუნეთ რეცეპტის პოზიცია: ${archived?.name}`);
                delete item.archived;
            }
            detail = `${item.name}: ${p.archived ? 'ამოღებულია' : 'დაბრუნდა'}`;
            break;
        }
        case 'saveRecipe': {
            const product = s.products.find(x => x.id === p.productId);
            assert(product, 'პროდუქტი ვერ მოიძებნა');
            const lines = recipeLines(inv, p.lines);
            inv.recipes = inv.recipes.filter(recipe => recipe.productId !== product.id);
            if (lines.length) inv.recipes.push({productId: product.id, lines});
            detail = `${product.name}: ${lines.length ? 'კალკულაცია შენახულია' : 'კალკულაცია წაიშალა'}`;
            break;
        }
        case 'saveBatchRecipe': {
            const item = findItem(inv, p.itemId);
            assert(item.kind === 'semi', 'რეცეპტი მხოლოდ ნახევარფაბრიკატს აქვს');
            const lines = recipeLines(inv, p.lines);
            if (!lines.length) {
                delete item.batch;
                detail = `${item.name}: რეცეპტი წაიშალა`;
                break;
            }
            const output = int(p.output, 1, 1e8, 'გამოსავალი არასწორია');
            assert(lines.every(line => line.itemId !== item.id), 'ნახევარფაბრიკატი თავის თავს ვერ შეიცავს');
            item.batch = {output, lines};
            assert(!hasCycle(inv.items), 'რეცეპტი ციკლურია: ნახევარფაბრიკატები ერთმანეთს შეიცავს');
            detail = `${item.name}: რეცეპტი შენახულია`;
            break;
        }
        case 'receiveStock': {
            assert(Array.isArray(p.lines) && p.lines.length >= 1 && p.lines.length <= 100, 'მიღებაში უნდა იყოს 1–100 ხაზი');
            assert(p.date === undefined || p.date === null || p.date === '' || isDay(p.date), 'თარიღი არასწორია');
            const date = typeof p.date === 'string' && p.date ? p.date : undefined;
            const supplier = optionalText(p.supplier, 'მომწოდებელი — მაქსიმუმ 200 სიმბოლო');
            const note = optionalText(p.note, 'შენიშვნა — მაქსიმუმ 200 სიმბოლო');
            const extra: Partial<Movement> = {...(supplier ? {supplier} : {}), ...(note ? {note} : {}), ...(date ? {date} : {})};
            const group = ctx.newId();
            let sum = 0;
            for (const raw of p.lines) {
                assert(isRecord(raw), 'მიღების ხაზი არასწორია');
                const item = findItem(inv, raw.itemId);
                const quantity = int(raw.quantity, 1, 1e8, 'რაოდენობა არასწორია');
                const total = int(raw.total, 0, 1e10, 'თანხა არასწორია');
                inflow(item, quantity, total);
                record(inv, ctx, group, item, 'receipt', quantity, total, extra);
                sum = safe(sum + total);
            }
            detail = `მიღება: ${p.lines.length} ხაზი, ${sum} თეთრი${supplier ? `; ${supplier}` : ''}`;
            break;
        }
        case 'writeOff': {
            const item = findItem(inv, p.itemId, true);
            const quantity = int(p.quantity, 1, 1e8, 'რაოდენობა არასწორია');
            const reason = text(p.reason, 'მიუთითეთ ჩამოწერის მიზეზი (1–200 სიმბოლო)', 200);
            const cost = outflow(item, quantity);
            record(inv, ctx, ctx.newId(), item, 'writeoff', 0 - quantity, 0 - cost, {reason});
            detail = `${item.name} × ${qtyText(item, quantity)}; ${reason}`;
            break;
        }
        case 'stockCount': {
            assert(Array.isArray(p.counts) && p.counts.length >= 1, 'მიუთითეთ დათვლილი რაოდენობა');
            const counts = p.counts.map(raw => {
                assert(isRecord(raw), 'ინვენტარიზაციის ხაზი არასწორია');
                return {item: findItem(inv, raw.itemId, true), quantity: int(raw.quantity, 0, 1e8, 'რაოდენობა არასწორია')};
            });
            assert(new Set(counts.map(x => x.item.id)).size === counts.length, 'პოზიცია ინვენტარიზაციაში მეორდება');
            const group = ctx.newId();
            let changed = 0;
            for (const {item, quantity} of counts) {
                const diff = safe(quantity - item.quantity);
                if (!diff) continue;
                item.quantity = quantity;
                item.value = quantity > 0 ? lineCost(quantity, item.avgCost) : 0;
                settle(item);
                record(inv, ctx, group, item, 'count', diff, lineCost(diff, item.avgCost));
                changed++;
            }
            detail = `ინვენტარიზაცია: ${counts.length} პოზიცია, სხვაობა ${changed}`;
            break;
        }
        case 'produce': {
            const item = findItem(inv, p.itemId);
            assert(item.kind === 'semi', 'წარმოება მხოლოდ ნახევარფაბრიკატზეა');
            const batches = int(p.batches, 1, 1000, 'პარტიების რაოდენობა უნდა იყოს 1–1000');
            const output = produceBatches(inv, ctx, item, batches, ctx.newId());
            detail = `${item.name}: ${batches} პარტია, ${qtyText(item, output)}`;
            break;
        }
        default: throw new Error('უცნობი მოქმედება');
    }
    prune(inv);
    return detail;
}

// Sale deduction never blocks: stock may go negative.
export function consumeSale(s: PosState, order: Order, sent: {line: Line; quantity: number}[], ctx: InventoryContext): void {
    const inv = s.inventory;
    const tableName = s.tables.find(t => t.id === order.tableId)?.name || order.tableId;
    let group: string | undefined;
    for (const {line, quantity} of sent) {
        if (quantity <= 0) continue;
        for (const recipeLine of productRecipe(inv, line.productId) ?? []) {
            const item = inv.items.find(x => x.id === recipeLine.itemId);
            if (!item) continue;
            const used = safe(recipeLine.quantity * quantity), cost = outflow(item, used);
            group ??= ctx.newId();
            record(inv, ctx, group, item, 'sale', 0 - used, 0 - cost, {orderId: order.id, lineId: line.id, tableName, productName: line.name});
        }
    }
    prune(inv);
}

const SEED_ITEMS: [string, string, StockUnit, number, number, number][] = [
    ['stock-flour', 'ფქვილი', 'g', 10000, 2000, 2000],
    ['stock-cheese', 'იმერული ყველი', 'g', 5000, 8000, 1000],
    ['stock-egg', 'კვერცხი', 'pcs', 60, 2400, 12],
    ['stock-butter', 'კარაქი', 'g', 2000, 4000, 500],
    ['stock-chicken', 'ქათმის ფილე', 'g', 4000, 5600, 1000],
    ['stock-lettuce', 'სალათის ფოთოლი', 'g', 2000, 1600, 500],
    ['stock-parmesan', 'პარმეზანი', 'g', 1000, 4500, 200],
    ['stock-oil', 'ზეითუნის ზეთი', 'ml', 3000, 5400, 500],
    ['stock-garlic', 'ნიორი', 'g', 1000, 800, 100],
    ['stock-water', 'წყალი 0.5ლ', 'pcs', 48, 2880, 12],
];
const lines = (pairs: [string, number][]): RecipeLine[] => pairs.map(([itemId, quantity]) => ({itemId: `stock-${itemId}`, quantity}));

// Demo stock built through the same inflow/production code as real actions.
export function seedInventory(ctx: InventoryContext): Inventory {
    const inv = emptyInventory();
    const group = ctx.newId();
    for (const [id, name, unit, quantity, total, threshold] of SEED_ITEMS) {
        const item: StockItem = {id, name, unit, kind: 'ingredient', quantity: 0, value: 0, avgCost: 0, threshold};
        inv.items.push(item);
        inflow(item, quantity, total);
        record(inv, ctx, group, item, 'receipt', quantity, total);
    }
    const sauce: StockItem = {id: 'stock-caesar-sauce', name: 'ცეზარის სოუსი', unit: 'g', kind: 'semi', quantity: 0, value: 0, avgCost: 0, threshold: 300,
        batch: {output: 500, lines: lines([['egg', 2], ['oil', 300], ['parmesan', 50], ['garlic', 10]])}};
    inv.items.push(sauce);
    produceBatches(inv, ctx, sauce, 2, ctx.newId());
    inv.recipes.push(
        {productId: 'product-1', lines: lines([['flour', 200], ['cheese', 250], ['egg', 1], ['butter', 20]])},
        {productId: 'product-2', lines: lines([['chicken', 150], ['lettuce', 100], ['parmesan', 20], ['caesar-sauce', 40]])},
        {productId: 'product-8', lines: lines([['water', 1]])},
    );
    return inv;
}
