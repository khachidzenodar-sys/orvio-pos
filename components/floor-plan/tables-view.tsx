'use client';

import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {PosState} from '@/lib/pos';
import {tableStatus, type TableStatus} from '@/lib/floor-plan';
import {FloorPlan} from './floor-plan';
import {TableGrid} from './table-grid';
import {TableListDialog} from './table-list-dialog';

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
    state: PosState; busy: boolean;
    onOpen: (tableId: string) => void;
    zone: string;
    onZone: (zoneId: string) => void;
};

export function TablesView({state, busy, onOpen, zone, onZone: setZone}: Props) {
    const [mode, setModeState] = useState<Mode>(readMode);
    const [list, setList] = useState<TableStatus | null>(null);
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
    const activeOrders = state.orders.filter(o => o.status === 'open' && tableStatus(o) === 'occupied');
    return <div ref={root} className="tablesview">
        <div className="stats compact">
            <div><span>ყველა მაგიდა</span><strong>{activeTables}</strong></div>
            <button type="button" onClick={() => setList('free')}><span><i className="dot"/> თავისუფალი</span><strong>{activeTables - activeOrders.length}</strong></button>
            <button type="button" onClick={() => setList('occupied')}><span><i className="dot amber"/> დაკავებული</span><strong>{activeOrders.length}</strong></button>
        </div>
        {list && <TableListDialog state={state} status={list} onClose={() => setList(null)} onOpen={id => { setList(null); onOpen(id); }}/>}
        <div className="toolbar">
            <div className="tabs">
                <button className={zone === 'all' ? 'selected' : ''} onClick={() => setZone('all')}>ყველა ზონა</button>
                {state.zones.filter(z => !z.archived).map(z => <button key={z.id} className={zone === z.id ? 'selected' : ''} onClick={() => setZone(z.id)}>{z.name}</button>)}
            </div>
            <div className="flex">
                <div className="tabs" role="group" aria-label="ხედი">
                    <button className={mode === 'plan' ? 'selected' : ''} onClick={() => setMode('plan')}>რუკა</button>
                    <button className={mode === 'grid' ? 'selected' : ''} onClick={() => setMode('grid')}>ბადე</button>
                </div>
            </div>
        </div>
        {mode === 'plan'
            ? <FloorPlan state={state} zoneId={zone} busy={busy} onOpen={onOpen}/>
            : <TableGrid state={state} zoneId={zone} busy={busy} onOpen={onOpen}/>}
        <p className="muted">შეეხეთ მაგიდას შეკვეთის გასახსნელად. მაგიდების განლაგება და რედაქტირება — „მართვა“ → „დარბაზის გეგმა“.</p>
    </div>;
}
