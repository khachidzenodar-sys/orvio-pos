import type {Order, PosState} from './pos';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {orderTotals} from './order-totals.ts';

export type PaymentTotals = {cash: number; card: number; other: number; total: number};
export type DayTotals = {
    closedBills: number;   // closed that day with ≥1 payment
    gross: number;         // Σ subtotal (voided units excluded)
    discounts: number;     // Σ discount
    net: number;           // gross − discounts
    voidCount: number;     // Σ voidQuantity on orders closed that day
    voidValue: number;     // Σ price × voidQuantity on orders closed that day
    payments: PaymentTotals; // payments whose createdAt is that day, any order
    openBills: number;
    openAmount: number;    // Σ due of open bills
    averageCheck: number;  // closedBills ? Math.round(net / closedBills) : 0
};
export type OpenBill = {orderId: string; tableName: string; total: number; paid: number; due: number; voidCount: number; voidValue: number};
export type DayReport = {date: string; totals: DayTotals; openBills: OpenBill[]};
export type DayClose = {
    id: string;
    date: string;          // 'YYYY-MM-DD' business day
    sequence: number;      // 1 = first close of that date, 2+ = repeat close
    closedAt: string;      // ISO
    closedBy?: string;     // optional free text, ≤100 chars
    note: string;          // '' allowed, ≤500 chars
    totals: DayTotals;     // snapshot, never recalculated
    openingFloat: number;
    expectedCash: number;  // openingFloat + totals.payments.cash
    countedCash: number;
    difference: number;    // countedCash − expectedCash (may be negative)
};
export type CashStatus = 'short' | 'over' | 'even';
export type CashCheck = {expected: number; difference: number | null; status: CashStatus | null};
export type AmountInput = {ok: true; value: number | null} | {ok: false; error: string};

