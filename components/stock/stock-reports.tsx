'use client';
import {useState} from 'react';
import type {PosState} from '@/lib/pos';
import {foodCostReport, type Movement, type MovementType} from '@/lib/inventory';
import {formatMoney, formatPercent, formatQuantity, movementLabels} from '@/lib/inventory-format';
import {when} from '@/lib/format';

const ROW_LIMIT = 500;
// Same business-day rule as the reports view.
export const localDay = (s: string) => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(s));

const signedMoney = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + formatMoney(Math.abs(n));

function source(m: Movement): string {
  if (m.type === 'sale') return `მაგიდა ${m.tableName ?? ''} · ${m.productName ?? ''}`;
  if (m.type === 'writeoff') return m.reason ?? '';
  if (m.type === 'receipt') return [m.supplier, m.note, m.date].filter(Boolean).join(' · ');
  return m.type === 'count' ? 'ინვენტარიზაცია' : 'წარმოება';
}

export function MovementHistory({state}: {state: PosState}) {
  const inventory = state.inventory;
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [itemId, setItemId] = useState(''), [type, setType] = useState<MovementType | ''>('');
  const items = new Map(inventory.items.map(item => [item.id, item]));
  const rows = inventory.movements.filter(m => {
    const d = localDay(m.at);
    return (!from || d >= from) && (!to || d <= to) && (!itemId || m.itemId === itemId) && (!type || m.type === type);
  }).reverse();
  return <section className="panel pad">
    <div className="toolbar"><div className="flex stockfilters">
      <label>დან<input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}/></label>
      <label>ჩათვლით<input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}/></label>
      <label>პოზიცია<select value={itemId} onChange={e => setItemId(e.target.value)}><option value="">ყველა</option>{inventory.items.map(item => <option key={item.id} value={item.id}>{item.name}{item.archived ? ' (ამოღებული)' : ''}</option>)}</select></label>
      <label>ტიპი<select value={type} onChange={e => setType(e.target.value as MovementType | '')}><option value="">ყველა</option>{(Object.keys(movementLabels) as MovementType[]).map(t => <option key={t} value={t}>{movementLabels[t]}</option>)}</select></label>
    </div><button onClick={() => {setFrom(''); setTo(''); setItemId(''); setType('');}}>ფილტრის გასუფთავება</button></div>
    {inventory.prunedBefore && <p className="muted">ისტორია ხელმისაწვდომია {when(inventory.prunedBefore)}-დან. ძველი ისტორიისთვის შეინახეთ სარეზერვო ასლი.</p>}
    {rows.length === 0 ? <p className="muted">მოძრაობა არ მოიძებნა.</p> :
      <table className="stocktable"><thead><tr><th>დრო</th><th>ტიპი</th><th>პოზიცია</th><th>რაოდენობა</th><th>ღირებულება</th><th>წყარო</th></tr></thead><tbody>
        {rows.slice(0, ROW_LIMIT).map(m => {
          const item = items.get(m.itemId);
          return <tr key={m.id}>
            <td>{when(m.at)}</td>
            <td>{movementLabels[m.type]}</td>
            <td>{item?.name ?? m.itemId}</td>
            <td>{item ? (m.quantity > 0 ? '+' : '') + formatQuantity(m.quantity, item.unit) : m.quantity}</td>
            <td>{signedMoney(m.value)}</td>
            <td>{source(m)}</td>
          </tr>;
        })}
      </tbody></table>}
    {rows.length > ROW_LIMIT && <p className="muted">ნაჩვენებია ბოლო {ROW_LIMIT} ჩანაწერი {rows.length}-დან. დააზუსტეთ ფილტრი.</p>}
  </section>;
}

export function FoodCostReport({state}: {state: PosState}) {
  const {rows, averageTenths} = foodCostReport(state);
  const withRecipe = new Set(rows.map(r => r.productId));
  const missing = state.products.filter(p => p.active && !withRecipe.has(p.id));
  return <section className="panel pad">
    <h2>ფუდქოსტი</h2>
    {rows.length === 0 ? <p className="muted">კალკულაცია ჯერ არცერთ კერძს არ აქვს.</p> :
      <table className="stocktable"><thead><tr><th>პროდუქტი</th><th>ფასი</th><th>თვითღირებულება</th><th>ფუდქოსტი</th><th>მარჟა</th></tr></thead><tbody>
        {rows.map(r => <tr key={r.productId}><td>{r.name}</td><td>{formatMoney(r.price)}</td><td>{formatMoney(r.cost)}</td><td>{formatPercent(r.percentTenths)}</td><td>{formatMoney(r.margin)}</td></tr>)}
      </tbody></table>}
    <div className="summaryrow"><span>საშუალო ფუდქოსტი</span><b>{formatPercent(averageTenths)}</b></div>
    {missing.length > 0 && <><h3>კალკულაციის გარეშე</h3>{missing.map(p => <div className="summaryrow" key={p.id}><span>{p.name}</span><span className="muted">კალკულაცია არ არის</span></div>)}</>}
  </section>;
}
