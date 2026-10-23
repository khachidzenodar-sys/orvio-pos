import type {Order, PosState, Table, TableLayout, TableShape} from './pos';

// Pure floor-plan rules with type-only dependencies, so tests can evaluate this module on its own.
export const PLAN_WIDTH = 1000;
export const PLAN_HEIGHT = 625;
export const MIN_SEATS = 1;
export const MAX_SEATS = 20;
export const TABLE_SHAPES: readonly TableShape[] = ['round', 'square', 'rectangle'];
export const SHAPE_LABELS: Record<TableShape, string> = {round: 'მრგვალი', square: 'კვადრატული', rectangle: 'მართკუთხა'};
export type TableStatus = 'free' | 'occupied';
export const STATUS_LABELS: Record<TableStatus, string> = {free: 'თავისუფალი', occupied: 'დაკავებული'};
export const CHAIR = 24;
export const GAP = 6;
const MAX_PLAN_TABLES = 200;
const OPEN_ORDER_MESSAGE = 'ჯერ დახურეთ ან გადაიტანეთ მაგიდის შეკვეთა';

type Rect = {left: number; top: number; right: number; bottom: number};

// Up to 24 tables share a fixed 6×4 grid whose cells (166×156) fit a 4-seat footprint (150×150).
export function defaultLayout(index: number, count: number): TableLayout {
    const cols = count <= 24 ? 6 : Math.max(6, Math.ceil(Math.sqrt(count * 1.6)));
    const rows = Math.max(4, Math.ceil(count / cols));
    const col = index % cols, row = Math.floor(index / cols);
    return {seats: 4, shape: 'square', rotation: 0, x: Math.round(PLAN_WIDTH / cols * (col + 0.5)), y: Math.round(PLAN_HEIGHT / rows * (row + 0.5))};
}

export function zoneTables(state: Pick<PosState, 'tables'>, zoneId: string): Table[] {
    return state.tables.filter(t => !t.archived && t.zoneId === zoneId);
}

// Tables without a layout take their default slot, or the next free spot if a saved table already sits there.
export function zoneLayouts(tables: Table[]): {table: Table; layout: TableLayout}[] {
    const taken = tables.flatMap(t => t.layout ? [t.layout] : []);
    return tables.map((table, i) => {
        if (table.layout) return {table, layout: table.layout};
        let layout = defaultLayout(i, tables.length);
        const box = rect(layout);
        if (taken.some(l => overlaps(rect(l), box))) layout = {...layout, ...findFreeSpot(taken, layout)};
        taken.push(layout);
        return {table, layout};
    });
}

export function tableSize(layout: Pick<TableLayout, 'seats' | 'shape'>): {width: number; height: number} {
    const n = layout.seats;
    if (layout.shape === 'round') {
        const d = 70 + 12 * n;
        return {width: d, height: d};
    }
    if (layout.shape === 'square') {
        const side = n <= 2 ? 70 : 40 + 50 * Math.ceil(n / 4);
        return {width: side, height: side};
    }
    return {width: Math.max(100, 50 * Math.ceil(n / 2) + 20), height: 80};
}

export function footprint(layout: TableLayout): {width: number; height: number} {
    const size = tableSize(layout), extra = 2 * (GAP + CHAIR);
    const width = size.width + extra, height = size.height + extra;
    return layout.rotation === 90 ? {width: height, height: width} : {width, height};
}

function clampAxis(value: number, half: number, max: number): number {
    const low = Math.ceil(half), high = Math.floor(max - half);
    if (low > high) return Math.floor(max / 2);
    return Math.min(high, Math.max(low, Math.round(value)));
}

export function clampPosition(layout: TableLayout, x: number, y: number): {x: number; y: number} {
    const size = footprint(layout);
    return {x: clampAxis(x, size.width / 2, PLAN_WIDTH), y: clampAxis(y, size.height / 2, PLAN_HEIGHT)};
}

// Chair centres relative to the table centre before rotation; angle points outward in degrees (0 = right, 90 = down).
export function chairPositions(layout: Pick<TableLayout, 'seats' | 'shape'>): {x: number; y: number; angle: number}[] {
    const n = layout.seats, size = tableSize(layout), offset = GAP + CHAIR / 2;
    const spread = (length: number, i: number, m: number) => -length / 2 + length * (i + 1) / (m + 1);
    if (layout.shape === 'round') {
        const r = size.width / 2 + offset;
        return Array.from({length: n}, (_, k) => {
            const angle = -90 + 360 * k / n, rad = angle * Math.PI / 180;
            return {x: r * Math.cos(rad), y: r * Math.sin(rad), angle};
        });
    }
    if (layout.shape === 'square') {
        const half = size.width / 2 + offset;
        return Array.from({length: n}, (_, k) => {
            const side = k % 4, i = Math.floor(k / 4), m = Math.floor((n - side - 1) / 4) + 1;
            const along = spread(size.width, i, m);
            if (side === 0) return {x: along, y: -half, angle: -90};
            if (side === 1) return {x: half, y: along, angle: 0};
            if (side === 2) return {x: -along, y: half, angle: 90};
            return {x: -half, y: -along, angle: 180};
        });
    }
    const top = Math.ceil(n / 2), bottom = n - top, half = size.height / 2 + offset;
    return [
        ...Array.from({length: top}, (_, i) => ({x: spread(size.width, i, top), y: -half, angle: -90})),
        ...Array.from({length: bottom}, (_, i) => ({x: spread(size.width, i, bottom), y: half, angle: 90})),
    ];
}

