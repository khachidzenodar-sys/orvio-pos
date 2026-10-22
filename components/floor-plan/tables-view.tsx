'use client';

import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {PosState} from '@/lib/pos';
import {orderTotals} from '@/lib/pos';
import {money} from '@/lib/format';
import {STATUS_LABELS, type TableStatus} from '@/lib/floor-plan';
import {FloorPlan} from './floor-plan';
import {TableGrid} from './table-grid';
import {FloorPlanEditor} from './floor-plan-editor';

type Mode = 'plan' | 'grid';
const VIEW_KEY = 'orvio.tables.view';

function readMode(): Mode {
    try {
        return window.localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'plan';
    } catch {
        return 'plan';
    }
}

// Expose the plan's real top offset so CSS can fit the canvas into the remaining viewport height.
function measurePlanTop(root: HTMLElement | null) {
    const plan = root?.querySelector('.floorplan');
    if (root && plan) root.style.setProperty('--plan-top', `${Math.round(plan.getBoundingClientRect().top + window.scrollY)}px`);
}

type Props = {
    state: PosState; busy: boolean; error: string;
    act: (action: string, payload: Record<string, unknown>) => Promise<unknown>;
    onOpen: (tableId: string) => void;
    zone: string;
    onZone: (zoneId: string) => void;
};

export function TablesView({state, busy, error, act, onOpen, zone, onZone: setZone}: Props) {
    const [mode, setModeState] = useState<Mode>(readMode);
    const [editing, setEditing] = useState(false);
    const setMode = (next: Mode) => {
        setModeState(next);
        try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* storage unavailable */ }
    };
    const root = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => measurePlanTop(root.current));
    useEffect(() => {
        const update = () => measurePlanTop(root.current);
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);
    const activeTables = state.tables.filter(t => !t.archived).length;
    const activeOrders = state.orders.filter(o => o.status === 'open');
    return <div ref={root} className="tablesview">
        <div className="stats compact">
            <div><span>ყველა მაგიდა</span><strong>{activeTables}</strong></div>
            <div><span><i className="dot"/> თავისუფალი</span><strong>{activeTables - activeOrders.length}</strong></div>
            <div><span><i className="dot amber"/> დაკავებული</span><strong>{activeOrders.length}</strong></div>
            <div><span>ღია ანგარიშები</span><strong>{money(activeOrders.reduce((a, o) => a + orderTotals(o).due, 0))}</strong></div>
        </div>
        <div className="toolbar">
            <div className="tabs">
                <button disabled={editing} className={zone === 'all' ? 'selected' : ''} onClick={() => setZone('all')}>ყველა ზონა</button>
                {state.zones.filter(z => !z.archived).map(z => <button key={z.id} disabled={editing} className={zone === z.id ? 'selected' : ''} onClick={() => setZone(z.id)}>{z.name}</button>)}
            </div>
            {!editing && <div className="flex">
                <div className="tabs" role="group" aria-label="ხედი">
                    <button className={mode === 'plan' ? 'selected' : ''} onClick={() => setMode('plan')}>რუკა</button>
                    <button className={mode === 'grid' ? 'selected' : ''} onClick={() => setMode('grid')}>ბადე</button>
                </div>
                <button disabled={zone === 'all'} title={zone === 'all' ? 'აირჩიეთ ზონა' : undefined} onClick={() => setEditing(true)}>განლაგების რედაქტირება</button>
            </div>}
        </div>
        {editing
            ? <FloorPlanEditor key={zone} state={state} zoneId={zone} busy={busy} error={error} act={act} onDone={() => setEditing(false)}/>
            : <>
                <div className="planlegend">
                    {(Object.keys(STATUS_LABELS) as TableStatus[]).map(status => <span key={status}><i className={status}/>{STATUS_LABELS[status]}</span>)}
                    {zone === 'all' && <span className="muted">განლაგების შესაცვლელად აირჩიეთ ზონა</span>}
                </div>
                {mode === 'plan'
                    ? <FloorPlan state={state} zoneId={zone} busy={busy} onOpen={onOpen}/>
                    : <TableGrid state={state} zoneId={zone} busy={busy} onOpen={onOpen}/>}
                <p className="muted">შეეხეთ მაგიდას შეკვეთის გასახსნელად. მაგიდების ფორმას, ადგილებს და მდებარეობას მენეჯერი ცვლის ღილაკით „განლაგების რედაქტირება“; მაგიდები და ზონები იმართება „მართვის“ განყოფილებაშიც.</p>
            </>}
    </div>;
}