export const BUSINESS_TIME_ZONE = 'Asia/Tbilisi';
export const CASH_STATUS_LABELS: Record<CashStatus, string> = {short: 'დანაკლისი', over: 'ზედმეტობა', even: 'ემთხვევა'};
const MAX_AMOUNT = 100000000;
const dayFormat = new Intl.DateTimeFormat('en-CA', {timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'});

// Calendar day in Tbilisi (UTC+4, no DST), independent of the device time zone.
export function businessDay(iso: string): string {
    return dayFormat.format(new Date(iso));
}
function isDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
}
function voids(order: Order) {
    return order.lines.reduce((a, l) => ({count: a.count + l.voidQuantity, value: a.value + l.price * l.voidQuantity}), {count: 0, value: 0});
}

export function computeDayReport(state: PosState, date: string): DayReport {
    const totals: DayTotals = {closedBills: 0, gross: 0, discounts: 0, net: 0, voidCount: 0, voidValue: 0, payments: {cash: 0, card: 0, other: 0, total: 0}, openBills: 0, openAmount: 0, averageCheck: 0};
    const openBills: OpenBill[] = [];
    for (const order of state.orders) {
        for (const payment of order.payments) {
            if (businessDay(payment.createdAt) !== date) continue;
            totals.payments[payment.method] += payment.amount;
            totals.payments.total += payment.amount;
        }
        if (order.status === 'closed' && order.closedAt && businessDay(order.closedAt) === date) {
            const v = voids(order);
            totals.voidCount += v.count;
            totals.voidValue += v.value;
            if (order.payments.length) {
                const t = orderTotals(order);
                totals.closedBills++;
                totals.gross += t.subtotal;
                totals.discounts += t.discount;
                totals.net += t.total;
            }
        }
        if (order.status === 'open' && businessDay(order.createdAt) <= date && (order.payments.length > 0 || order.lines.some(l => l.quantity > l.voidQuantity))) {
            const t = orderTotals(order);
            const v = voids(order);
            openBills.push({orderId: order.id, tableName: state.tables.find(x => x.id === order.tableId)?.name ?? order.tableId, total: t.total, paid: t.paid, due: t.due, voidCount: v.count, voidValue: v.value});
            totals.openBills++;
            totals.openAmount += t.due;
        }
    }
    totals.averageCheck = totals.closedBills ? Math.round(totals.net / totals.closedBills) : 0;
    return {date, totals, openBills};
}

export function cashCheck(openingFloat: number, cashPayments: number, counted: number | null): CashCheck {
    const expected = openingFloat + cashPayments;
    if (counted === null) return {expected, difference: null, status: null};
    const difference = counted - expected;
    return {expected, difference, status: difference < 0 ? 'short' : difference > 0 ? 'over' : 'even'};
}

// Parsed from the text itself so no float rounding can creep in.
export function parseAmount(text: string): AmountInput {
    const value = text.trim();
    if (!value) return {ok: true, value: null};
    const match = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(value);
    if (!match) return {ok: false, error: 'შეიყვანეთ 0 ან მეტი თანხა, მაქსიმუმ 2 ციფრით წერტილის შემდეგ'};
    const tetri = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
    return tetri > MAX_AMOUNT ? {ok: false, error: 'თანხა არ უნდა აღემატებოდეს 1 000 000 ₾-ს'} : {ok: true, value: tetri};
}

export function signedAmount(tetri: number): string {
    const abs = Math.abs(tetri);
    const text = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
    return tetri < 0 ? `−${text}` : tetri > 0 ? `+${text}` : text;
}

export function differenceText(tetri: number): string {
    return `${signedAmount(tetri)} ${CASH_STATUS_LABELS[tetri < 0 ? 'short' : tetri > 0 ? 'over' : 'even']}`;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const amount = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const TOTAL_KEYS = ['closedBills', 'gross', 'discounts', 'net', 'voidCount', 'voidValue', 'openBills', 'openAmount', 'averageCheck'] as const;
const PAYMENT_KEYS = ['cash', 'card', 'other', 'total'] as const;

export function isValidDayCloses(value: unknown): boolean {
    if (!Array.isArray(value)) return false;
    const ids = new Set<string>();
    return value.every(c => {
        if (!isRecord(c) || typeof c.id !== 'string' || ids.has(c.id)) return false;
        ids.add(c.id);
        const t = c.totals;
        if (!isRecord(t) || !TOTAL_KEYS.every(k => amount(t[k])) || !isRecord(t.payments)) return false;
        const payments = t.payments;
        if (!PAYMENT_KEYS.every(k => amount(payments[k]))) return false;
        return isDate(c.date) && Number.isSafeInteger(c.sequence) && Number(c.sequence) >= 1
            && typeof c.closedAt === 'string' && Number.isFinite(Date.parse(c.closedAt))
            && (c.closedBy === undefined || (typeof c.closedBy === 'string' && c.closedBy.length <= 100))
            && typeof c.note === 'string' && c.note.length <= 500
            && amount(c.openingFloat) && amount(c.countedCash) && amount(c.expectedCash)
            && typeof c.difference === 'number' && Number.isSafeInteger(c.difference)
            && c.expectedCash === c.openingFloat + Number(payments.cash)
            && c.difference === c.countedCash - c.expectedCash;
    });
}

function fail(message: string): never {
    throw new Error(message);
}
function cash(value: unknown): number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_AMOUNT ? value : fail('თანხა არასწორია');
}
function optionalText(value: unknown, max: number, message: string): string {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.trim().length > max) fail(message);
    return value.trim();
}

// Appends an immutable snapshot; orders, payments and tables are never touched.
export function closeDay(s: PosState, p: Record<string, unknown>, ctx: {now: string; newId: () => string}): string {
    const date = isDate(p.date) ? p.date : fail('თარიღი არასწორია');
    if (date > businessDay(ctx.now)) fail('მომავალი დღის დახურვა შეუძლებელია');
    const openingFloat = cash(p.openingFloat);
    const countedCash = cash(p.countedCash);
    const note = optionalText(p.note, 500, 'შენიშვნა უნდა შეიცავდეს მაქსიმუმ 500 სიმბოლოს');
    const closedBy = optionalText(p.closedBy, 100, 'სახელი უნდა შეიცავდეს მაქსიმუმ 100 სიმბოლოს');
    const totals = computeDayReport(s, date).totals;
    const check = cashCheck(openingFloat, totals.payments.cash, countedCash);
    const difference = check.difference ?? 0;
    const history = s.dayCloses ?? [];
    const record: DayClose = {
        id: ctx.newId(), date, sequence: history.filter(c => c.date === date).length + 1, closedAt: ctx.now,
        ...(closedBy ? {closedBy} : {}), note, totals, openingFloat, expectedCash: check.expected, countedCash, difference,
    };
    s.dayCloses = [...history, record];
    return `${date}: მოსალოდნელი ${check.expected}, დათვლილი ${countedCash}, სხვაობა ${difference}`;
}
