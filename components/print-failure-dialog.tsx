'use client';

/** Shown when the thermal printer fails; the order itself was already saved. */
export function PrintFailureDialog({message, busy = false, onRetry, onDialog, onClose}: {message: string; busy?: boolean; onRetry(): void; onDialog(): void; onClose(): void}) {
  return <div className="overlay">
    <section role="alertdialog" aria-modal="true" aria-label="ბეჭდვა ვერ მოხერხდა" className="modal">
      <div className="receipthead"><h2>ბეჭდვა ვერ მოხერხდა</h2></div>
      <div role="alert" className="error formerror">{message}</div>
      <p className="muted">შეკვეთის მონაცემები შენახულია და არ შეცვლილა.</p>
      <button className="primary full" disabled={busy} onClick={onRetry}>{busy ? 'იბეჭდება…' : 'თავიდან ცდა'}</button>
      <div className="buttonrow">
        <button disabled={busy} onClick={onDialog}>ბეჭდვის ფანჯრიდან</button>
        <button disabled={busy} onClick={onClose}>დახურვა</button>
      </div>
    </section>
  </div>;
}
