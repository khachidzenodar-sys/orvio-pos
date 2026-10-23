'use client';

import type {KeyboardEvent, PointerEvent} from 'react';
import type {TableLayout} from '@/lib/pos';
import {CHAIR, GAP, STATUS_LABELS, chairPositions, tableSize, type TableStatus} from '@/lib/floor-plan';

type Props = {
    layout: TableLayout;
    name: string;
    status: TableStatus;
    amount?: string;
    selected?: boolean;
    onOpen?: () => void;
    onPointerDown?: (event: PointerEvent<SVGGElement>) => void;
};

// Shared paint for every table drawing; render once inside each <svg>.
export function TableDefs() {
    return <defs>
        <linearGradient id="orvio-wood" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ecd3a6"/><stop offset=".55" stopColor="#dcb57c"/><stop offset="1" stopColor="#c99a5e"/>
        </linearGradient>
        <linearGradient id="orvio-grain" x1="0" y1="0" x2="0" y2="1" spreadMethod="repeat">
            <stop offset="0" stopColor="#fff" stopOpacity=".16"/><stop offset=".5" stopColor="#8a5a2b" stopOpacity=".07"/><stop offset="1" stopColor="#fff" stopOpacity=".16"/>
        </linearGradient>
        <filter id="orvio-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#3b2a14" floodOpacity=".28"/>
        </filter>
    </defs>;
}

// Space a table takes including its chairs, for sizing a standalone drawing.
export function tableFootprint(layout: Pick<TableLayout, 'seats' | 'shape'>) {
    const size = tableSize(layout), pad = 2 * (GAP + CHAIR) + 8;
    return {width: size.width + pad, height: size.height + pad};
}

// Top-down chair: the seat faces the table (+y), the backrest sits on the far side.
function Chair({x, y, angle}: {x: number; y: number; angle: number}) {
    return <g className="chair" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle + 90})`}>
        <rect className="chairseat" x={-CHAIR / 2} y={-CHAIR * 0.32} width={CHAIR} height={CHAIR * 0.72} rx={6}/>
        <rect className="chairback" x={-CHAIR / 2 - 1} y={-CHAIR * 0.5} width={CHAIR + 2} height={CHAIR * 0.26} rx={4}/>
    </g>;
}

export function PlanTable({layout, name, status, amount, selected, onOpen, onPointerDown}: Props) {
    const size = tableSize(layout), w = size.width, h = size.height;
    const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen?.();
    };
    // Small or narrow tables drop the seat line under an amount; long text is squeezed to stay inside the table.
    const lines = !amount ? [{text: name, y: -12, cls: 'planname', size: 26}, {text: `${layout.seats} ადგ.`, y: 18, cls: 'planmeta', size: 18}]
        : Math.min(w, h) < 100 ? [{text: name, y: -10, cls: 'planname', size: 26}, {text: amount, y: 18, cls: 'planamount', size: 19}]
            : [{text: name, y: -24, cls: 'planname', size: 26}, {text: `${layout.seats} ადგ.`, y: 2, cls: 'planmeta', size: 18}, {text: amount, y: 26, cls: 'planamount', size: 19}];
    const room = (layout.rotation === 90 ? h : w) - 12;
    const fit = (text: string, size: number) => text.length * size * 0.56 > room ? room : undefined;
    const shape = (cls: string, inset = 0) => layout.shape === 'round'
        ? <circle className={cls} r={w / 2 - inset}/>
        : <rect className={cls} x={-w / 2 + inset} y={-h / 2 + inset} width={w - 2 * inset} height={h - 2 * inset} rx={Math.max(2, (layout.shape === 'square' ? 8 : 14) - inset)}/>;
    const interactive = !!(onOpen || onPointerDown);
    return <g role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} aria-label={interactive ? `მაგიდა ${name}, ${STATUS_LABELS[status]}${amount ? `, ${amount}` : ''}` : undefined}
        className={`plantable ${status}${selected ? ' selected' : ''}`} transform={`translate(${layout.x} ${layout.y})`}
        onClick={onOpen} onKeyDown={onKeyDown} onPointerDown={onPointerDown}>
        <g transform={layout.rotation ? `rotate(${layout.rotation})` : undefined}>
            {chairPositions(layout).map((c, i) => <Chair key={i} {...c}/>)}
            <g filter="url(#orvio-shadow)">{shape('planshape')}</g>
            {shape('plangrain')}
            {shape('planstatus', 7)}
        </g>
        {lines.map(l => {
            const length = fit(l.text, l.size);
            return <text key={l.cls} className={l.cls} y={l.y} textLength={length} lengthAdjust={length ? 'spacingAndGlyphs' : undefined}>{l.text}</text>;
        })}
    </g>;
}
