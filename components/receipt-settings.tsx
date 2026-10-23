'use client';

import {useState, type ChangeEvent} from 'react';
import {compressProductPhoto} from '@/lib/adapters/image-compressor';

type Props = {logo?: string; busy: boolean; act: (action: string, payload: Record<string, unknown>) => Promise<unknown>};

// Manager screen for the guest-check logo: pick a picture, preview it, save or remove with the manager PIN.
export function ReceiptSettings({logo, busy, act}: Props) {
    const [pending, setPending] = useState<string | null | undefined>(undefined);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const shown = pending === undefined ? logo : pending;
    async function pick(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setError('');
        try { setPending((await compressProductPhoto(file)).dataUrl); }
        catch (e) { setPending(undefined); setError(e instanceof Error ? e.message : String(e)); }
    }
    async function save() {
        setError('');
        if (await act('setReceiptLogo', {logo: pending ?? null, pin})) { setPending(undefined); setPin(''); }
        else setPin('');
    }
    return <section className="panel pad receiptsettings">
        <h2>ჩეკის ლოგო</h2>
        <p className="muted">ლოგო იბეჭდება სტუმრის ჩეკის თავში, შავ-თეთრად. საუკეთესოა მუქი ლოგო თეთრ ფონზე.</p>
        <div className="logopreview">{shown
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={shown} alt="ჩეკის ლოგო"/>
            : <span className="muted">ლოგო არ არის დამატებული</span>}</div>
        <div className="flex">
            <label className="button">{logo || pending ? 'ლოგოს შეცვლა' : 'ლოგოს დამატება'}<input className="visuallyhidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={pick}/></label>
            {(logo && pending === undefined) && <button type="button" onClick={() => setPending(null)}>ლოგოს წაშლა</button>}
        </div>
        {pending !== undefined && <div className="logosave">
            <p className="muted">{pending ? 'ახალი ლოგო ჯერ შენახული არ არის.' : 'ლოგო წაიშლება.'}</p>
            <label>მენეჯერის კოდი<input type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)}/></label>
            <div className="flex"><button type="button" className="primary" disabled={busy || !pin} onClick={save}>შენახვა</button><button type="button" onClick={() => { setPending(undefined); setPin(''); }}>გაუქმება</button></div>
        </div>}
        {error && <div role="alert" className="error formerror">{error}</div>}
    </section>;
}
