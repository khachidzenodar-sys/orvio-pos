'use client';

import {useState, type FormEvent} from 'react';
import {backupFileName} from '@/lib/backup';
import type {DemoStore} from '@/lib/demo-store';
import type {BackupFiles} from '@/lib/ports/backup-files';
import {when} from '@/lib/format';

type Store = Pick<DemoStore, 'exportBackup' | 'inspectBackup' | 'restoreBackup'>;
type Pending = {text: string; createdAt: string; orders: number; products: number};

const message = (error: unknown) => error instanceof Error ? error.message : String(error);

/** Saves all local data to a file and restores it, never without a manager PIN. */
// onFailed lets the workspace pick up the version/lockout change a wrong PIN writes.
export function BackupPanel({files, store, onRestored, onFailed}: {files: BackupFiles; store: Store; onRestored(): void; onFailed(): void}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [restoreError, setRestoreError] = useState('');

  async function run(work: () => Promise<void>) {
    setNotice(''); setError(''); setBusy(true);
    try { await work(); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }

  const save = () => run(async () => {
    if (await files.save(backupFileName(new Date()), await store.exportBackup())) setNotice('სარეზერვო ასლი შენახულია');
  });

  const pick = () => run(async () => {
    const text = await files.open();
    if (text === null) return;
    const {createdAt, summary} = await store.inspectBackup(text);
    setRestoreError('');
    setPending({text, createdAt, ...summary});
  });

  async function restore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) return;
    const pin = String(new FormData(event.currentTarget).get('pin') || '');
    setRestoreError(''); setBusy(true);
    try { await store.restoreBackup(pending.text, pin); setPending(null); onRestored(); }
    catch (e) { setRestoreError(message(e)); onFailed(); }
    finally { setBusy(false); }
  }

  return <section className="panel pad">
    <h2>სარეზერვო ასლი</h2>
    <p className="muted">შეინახეთ ყველა მონაცემი ფაილში (მაგალითად, USB ფლეშზე) და საჭიროების შემთხვევაში აღადგინეთ.</p>
    <div className="buttonrow">
      <button className="primary" disabled={busy} onClick={save}>სარეზერვო ასლის შენახვა</button>
      <button disabled={busy} onClick={pick}>აღდგენა ფაილიდან</button>
    </div>
    {notice && <p role="status" className="muted">{notice}</p>}
    {error && <div role="alert" className="error formerror">{error}</div>}
    {pending && <div className="overlay">
      <section role="dialog" aria-modal="true" aria-label="აღდგენა ფაილიდან" className="modal">
        <div className="receipthead"><h2>აღდგენა ფაილიდან</h2><button aria-label="დახურვა" disabled={busy} onClick={() => setPending(null)}>×</button></div>
        <form onSubmit={restore}>
          <div className="summaryrow"><span>შექმნის თარიღი</span><b>{when(pending.createdAt)}</b></div>
          <div className="summaryrow"><span>შეკვეთები</span><b>{pending.orders}</b></div>
          <div className="summaryrow"><span>პროდუქტები</span><b>{pending.products}</b></div>
          <p className="error formerror">ამ კომპიუტერზე არსებული მონაცემები ჩანაცვლდება ფაილის მონაცემებით. მიმდინარე მონაცემების ასლი ავტომატურად შეინახება.</p>
          <label>მენეჯერის კოდი<input name="pin" type="password" inputMode="numeric" autoComplete="off" required minLength={4} maxLength={12}/></label>
          {restoreError && <div role="alert" className="error formerror">{restoreError}</div>}
          <button type="submit" disabled={busy} className="primary full">{busy ? 'აღდგენა…' : 'აღდგენა'}</button>
        </form>
      </section>
    </div>}
  </section>;
}
