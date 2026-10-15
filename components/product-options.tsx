'use client';

import {useState} from 'react';
import {getProductOptions, type Addon, type Line, type Product, type Ticket} from '@/lib/pos';

const money = (value: number) => `${(value / 100).toFixed(2)} ₾`;

/** The main product button stays a one-tap +1; this is its optional editor. */
export function OrderProductOptions({product, departmentNames}: {product: Product; departmentNames: string}) {
  const options = getProductOptions(product);
  const [quantity, setQuantity] = useState('1');
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const unitPrice = product.price + options.addons.filter(addon => selectedAddons.includes(addon.id)).reduce((sum, addon) => sum + addon.price, 0);
  const count = Number(quantity);
  const total = Number.isSafeInteger(count) && count > 0 ? unitPrice * count : 0;
  const totalIsSafe = Number.isSafeInteger(total);

  return <div className="product-options">
    <label>დასამატებელი რაოდენობა
      <input autoFocus name="quantity" type="number" min="1" max="100000000" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} required/>
    </label>
    {options.quickNotes.length > 0 && <fieldset className="option-section free-options">
      <legend>სწრაფი შენიშვნები · უფასო</legend>
      <div className="quick-note-choices" role="group" aria-label="სწრაფი შენიშვნები">
        {options.quickNotes.map(note => <button key={note} type="button" aria-pressed={selectedNotes.includes(note)} onClick={() => setSelectedNotes(current => current.includes(note) ? current.filter(item => item !== note) : [...current, note])}>{selectedNotes.includes(note) && <span aria-hidden="true">✓ </span>}{note}</button>)}
      </div>
      {selectedNotes.map(note => <input key={note} type="hidden" name="quickNotes" value={note}/>)}
    </fieldset>}
    {options.addons.length > 0 && <fieldset className="option-section paid-options">
      <legend>ფასიანი დანამატები</legend>
      <p className="option-hint">ფასი ემატება თითოეულ ერთეულს.</p>
      <div className="addon-choices">{options.addons.map(addon => <label key={addon.id} className={`addon-choice ${selectedAddons.includes(addon.id) ? 'is-selected' : ''}`}>
        <input type="checkbox" name="addonIds" value={addon.id} checked={selectedAddons.includes(addon.id)} onChange={event => setSelectedAddons(current => event.target.checked ? [...current, addon.id] : current.filter(id => id !== addon.id))}/>
        <span>{addon.name}</span><b>+{money(addon.price)}</b>
      </label>)}</div>
    </fieldset>}
    <label>თავისუფალი შენიშვნა · უფასო
      <textarea name="note" placeholder="მაგალითად: ხახვის გარეშე" maxLength={500}/>
    </label>
    <div className="option-price-summary" aria-live="polite">
      <div><span>საბაზო ფასი</span><b>{money(product.price)}</b></div>
      {selectedAddons.length > 0 && <div><span>ერთი ერთეული დანამატებით</span><b>{money(unitPrice)}</b></div>}
      <div className="option-price-total"><span>დასამატებელი ჯამი · {Number.isSafeInteger(count) && count > 0 ? count : 0} ერთეული</span><strong>{totalIsSafe ? money(total) : 'შეამცირეთ რაოდენობა'}</strong></div>
    </div>
    <p className="muted option-recipient">მიიღებს: {departmentNames}</p>
  </div>;
}

type EditableAddon = {id: string; name: string; price: string};

/** Per-product settings avoid a second, global modifier catalog. */
export function MenuProductOptions({product}: {product?: Product}) {
  const options = product ? getProductOptions(product) : {quickNotes: [], addons: []};
  const [quickNotes, setQuickNotes] = useState(options.quickNotes.join('\n'));
  const [addons, setAddons] = useState<EditableAddon[]>(options.addons.map(addon => ({id: addon.id, name: addon.name, price: (addon.price / 100).toFixed(2)})));
  const updateAddon = (id: string, field: 'name' | 'price', value: string) => setAddons(current => current.map(addon => addon.id === id ? {...addon, [field]: value} : addon));

  return <div className="menu-product-options">
    <fieldset className="option-section">
      <legend>სწრაფი შენიშვნები · უფასო</legend>
      <p className="option-hint">მაქსიმუმ 20 შენიშვნა, თითოეული — 100 სიმბოლომდე.</p>
      <label>თითო შენიშვნა ახალ სტრიქონზე
        <textarea name="productQuickNotes" value={quickNotes} onChange={event => setQuickNotes(event.target.value)} placeholder={'ხახვის გარეშე\nსოუსი ცალკე'} maxLength={3000}/>
      </label>
    </fieldset>
    <fieldset className="option-section paid-options">
      <legend>ფასიანი დანამატები</legend>
      <p className="option-hint">მიუთითეთ ერთი დანამატის ფასი ლარში.</p>
      <div className="addon-editor">{addons.map((addon, index) => <div className="addon-editor-row" key={addon.id}>
        <label>დანამატი {index + 1}<input aria-label={`დანამატი ${index + 1} დასახელება`} value={addon.name} onChange={event => updateAddon(addon.id, 'name', event.target.value)} maxLength={100} required placeholder="მაგალითად: ყველი"/></label>
        <label>ფასი (₾)<input aria-label={`დანამატი ${index + 1} ფასი`} type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" value={addon.price} onChange={event => updateAddon(addon.id, 'price', event.target.value)} required/></label>
        <button type="button" className="iconbtn addon-remove" aria-label={`დანამატი ${index + 1} ამოღება`} onClick={() => setAddons(current => current.filter(item => item.id !== addon.id))}>×</button>
      </div>)}</div>
      <button type="button" className="addon-create" disabled={addons.length >= 20} onClick={() => setAddons(current => current.length < 20 ? [...current, {id: crypto.randomUUID(), name: '', price: ''}] : current)}>+ დანამატის დამატება</button>
      <input type="hidden" name="productAddons" value={JSON.stringify(addons.map(addon => ({id: addon.id, name: addon.name.trim(), price: Math.round(Number(addon.price) * 100)})))}/>
    </fieldset>
  </div>;
}

export function CashLineDetails({line}: {line: Line}) {
  return <div className="line-options-details">
    {!!line.addons?.length && <>
      <small>საბაზო ფასი: {money(line.basePrice ?? line.price - line.addons.reduce((sum, addon) => sum + addon.price, 0))}</small>
      {line.addons.map(addon => <small key={addon.id}>ფასიანი დანამატი: {addon.name} <b>+{money(addon.price)}</b> / ერთ.</small>)}
    </>}
    {line.note && <small className="free-line-note">შენიშვნა: {line.note}</small>}
  </div>;
}

/** Deliberately only names: preparation tickets never display prices. */
export function KitchenLineDetails({line}: {line: Ticket['lines'][number]}) {
  return <div className="line-options-details kitchen-line-details">
    {line.addons?.map((addon: Addon) => <small key={addon.id}>ფასიანი დანამატი: {addon.name}</small>)}
    {line.note && <small className="free-line-note">შენიშვნა: {line.note}</small>}
  </div>;
}
