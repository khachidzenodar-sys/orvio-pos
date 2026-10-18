// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {applyInventoryAction, consumeSale, emptyInventory, isValidInventory, seedInventory, INVENTORY_ACTIONS, type Inventory, type InventoryAction} from './inventory.ts';
export {emptyInventory, isValidInventory, INVENTORY_ACTIONS};
export type {Inventory};
export type Department = {
    archived?: boolean;
    id: string;
    name: string;
};
export type Zone = Department;
export type Table = Department & {
    zoneId: string;
};
// Prices throughout the POS are integer tetri, including each add-on snapshot.
export type Addon = {
    id: string;
    name: string;
    price: number;
};
export type Product = {
    id: string;
    name: string;
    category: string;
    price: number;
    departmentIds: string[];
    active: boolean;
    quickNotes?: string[];
    addons?: Addon[];
};
export type Line = {
    id: string;
    productId: string;
    name: string;
    price: number;
    basePrice?: number;
    addons?: Addon[];
    quantity: number;
    departmentIds: string[];
    note: string;
    sentQuantity: number;
    voidQuantity: number;
};
export type Payment = {
    id: string;
    method: 'cash' | 'card' | 'other';
    amount: number;
    createdAt: string;
    allocations: {
        lineId: string;
        amount: number;
    }[];
};
export type Order = {
    id: string;
    tableId: string;
    status: 'open' | 'closed';
    createdAt: string;
    closedAt?: string;
    lines: Line[];
    discountPercent: number;
    discountAmount?: number;
    receiptPrintCount?: number;
    payments: Payment[];
};
export type Ticket = {
    id: string;
    orderId: string;
    tableId: string;
    tableName: string;
    departmentId: string;
    type: 'order' | 'cancel';
    createdAt: string;
    lines: {
        lineId: string;
        name: string;
        quantity: number;
        note: string;
        addons?: Addon[];
    }[];
    printCount: number;
};
export type Audit = {
    id: string;
    at: string;
    action: string;
    detail: string;
};
export type PosState = {
    departments: Department[];
    zones: Zone[];
    tables: Table[];
    products: Product[];
    orders: Order[];
    tickets: Ticket[];
    audit: Audit[];
    inventory: Inventory;
};
const id = () => crypto.randomUUID();
const seedOptions: Record<string, {name: string; quickNotes: string[]; addons: Addon[]}> = {
    'product-1': {name: 'ხაჭაპური', quickNotes: ['კარგად დაბრაწული', 'დაჭრის გარეშე'], addons: [{id: 'extra-cheese', name: 'დამატებითი ყველი', price: 200}]},
    'product-2': {name: 'ცეზარი ქათმით', quickNotes: ['სოუსი ცალკე', 'კრუტონების გარეშე', 'ხახვის გარეშე'], addons: [{id: 'extra-chicken', name: 'დამატებითი ქათამი', price: 400}, {id: 'extra-cheese', name: 'დამატებითი ყველი', price: 200}]},
    'product-3': {name: 'პასტა ალფრედო', quickNotes: ['პილპილის გარეშე', 'სოუსი ცალკე'], addons: [{id: 'extra-cheese', name: 'დამატებითი ყველი', price: 200}]},
    'product-4': {name: 'კარტოფილი ფრი', quickNotes: ['მარილის გარეშე', 'სოუსი ცალკე'], addons: [{id: 'extra-sauce', name: 'დამატებითი სოუსი', price: 150}]},
    'product-5': {name: 'ამერიკანო', quickNotes: ['შაქარი ცალკე', 'უშაქროდ'], addons: [{id: 'milk', name: 'რძე', price: 200}]},
    'product-6': {name: 'კაპუჩინო', quickNotes: ['შაქარი ცალკე', 'უშაქროდ'], addons: []},
    'product-7': {name: 'ასკილის ლიმონათი', quickNotes: ['ყინულის გარეშე', 'ყინული ცალკე'], addons: []},
    'product-8': {name: 'წყალი', quickNotes: ['ცივი', 'ოთახის ტემპერატურის'], addons: []},
    'product-9': {name: 'ჩიზქეიქი', quickNotes: ['სოუსი ცალკე'], addons: []},
    'product-10': {name: 'კრუასანი', quickNotes: ['შეთბობით', 'შეთბობის გარეშე'], addons: []},
};
// Old demo documents gain examples lazily, without replacing any saved orders.
// Matching both ID and name prevents examples leaking into custom products.
// Explicit empty arrays let a manager remove the examples permanently.
export function getProductOptions(product: Product): {quickNotes: string[]; addons: Addon[]} {
    const defaults = seedOptions[product.id]?.name === product.name ? seedOptions[product.id] : undefined;
    return {
        quickNotes: [...(product.quickNotes ?? defaults?.quickNotes ?? [])],
        addons: (product.addons ?? defaults?.addons ?? []).map(addon => ({...addon})),
    };
}
export function seedState(): PosState { return { departments: [{ id: 'kitchen', name: 'სამზარეულო' }, { id: 'bar', name: 'ბარი' }, { id: 'pastry', name: 'საკონდიტრო' }], zones: [{ id: 'hall', name: 'დარბაზი' }, { id: 'terrace', name: 'ტერასა' }], tables: Array.from({ length: 12 }, (_, i) => ({ id: `table-${i + 1}`, name: `${i + 1}`, zoneId: i < 8 ? 'hall' : 'terrace' })), products: [['ხაჭაპური', 'კერძები', 1800, 'kitchen'], ['ცეზარი ქათმით', 'სალათები', 2400, 'kitchen'], ['პასტა ალფრედო', 'კერძები', 2600, 'kitchen'], ['კარტოფილი ფრი', 'გარნირები', 900, 'kitchen'], ['ამერიკანო', 'ყავა', 600, 'bar'], ['კაპუჩინო', 'ყავა', 800, 'bar'], ['ასკილის ლიმონათი', 'სასმელები', 1000, 'bar'], ['წყალი', 'სასმელები', 400, 'bar'], ['ჩიზქეიქი', 'დესერტები', 1200, 'pastry'], ['კრუასანი', 'დესერტები', 700, 'pastry']].map((p, i) => ({ id: `product-${i + 1}`, name: String(p[0]), category: String(p[1]), price: Number(p[2]), departmentIds: [String(p[3])], active: true })), orders: [], tickets: [], audit: [], inventory: emptyInventory() }; }
// Documents saved before inventory existed load with an empty stock.
export function normalizeState(state: Omit<PosState, 'inventory'> & {inventory?: Inventory}): PosState {
    return state.inventory ? state as PosState : {...state, inventory: emptyInventory()};
}
// Fresh demo and desktop documents only; real accounts start with empty stock.
export function demoSeedState(now = new Date().toISOString()): PosState {
    return {...seedState(), inventory: seedInventory({now, newId: id})};
}
export function orderTotals(order: Order) { const subtotal = order.lines.reduce((a, l) => a + l.price * (l.quantity - l.voidQuantity), 0); const discount = order.discountAmount ?? Math.round(subtotal * order.discountPercent / 100); const total = subtotal - discount; const paid = order.payments.reduce((a, p) => a + p.amount, 0); return { subtotal, discount, total, paid, due: total - paid }; }
function proportion(a: number, b: number, den: number) { if (!den)
    return 0; const n = BigInt(a) * BigInt(b), d = BigInt(den); return Number((n * BigInt(2) + d) / (BigInt(2) * d)); }
