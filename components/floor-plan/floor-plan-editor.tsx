'use client';

import {useRef, useState, type KeyboardEvent, type PointerEvent} from 'react';
import type {PosState, Table, TableLayout, TableShape} from '@/lib/pos';
import {MAX_SEATS, MIN_SEATS, PLAN_HEIGHT, PLAN_WIDTH, SHAPE_LABELS, TABLE_SHAPES, clampPosition, findFreeSpot, nextTableName, tableStatus, zoneLayouts, zoneTables} from '@/lib/floor-plan';
import {PlanTable, TableDefs} from './plan-table';

type Draft = {key: string; id?: string; name: string; layout: TableLayout};
type Props = {
    state: PosState; zoneId: string; busy: boolean; error: string;
    act: (action: string, payload: Record<string, unknown>) => Promise<unknown>;
    onDone: () => void;
};

const SNAP = 5;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const ARROWS: Record<string, [number, number]> = {ArrowLeft: [-SNAP, 0], ArrowRight: [SNAP, 0], ArrowUp: [0, -SNAP], ArrowDown: [0, SNAP]};

export function FloorPlanEditor({state, zoneId, busy, error, act, onDone}: Props) {
    // Draft is taken once when editing starts; background reloads must not overwrite it.
    const [draft, setDraft] = useState<Draft[]>(() => zoneLayouts(zoneTables(state, zoneId)).map(({table, layout}) => ({key: table.id, id: table.id, name: table.name, layout})));
    const [removeIds, setRemoveIds] = useState<string[]>([]);
    const [selected, setSelected] = useState('');
    const [pin, setPin] = useState('');
    const [message, setMessage] = useState('');
    const svg = useRef<SVGSVGElement>(null);
    const drag = useRef<{key: string; dx: number; dy: number} | null>(null);
    const added = useRef(0);
    const current = draft.find(d => d.key === selected);

    const update = (key: string, change: (d: Draft) => Draft) => setDraft(list => list.map(d => d.key === key ? change(d) : d));
    const setLayout = (key: string, patch: Partial<TableLayout>) => update(key, d => {
        const layout = {...d.layout, ...patch};
        return {...d, layout: {...layout, ...clampPosition(layout, layout.x, layout.y)}};
    });
    const moveTo = (key: string, x: number, y: number) => update(key, d => ({...d, layout: {...d.layout, ...clampPosition(d.layout, snap(x), snap(y))}}));

    function toPlan(event: PointerEvent) {
        const matrix = svg.current?.getScreenCTM();
        if (!matrix) return null;
        return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    }
    function startDrag(d: Draft, event: PointerEvent<SVGGElement>) {
        setSelected(d.key);
        setMessage('');
        const point = toPlan(event);
        if (!point || !svg.current) return;
        event.preventDefault();
        drag.current = {key: d.key, dx: d.layout.x - point.x, dy: d.layout.y - point.y};
        try { svg.current.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
    }
    function onMove(event: PointerEvent<SVGSVGElement>) {
        const active = drag.current, point = active && toPlan(event);
        if (active && point) moveTo(active.key, point.x + active.dx, point.y + active.dy);
    }
    function endDrag(event: PointerEvent<SVGSVGElement>) {
        drag.current = null;
        if (svg.current?.hasPointerCapture(event.pointerId)) svg.current.releasePointerCapture(event.pointerId);
    }
    function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
        const step = ARROWS[event.key];
        if (!step || !current) return;
        event.preventDefault();
        moveTo(current.key, current.layout.x + step[0], current.layout.y + step[1]);
    }

    function addTable() {
        const base = {seats: 4, shape: 'square' as TableShape, rotation: 0 as const};
        const others: Table[] = state.tables.filter(t => !t.archived && t.zoneId !== zoneId);
        const name = nextTableName([...others, ...draft.map(d => ({id: d.key, name: d.name, zoneId}))]);
        const key = `new-${++added.current}`;
        setDraft(list => [...list, {key, name, layout: {...base, ...findFreeSpot(list.map(d => d.layout), base)}}]);
        setSelected(key);
        setMessage('');
    }
    function removeTable(d: Draft) {
        if (d.id && state.orders.some(o => o.tableId === d.id && o.status === 'open')) {
            setMessage('ამ მაგიდაზე ღია შეკვეთაა — ჯერ დახურეთ ან გადაიტანეთ მაგიდის შეკვეთა');
            return;
        }
        if (d.id) setRemoveIds(ids => [...ids, d.id!]);
        setDraft(list => list.filter(x => x.key !== d.key));
        setSelected('');
        setMessage('');
    }
    async function save() {
        setMessage('');
        const tables = draft.map(({id, name, layout}) => id ? {id, name, layout} : {name, layout});
        if (await act('saveFloorPlan', {pin, zoneId, tables, removeIds})) onDone();
    }

    const shown = message || error;
    return <div className="planeditor">
        <svg ref={svg} className="floorplan editing" viewBox={`0 0 ${PLAN_WIDTH} ${PLAN_HEIGHT}`} role="group" aria-label="განლაგების რედაქტირება"
            onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={onKeyDown}>
            <TableDefs/>
            {draft.map(d => <PlanTable key={d.key} layout={d.layout} name={d.name || '?'} status={tableStatus(d.id ? state.orders.find(o => o.tableId === d.id && o.status === 'open') : undefined)} selected={d.key === selected}
                onOpen={() => setSelected(d.key)} onPointerDown={event => startDrag(d, event)}/>)}
        </svg>
        <aside>
            <h3>{current ? `მაგიდა ${current.name}` : 'განლაგება'}</h3>
            {!current && <p className="muted">აირჩიეთ მაგიდა რუკაზე და გადაათრიეთ სასურველ ადგილას. ისრებით ის 5 ერთეულით გადაადგილდება.</p>}
            {current && <>
                <label>სახელი<input value={current.name} maxLength={40} onChange={e => update(current.key, d => ({...d, name: e.target.value}))}/></label>
                <label>ადგილები</label>
                <div className="seatstepper">
                    <button type="button" aria-label="ადგილის მოკლება" disabled={current.layout.seats <= MIN_SEATS} onClick={() => setLayout(current.key, {seats: current.layout.seats - 1})}>−</button>
                    <b>{current.layout.seats}</b>
                    <button type="button" aria-label="ადგილის დამატება" disabled={current.layout.seats >= MAX_SEATS} onClick={() => setLayout(current.key, {seats: current.layout.seats + 1})}>+</button>
                </div>
                <label>ფორმა</label>
                <div className="tabs">{TABLE_SHAPES.map(shape => <button type="button" key={shape} className={current.layout.shape === shape ? 'selected' : ''} onClick={() => setLayout(current.key, {shape})}>{SHAPE_LABELS[shape]}</button>)}</div>
                <label>შემობრუნება</label>
                <div className="tabs">{([0, 90] as const).map(rotation => <button type="button" key={rotation} className={current.layout.rotation === rotation ? 'selected' : ''} onClick={() => setLayout(current.key, {rotation})}>{rotation}°</button>)}</div>
                <p><button type="button" className="remove" onClick={() => removeTable(current)}>ამოღება</button></p>
            </>}
            <p><button type="button" onClick={addTable} disabled={draft.length >= 200}>+ მაგიდის დამატება</button></p>
            <label>მენეჯერის კოდი<input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e => setPin(e.target.value)}/></label>
            {shown && <p className="error formerror">{shown}</p>}
            <div className="flex">
                <button type="button" className="primary" disabled={busy || !pin} onClick={save}>შენახვა</button>
                <button type="button" onClick={onDone}>გაუქმება</button>
            </div>
        </aside>
    </div>;
}