// A table is occupied while it has an open order.
// A table turns occupied once something from its order has gone to a department (or been paid).
export function tableStatus(order: Order | undefined): TableStatus {
    return order && (order.payments.length > 0 || order.lines.some(l => l.sentQuantity > 0)) ? 'occupied' : 'free';
}

function rect(layout: TableLayout): Rect {
    const size = footprint(layout);
    return {left: layout.x - size.width / 2, top: layout.y - size.height / 2, right: layout.x + size.width / 2, bottom: layout.y + size.height / 2};
}

function overlaps(a: Rect, b: Rect): boolean {
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

export function findFreeSpot(layouts: TableLayout[], table: Omit<TableLayout, 'x' | 'y'>): {x: number; y: number} {
    const taken = layouts.map(rect), slots = Math.max(24, layouts.length + 1);
    for (let i = 0; i < slots; i++) {
        const slot = defaultLayout(i, slots);
        const spot = clampPosition({...table, x: slot.x, y: slot.y}, slot.x, slot.y);
        const candidate = rect({...table, ...spot});
        if (!taken.some(r => overlaps(r, candidate))) return spot;
    }
    return {x: PLAN_WIDTH / 2, y: Math.floor(PLAN_HEIGHT / 2)};
}

export function nextTableName(tables: Table[]): string {
    const active = tables.filter(t => !t.archived);
    const numbers = active.map(t => t.name.trim()).filter(name => /^\d+$/.test(name)).map(Number);
    return String(numbers.length ? Math.max(...numbers) + 1 : active.length + 1);
}

const LAYOUT_KEYS = new Set(['seats', 'shape', 'x', 'y', 'rotation']);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const intIn = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

function layoutError(value: unknown): string | null {
    if (!isRecord(value) || Object.keys(value).some(k => !LAYOUT_KEYS.has(k))) return 'მაგიდის განლაგება არასწორია';
    if (!intIn(value.seats, MIN_SEATS, MAX_SEATS)) return `ადგილების რაოდენობა უნდა იყოს ${MIN_SEATS}–${MAX_SEATS}`;
    if (!TABLE_SHAPES.includes(value.shape as TableShape)) return 'მაგიდის ფორმა არასწორია';
    if (!intIn(value.x, 0, PLAN_WIDTH) || !intIn(value.y, 0, PLAN_HEIGHT)) return 'მაგიდის მდებარეობა არასწორია';
    if (value.rotation !== 0 && value.rotation !== 90) return 'შემობრუნება უნდა იყოს 0° ან 90°';
    return null;
}

export function isValidTableLayout(value: unknown): value is TableLayout {
    return layoutError(value) === null;
}

export function parseTableLayout(value: unknown): TableLayout {
    const error = layoutError(value);
    if (error) throw new Error(error);
    const v = value as TableLayout;
    return {seats: v.seats, shape: v.shape, x: v.x, y: v.y, rotation: v.rotation};
}

function check(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}

// Validates the whole draft first, then mutates s, so a failure leaves the state untouched.
export function applyFloorPlan(s: PosState, p: Record<string, unknown>, ctx: {newId: () => string}): string {
    const zone = s.zones.find(z => z.id === p.zoneId && !z.archived);
    check(zone, 'ზონა ვერ მოიძებნა');
    check(Array.isArray(p.tables) && p.tables.length <= MAX_PLAN_TABLES, 'მაგიდების სია არასწორია');
    const active = zoneTables(s, zone.id);
    const seen = new Set<string>();
    const drafts = p.tables.map((item: unknown) => {
        check(isRecord(item), 'მაგიდების სია არასწორია');
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        check(name.length >= 1 && name.length <= 40, 'მაგიდის სახელი უნდა შეიცავდეს 1–40 სიმბოლოს');
        const layout = parseTableLayout(item.layout);
        if (item.id === undefined) return {table: undefined, name, layout};
        const table = active.find(t => t.id === item.id);
        check(table, 'მაგიდა ვერ მოიძებნა');
        check(!seen.has(table.id), 'მაგიდა სიაში ორჯერ არის');
        seen.add(table.id);
        return {table, name, layout};
    });
    check(p.removeIds === undefined || Array.isArray(p.removeIds), 'მაგიდების სია არასწორია');
    const removed = ((p.removeIds ?? []) as unknown[]).map(removeId => {
        const table = active.find(t => t.id === removeId);
        check(table, 'მაგიდა ვერ მოიძებნა');
        check(!seen.has(table.id), 'მაგიდა სიაში ორჯერ არის');
        seen.add(table.id);
        check(!s.orders.some(o => o.tableId === table.id && o.status === 'open'), OPEN_ORDER_MESSAGE);
        return table;
    });
    let updated = 0, added = 0;
    for (const draft of drafts) {
        if (draft.table) {
            draft.table.name = draft.name;
            draft.table.layout = draft.layout;
            updated++;
        } else {
            s.tables.push({id: ctx.newId(), name: draft.name, zoneId: zone.id, layout: draft.layout});
            added++;
        }
    }
    for (const table of removed) table.archived = true;
    return `${zone.name}: განახლდა ${updated}, დაემატა ${added}, ამოღებულია ${removed.length}`;
}
