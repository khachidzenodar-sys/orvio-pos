'use client';
import {useMemo, useState, type FormEvent} from 'react';
import type {PosState} from '@/lib/pos';
import type {Row} from '@/lib/printing/receipt-layout';
import {businessDay, cashCheck, computeDayReport, differenceText, parseAmount, type DayClose, type DayTotals} from '@/lib/day-report';
import {dayReportRows} from '@/lib/printing/day-report-layout';
import {money, when} from '@/lib/format';

export type DayReportProps = {
  state: PosState; busy: boolean; error: string;
  act: (action: string, payload: Record<string, unknown>) => Promise<unknown>; // resolves null on failure
  print: (rows: Row[]) => Promise<void>;
};

const message = (e: unknown) => e instanceof Error ? e.message : String(e);
const diffClass = (n: number) => `cashdiff ${n < 0 ? 'short' : n > 0 ? 'over' : 'even'}`;
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

function TotalsPanels({totals}: {totals: DayTotals}) {
  return <div className="reportgrid">
    <section className="panel pad">
      <h2>გაყიდვები</h2>
      <div className="summaryrow"><span>დახურული ანგარიშები</span><b>{totals.closedBills}</b></div>
      <div className="summaryrow"><span>მთლიანი</span><b>{money(totals.gross)}</b></div>
      <div className="summaryrow"><span>ფასდაკლებები</span><b>{money(totals.discounts)}</b></div>
      <div className="summaryrow"><span>გაუქმებები</span><b>{totals.voidCount} ც. / {money(totals.voidValue)}</b></div>
      <div className="summaryrow total"><span>წმინდა</span><b>{money(totals.net)}</b></div>
    </section>
    <section className="panel pad">
      <h2>გადახდები</h2>
      <div className="summaryrow"><span>ნაღდი</span><b>{money(totals.payments.cash)}</b></div>
      <div className="summaryrow"><span>ბარათი</span><b>{money(totals.payments.card)}</b></div>
      <div className="summaryrow"><span>სხვა</span><b>{money(totals.payments.other)}</b></div>
      <div className="summaryrow total"><span>სულ</span><b>{money(totals.payments.total)}</b></div>
    </section>
  </div>;
}

function CloseRecord({record, onPrint, onBack}: {record: DayClose; onPrint(): void; onBack(): void}) {
  return <section className="panel pad">
    <div className="receipthead">
      <h2>{record.date} · #{record.sequence} {record.sequence > 1 && <span className="badge warm">განმეორებითი</span>}</h2>
      <div className="flex"><button onClick={onBack}>← სია</button><button className="primary" onClick={onPrint}>ბეჭდვა</button></div>
    </div>
    <p className="muted">დახურულია {when(record.closedAt)}{record.closedBy ? ` · ${record.closedBy}` : ''}</p>
    <TotalsPanels totals={record.totals}/>
    <div className="summaryrow"><span>ღია ანგარიშები დახურვისას</span><b>{record.totals.openBills} / {money(record.totals.openAmount)}</b></div>
    <div className="summaryrow"><span>საშუალო ჩეკი</span><b>{money(record.totals.averageCheck)}</b></div>
    <div className="summaryrow"><span>სალაროში დილით დატოვებული თანხა</span><b>{money(record.openingFloat)}</b></div>
    <div className="summaryrow"><span>მოსალოდნელი ნაღდი</span><b>{money(record.expectedCash)}</b></div>
    <div className="summaryrow"><span>დათვლილი ნაღდი</span><b>{money(record.countedCash)}</b></div>
    <div className="summaryrow"><span>სხვაობა</span><b className={diffClass(record.difference)}>{differenceText(record.difference)}</b></div>
    {record.note && <p className="muted">შენიშვნა: {record.note}</p>}
  </section>;
}

