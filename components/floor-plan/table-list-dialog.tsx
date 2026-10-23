'use client';

import type {PosState} from '@/lib/pos';
import {orderTotals} from '@/lib/pos';
import {money} from '@/lib/format';
import {STATUS_LABELS, tableStatus, type TableStatus} from '@/lib/floor-plan';

type Props = {state: PosState; status: TableStatus; onClose: () => void; onOpen: (tableId: string) => void};

// Lists free or occupied tables by zone; tapping one opens it.
export function TableListDialog({state, status, onClose, onOpen}: Props) {
    const openOrder = (tableId: string) => state.orders.find(o => o.tableId === tableId && o.status === 'open');
    const zones = state.zones.filter(z => !z.archived).map(z => ({
        zone: z,
        tables: state.tables.filter(t => !t.archived && t.zoneId === z.id && tableStatus(openOrder(t.id)) === status),
    })).filter(g => g.tables.length);
    return <div className="overlay" onClick={onClose}>
        <section role="dialog" aria-modal="true" aria-label={`${STATUS_LABELS[status]} მაგიდები`} className="modal tablelist" onClick={e => e.stopPropagation()}>
            <div className="receipthead"><h2>{STATUS_LABELS[status]} მაგიდები</h2><button aria-label="დახურვა" onClick={onClose}>×</button></div>
            {!zones.length && <p className="muted">{status === 'free' ? 'თავისუფალი მაგიდა არ არის.' : 'დაკავებული მაგიდა არ არის.'}</p>}
            {zones.map(({zone, tables}) => <div key={zone.id} className="tablelistzone">
                <h3>{zone.name}</h3>
                <div className="tablelistgrid">{tables.map(t => {
                    const order = openOrder(t.id);
                    return <button key={t.id} className={`tablelistitem ${status}`} onClick={() => onOpen(t.id)}>
                        <b>{t.name}</b><small>{t.layout?.seats ?? 4} ადგ.</small>{order && <em>{money(orderTotals(order).due)}</em>}
                    </button>;
                })}</div>
            </div>)}
        </section>
    </div>;
}
