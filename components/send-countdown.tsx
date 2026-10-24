'use client';

import {useEffect, useState} from 'react';

export const SEND_DELAY_MS = 5000;
export const sendDeadline = () => Date.now() + SEND_DELAY_MS;

// Toast shown while a send to the departments is held back; "გაუქმება" stops it.
export function SendCountdown({table, until, onCancel}: {table: string; until: number; onCancel: () => void}) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 200);
        return () => clearInterval(timer);
    }, []);
    const left = Math.max(0, until - now);
    return <div className="sendcountdown" role="status" aria-live="polite">
        <div><b>მაგიდა {table}</b> · განყოფილებებში გაიგზავნება {Math.ceil(left / 1000)} წამში</div>
        <button type="button" onClick={onCancel}>გაუქმება</button>
        <i style={{width: `${(left / SEND_DELAY_MS) * 100}%`}}/>
    </div>;
}
