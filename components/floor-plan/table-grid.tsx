'use client';

import type {PosState} from '@/lib/pos';
import {orderTotals} from '@/lib/pos';
import {money} from '@/lib/format';
import {STATUS_LABELS, tableStatus, zoneLayouts} from '@/lib/floor-plan';

// Simple card grid kept as a fallback for the floor plan.
export function TableGrid({state, zoneId, busy, onOpen}: {state: PosState; zoneId: string; busy: boolean; onOpen: (tableId: string) => void}) {
    const items = zoneLayouts(state.tables.filter(t => !t.archived && (zoneId === 'all' || t.zoneId === zoneId)));
    return <div className="tablegrid">{items.map(({table, layout}) => {
        const order = state.orders.find(o => o.tableId === table.id && o.status === 'open'), status = tableStatus(order);
        return <button disabled={busy} key={table.id} className={`tablecard ${status}`} onClick={() => onOpen(table.id)}>
            <div className="tabletop"><span>{layout.seats} ადგილი</span><span className={`badge ${order ? 'warm' : ''}`}>{STATUS_LABELS[status]}</span></div>
            <div className="tableShape"><span>{table.name}</span></div>
            <div className="tablebottom"><b>{order ? money(orderTotals(order).due) : 'ახალი შეკვეთა'}</b><span>{order ? `${order.lines.reduce((a, l) => a + l.quantity - l.voidQuantity, 0)} პოზიცია` : ''}</span></div>
        </button>;
    })}</div>;
}
