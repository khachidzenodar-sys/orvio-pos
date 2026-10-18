'use client';
import {useState, type FormEvent, type ReactNode} from 'react';
import {countPreview, lineCost, WRITE_OFF_REASONS, type StockItem} from '@/lib/inventory';
import {formatMoney, formatQuantity, formatUnitCost, inputUnitLabels, inputUnits, lineTotal, parseMoney, parseQuantity, type InputUnit} from '@/lib/inventory-format';
import {localDay} from '@/components/stock/stock-reports';
import type {StockAct, StockProps} from '@/components/stock/stock-view';

const message = (e: unknown) => e instanceof Error ? e.message : String(e);
const MINUS = '−';
export const signedMoney = (n: number) => (n > 0 ? '+' : n < 0 ? MINUS : '') + formatMoney(Math.abs(n));
export const signedQuantity = (n: number, item: StockItem) => (n > 0 ? '+' : '') + formatQuantity(n, item.unit);
let seq = 0;
export const rowKey = () => String(++seq);

// Validates locally, then sends; the domain error arrives through the `error` prop and is shown only after this form's own submit.
export function useStockSubmit(act: StockAct) {
  const [problem, setProblem] = useState(''), [sent, setSent] = useState(false), [done, setDone] = useState(false);
  async function run(e: {preventDefault(): void}, action: string, build: () => Record<string, unknown>): Promise<boolean> {
    e.preventDefault();
    setDone(false);
    let payload: Record<string, unknown>;
    try {payload = build();} catch (err) {setProblem(message(err)); setSent(false); return false;}
    setProblem(''); setSent(true);
    const ok = !!(await act(action, payload));
    setDone(ok);
    return ok;
  }
  return {problem, sent, done, run};
}

export function PinField({value, onChange}: {value: string; onChange(v: string): void}) {
  return <label>მენეჯერის კოდი<input type="password" inputMode="numeric" autoComplete="off" value={value} onChange={e => onChange(e.target.value)}/></label>;
}

export function FormFooter({problem, sent, error, busy, label, done, children}: {problem: string; sent: boolean; error: string; busy: boolean; label: string; done?: string; children?: ReactNode}) {
  return <>
    {(problem || (sent && error)) && <div role="alert" className="formerror error">{problem || error}</div>}
    {done && !problem && !error && <div role="status" className="formerror formdone">✓ {done}</div>}
    <div className="buttonrow">{children}<button type="submit" disabled={busy} className="primary">{busy ? 'ინახება…' : label}</button></div>
  </>;
}

export function ItemSelect({items, value, onChange, taken = []}: {items: StockItem[]; value: string; onChange(id: string): void; taken?: string[]}) {
  return <select value={value} onChange={e => onChange(e.target.value)}>
    <option value="">აირჩიეთ პოზიცია</option>
    {items.map(item => <option key={item.id} value={item.id} disabled={item.id !== value && taken.includes(item.id)}>{item.name}</option>)}
  </select>;
}

export function UnitSelect({item, value, onChange}: {item?: StockItem; value: InputUnit; onChange(u: InputUnit): void}) {
  return <select className="unitselect" value={value} disabled={!item} onChange={e => onChange(e.target.value as InputUnit)}>
    {(item ? inputUnits(item.unit) : [value]).map(u => <option key={u} value={u}>{inputUnitLabels[u]}</option>)}
  </select>;
}

// Tbilisi business day, the receipt default.
export const today = () => localDay(new Date().toISOString());
const activeItems = (items: StockItem[]) => items.filter(item => !item.archived);
const find = (items: StockItem[], id: string) => items.find(item => item.id === id);
const tryParse = <T,>(f: () => T): T | null => {try {return f();} catch {return null;}};

type ReceiptRow = {key: string; itemId: string; quantity: string; unit: InputUnit; mode: 'unit' | 'total'; price: string};
const receiptRow = (): ReceiptRow => ({key: rowKey(), itemId: '', quantity: '', unit: 'kg', mode: 'unit', price: ''});
const perUnit = (item?: StockItem) => item?.unit === 'pcs' ? '₾/ცალი' : item?.unit === 'ml' ? '₾/ლ' : '₾/კგ';

function rowTotal(row: ReceiptRow, item: StockItem | undefined): {quantity: number; total: number} {
  if (!item) throw new Error('აირჩიეთ პოზიცია');
  const quantity = parseQuantity(row.quantity, row.unit);
  const price = parseMoney(row.price);
  return {quantity, total: row.mode === 'total' ? price : lineTotal(price, quantity, item.unit)};
}