export function lineBalances(order: Order) { const { subtotal, total } = orderTotals(order); let cumulative = 0, allocated = 0; return order.lines.map(l => { cumulative += l.price * (l.quantity - l.voidQuantity); const until = subtotal ? proportion(cumulative, total, subtotal) : 0; const lineTotal = until - allocated; allocated = until; const paid = order.payments.reduce((a, p) => a + p.allocations.filter(x => x.lineId === l.id).reduce((s, x) => s + x.amount, 0), 0); return { lineId: l.id, total: lineTotal, paid, due: lineTotal - paid }; }); }
function assert(value: unknown, message: string): asserts value { if (!value)
    throw new Error(message); }
function text(value: unknown, label: string) { assert(typeof value === 'string' && value.trim().length > 0 && value.length <= 500, label); return value.trim(); }
function integer(value: unknown, min = 1) { assert(typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= 100000000, 'რაოდენობა ან თანხა არასწორია'); return value; }
function optionText(value: unknown, label: string, maxLength = 100) {
    const valueText = text(value, label);
    assert(valueText.length <= maxLength, label);
    return valueText;
}
function quickNoteConfig(value: unknown): string[] {
    assert(Array.isArray(value) && value.length <= 20, 'სწრაფი შენიშვნების რაოდენობა უნდა იყოს მაქსიმუმ 20');
    const notes = value.map(note => optionText(note, 'შენიშვნა უნდა შეიცავდეს 1–100 სიმბოლოს'));
    assert(new Set(notes).size === notes.length, 'სწრაფი შენიშვნა მეორდება');
    return notes;
}
function addonConfig(value: unknown): Addon[] {
    assert(Array.isArray(value) && value.length <= 20, 'დანამატების რაოდენობა უნდა იყოს მაქსიმუმ 20');
    const addons = value.map(raw => {
        assert(raw && typeof raw === 'object' && !Array.isArray(raw), 'დანამატი არასწორია');
        const addon = raw as Record<string, unknown>;
        return {id: optionText(addon.id, 'დანამატის კოდი არასწორია', 80), name: optionText(addon.name, 'დანამატის სახელი უნდა შეიცავდეს 1–100 სიმბოლოს'), price: integer(addon.price)};
    });
    assert(new Set(addons.map(addon => addon.id)).size === addons.length, 'დანამატის კოდი მეორდება');
    return addons;
}
function selectedStrings(value: unknown, message: string): string[] {
    if (value === undefined) return [];
    assert(Array.isArray(value) && value.length <= 20 && value.every(item => typeof item === 'string'), message);
    assert(new Set(value).size === value.length, message);
    return value as string[];
}
function sameAddons(left: Addon[] = [], right: Addon[] = []) {
    return left.length === right.length && left.every((addon, index) => addon.id === right[index].id && addon.name === right[index].name && addon.price === right[index].price);
}
// Manager authorization is verified in the server route immediately before this pure transition.
export function applyAction(original: PosState, action: string, p: Record<string, unknown>, manager = false, now = new Date().toISOString()): PosState {
    const s = normalizeState(structuredClone(original));
    const ctx = {now, newId: id};
    const log = (detail: string) => s.audit.push({ id: id(), at: now, action, detail });
    const getOrder = () => { const o = s.orders.find(o => o.id === p.orderId); assert(o, 'შეკვეთა ვერ მოიძებნა'); assert(o.status === 'open', 'ანგარიში უკვე დახურულია'); return o; };
    const editable = (o: Order) => assert(!o.payments.length, 'ნაწილობრივი გადახდის შემდეგ შეკვეთის შეცვლა შეუძლებელია');
    const ticket = (o: Order, lines: {
        line: Line;
        quantity: number;
    }[], type: 'order' | 'cancel') => { for (const d of s.departments) {
        const matching = lines.filter(x => x.quantity > 0 && x.line.departmentIds.includes(d.id));
        if (matching.length)
            s.tickets.push({ id: id(), orderId: o.id, tableId: o.tableId, tableName: s.tables.find(t => t.id === o.tableId)?.name || o.tableId, departmentId: d.id, type, createdAt: now, lines: matching.map(x => ({ lineId: x.line.id, name: x.line.name, quantity: x.quantity, note: x.line.note, ...(x.line.addons ? {addons: x.line.addons.map(addon => ({...addon}))} : {}) })), printCount: 0 });
    } };
    switch (action) {
        case 'openOrder': {
            assert(s.tables.some(t => t.id === p.tableId && !t.archived), 'მაგიდა ვერ მოიძებნა');
            if (!s.orders.some(o => o.tableId === p.tableId && o.status === 'open'))
                s.orders.push({ id: id(), tableId: String(p.tableId), status: 'open', createdAt: now, lines: [], discountPercent: 0, payments: [] });
            break;
        }
        case 'closeEmptyOrder': {
            const o = getOrder();
            assert(!o.payments.length && o.lines.every(l => l.quantity === l.voidQuantity), 'ჯერ გააუქმეთ აქტიური პოზიციები');
            o.status = 'closed';
            o.closedAt = now;
            log(`${o.id}: ცარიელი მაგიდა გათავისუფლდა`);
            break;
        }
        case 'addItem': {
            const o = getOrder();
            editable(o);
            const prod = s.products.find(x => x.id === p.productId && x.active);
            assert(prod, 'პროდუქტი ვერ მოიძებნა');
            const quantity = integer(p.quantity);
            const options = getProductOptions(prod);
            const addonIds = selectedStrings(p.addonIds, 'აირჩიეთ სწორი, არაგამეორებული დანამატები');
            const quickNotes = selectedStrings(p.quickNotes, 'აირჩიეთ სწორი, არაგამეორებული შენიშვნები');
            assert(addonIds.every(addonId => options.addons.some(addon => addon.id === addonId)), 'დანამატი ვერ მოიძებნა');
            assert(quickNotes.every(note => options.quickNotes.includes(note)), 'სწრაფი შენიშვნა ვერ მოიძებნა');
            // Catalog order makes differently ordered selections equivalent.
            const addons = options.addons.filter(addon => addonIds.includes(addon.id));
            assert(p.note === undefined || typeof p.note === 'string', 'შენიშვნა არასწორია');
            const freeNote = (p.note as string | undefined) ?? '';
            const note = [...options.quickNotes.filter(note => quickNotes.includes(note)), freeNote].filter(Boolean).join('; ');
            assert(note.length <= 500, 'შენიშვნა უნდა შეიცავდეს მაქსიმუმ 500 სიმბოლოს');
            const basePrice = integer(prod.price, 0);
            const price = integer(addons.reduce((sum, addon) => sum + integer(addon.price), basePrice), 0);
            const existing = o.lines.find(l => l.productId === prod.id && l.name === prod.name && l.price === price && (l.basePrice ?? l.price) === basePrice && sameAddons(l.addons, addons) && l.note === note && l.quantity > l.voidQuantity && l.departmentIds.length === prod.departmentIds.length && l.departmentIds.every(d => prod.departmentIds.includes(d)));
            if (existing) {
                existing.quantity = integer(existing.quantity + quantity);
            } else {
                o.lines.push({ id: id(), productId: prod.id, name: prod.name, price, basePrice, addons, quantity, departmentIds: [...prod.departmentIds], note, sentQuantity: 0, voidQuantity: 0 });
            }
            break;
        }
        case 'sendOrder': {
            const o = getOrder();
            const lines = o.lines.map(line => ({ line, quantity: line.quantity - line.voidQuantity - line.sentQuantity }));
            ticket(o, lines, 'order');
            consumeSale(s, o, lines.filter(x => x.quantity > 0), ctx);
            for (const x of lines)
                x.line.sentQuantity += x.quantity;
            break;
        }
        case 'voidItem': {
            assert(manager, 'მენეჯერის კოდი აუცილებელია');
            const o = getOrder();
            editable(o);
            const l = o.lines.find(l => l.id === p.lineId);
            assert(l, 'პოზიცია ვერ მოიძებნა');
            const q = integer(p.quantity);
            assert(q <= l.quantity - l.voidQuantity, 'გასაუქმებელი რაოდენობა ზედმეტია');
            const reason = text(p.reason, 'მიუთითეთ გაუქმების მიზეზი');
            const unsent = l.quantity - l.voidQuantity - l.sentQuantity;
            const cancel = Math.max(0, q - unsent);
            l.voidQuantity += q;
            l.sentQuantity -= cancel;
            if (o.discountAmount !== undefined)
                o.discountAmount = Math.min(o.discountAmount, orderTotals(o).subtotal);
            ticket(o, [{ line: l, quantity: cancel }], 'cancel');
            log(`${o.id}: ${l.name} × ${q}; ${reason}`);
            break;
        }
        case 'discount': {
            assert(manager, 'მენეჯერის კოდი აუცილებელია');
            const o = getOrder();
            editable(o);
            const reason = text(p.reason, 'მიუთითეთ ფასდაკლების მიზეზი');
            if (p.amount !== undefined) {
                assert(p.percent === undefined, 'აირჩიეთ პროცენტი ან თანხა');
                const amount = integer(p.amount, 0);
                assert(amount <= orderTotals(o).subtotal, 'ფასდაკლება მეტია შეკვეთაზე');
                o.discountAmount = amount;
                o.discountPercent = 0;
            }
            else {
                const percent = p.percent;
                assert(typeof percent === 'number' && Number.isFinite(percent) && percent >= 0 && percent <= 100, 'ფასდაკლება უნდა იყოს 0–100%');
                o.discountPercent = percent;
                delete o.discountAmount;
            }
            log(`${o.id}: ${o.discountAmount ?? o.discountPercent} ${o.discountAmount !== undefined ? 'თეთრი' : '%'}; ${reason}`);
            break;
        }
        case 'transfer': {
            const o = getOrder();
            editable(o);
            assert(s.tables.some(t => t.id === p.tableId && !t.archived), 'მაგიდა ვერ მოიძებნა');
            assert(!s.orders.some(x => x.status === 'open' && x.tableId === p.tableId), 'მაგიდა დაკავებულია');
            o.tableId = String(p.tableId);
            break;
        }
        case 'pay': {
            const o = getOrder();
            assert(o.lines.length, 'ცარიელი შეკვეთა');
            assert(o.lines.every(l => l.sentQuantity === l.quantity - l.voidQuantity), 'ჯერ გააგზავნეთ შეკვეთა განყოფილებებში');
            assert(['cash', 'card', 'other'].includes(String(p.method)), 'გადახდის მეთოდი არასწორია');
            const balances = lineBalances(o);
            const allocations: {
                lineId: string;
                amount: number;
            }[] = [];
            let amount = 0;
            if (Array.isArray(p.items)) {
                assert(p.amount === undefined, 'აირჩიეთ თანხა ან პოზიციები');
                assert(p.items.length, 'აირჩიეთ პოზიციები');
                const seen = new Set<string>();
                for (const raw of p.items) {
                    const item = raw as {
                        lineId: string;
                        quantity: number;
                    };
                    assert(!seen.has(item.lineId), 'დუბლირებული პოზიცია');
                    seen.add(item.lineId);
                    const l = o.lines.find(x => x.id === item.lineId);
                    const b = balances.find(x => x.lineId === item.lineId);
                    assert(l && b, 'პოზიცია ვერ მოიძებნა');
                    const qty = integer(item.quantity);
                    const active = l.quantity - l.voidQuantity;
                    assert(qty <= active, 'არასწორი რაოდენობა');
                    let low = 0, high = active;
                    while (low < high) {
                        const mid = Math.ceil((low + high) / 2);
                        if (proportion(b.total, mid, active) <= b.paid)
                            low = mid;
                        else
                            high = mid - 1;
                    }
                    assert(qty <= active - low, 'ამ პოზიციაზე ამდენი გადაუხდელი ერთეული არ არის');
                    const share = proportion(b.total, low + qty, active) - b.paid;
                    assert(share <= b.due, 'ამ პოზიციის დარჩენილი თანხა ნაკლებია');
                    allocations.push({ lineId: l.id, amount: share });
                    amount += share;
                }
            }
            else {
                amount = integer(p.amount, 0);
                let remaining = amount;
                for (const b of balances) {
                    const part = Math.min(remaining, b.due);
                    if (part > 0)
                        allocations.push({ lineId: b.lineId, amount: part });
                    remaining -= part;
                }
            }
            const due = orderTotals(o).due;
            assert(amount <= due, 'გადახდა აღემატება დარჩენილ თანხას');
            assert(amount > 0 || due === 0, 'მიუთითეთ დადებითი თანხა');
            o.payments.push({ id: id(), method: p.method as Payment['method'], amount, createdAt: now, allocations });
            if (orderTotals(o).due === 0) {
                o.status = 'closed';
                o.closedAt = now;
            }
            log(`${o.id}: ${amount} (${p.method})`);
            break;
        }
        case 'saveProduct': {
            const name = text(p.name, 'მიუთითეთ სახელი'), category = text(p.category, 'მიუთითეთ კატეგორია'), price = integer(p.price, 0);
            assert(Array.isArray(p.departmentIds) && p.departmentIds.length && p.departmentIds.every(x => typeof x === 'string' && s.departments.some(d => d.id === x && !d.archived)), 'აირჩიეთ განყოფილებები');
            assert(typeof p.active === 'boolean', 'აქტიურობა არასწორია');
            const productId = typeof p.id === 'string' ? p.id : id();
            const idx = s.products.findIndex(x => x.id === productId);
            const previous = idx >= 0 ? getProductOptions(s.products[idx]) : {quickNotes: [], addons: []};
            const value: Product = { id: productId, name, category, price, departmentIds: [...new Set(p.departmentIds as string[])], active: p.active,
                quickNotes: p.quickNotes === undefined ? previous.quickNotes : quickNoteConfig(p.quickNotes),
                addons: p.addons === undefined ? previous.addons : addonConfig(p.addons) };
            if (idx >= 0)
                s.products[idx] = value;
            else
                s.products.push(value);
            break;
        }
        case 'saveTable':
        case 'saveZone':
        case 'saveDepartment': {
            assert(manager, 'მენეჯერის კოდი აუცილებელია');
            const name = text(p.name, 'მიუთითეთ სახელი');
            const target = action === 'saveTable' ? s.tables : action === 'saveZone' ? s.zones : s.departments;
            const value: {
                id: string;
                name: string;
                zoneId?: string;
            } = { id: typeof p.id === 'string' ? p.id : id(), name };
            if (action === 'saveTable') {
                assert(s.zones.some(z => z.id === p.zoneId), 'აირჩიეთ ზონა');
                value.zoneId = String(p.zoneId);
            }
            const idx = target.findIndex(x => x.id === value.id);
            assert(idx < 0 || !target[idx].archived, 'ჩანაწერი ამოღებულია');
            if (idx >= 0)
                target[idx] = value as Table;
            else
                target.push(value as Table);
            break;
        }
        case 'deleteTable':
        case 'deleteDepartment': {
            assert(manager, 'მენეჯერის კოდი აუცილებელია');
            const target = action === 'deleteTable' ? s.tables : s.departments;
            const item = target.find(x => x.id === p.id && !x.archived);
            assert(item, 'ჩანაწერი ვერ მოიძებნა');
            if (action === 'deleteTable') {
                assert(!s.orders.some(o => o.tableId === item.id && o.status === 'open'), 'ჯერ დახურეთ ან გადაიტანეთ მაგიდის შეკვეთა');
            } else {
                assert(!s.products.some(x => x.departmentIds.includes(item.id)), 'ჯერ მენიუში შეცვალეთ ამ განყოფილებაზე მიბმული კერძების მიმღები');
                assert(!s.orders.some(o => o.status === 'open' && o.lines.some(l => l.departmentIds.includes(item.id) && l.quantity > l.voidQuantity)), 'განყოფილება ღია შეკვეთაში გამოიყენება');
            }
            item.archived = true;
            break;
        }
        case 'printReceipt': {
            const o = s.orders.find(o => o.id === p.orderId);
            assert(o, 'შეკვეთა ვერ მოიძებნა');
            o.receiptPrintCount = (o.receiptPrintCount || 0) + 1;
            break;
        }
        case 'printTicket': {
            const t = s.tickets.find(t => t.id === p.ticketId);
            assert(t, 'ჩეკი ვერ მოიძებნა');
            t.printCount++;
            break;
        }
        case 'saveStockItem':
        case 'archiveStockItem':
        case 'saveRecipe':
        case 'saveBatchRecipe':
        case 'receiveStock':
        case 'writeOff':
        case 'stockCount':
        case 'produce': {
            assert(manager, 'მენეჯერის კოდი აუცილებელია');
            log(applyInventoryAction(s, action as InventoryAction, p, ctx));
            break;
        }
        default: throw new Error('უცნობი მოქმედება');
    }
    for (const o of s.orders) {
        let subtotal = 0;
        for (const line of o.lines) {
            const lineTotal = line.price * (line.quantity - line.voidQuantity);
            subtotal += lineTotal;
            assert(Number.isSafeInteger(lineTotal) && Number.isSafeInteger(subtotal), 'თანხა დასაშვებ ზღვარს აღემატება');
        }
        const totals = orderTotals(o);
        assert(Object.values(totals).every(Number.isSafeInteger), 'თანხა დასაშვებ ზღვარს აღემატება');
        assert(totals.due >= 0, 'თანხის ბალანსი არასწორია');
    }
    return s;
}