/** End-of-day report with cash reconciliation and the saved day-close history. */
export function DayReportView({state, busy, error, act, print}: DayReportProps) {
  const today = businessDay(new Date().toISOString());
  const [tab, setTab] = useState<'day' | 'history'>('day');
  const [date, setDate] = useState(today);
  const [floatText, setFloatText] = useState('');
  const [countedText, setCountedText] = useState('');
  const [note, setNote] = useState('');
  const [closedBy, setClosedBy] = useState('');
  const [closing, setClosing] = useState(false);
  const [pin, setPin] = useState('');
  const [sent, setSent] = useState(false);
  const [printError, setPrintError] = useState('');
  const [opened, setOpened] = useState<{id?: string; date?: string} | null>(null);

  const day = isDay(date) ? date : today;
  const report = useMemo(() => computeDayReport(state, day), [state, day]);
  const t = report.totals;
  const floatInput = parseAmount(floatText);
  const countedInput = parseAmount(countedText);
  const openingFloat = floatInput.ok ? floatInput.value ?? 0 : 0;
  const counted = countedInput.ok ? countedInput.value : null;
  const check = cashCheck(openingFloat, t.payments.cash, counted);
  const canClose = floatInput.ok && countedInput.ok && counted !== null && note.length <= 500 && !busy;

  const history = useMemo(() => [...(state.dayCloses ?? [])].sort((a, b) => b.closedAt.localeCompare(a.closedAt)), [state.dayCloses]);
  const record = opened ? history.find(c => opened.id ? c.id === opened.id : c.date === opened.date) : undefined;

  async function send(rows: Row[]) {
    setPrintError('');
    try {await print(rows);} catch (e) {setPrintError(message(e));}
  }
  const printLive = () => send(dayReportRows({
    date: day, printedAt: new Date().toISOString(), totals: t, openingFloat, expectedCash: check.expected,
  }));
  const printRecord = (c: DayClose) => send(dayReportRows({
    date: c.date, printedAt: new Date().toISOString(), totals: c.totals, openingFloat: c.openingFloat, expectedCash: c.expectedCash,
    countedCash: c.countedCash, difference: c.difference, sequence: c.sequence, closedAt: c.closedAt, closedBy: c.closedBy, note: c.note,
  }));

  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canClose || counted === null) return;
    setSent(true);
    const ok = await act('closeDay', {pin, date: day, openingFloat, countedCash: counted, note: note.trim(), ...(closedBy.trim() ? {closedBy: closedBy.trim()} : {})});
    setPin('');
    if (!ok) return;
    setSent(false); setClosing(false); setCountedText(''); setNote('');
    setOpened({date: day}); setTab('history');
  }

  return <>
    <div className="toolbar">
      <div className="tabs">
        <button className={tab === 'day' ? 'selected' : ''} onClick={() => setTab('day')}>მიმდინარე</button>
        <button className={tab === 'history' ? 'selected' : ''} onClick={() => {setTab('history'); setOpened(null);}}>დახურვების ისტორია</button>
      </div>
      {tab === 'day' && <label className="flex">თარიღი<input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}/></label>}
    </div>
    {printError && <div role="alert" className="error formerror">{printError}</div>}

    {tab === 'day' && <>
      <div className="stats">
        <div><span>დახურული ანგარიშები</span><strong>{t.closedBills}</strong></div>
        <div><span>წმინდა გაყიდვები</span><strong>{money(t.net)}</strong></div>
        <div><span>საშუალო ჩეკი</span><strong>{money(t.averageCheck)}</strong></div>
        <div><span>ღია ანგარიშები</span><strong>{t.openBills} / {money(t.openAmount)}</strong></div>
      </div>
      <TotalsPanels totals={t}/>
      {t.payments.total !== t.net && <p className="muted">გადახდები ითვლება გადახდის დღით, გაყიდვები კი ანგარიშის დახურვის დღით. ამიტომ ღია ანგარიშის ნაწილობრივი გადახდა ან სხვა დღეს გახსნილი ანგარიში ჯამებს შორის სხვაობას იძლევა.</p>}
      <section className="panel pad">
        <h2>ღია ანგარიშები</h2>
        {report.openBills.length === 0 ? <p className="muted">ღია ანგარიშები არ არის</p> : <table>
          <thead><tr><th>მაგიდა</th><th>ჯამი</th><th>გადახდილი</th><th>დარჩენილი</th><th>გაუქმებები</th></tr></thead>
          <tbody>{report.openBills.map(b => <tr key={b.orderId}><td>{b.tableName}</td><td>{money(b.total)}</td><td>{money(b.paid)}</td><td><b>{money(b.due)}</b></td><td>{b.voidCount ? `${b.voidCount} ც. / ${money(b.voidValue)}` : '—'}</td></tr>)}</tbody>
        </table>}
      </section>
      <section className="panel pad stockform">
        <h2>სალაროს შემოწმება</h2>
        <div className="dayreport-cash">
          <label>სალაროში დილით დატოვებული თანხა<input inputMode="decimal" placeholder="0.00" value={floatText} onChange={e => setFloatText(e.target.value)}/>
            {!floatInput.ok && <small className="error">{floatInput.error}</small>}</label>
          <label>დათვლილი ნაღდი<input inputMode="decimal" placeholder="0.00" value={countedText} onChange={e => setCountedText(e.target.value)}/>
            {!countedInput.ok && <small className="error">{countedInput.error}</small>}</label>
          <div className="summaryrow"><span>მოსალოდნელი ნაღდი (დილის თანხა + ნაღდი გადახდები)</span><b>{money(check.expected)}</b></div>
          <div className="summaryrow"><span>სხვაობა</span>{floatInput.ok && check.status && check.difference !== null ? <b className={`cashdiff ${check.status}`}>{differenceText(check.difference)}</b> : <b className="muted">—</b>}</div>
          <label>შენიშვნა<textarea maxLength={500} value={note} onChange={e => setNote(e.target.value)}/></label>
          <label>ვინ ხურავს<input maxLength={100} value={closedBy} onChange={e => setClosedBy(e.target.value)}/></label>
        </div>
        <div className="buttonrow">
          <button onClick={printLive}>ბეჭდვა</button>
          <button className="primary" disabled={!canClose} onClick={() => {setClosing(true); setSent(false);}}>დღის დახურვა</button>
        </div>
        {closing && <form onSubmit={confirm}>
          <p className="muted">დახურვა ინახავს ჯამების ასლს. შეკვეთები არ იცვლება და გაყიდვა გრძელდება.</p>
          <label>მენეჯერის კოდი<input type="password" inputMode="numeric" autoComplete="off" required minLength={4} maxLength={12} value={pin} onChange={e => setPin(e.target.value)}/></label>
          <div className="buttonrow">
            <button type="button" disabled={busy} onClick={() => {setClosing(false); setPin('');}}>გაუქმება</button>
            <button type="submit" className="primary" disabled={!canClose || !pin}>დადასტურება</button>
          </div>
        </form>}
        {sent && error && <div role="alert" className="error formerror">{error}</div>}
      </section>
    </>}

    {tab === 'history' && (record ? <CloseRecord record={record} onPrint={() => printRecord(record)} onBack={() => setOpened(null)}/> :
      <section className="panel pad">
        <h2>დახურვების ისტორია</h2>
        {history.length === 0 ? <p className="muted">დახურვები ჯერ არ არის</p> : <table>
          <thead><tr><th>თარიღი</th><th>#</th><th>წმინდა</th><th>მოსალოდნელი</th><th>დათვლილი</th><th>სხვაობა</th><th/></tr></thead>
          <tbody>{history.map(c => <tr key={c.id}>
            <td>{c.date}<small>{when(c.closedAt)}</small></td>
            <td>#{c.sequence} {c.sequence > 1 && <span className="badge warm">განმეორებითი</span>}</td>
            <td>{money(c.totals.net)}</td><td>{money(c.expectedCash)}</td><td>{money(c.countedCash)}</td>
            <td><b className={diffClass(c.difference)}>{differenceText(c.difference)}</b></td>
            <td><button onClick={() => setOpened({id: c.id})}>ნახვა</button></td>
          </tr>)}</tbody>
        </table>}
      </section>)}
  </>;
}