export function ReceiptForm({state, busy, error, act}: StockProps) {
  const items = activeItems(state.inventory.items);
  const [date, setDate] = useState(today), [supplier, setSupplier] = useState(''), [note, setNote] = useState(''), [pin, setPin] = useState('');
  const [rows, setRows] = useState<ReceiptRow[]>(() => [receiptRow()]);
  const {problem, sent, done, run} = useStockSubmit(act);
  const update = (key: string, patch: Partial<ReceiptRow>) => setRows(rows.map(r => r.key === key ? {...r, ...patch} : r));
  const totals = rows.map(r => tryParse(() => rowTotal(r, find(items, r.itemId))));
  const sum = totals.reduce((a, t) => a + (t?.total ?? 0), 0);

  async function submit(e: FormEvent) {
    const ok = await run(e, 'receiveStock', () => {
      const lines = rows.map((r, i) => {
        try {return {itemId: r.itemId, ...rowTotal(r, find(items, r.itemId))};} catch (err) {throw new Error(`ხაზი ${i + 1}: ${message(err)}`);}
      });
      return {date, ...(supplier.trim() ? {supplier: supplier.trim()} : {}), ...(note.trim() ? {note: note.trim()} : {}), lines, pin};
    });
    if (ok) {setRows([receiptRow()]); setSupplier(''); setNote(''); setPin('');}
  }

  if (!items.length) return <section className="panel pad"><p className="muted">ჯერ დაამატეთ პოზიცია „ნაშთების“ ჩანართში.</p></section>;
  return <section className="panel pad stockform">
    <h2>საქონლის მიღება</h2>
    <form onSubmit={submit}>
      <div className="stockfields">
        <label>თარიღი<input type="date" value={date} required onChange={e => setDate(e.target.value)}/></label>
        <label>მომწოდებელი<input value={supplier} maxLength={200} onChange={e => setSupplier(e.target.value)}/></label>
        <label>შენიშვნა<input value={note} maxLength={200} onChange={e => setNote(e.target.value)}/></label>
      </div>
      {rows.map((r, i) => {
        const item = find(items, r.itemId), total = totals[i];
        return <div className="stockline receiptline" key={r.key}>
          <label>პოზიცია<ItemSelect items={items} value={r.itemId} onChange={id => {const next = find(items, id); update(r.key, {itemId: id, unit: next ? inputUnits(next.unit)[0] : 'kg'});}}/></label>
          <label>რაოდენობა<div className="qtyinput"><input value={r.quantity} inputMode="decimal" onChange={e => update(r.key, {quantity: e.target.value})}/><UnitSelect item={item} value={r.unit} onChange={unit => update(r.key, {unit})}/></div></label>
          <label>ფასი<div className="qtyinput"><input value={r.price} inputMode="decimal" onChange={e => update(r.key, {price: e.target.value})}/>
            <select className="unitselect" value={r.mode} onChange={e => update(r.key, {mode: e.target.value as ReceiptRow['mode']})}>
              <option value="unit">ერთეულის ფასი ({perUnit(item)})</option><option value="total">ხაზის ჯამი (₾)</option>
            </select></div></label>
          <div className="stocklinetotal"><small>ჯამი</small><b>{total ? formatMoney(total.total) : '—'}</b></div>
          <button type="button" aria-label="ხაზის წაშლა" className="stockremove" disabled={rows.length === 1} onClick={() => setRows(rows.filter(x => x.key !== r.key))}>×</button>
        </div>;
      })}
      <button type="button" disabled={rows.length >= 100} onClick={() => setRows([...rows, receiptRow()])}>+ ხაზი</button>
      <div className="summaryrow total"><span>მიღების ჯამი</span><b>{formatMoney(sum)}</b></div>
      <PinField value={pin} onChange={setPin}/>
      <FormFooter problem={problem} sent={sent} error={error} busy={busy} label="მიღების დადასტურება" done={done ? 'მიღება შენახულია. ნაშთი და საშუალო ფასი განახლდა.' : ''}/>
    </form>
  </section>;
}

