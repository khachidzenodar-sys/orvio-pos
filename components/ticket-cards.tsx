'use client';

import {KitchenLineDetails} from '@/components/product-options';
import {grouped, when} from '@/lib/format';
import type {PosState, Ticket} from '@/lib/pos';

type Props = {state: PosState; dept: string; busy: boolean; onPrint: (ticketIds: string[]) => void};

// One send creates a ticket per department; the "all" tab joins them back into the whole order.
function joinSends(tickets: Ticket[]): Ticket[][] {
    const sends = new Map<string, Ticket[]>();
    for (const t of tickets) {
        const key = `${t.orderId}|${t.createdAt}|${t.type}`;
        sends.set(key, [...(sends.get(key) ?? []), t]);
    }
    return [...sends.values()];
}

export function TicketCards({state, dept, busy, onPrint}: Props) {
    const tickets = state.tickets.filter(t => dept === 'all' || t.departmentId === dept);
    const cards = (dept === 'all' ? joinSends(tickets) : tickets.map(t => [t])).reverse();
    if (!cards.length) return <div className="empty panel">გაგზავნილი შეკვეთები აქ გამოჩნდება.</div>;
    return <div className="ticketgrid">{cards.map(group => {
        const t = group[0], printCount = Math.max(...group.map(x => x.printCount));
        // A dish routed to two departments sits on both tickets; list it once.
        const lines = [...new Map(group.flatMap(x => x.lines).map(l => [l.lineId, l])).values()];
        return <article className={`ticket ${t.type === 'cancel' ? 'cancel' : ''}`} key={t.id}>
            <div className="receipthead"><h2>მაგიდა {t.tableName}</h2><span className="badge">{t.type === 'cancel' ? 'გაუქმება' : 'შეკვეთა'}</span></div>
            <b>{group.map(x => state.departments.find(d => d.id === x.departmentId)?.name).filter(Boolean).join(' · ')}</b>
            <small>{when(t.createdAt)}</small>
            {t.note && <p className="ticketnote">! {t.note}</p>}
            {grouped(lines).map((l, i) => <div className="ticketline" key={i}><strong>{l.quantity}×</strong><div><b>{l.name}</b><KitchenLineDetails line={l}/></div></div>)}
            <button className="full" disabled={busy} onClick={() => onPrint(group.map(x => x.id))}>{printCount ? 'ასლის ბეჭდვა' : 'ბეჭდვა'}{printCount > 0 && ` · ${printCount}`}</button>
        </article>;
    })}</div>;
}
