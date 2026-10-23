'use client';

import {useState} from 'react';
import {money, methods} from '@/lib/format';

type Mode = 'cash' | 'card' | 'other' | 'split';
const MODES: [Mode, string][] = [['cash', methods.cash], ['card', methods.card], ['other', methods.other], ['split', 'გაყოფა']];
const toTetri = (text: string) => Math.round((Number(text.replace(',', '.')) || 0) * 100);
const fixed = (tetri: number) => (Math.max(0, tetri) / 100).toFixed(2);

// Cash handed over and the change to give back; display only, never stored.
function ChangeCalculator({amount}: {amount: number}) {
    const [given, setGiven] = useState('');
    const received = toTetri(given), change = received - amount;
    const quick = [...new Set([amount, ...[2000, 5000, 10000, 20000].filter(n => n > amount)])].slice(0, 4);
    return <div className="changecalc">
        <label>მომხმარებელმა მოგცათ (₾)<input type="number" inputMode="decimal" min="0" step="0.01" value={given} placeholder={fixed(amount)} onChange={e => setGiven(e.target.value)}/></label>
        <div className="quickcash">{quick.map(n => <button key={n} type="button" onClick={() => setGiven(fixed(n))}>{n === amount ? 'ზუსტად' : money(n)}</button>)}</div>
        {given !== '' && <div className={`summaryrow total change ${change < 0 ? 'short' : ''}`}><span>{change < 0 ? 'აკლია' : 'დასაბრუნებელი ხურდა'}</span><b>{money(Math.abs(change))}</b></div>}
    </div>;
}

// One payment window: method buttons, the amount, and for cash the change to return; "გაყოფა" splits cash and card.
export function PaymentFields({total, paid, due}: {total: number; paid: number; due: number}) {
    const [mode, setMode] = useState<Mode>('cash');
    const [amount, setAmount] = useState(fixed(due));
    const [cash, setCash] = useState('');
    const [card, setCard] = useState('');
    const fill = (value: string, setOther: (v: string) => void) => setOther(fixed(due - toTetri(value)));
    const rest = due - toTetri(cash) - toTetri(card);
    return <>
        <div className="paysummary">
            <div className="summaryrow"><span>ანგარიში</span><b>{money(total)}</b></div>
            {paid > 0 && <div className="summaryrow"><span>უკვე გადახდილია</span><b>{money(paid)}</b></div>}
            <div className="summaryrow total"><span>გადასახდელი</span><b>{money(due)}</b></div>
        </div>
        <input type="hidden" name="paymode" value={mode}/>
        <div className="paymethods" role="group" aria-label="გადახდის მეთოდი">{MODES.map(([id, label]) =>
            <button key={id} type="button" aria-pressed={mode === id} className={mode === id ? 'selected' : ''} onClick={() => setMode(id)}>{label}</button>)}</div>
        {mode !== 'split' ? <>
            <input type="hidden" name="method" value={mode}/>
            <label>გადასახდელი თანხა (₾)<input name="amount" type="number" inputMode="decimal" min="0" step="0.01" max={due / 100} value={amount} onChange={e => setAmount(e.target.value)}/></label>
            {mode === 'cash' && <ChangeCalculator key={amount} amount={toTetri(amount)}/>}
        </> : <>
            <label>ნაღდი (₾)<input name="cash" type="number" inputMode="decimal" min="0" step="0.01" max={due / 100} value={cash} autoFocus onChange={e => { setCash(e.target.value); fill(e.target.value, setCard); }}/></label>
            <label>ბარათი (₾)<input name="card" type="number" inputMode="decimal" min="0" step="0.01" max={due / 100} value={card} onChange={e => { setCard(e.target.value); fill(e.target.value, setCash); }}/></label>
            {rest !== 0 && <p className={rest < 0 ? 'error' : 'muted'}>{rest < 0 ? `ჯამი აღემატება გადასახდელს ${money(-rest)}-ით` : `გადაუხდელი დარჩება: ${money(rest)}`}</p>}
            {toTetri(cash) > 0 && <ChangeCalculator key={cash} amount={toTetri(cash)}/>}
        </>}
    </>;
}
