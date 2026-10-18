'use client';
import {useState, FormEvent} from 'react';
import {stockAlerts, stockValue, totalStockValue, type StockItem, type StockKind, type StockUnit} from '@/lib/inventory';
import {formatMoney, formatQuantity, formatUnitCost, inputUnitLabels, inputUnits, kindLabels, parseQuantity, unitLabels, type InputUnit} from '@/lib/inventory-format';
import type {StockProps} from '@/components/stock/stock-view';

type ItemForm = {id?: string; name: string; unit: StockUnit; kind: StockKind; threshold: string; thresholdUnit: InputUnit; pin: string};
type ArchiveForm = {item: StockItem; pin: string};

const newForm = (): ItemForm => ({name: '', unit: 'g', kind: 'ingredient', threshold: '', thresholdUnit: 'kg', pin: ''});
// Thresholds are edited in the smallest unit so no precision is lost.
const editForm = (item: StockItem): ItemForm => ({id: item.id, name: item.name, unit: item.unit, kind: item.kind, threshold: item.threshold === undefined ? '' : String(item.threshold), thresholdUnit: inputUnits(item.unit).at(-1)!, pin: ''});

export function StockLevels({state, busy, error, act}: StockProps) {
  const inventory = state.inventory;
  const alerts = stockAlerts(inventory);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<ItemForm | null>(null);
  const [archive, setArchive] = useState<ArchiveForm | null>(null);
  const [formError, setFormError] = useState('');
  const [sent, setSent] = useState(false);
  const negative = new Set(alerts.negative.map(item => item.id)), low = new Set(alerts.low.map(item => item.id));
  const items = inventory.items.filter(item => showArchived || !item.archived);

  function open(next: ItemForm | null, nextArchive: ArchiveForm | null = null) {setFormError(''); setSent(false); setForm(next); setArchive(nextArchive);}
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    let threshold: number | null = null;
    try {
      if (!form.name.trim()) throw new Error('შეიყვანეთ დასახელება');
      if (form.threshold.trim()) threshold = parseQuantity(form.threshold, form.thresholdUnit, true);
    } catch (err) {setFormError(err instanceof Error ? err.message : String(err)); return;}
    setFormError(''); setSent(true);
    const r = await act('saveStockItem', {...(form.id ? {id: form.id} : {}), name: form.name.trim(), unit: form.unit, kind: form.kind, threshold, pin: form.pin});
    if (r) setForm(null);
  }
  async function toggleArchive(e: FormEvent) {
    e.preventDefault();
    if (!archive) return;
    setSent(true);
    const r = await act('archiveStockItem', {id: archive.item.id, archived: !archive.item.archived, pin: archive.pin});
    if (r) setArchive(null);
  }

  return <>
    <section className="panel pad stockalerts">
      <h2>მარაგის გაფრთხილებები</h2>
      {alerts.count === 0 && <p className="muted">ყველა პოზიციის მარაგი საკმარისია.</p>}
      {alerts.negative.length > 0 && <><h3>მინუსში</h3>{alerts.negative.map(item => <div className="summaryrow" key={item.id}><span>{item.name}</span><b className="badge error">{formatQuantity(item.quantity, item.unit)}</b></div>)}</>}
      {alerts.low.length > 0 && <><h3>იწურება</h3>{alerts.low.map(item => <div className="summaryrow" key={item.id}><span>{item.name}</span><b className="badge warm">{formatQuantity(item.quantity, item.unit)}{item.threshold !== undefined && ` / ზღვარი ${formatQuantity(item.threshold, item.unit)}`}</b></div>)}</>}
    </section>
    <section className="panel pad">
      <div className="receipthead"><h2>ნაშთები</h2><div className="flex">
        <label className="check"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}/>ამოღებულების ჩვენება</label>
        <button disabled={busy} onClick={() => open(newForm())}>+ პოზიცია</button>
      </div></div>
      {items.length === 0 ? <p className="muted">საწყობში პოზიცია ჯერ არ არის. დაამატეთ ინგრედიენტი ან ნახევარფაბრიკატი.</p> :
        <table className="stocktable"><thead><tr><th>დასახელება</th><th>ტიპი</th><th>ერთეული</th><th>ნაშთი</th><th>საშუალო ფასი</th><th>ღირებულება</th><th/></tr></thead><tbody>
          {items.map(item => <tr key={item.id} className={item.archived ? 'void' : negative.has(item.id) ? 'error' : ''}>
            <td>{item.name}{item.archived && <small className="muted"> · ამოღებული</small>}</td>
            <td>{kindLabels[item.kind]}</td>
            <td>{unitLabels[item.unit]}</td>
            <td><b>{formatQuantity(item.quantity, item.unit)}</b>{negative.has(item.id) && <> <span className="badge error">მინუსში</span></>}{low.has(item.id) && <> <span className="badge warm">იწურება</span></>}</td>
            <td>{formatUnitCost(item.avgCost, item.unit)}</td>
            <td>{formatMoney(stockValue(item))}</td>
            <td><div className="flex stockactions">
              {!item.archived && <button disabled={busy} onClick={() => open(editForm(item))}>რედაქტირება</button>}
              <button disabled={busy} onClick={() => open(null, {item, pin: ''})}>{item.archived ? 'დაბრუნება' : 'ამოღება'}</button>
            </div></td>
          </tr>)}
        </tbody></table>}
      <div className="summaryrow"><span>საწყობის ჯამური ღირებულება</span><b>{formatMoney(totalStockValue(inventory))}</b></div>
    </section>
    {form && <div className="overlay"><div className="modal">
      <div className="receipthead"><h2>{form.id ? 'პოზიციის რედაქტირება' : 'ახალი პოზიცია'}</h2><button aria-label="დახურვა" onClick={() => open(null)}>×</button></div>
      <form onSubmit={save}>
        <label>დასახელება<input value={form.name} maxLength={100} required onChange={e => setForm({...form, name: e.target.value})}/></label>
        <label>ერთეული<select value={form.unit} disabled={!!form.id} onChange={e => {const unit = e.target.value as StockUnit; setForm({...form, unit, thresholdUnit: inputUnits(unit)[0]});}}>
          {(Object.keys(unitLabels) as StockUnit[]).map(u => <option key={u} value={u}>{unitLabels[u]}</option>)}
        </select></label>
        <label>ტიპი<select value={form.kind} disabled={!!form.id} onChange={e => setForm({...form, kind: e.target.value as StockKind})}>
          {(Object.keys(kindLabels) as StockKind[]).map(k => <option key={k} value={k}>{kindLabels[k]}</option>)}
        </select></label>
        <label>მინიმალური ნაშთი (არასავალდებულო)<div className="flex">
          <input value={form.threshold} inputMode="decimal" onChange={e => setForm({...form, threshold: e.target.value})}/>
          <select value={form.thresholdUnit} onChange={e => setForm({...form, thresholdUnit: e.target.value as InputUnit})}>{inputUnits(form.unit).map(u => <option key={u} value={u}>{inputUnitLabels[u]}</option>)}</select>
        </div></label>
        {form.id && <p className="muted">ერთეული და ტიპი შექმნის შემდეგ არ იცვლება.</p>}
        <label>მენეჯერის კოდი<input type="password" inputMode="numeric" autoComplete="off" value={form.pin} onChange={e => setForm({...form, pin: e.target.value})}/></label>
        {(formError || (sent && error)) && <div className="formerror error">{formError || error}</div>}
        <button type="submit" disabled={busy} className="primary full">{busy ? 'ინახება…' : 'შენახვა'}</button>
      </form>
    </div></div>}
    {archive && <div className="overlay"><div className="modal">
      <div className="receipthead"><h2>{archive.item.archived ? 'პოზიციის დაბრუნება' : 'პოზიციის ამოღება'}</h2><button aria-label="დახურვა" onClick={() => open(null)}>×</button></div>
      <form onSubmit={toggleArchive}>
        <p className="muted">{archive.item.name}. {archive.item.archived ? 'პოზიცია ისევ გამოჩნდება სიებში.' : 'ამოღებული პოზიცია ისტორიაში რჩება, მაგრამ ახალ მიღებასა და კალკულაციაში აღარ ჩანს.'}</p>
        <label>მენეჯერის კოდი<input type="password" inputMode="numeric" autoComplete="off" value={archive.pin} onChange={e => setArchive({...archive, pin: e.target.value})}/></label>
        {sent && error && <div className="formerror error">{error}</div>}
        <button type="submit" disabled={busy} className="primary full">{busy ? 'ინახება…' : 'დადასტურება'}</button>
      </form>
    </div></div>}
  </>;
}
