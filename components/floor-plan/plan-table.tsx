'use client';

import type {KeyboardEvent, PointerEvent} from 'react';
import type {TableLayout} from '@/lib/pos';
import {CHAIR, STATUS_LABELS, chairPositions, tableSize, type TableStatus} from '@/lib/floor-plan';

type Props = {
    layout: TableLayout;
    name: string;
    status: TableStatus;
    amount?: string;
    selected?: boolean;
    onOpen?: () => void;
    onPointerDown?: (event: PointerEvent<SVGGElement>) => void;
};

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
    return <g role="button" tabIndex={0} aria-label={`მაგიდა ${name}, ${STATUS_LABELS[status]}${amount ? `, ${amount}` : ''}`}
        className={`plantable ${status}${selected ? ' selected' : ''}`} transform={`translate(${layout.x} ${layout.y})`}
        onClick={onOpen} onKeyDown={onKeyDown} onPointerDown={onPointerDown}>
        <g transform={layout.rotation ? `rotate(${layout.rotation})` : undefined}>
            {chairPositions(layout).map((c, i) => <rect key={i} className="chair" x={-CHAIR / 2} y={-CHAIR * 0.375} width={CHAIR} height={CHAIR * 0.75} rx={6}
                transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${c.angle + 90})`}/>)}
            {layout.shape === 'round'
                ? <circle className="planshape" r={w / 2}/>
                : <rect className="planshape" x={-w / 2} y={-h / 2} width={w} height={h} rx={layout.shape === 'square' ? 6 : 16}/>}
        </g>
        {lines.map(l => {
            const length = fit(l.text, l.size);
            return <text key={l.cls} className={l.cls} y={l.y} textLength={length} lengthAdjust={length ? 'spacingAndGlyphs' : undefined}>{l.text}</text>;
        })}
    </g>;
}
