'use client';
import {useState} from 'react';
import type {PosState} from '@/lib/pos';
import {StockLevels} from '@/components/stock/stock-levels';
import {MovementHistory, FoodCostReport} from '@/components/stock/stock-reports';
import {CountForm, ProductionForm, ReceiptForm, WriteOffForm} from '@/components/stock/stock-forms';

export type StockAct = (action: string, payload: Record<string, unknown>) => Promise<unknown>;
export type StockProps = {state: PosState; busy: boolean; error: string; act: StockAct};

const tabs = [
  ['levels', 'ნაშთები'], ['receipt', 'მიღება'], ['writeoff', 'ჩამოწერა'], ['count', 'ინვენტარიზაცია'],
  ['production', 'წარმოება'], ['history', 'მოძრაობები'], ['foodcost', 'ფუდქოსტი'],
] as const;
type Tab = typeof tabs[number][0];

// Warehouse screen: sub-tabs keep their own form state, so the periodic reload never wipes input.
export function StockView(props: StockProps) {
  const [tab, setTab] = useState<Tab>('levels');
  return <>
    <div className="toolbar"><div className="tabs">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>{label}</button>)}</div></div>
    {tab === 'levels' && <StockLevels {...props}/>}
    {tab === 'receipt' && <ReceiptForm {...props}/>}
    {tab === 'writeoff' && <WriteOffForm {...props}/>}
    {tab === 'count' && <CountForm {...props}/>}
    {tab === 'production' && <ProductionForm {...props}/>}
    {tab === 'history' && <MovementHistory state={props.state}/>}
    {tab === 'foodcost' && <FoodCostReport state={props.state}/>}
  </>;
}
