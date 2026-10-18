'use client';
import {useState, type FormEvent} from 'react';
import type {Product} from '@/lib/pos';
import {foodCostReport, lineCost, productRecipe, recipeCost, type RecipeLine, type StockItem} from '@/lib/inventory';
import {formatMoney, formatPercent, formatQuantity, inputUnits, parseQuantity, type InputUnit} from '@/lib/inventory-format';
import {FormFooter, ItemSelect, PinField, rowKey, UnitSelect, useStockSubmit} from '@/components/stock/stock-forms';
import type {StockProps} from '@/components/stock/stock-view';

const MAX_LINES = 50;
type Row = {key: string; itemId: string; quantity: string; unit: InputUnit};
type Target = {kind: 'product'; product: Product} | {kind: 'semi'; item: StockItem};

// Existing quantities open in the base unit (g, ml, pcs) so nothing is rounded.
const baseUnit = (item?: StockItem): InputUnit => item ? inputUnits(item.unit).at(-1)! : 'g';
const toRows = (lines: RecipeLine[], items: StockItem[]): Row[] =>
  lines.map(line => ({key: rowKey(), itemId: line.itemId, quantity: String(line.quantity), unit: baseUnit(items.find(i => i.id === line.itemId))}));
const emptyRow = (): Row => ({key: rowKey(), itemId: '', quantity: '', unit: 'g'});

