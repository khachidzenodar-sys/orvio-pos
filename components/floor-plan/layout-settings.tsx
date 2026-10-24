'use client';

import {useState} from 'react';
import type {PosState} from '@/lib/pos';
import {FloorPlan} from './floor-plan';
import {FloorPlanEditor} from './floor-plan-editor';

type Props = {state: PosState; busy: boolean; error: string; act: (action: string, payload: Record<string, unknown>) => Promise<unknown>};

// Management screen for the floor plan: pick a zone, preview it, edit with the manager PIN.
export function LayoutSettings({state, busy, error, act}: Props) {
    const zones = state.zones.filter(z => !z.archived);
    const [zone, setZone] = useState(zones[0]?.id ?? '');
    const [editing, setEditing] = useState(false);
    if (!zones.length) return <p className="muted">ჯერ დაამატეთ ზონა „ზონები და მაგიდები“ განყოფილებაში.</p>;
    const current = zones.some(z => z.id === zone) ? zone : zones[0].id;
    return <div className="layoutsettings">
        <div className="toolbar">
            <div className="tabs">{zones.map(z => <button key={z.id} disabled={editing} className={current === z.id ? 'selected' : ''} onClick={() => setZone(z.id)}>{z.name}</button>)}</div>
            {!editing && <button className="primary" onClick={() => setEditing(true)}>განლაგების რედაქტირება</button>}
        </div>
        {editing
            ? <FloorPlanEditor key={current} state={state} zoneId={current} busy={busy} error={error} act={act} onDone={() => setEditing(false)}/>
            : <>
                <FloorPlan state={state} zoneId={current} busy onOpen={() => {}}/>
                <p className="muted">მაგიდების გადასაადგილებლად, ადგილების ან ფორმის შესაცვლელად დააჭირეთ „განლაგების რედაქტირებას“. შენახვას სჭირდება მენეჯერის კოდი.</p>
            </>}
    </div>;
}
