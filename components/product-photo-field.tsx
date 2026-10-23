'use client';

import {useState, type ChangeEvent, type DragEvent, type KeyboardEvent} from 'react';
import type {Product} from '@/lib/pos';
import {PHOTO_ACCEPT} from '@/lib/product-photo';
import {compressProductPhoto, type CompressedPhoto} from '@/lib/adapters/image-compressor';

const message = (error: unknown) => error instanceof Error ? error.message : String(error);

/** Photo editor inside the product modal; saves on its own with the manager PIN, never via the main form. */
export function ProductPhotoField({product, busy, onSave}: {product?: Product; busy: boolean; onSave: (photo: string | null, pin: string) => Promise<boolean>}) {
  const [pending, setPending] = useState<CompressedPhoto | null>(null);
  const [removing, setRemoving] = useState(false);
  const [working, setWorking] = useState(false);
  const [localError, setLocalError] = useState('');
  const [pin, setPin] = useState('');
  const [dragover, setDragover] = useState(false);

  if (!product) return <fieldset className="photofield"><legend>ფოტო</legend><p className="muted">ფოტოს დამატება შესაძლებელია პროდუქტის შენახვის შემდეგ.</p></fieldset>;

  const disabled = busy || working;
  const editing = !!pending || removing;

  async function pick(file?: File) {
    if (!file || disabled) return;
    setLocalError(''); setWorking(true);
    try { setPending(await compressProductPhoto(file)); setRemoving(false); }
    catch (e) { setLocalError(message(e)); }
    finally { setWorking(false); }
  }
  const choose = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; pick(file); };
  const drop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragover(false); pick(event.dataTransfer.files?.[0]); };
  const cancel = () => { setPending(null); setRemoving(false); setPin(''); setLocalError(''); };

  async function save() {
    if (disabled || !editing || !pin) return;
    setLocalError(''); setWorking(true);
    try {
      if (await onSave(removing ? null : pending!.dataUrl, pin)) { setPending(null); setRemoving(false); }
      setPin('');
    } finally { setWorking(false); }
  }
  // Enter in the PIN field must save the photo, not submit the product form around it.
  const pinKey = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') { event.preventDefault(); save(); } };

  const shown = removing ? undefined : pending?.dataUrl ?? product.photo;
  return <fieldset className="photofield">
    <legend>ფოტო</legend>
    <div className="photorow">
      <div className={`photoframe${dragover ? ' dragover' : ''}${removing ? ' removing' : ''}`} onDragOver={event => { event.preventDefault(); if (!disabled) setDragover(true); }} onDragLeave={() => setDragover(false)} onDrop={drop}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {shown ? <img src={shown} alt={product.name} width={pending && !removing ? pending.width : 400} height={pending && !removing ? pending.height : 300} decoding="async" draggable={false}/> : <span className="muted">ფოტო არ არის</span>}
      </div>
      <div className="photoactions">
        <label className={`button${disabled ? ' disabled' : ''}`} aria-disabled={disabled}>
          {product.photo || pending ? 'ფოტოს შეცვლა' : 'ფოტოს დამატება'}
          <input className="photoinput" type="file" accept={PHOTO_ACCEPT} disabled={disabled} onChange={choose}/>
        </label>
        {product.photo && !removing && <button type="button" disabled={disabled} onClick={() => { setPending(null); setRemoving(true); setLocalError(''); }}>ფოტოს წაშლა</button>}
        {working && <p className="muted" role="status">ფოტო მუშავდება…</p>}
        {pending && !removing && <p className="muted">{pending.kilobytes} კბ · {pending.width}×{pending.height}</p>}
        {removing && <p className="muted">ფოტო წაიშლება</p>}
      </div>
    </div>
    {localError && <div role="alert" className="error formerror">{localError}</div>}
    {editing && <div className="photoconfirm">
      <label>მენეჯერის კოდი<input type="password" inputMode="numeric" autoComplete="off" maxLength={12} value={pin} disabled={disabled} onChange={event => setPin(event.target.value)} onKeyDown={pinKey}/></label>
      <div className="buttonrow">
        <button type="button" className="primary" disabled={disabled || !pin} onClick={save}>შენახვა</button>
        <button type="button" disabled={working} onClick={cancel}>გაუქმება</button>
      </div>
    </div>}
  </fieldset>;
}
