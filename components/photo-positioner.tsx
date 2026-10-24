'use client';

import {useEffect, useRef, type KeyboardEvent, type PointerEvent} from 'react';
import type {PhotoCrop} from '@/lib/adapters/image-compressor';

// Same 4:3 shape as the menu tiles, so what is framed here is what the tile shows.
const FRAME_W = 320, FRAME_H = 240, MAX_ZOOM = 3;

export type PhotoView = {x: number; y: number; zoom: number};

// Picture size and offset inside the frame; the picture always covers the whole frame.
function layout(view: PhotoView | null, width: number, height: number) {
    const zoom = Math.min(MAX_ZOOM, Math.max(1, view?.zoom ?? 1));
    const scale = Math.max(FRAME_W / width, FRAME_H / height) * zoom, w = width * scale, h = height * scale;
    const clamp = (value: number, size: number, frame: number) => Math.min(0, Math.max(frame - size, value));
    return {zoom, w, h, x: clamp(view?.x ?? (FRAME_W - w) / 2, w, FRAME_W), y: clamp(view?.y ?? (FRAME_H - h) / 2, h, FRAME_H)};
}

/** The part of the original picture the frame shows, as fractions of its width and height. */
export function cropFor(view: PhotoView | null, width: number, height: number): PhotoCrop {
    const l = layout(view, width, height);
    return {x: -l.x / l.w, y: -l.y / l.h, w: FRAME_W / l.w, h: FRAME_H / l.h};
}

/** Drag the picture with the mouse or a finger to frame it; zoom with the wheel or the slider. */
export function PhotoPositioner({src, width, height, view, onChange, disabled}: {src: string; width: number; height: number; view: PhotoView | null; onChange: (view: PhotoView | null) => void; disabled?: boolean}) {
    const l = layout(view, width, height);
    const drag = useRef<{px: number; py: number; x: number; y: number} | null>(null);
    const frame = useRef<HTMLDivElement>(null);
    // Zooming keeps the frame's centre on the same spot of the picture.
    const zoomTo = (zoom: number) => {
        const next = Math.min(MAX_ZOOM, Math.max(1, zoom)), ratio = next / l.zoom;
        onChange({zoom: next, x: FRAME_W / 2 - (FRAME_W / 2 - l.x) * ratio, y: FRAME_H / 2 - (FRAME_H / 2 - l.y) * ratio});
    };
    const zoomRef = useRef(zoomTo);
    useEffect(() => { zoomRef.current = zoomTo; });
    // React's wheel listener is passive; a native one can stop the modal from scrolling while zooming.
    useEffect(() => {
        const el = frame.current;
        if (!el || disabled) return;
        const wheel = (event: WheelEvent) => { event.preventDefault(); zoomRef.current(Math.exp(-event.deltaY / 400) * currentZoom(el)); };
        el.addEventListener('wheel', wheel, {passive: false});
        return () => el.removeEventListener('wheel', wheel);
    }, [disabled]);
    const down = (event: PointerEvent<HTMLDivElement>) => {
        if (disabled) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {px: event.clientX, py: event.clientY, x: l.x, y: l.y};
    };
    const move = (event: PointerEvent<HTMLDivElement>) => {
        const d = drag.current;
        if (d) onChange({zoom: l.zoom, x: d.x + event.clientX - d.px, y: d.y + event.clientY - d.py});
    };
    const key = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? 30 : 8, moves: Record<string, [number, number]> = {ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step]};
        if (!moves[event.key] || disabled) return;
        event.preventDefault();
        onChange({zoom: l.zoom, x: l.x + moves[event.key][0], y: l.y + moves[event.key][1]});
    };
    return <div className="photopositioner">
        <div ref={frame} className="positionframe" data-zoom={l.zoom} tabIndex={disabled ? -1 : 0} role="application" aria-label="ფოტოს პოზიცია: გადაათრიეთ ან გამოიყენეთ ისრები"
            onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={key}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" draggable={false} style={{left: l.x, top: l.y, width: l.w, height: l.h}}/>
        </div>
        <div className="positionzoom">
            <button type="button" disabled={disabled || l.zoom <= 1} onClick={() => zoomTo(l.zoom / 1.2)} aria-label="დაპატარავება">−</button>
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={l.zoom} disabled={disabled} aria-label="ზუმი" onChange={event => zoomTo(Number(event.target.value))}/>
            <button type="button" disabled={disabled || l.zoom >= MAX_ZOOM} onClick={() => zoomTo(l.zoom * 1.2)} aria-label="გადიდება">+</button>
            <button type="button" disabled={disabled || !view} onClick={() => onChange(null)}>ცენტრში</button>
        </div>
        <p className="muted">გადაათრიეთ ფოტო მაუსით, რომ სასურველი ნაწილი ჩანდეს. გადიდება — მაუსის ბორბლით ან სლაიდერით.</p>
    </div>;
}

const currentZoom = (el: HTMLElement) => Number(el.dataset.zoom) || 1;