function parseLines(rows: Row[], items: StockItem[]): RecipeLine[] {
  const lines = rows.filter(r => r.itemId || r.quantity.trim()).map((r, i) => {
    if (!items.some(item => item.id === r.itemId)) throw new Error(`ხაზი ${i + 1}: აირჩიეთ პოზიცია`);
    try {return {itemId: r.itemId, quantity: parseQuantity(r.quantity, r.unit)};} catch (err) {throw new Error(`ხაზი ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);}
  });
  if (new Set(lines.map(l => l.itemId)).size !== lines.length) throw new Error('ერთი პოზიცია კალკულაციაში მხოლოდ ერთხელ შეიძლება');
  if (lines.length > MAX_LINES) throw new Error(`მაქსიმუმ ${MAX_LINES} ხაზი`);
  if (lines.some(l => l.quantity > 1_000_000)) throw new Error('ხაზის რაოდენობა — მაქსიმუმ 1 000 000 საბაზო ერთეული');
  return lines;
}

export function RecipesPanel(props: StockProps) {
  const {state, busy} = props;
  const inventory = state.inventory;
  const [target, setTarget] = useState<Target | null>(null);
  const percents = new Map(foodCostReport(state).rows.map(r => [r.productId, r.percentTenths]));
  const semis = inventory.items.filter(item => item.kind === 'semi' && !item.archived);

  return <>
    <section className="panel pad">
      <h2>კერძების კალკულაციები</h2>
      <table className="stocktable"><thead><tr><th>პროდუქტი</th><th>ფასი</th><th>თვითღირებულება</th><th>ფუდქოსტი</th><th/></tr></thead><tbody>
        {state.products.map(product => {
          const lines = productRecipe(inventory, product.id);
          return <tr key={product.id} className={product.active ? '' : 'void'}>
            <td>{product.name}<small>{product.category}</small></td>
            <td>{formatMoney(product.price)}</td>
            <td>{lines ? formatMoney(recipeCost(lines, inventory.items)) : <span className="muted">კალკულაცია არ არის</span>}</td>
            <td>{formatPercent(percents.get(product.id) ?? null)}</td>
            <td><button disabled={busy} onClick={() => setTarget({kind: 'product', product})}>{lines ? 'რედაქტირება' : 'დამატება'}</button></td>
          </tr>;
        })}
      </tbody></table>
    </section>
    <section className="panel pad">
      <h2>ნახევარფაბრიკატების რეცეპტები</h2>
      {semis.length === 0 ? <p className="muted">ნახევარფაბრიკატი ჯერ არ არის. დაამატეთ „ნაშთების“ ჩანართში ტიპით „ნახევარფაბრიკატი“.</p> :
        <table className="stocktable"><thead><tr><th>ნახევარფაბრიკატი</th><th>გამოსავალი პარტიაზე</th><th>პარტიის თვითღირებულება</th><th/></tr></thead><tbody>
          {semis.map(item => <tr key={item.id}>
            <td>{item.name}</td>
            <td>{item.batch ? formatQuantity(item.batch.output, item.unit) : <span className="muted">რეცეპტი არ არის</span>}</td>
            <td>{item.batch ? formatMoney(recipeCost(item.batch.lines, inventory.items)) : '—'}</td>
            <td><button disabled={busy} onClick={() => setTarget({kind: 'semi', item})}>{item.batch ? 'რედაქტირება' : 'დამატება'}</button></td>
          </tr>)}
        </tbody></table>}
    </section>
    {target && <RecipeEditor key={target.kind === 'product' ? target.product.id : target.item.id} {...props} target={target} onClose={() => setTarget(null)}/>}
  </>;
}

function RecipeEditor({state, busy, error, act, target, onClose}: StockProps & {target: Target; onClose(): void}) {
  const all = state.inventory.items;
  const self = target.kind === 'semi' ? target.item : undefined;
  const existing = target.kind === 'product' ? productRecipe(state.inventory, target.product.id) : self?.batch?.lines;
  const [rows, setRows] = useState<Row[]>(() => existing?.length ? toRows(existing, all) : [emptyRow()]);
  const [output, setOutput] = useState(self?.batch ? String(self.batch.output) : ''), [outputUnit, setOutputUnit] = useState<InputUnit>(baseUnit(self));
  const [pin, setPin] = useState('');
  const {problem, sent, run} = useStockSubmit(act);
  const taken = rows.map(r => r.itemId);
  // Archived items stay selectable only on rows that already use them.
  const options = (row: Row) => all.filter(item => item.id !== self?.id && (!item.archived || item.id === row.itemId));
  const update = (key: string, patch: Partial<Row>) => setRows(rows.map(r => r.key === key ? {...r, ...patch} : r));
  const costs = rows.map(r => {
    const item = all.find(i => i.id === r.itemId);
    try {return item ? lineCost(parseQuantity(r.quantity, r.unit), item.avgCost) : null;} catch {return null;}
  });
  const total = costs.reduce<number>((a, c) => a + (c ?? 0), 0);
  const price = target.kind === 'product' ? target.product.price : 0;

  async function save(e: FormEvent, clear: boolean) {
    const ok = target.kind === 'product'
      ? await run(e, 'saveRecipe', () => ({productId: target.product.id, lines: clear ? [] : parseLines(rows, all), pin}))
      : await run(e, 'saveBatchRecipe', () => {
        if (clear) return {itemId: target.item.id, lines: [], pin};
        const lines = parseLines(rows, all);
        if (!lines.length) throw new Error('დაამატეთ მინიმუმ ერთი ინგრედიენტი');
        return {itemId: target.item.id, output: parseQuantity(output, outputUnit), lines, pin};
      });
    if (ok) onClose();
  }

  return <div className="overlay"><section role="dialog" aria-modal="true" className="modal recipemodal">
    <div className="receipthead"><h2>{target.kind === 'product' ? `კალკულაცია: ${target.product.name}` : `რეცეპტი: ${target.item.name}`}</h2><button aria-label="დახურვა" onClick={onClose}>×</button></div>
    <form onSubmit={e => save(e, false)}>
      {self && <label>გამოსავალი ერთ პარტიაზე<div className="qtyinput"><input value={output} inputMode="decimal" onChange={e => setOutput(e.target.value)}/><UnitSelect item={self} value={outputUnit} onChange={setOutputUnit}/></div></label>}
      {rows.map((r, i) => {
        const item = all.find(x => x.id === r.itemId);
        return <div className="stockline recipeline" key={r.key}>
          <label>პოზიცია<ItemSelect items={options(r)} value={r.itemId} taken={taken} onChange={id => update(r.key, {itemId: id, unit: baseUnit(all.find(x => x.id === id))})}/></label>
          <label>რაოდენობა<div className="qtyinput"><input value={r.quantity} inputMode="decimal" onChange={e => update(r.key, {quantity: e.target.value})}/><UnitSelect item={item} value={r.unit} onChange={unit => update(r.key, {unit})}/></div></label>
          <div className="stocklinetotal"><small>ღირებულება</small><b>{costs[i] === null ? '—' : formatMoney(costs[i]!)}</b></div>
          <button type="button" aria-label="ხაზის წაშლა" className="stockremove" onClick={() => setRows(rows.length === 1 ? [emptyRow()] : rows.filter(x => x.key !== r.key))}>×</button>
        </div>;
      })}
      <button type="button" disabled={rows.length >= MAX_LINES} onClick={() => setRows([...rows, emptyRow()])}>+ ინგრედიენტი</button>
      <div className="summaryrow total"><span>{self ? 'პარტიის თვითღირებულება' : 'თვითღირებულება'}</span><b>{formatMoney(total)}</b></div>
      {target.kind === 'product' && <div className="summaryrow"><span>ფასი · ფუდქოსტი · მარჟა</span><b>{formatMoney(price)} · {formatPercent(price > 0 ? Math.floor((total * 1000 * 2 + price) / (price * 2)) : null)} · {formatMoney(price - total)}</b></div>}
      <PinField value={pin} onChange={setPin}/>
      <FormFooter problem={problem} sent={sent} error={error} busy={busy} label="შენახვა">
        {existing && <button type="button" disabled={busy} onClick={e => save(e, true)}>{self ? 'რეცეპტის წაშლა' : 'კალკულაციის წაშლა'}</button>}
      </FormFooter>
    </form>
  </section></div>;
}
