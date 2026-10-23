'use client';

import type {PosState} from '@/lib/pos';
import {orderTotals} from '@/lib/pos';
import {money} from '@/lib/format';
import {tableStatus, zoneLayouts} from '@/lib/floor-plan';
import {PlanTable, TableDefs, tableFootprint} from './plan-table';

// Tables in tidy rows, each drawn like the floor plan. All cards share one scale so bigger tables look bigger.
export function TableGrid({state, zoneId, busy, onOpen}: {state: PosState; zoneId: string; busy: boolean; onOpen: (tableId: string) => void}) {
    const items = zoneLayouts(state.tables.filter(t => !t.archived && (zoneId === 'all' || t.zoneId === zoneId)))
        .map(item => ({...item, layout: {...item.layout, x: 0, y: 0, rotation: 0 as const}}));
    const box = items.reduce((m, {layout}) => { const f = tableFootprint(layout); return {width: Math.max(m.width, f.width), height: Math.max(m.height, f.height)}; }, {width: 160, height: 160});
    return <div className="tablegrid">{items.map(({table, layout}) => {
        const order = state.orders.find(o => o.tableId === table.id && o.status === 'open'), status = tableStatus(order);
        const due = order ? money(orderTotals(order).due) : undefined;
        return <button disabled={busy} key={table.id} className={`tablecard ${status}`} onClick={() => onOpen(table.id)}>
            <svg className="tabledrawing" viewBox={`${-box.width / 2} ${-box.height / 2} ${box.width} ${box.height}`} aria-hidden="true">
                <TableDefs/>
                <PlanTable layout={layout} name={table.name} status={status} amount={due} hideName/>
            </svg>
            <div className="tablebottom"><span className="tablename">{table.name}</span>{due && <b>{due}</b>}</div>
        </button>;
    })}</div>;
}