export function WriteOffForm({state, busy, error, act}: StockProps) {
  const items = activeItems(state.inventory.items);
  const [itemId, setItemId] = useState(''), [quantity, setQuantity] = useState(''), [unit, setUnit] = useState<InputUnit>('kg'), [reason, setReason] = useState(''), [pin, setPin] = useState('');
  const {problem, sent, done, run} = useStockSubmit(act);
  const item = find(items, itemId);
  const q = tryParse(() => parseQuantity(quantity, unit));

  async function submit(e: FormEvent) {
    const ok = await run(e, 'writeOff', () => {
      if (!item) throw new Error('აირჩიეთ პოზიცია');
      if (!reason.trim()) throw new Error('მიუთითეთ ჩამოწერის მიზეზი');
      return {itemId: item.id, quantity: parseQuantity(quantity, unit), reason: reason.trim(), pin};
    });
    if (ok) {setQuantity(''); setReason(''); setPin('');}
  }

  if (!items.length) return <section className="panel pad"><p className="muted">ჯერ დაამატეთ პოზიცია „ნაშთების“ ჩანართში.</p></section>;
  return <section className="panel pad stockform">
    <h2>ჩამოწერა</h2>
    <form onSubmit={submit}>
      <div className="stockfields">
        <label>პოზიცია<ItemSelect items={items} value={itemId} onChange={id => {setItemId(id); const next = find(items, id); if (next) setUnit(inputUnits(next.unit)[0]);}}/></label>
        <label>რაოდენობა<div className="qtyinput"><input value={quantity} inputMode="decimal" onChange={e => setQuantity(e.target.value)}/><UnitSelect item={item} value={unit} onChange={setUnit}/></div></label>
      </div>
      {item && <div className="summaryrow"><span>მიმდინარე ნაშთი</span><b>{formatQuantity(item.quantity, item.unit)} · {formatUnitCost(item.avgCost, item.unit)}</b></div>}
      {item && q !== null && <div className="summaryrow"><span>ჩამოწერის ღირებულება (დაახლ.)</span><b>{formatMoney(lineCost(q, item.avgCost))}</b></div>}
      <label>მიზეზი<input value={reason} maxLength={200} onChange={e => setReason(e.target.value)}/></label>
      <div className="tabs reasonchoices">{WRITE_OFF_REASONS.map(r => <button type="button" key={r} className={reason === r ? 'selected' : ''} onClick={() => setReason(r)}>{r}</button>)}</div>
      <PinField value={pin} onChange={setPin}/>
      <FormFooter problem={problem} sent={sent} error={error} busy={busy} label="ჩამოწერა" done={done ? 'ჩამოწერა შენახულია.' : ''}/>
    </form>
  </section>;
}

type CountInput = {text: string; unit: InputUnit};

export function CountForm({state, busy, error, act}: StockProps) {
  const items = activeItems(state.inventory.items);
  const [inputs, setInputs] = useState<Record<string, CountInput>>({}), [pin, setPin] = useState('');
  const {problem, sent, done, run} = useStockSubmit(act);
  const input = (item: StockItem): CountInput => inputs[item.id] ?? {text: '', unit: inputUnits(item.unit)[0]};
  const set = (item: StockItem, patch: Partial<CountInput>) => setInputs({...inputs, [item.id]: {...input(item), ...patch}});
  const parsed = items.map(item => {
    const v = input(item);
    if (!v.text.trim()) return {item, quantity: null, problem: ''};
    try {return {item, quantity: parseQuantity(v.text, v.unit, true), problem: ''};} catch (err) {return {item, quantity: null, problem: message(err)};}
  });
  const counts = parsed.flatMap(x => x.quantity === null ? [] : [{itemId: x.item.id, quantity: x.quantity}]);
  const preview = countPreview(state.inventory, counts);

  async function submit(e: FormEvent) {
    const ok = await run(e, 'stockCount', () => {
      const bad = parsed.find(x => x.problem);
      if (bad) throw new Error(`${bad.item.name}: ${bad.problem}`);
      if (!counts.length) throw new Error('მიუთითეთ დათვლილი რაოდენობა მაინც ერთ პოზიციაზე');
      return {counts, pin};
    });
    if (ok) {setInputs({}); setPin('');}
  }

  if (!items.length) return <section className="panel pad"><p className="muted">ჯერ დაამატეთ პოზიცია „ნაშთების“ ჩანართში.</p></section>;
  return <section className="panel pad stockform">
    <h2>ინვენტარიზაცია</h2>
    <p className="muted">ჩაწერეთ ფაქტობრივი რაოდენობა. ცარიელი ველი არ იცვლება.</p>
    <form onSubmit={submit}>
      <table className="stocktable"><thead><tr><th>პოზიცია</th><th>სისტემური ნაშთი</th><th>ფაქტობრივი</th></tr></thead><tbody>
        {parsed.map(({item, problem: rowProblem}) => <tr key={item.id} className={item.quantity < 0 ? 'error' : ''}>
          <td>{item.name}</td>
          <td>{formatQuantity(item.quantity, item.unit)}</td>
          <td><div className="qtyinput"><input value={input(item).text} inputMode="decimal" aria-label={`${item.name} — ფაქტობრივი`} onChange={e => set(item, {text: e.target.value})}/><UnitSelect item={item} value={input(item).unit} onChange={unit => set(item, {unit})}/></div>
            {rowProblem && <small className="error">{rowProblem}</small>}</td>
        </tr>)}
      </tbody></table>
      <h3>სხვაობები</h3>
      {preview.lines.length === 0 ? <p className="muted">სხვაობა არ არის.</p> :
        <table className="stocktable"><thead><tr><th>პოზიცია</th><th>სისტემური</th><th>ფაქტობრივი</th><th>სხვაობა</th><th>ღირებულება</th></tr></thead><tbody>
          {preview.lines.map(line => {
            const item = find(items, line.itemId)!;
            return <tr key={line.itemId} className={line.diff < 0 ? 'shortage' : 'surplus'}>
              <td>{item.name}</td><td>{formatQuantity(line.system, item.unit)}</td><td>{formatQuantity(line.counted, item.unit)}</td>
              <td>{signedQuantity(line.diff, item)}</td><td>{signedMoney(line.value)}</td>
            </tr>;
          })}
        </tbody></table>}
      <div className="summaryrow"><span>ნამეტი</span><b>{signedMoney(preview.surplus)}</b></div>
      <div className="summaryrow"><span>დანაკლისი</span><b>{signedMoney(-preview.shortage)}</b></div>
      <PinField value={pin} onChange={setPin}/>
      <FormFooter problem={problem} sent={sent} error={error} busy={busy} label="ნაშთის გასწორება" done={done ? 'ნაშთი გასწორდა.' : ''}/>
    </form>
  </section>;
}

