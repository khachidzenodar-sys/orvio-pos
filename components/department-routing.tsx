'use client';

import {useMemo, useState} from 'react';
import type {PosState} from '@/lib/pos';

type Props = {state: PosState; busy: boolean; act: (action: string, payload: Record<string, unknown>) => Promise<unknown>};

// Which department receives each dish: one row per dish, one column per department, with whole-category toggles.
export function DepartmentRouting({state, busy, act}: Props) {
    const departments = state.departments.filter(d => !d.archived);
    const saved = useMemo(() => Object.fromEntries(state.products.map(p => [p.id, p.departmentIds])), [state.products]);
    const [draft, setDraft] = useState<Record<string, string[]>>({});
    const current = (id: string) => draft[id] ?? saved[id] ?? [];
    const categories = [...new Set(state.products.map(p => p.category))];
    const changed = Object.keys(draft).filter(id => [...draft[id]].sort().join() !== [...(saved[id] ?? [])].sort().join());
    const empty = changed.filter(id => !draft[id].length).map(id => state.products.find(p => p.id === id)?.name);
    const toggle = (ids: string[], dept: string, on: boolean) => setDraft(d => {
        const next = {...d};
        for (const id of ids) {
            const list = next[id] ?? saved[id] ?? [];
            next[id] = on ? [...new Set([...list, dept])] : list.filter(x => x !== dept);
        }
        return next;
    });
    async function save() {
        if (await act('setProductDepartments', {assignments: Object.fromEntries(changed.map(id => [id, draft[id]]))})) setDraft({});
    }
    return <section className="panel pad routing">
        <div className="receipthead"><h2>კერძების მიმღები განყოფილებები</h2></div>
        <p className="muted">მონიშნეთ, რომელ განყოფილებაში წავიდეს თითო კერძი. კატეგორიის ხაზზე მონიშვნა მთელ კატეგორიას ერთად ცვლის. კერძი შეიძლება რამდენიმე განყოფილებაშიც წავიდეს.</p>
        <div className="routingtable">
            <table>
                <thead><tr><th>კერძი</th>{departments.map(d => <th key={d.id}>{d.name}</th>)}</tr></thead>
                <tbody>{categories.map(category => {
                    const items = state.products.filter(p => p.category === category);
                    const ids = items.map(p => p.id);
                    return [
                        <tr key={`c-${category}`} className="routingcategory"><th>{category}</th>{departments.map(d => {
                            const all = ids.every(id => current(id).includes(d.id)), some = ids.some(id => current(id).includes(d.id));
                            return <td key={d.id}><input type="checkbox" aria-label={`${category} → ${d.name}`} checked={all} ref={el => { if (el) el.indeterminate = some && !all; }} onChange={e => toggle(ids, d.id, e.target.checked)}/></td>;
                        })}</tr>,
                        ...items.map(p => <tr key={p.id} className={changed.includes(p.id) ? 'routingchanged' : undefined}><td>{p.name}{!p.active && <small> · გამორთული</small>}</td>{departments.map(d =>
                            <td key={d.id}><input type="checkbox" aria-label={`${p.name} → ${d.name}`} checked={current(p.id).includes(d.id)} onChange={e => toggle([p.id], d.id, e.target.checked)}/></td>)}</tr>),
                    ];
                })}</tbody>
            </table>
        </div>
        {!!empty.length && <div role="alert" className="error formerror">განყოფილების გარეშე დარჩა: {empty.join(', ')}. თითო კერძს ერთი განყოფილება მაინც სჭირდება.</div>}
        <div className="flex routingactions">
            <button className="primary" disabled={busy || !changed.length || !!empty.length} onClick={save}>შენახვა{changed.length ? ` (${changed.length})` : ''}</button>
            <button disabled={!changed.length} onClick={() => setDraft({})}>გაუქმება</button>
        </div>
    </section>;
}
