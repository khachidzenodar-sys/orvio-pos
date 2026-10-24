import type {Order, PosState} from './pos';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {lineBalances} from './order-totals.ts';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {productRecipe, recipeCost} from './inventory.ts';

// Money in tetri. Cost and profit cover only dishes with a recipe; uncosted is the revenue of dishes without one.
export type SalesRow = {id: string; name: string; quantity: number; revenue: number; cost: number | null; profit: number | null; marginPercent: number | null; uncosted: number};
export type SalesAnalytics = {departments: SalesRow[]; products: SalesRow[]; total: SalesRow};

type Acc = {id: string; name: string; quantity: number; revenue: number; cost: number; costedRevenue: number; costed: number};
const acc = (id: string, name: string): Acc => ({id, name, quantity: 0, revenue: 0, cost: 0, costedRevenue: 0, costed: 0});
function row(a: Acc): SalesRow {
    const known = a.costed > 0, profit = known ? a.costedRevenue - a.cost : null;
    return {id: a.id, name: a.name, quantity: a.quantity, revenue: a.revenue, cost: known ? a.cost : null, profit,
        marginPercent: profit !== null && a.costedRevenue > 0 ? Math.round(profit * 1000 / a.costedRevenue) / 10 : null, uncosted: a.revenue - a.costedRevenue};
}

/** Sales of closed bills, after discounts. Cost is today's recipe cost × quantity; a dish routed to
 *  several departments counts toward the first one. */
export function salesAnalytics(state: PosState, include: (order: Order) => boolean = () => true): SalesAnalytics {
    const departments = new Map<string, Acc>(), products = new Map<string, Acc>(), total = acc('total', 'სულ');
    const unitCost = new Map<string, number | null>();
    const costOf = (productId: string) => {
        if (!unitCost.has(productId)) {
            const recipe = productRecipe(state.inventory, productId);
            unitCost.set(productId, recipe ? recipeCost(recipe, state.inventory.items) : null);
        }
        return unitCost.get(productId)!;
    };
    for (const order of state.orders) {
        if (order.status !== 'closed' || !include(order)) continue;
        const net = new Map(lineBalances(order).map(b => [b.lineId, b.total]));
        for (const line of order.lines) {
            const quantity = line.quantity - line.voidQuantity;
            if (quantity <= 0) continue;
            const deptId = line.departmentIds[0] ?? 'none';
            const dept = departments.get(deptId) ?? acc(deptId, state.departments.find(d => d.id === deptId)?.name ?? 'განყოფილების გარეშე');
            const product = products.get(line.productId) ?? acc(line.productId, state.products.find(p => p.id === line.productId)?.name ?? line.name);
            const unit = costOf(line.productId), revenue = net.get(line.id) ?? line.price * quantity;
            for (const a of [dept, product, total]) {
                a.quantity += quantity;
                a.revenue += revenue;
                if (unit !== null) { a.cost += unit * quantity; a.costedRevenue += revenue; a.costed += quantity; }
            }
            departments.set(deptId, dept);
            products.set(line.productId, product);
        }
    }
    const byRevenue = (a: SalesRow, b: SalesRow) => b.revenue - a.revenue;
    return {departments: [...departments.values()].map(row).sort(byRevenue), products: [...products.values()].map(row).sort(byRevenue), total: row(total)};
}

export type MenuClass = 'star' | 'plowhorse' | 'puzzle' | 'dog' | 'unknown';
export type MenuEngineering = {rows: (SalesRow & {group: MenuClass; unitProfit: number | null})[]; popularityLine: number; profitLine: number | null};

/** Menu engineering: a dish is popular when it sells at least 70% of an equal share, and profitable when
 *  its profit per portion is at least the average across costed dishes. Dishes without a recipe stay unknown. */
export function menuEngineering(products: SalesRow[]): MenuEngineering {
    const costed = products.filter(r => r.profit !== null && r.uncosted === 0);
    const quantity = products.reduce((sum, r) => sum + r.quantity, 0);
    const popularityLine = products.length ? quantity / products.length * 0.7 : 0;
    const costedQuantity = costed.reduce((sum, r) => sum + r.quantity, 0);
    const profitLine = costedQuantity ? costed.reduce((sum, r) => sum + r.profit!, 0) / costedQuantity : null;
    const rows = products.map(r => {
        const unitProfit = r.profit !== null && r.uncosted === 0 && r.quantity ? r.profit / r.quantity : null;
        const popular = r.quantity >= popularityLine;
        const group: MenuClass = unitProfit === null || profitLine === null ? 'unknown'
            : unitProfit >= profitLine ? (popular ? 'star' : 'puzzle') : (popular ? 'plowhorse' : 'dog');
        return {...r, group, unitProfit};
    });
    return {rows, popularityLine, profitLine};
}