export function ProductionForm({state, busy, error, act}: StockProps) {
  const all = state.inventory.items;
  const semis = activeItems(all).filter(item => item.kind === 'semi' && item.batch);
  const [itemId, setItemId] = useState(''), [batches, setBatches] = useState('1'), [pin, setPin] = useState('');
  const {problem, sent, done, run} = useStockSubmit(act);
  const semi = find(semis, itemId);
  const n = /^\d+$/.test(batches.trim()) && Number(batches) >= 1 && Number(batches) <= 1000 ? Number(batches) : null;
  const consumption = semi?.batch && n ? semi.batch.lines.map(line => {
    const item = find(all, line.itemId);
    const quantity = line.quantity * n;
    return {line, item, quantity, cost: lineCost(quantity, item?.avgCost ?? 0)};
  }) : [];
  const total = consumption.reduce((a, x) => a + x.cost, 0);

  async function submit(e: FormEvent) {
    const ok = await run(e, 'produce', () => {
      if (!semi) throw new Error('აირჩიეთ ნახევარფაბრიკატი');
      if (!n) throw new Error('პარტიების რაოდენობა უნდა იყოს მთელი რიცხვი 1–1000');
      return {itemId: semi.id, batches: n, pin};
    });
    if (ok) {setBatches('1'); setPin('');}
  }

  if (!semis.length) return <section className="panel pad"><p className="muted">წარმოებისთვის საჭიროა ნახევარფაბრიკატი რეცეპტით. დაამატეთ რეცეპტი „კალკულაციების“ ჩანართში.</p></section>;
  return <section className="panel pad stockform">
    <h2>ნახევარფაბრიკატის წარმოება</h2>
    <form onSubmit={submit}>
      <div className="stockfields">
        <label>ნახევარფაბრიკატი<ItemSelect items={semis} value={itemId} onChange={setItemId}/></label>
        <label>პარტიების რაოდენობა<input value={batches} inputMode="numeric" onChange={e => setBatches(e.target.value)}/></label>
      </div>
      {semi?.batch && n && <>
        <table className="stocktable"><thead><tr><th>ინგრედიენტი</th><th>ხარჯი</th><th>ნაშთი ამის შემდეგ</th><th>ღირებულება</th></tr></thead><tbody>
          {consumption.map(({line, item, quantity, cost}) => {
            const after = (item?.quantity ?? 0) - quantity;
            return <tr key={line.itemId} className={after < 0 ? 'error' : ''}>
              <td>{item?.name ?? line.itemId}</td>
              <td>{item ? formatQuantity(-quantity, item.unit) : -quantity}</td>
              <td>{item ? formatQuantity(after, item.unit) : '—'}{after < 0 && <> <span className="badge error">მინუსში წავა</span></>}</td>
              <td>{signedMoney(-cost)}</td>
            </tr>;
          })}
        </tbody></table>
        <div className="summaryrow total"><span>გამოსავალი (დაახლ.)</span><b>+{formatQuantity(semi.batch.output * n, semi.unit)} · {formatMoney(total)}</b></div>
      </>}
      <PinField value={pin} onChange={setPin}/>
      <FormFooter problem={problem} sent={sent} error={error} busy={busy} label="წარმოება" done={done ? 'წარმოება შენახულია. ნახევარფაბრიკატი დაემატა საწყობს.' : ''}/>
    </form>
  </section>;
}
