'use client';

import type {PosState} from '@/lib/pos';
import {orderTotals} from '@/lib/pos';
import {money} from '@/lib/format';
import {PLAN_HEIGHT, PLAN_WIDTH, tableStatus, zoneLayouts, zoneTables} from '@/lib/floor-plan';
import {PlanTable, TableDefs} from './plan-table';

type Props = {state: PosState; zoneId: string; busy: boolean; onOpen: (tableId: string) => void};

function ZonePlan({state, zoneId, busy, onOpen}: Props) {
    const items = zoneLayouts(zoneTables(state, zoneId));
    if (!items.length) return <p className="muted">ამ ზონაში მაგიდა არ არის.</p>;
    return <svg className="floorplan" viewBox={`0 0 ${PLAN_WIDTH} ${PLAN_HEIGHT}`} role="group" aria-label="მაგიდების რუკა">
        <TableDefs/>
        {items.map(({table, layout}) => {
            const order = state.orders.find(o => o.tableId === table.id && o.status === 'open');
            return <PlanTable key={table.id} layout={layout} name={table.name} status={tableStatus(order)}
                amount={order ? money(orderTotals(order).due) : undefined} onOpen={() => { if (!busy) onOpen(table.id); }}/>;
        })}
    </svg>;
}

export function FloorPlan(props: Props) {
    if (props.zoneId !== 'all') return <ZonePlan {...props}/>;
    return <>{props.state.zones.filter(z => !z.archived).map(z => <section key={z.id} className="floorplanzone">
        <h2>{z.name}</h2>
        <ZonePlan {...props} zoneId={z.id}/>
    </section>)}</>;
}
