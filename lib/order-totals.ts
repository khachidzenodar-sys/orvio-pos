import type {Order} from './pos';

export function orderTotals(order: Order) { const subtotal = order.lines.reduce((a, l) => a + l.price * (l.quantity - l.voidQuantity), 0); const discount = order.discountAmount ?? Math.round(subtotal * order.discountPercent / 100); const total = subtotal - discount; const paid = order.payments.reduce((a, p) => a + p.amount, 0); return { subtotal, discount, total, paid, due: total - paid }; }
export function proportion(a: number, b: number, den: number) { if (!den)
    return 0; const n = BigInt(a) * BigInt(b), d = BigInt(den); return Number((n * BigInt(2) + d) / (BigInt(2) * d)); }
export function lineBalances(order: Order) { const { subtotal, total } = orderTotals(order); let cumulative = 0, allocated = 0; return order.lines.map(l => { cumulative += l.price * (l.quantity - l.voidQuantity); const until = subtotal ? proportion(cumulative, total, subtotal) : 0; const lineTotal = until - allocated; allocated = until; const paid = order.payments.reduce((a, p) => a + p.allocations.filter(x => x.lineId === l.id).reduce((s, x) => s + x.amount, 0), 0); return { lineId: l.id, total: lineTotal, paid, due: lineTotal - paid }; }); }
