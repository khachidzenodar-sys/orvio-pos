'use client';

import {useEffect, useState} from 'react';
import type {PrinterSettings as Settings} from '@/lib/ports/printer';

const message = (error: unknown) => error instanceof Error ? error.message : String(error);

/** Picks the Windows printer for receipts; without one, printing uses the print dialog. */
export function PrinterSettings({settings}: {settings: Settings}) {
  const [printers, setPrinters] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let live = true;
    // Loaded independently so a failing printer list never hides the saved choice.
    Promise.allSettled([settings.list(), settings.selected()])
      .then(([list, current]) => {
        if (!live) return;
        if (list.status === 'fulfilled') setPrinters(list.value);
        if (current.status === 'fulfilled') setSelected(current.value);
        const failed = [list, current].find((r): r is PromiseRejectedResult => r.status === 'rejected');
        setError(failed ? message(failed.reason) : '');
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [settings, reloads]);

  async function choose(name: string) {
    setNotice(''); setError('');
    try { await settings.select(name || null); setSelected(name || null); setNotice('შენახულია'); }
    catch (e) { setError(message(e)); }
  }

  async function testPrint() {
    setNotice(''); setError(''); setTesting(true);
    try { await settings.testPrint(); setNotice('საცდელი ჩეკი გაიგზავნა პრინტერზე'); }
    catch (e) { setError(message(e)); }
    finally { setTesting(false); }
  }

  const missing = selected !== null && !loading && !printers.includes(selected);

  return <section className="panel pad">
    <h2>პრინტერი</h2>
    <p className="muted">80 მმ თერმული პრინტერი ჩეკებისა და განყოფილებების ჩეკებისთვის. თუ პრინტერი არ არის არჩეული, ბეჭდვა გაიხსნება ბეჭდვის ფანჯარაში.</p>
    <select aria-label="ჩეკის პრინტერი" value={selected ?? ''} disabled={loading || testing} onChange={event => choose(event.target.value)}>
      <option value="">არ არის არჩეული (ბეჭდვის ფანჯარა)</option>
      {missing && <option value={selected!}>{selected} (ვერ მოიძებნა)</option>}
      {printers.map(name => <option key={name} value={name}>{name}</option>)}
    </select>
    <div className="buttonrow">
      <button disabled={loading || testing} onClick={() => { setLoading(true); setNotice(''); setReloads(n => n + 1); }}>სიის განახლება</button>
      <button className="primary" disabled={!selected || loading || testing} onClick={testPrint}>{testing ? 'იბეჭდება…' : 'საცდელი ბეჭდვა'}</button>
    </div>
    {notice && <p role="status" className="muted">{notice}</p>}
    {error && <div role="alert" className="error formerror">{error}</div>}
  </section>;
}
