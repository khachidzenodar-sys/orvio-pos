'use client';

import {useState} from 'react';
import {money} from '@/lib/format';

const toTetri = (text: string) => Math.round((Number(text) || 0) * 100);

// Typing one amount fills the other with the rest of the bill.
export function SplitPayFields({due}: {due: number}) {
  const [cash, setCash] = useState('');
  const [card, setCard] = useState('');
  const rest = due - toTetri(cash) - toTetri(card);
  const fill = (value: string, setOther: (v: string) => void) => {
    const other = due - toTetri(value);
    setOther(other > 0 ? (other / 100).toFixed(2) : '0.00');
  };
  return <>
    <div className="summaryrow total"><span>დარჩენილი თანხა</span><b>{money(due)}</b></div>
    <label>ნაღდი (₾)<input name="cash" type="number" min="0" step="0.01" max={due / 100} value={cash} autoFocus
      onChange={e => {setCash(e.target.value); fill(e.target.value, setCard);}}/></label>
    <label>ბარათი (₾)<input name="card" type="number" min="0" step="0.01" max={due / 100} value={card}
      onChange={e => {setCard(e.target.value); fill(e.target.value, setCash);}}/></label>
    {rest !== 0 && <p className={rest < 0 ? 'error' : 'muted'}>{rest < 0 ? `ჯამი აღემატება დარჩენილ თანხას ${money(-rest)}-ით` : `გადაუხდელი დარჩება: ${money(rest)}`}</p>}
  </>;
}
