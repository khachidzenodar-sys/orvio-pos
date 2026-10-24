'use client';

import {useState} from 'react';
import {menuEngineering, type MenuClass, type MenuEngineering, type SalesAnalytics, type SalesRow} from '@/lib/sales-analytics';
import {MENU_CLASS_TEXT, salesWorkbook} from '@/lib/sales-export';
import {buildXlsx} from '@/lib/xlsx';
import type {ExportFiles} from '@/lib/ports/export-files';
import {money} from '@/lib/format';

const pct = (value: number | null) => value === null ? '—' : `${value.toFixed(1)}%`;
const opt = (value: number | null) => value === null ? '—' : money(value);

// Revenue split into cost, profit and the part without a recipe; one shared scale per chart.
function SalesBars({rows, label}: {rows: SalesRow[]; label: string}) {
    const [hover, setHover] = useState<string | null>(null);
    const max = Math.max(1, ...rows.map(r => r.revenue));
    const width = (value: number) => `${Math.max(0, value) / max * 100}%`;
    return <div className="salesbars" role="img" aria-label={label}>
        {rows.map(r => {
            const cost = r.cost ?? 0, profit = Math.max(0, r.profit ?? 0);
            return <div className="salesbar" key={r.id} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(r.id)} onBlur={() => setHover(null)} tabIndex={0}>
                <span className="salesname">{r.name}</span>
                <span className="salestrack">
                    {cost > 0 && <i className="seg cost" style={{width: width(cost)}}/>}
                    {profit > 0 && <i className="seg profit" style={{width: width(profit)}}/>}
                    {r.uncosted > 0 && <i className="seg unknown" style={{width: width(r.uncosted)}}/>}
                </span>
                <span className="salesvalue"><b>{money(r.revenue)}</b><small>{pct(r.marginPercent)}</small></span>
                {hover === r.id && <div className="salestip" role="tooltip">
                    <b>{r.name}</b>
                    <span><em>გაყიდვები</em>{money(r.revenue)}</span>
                    <span><i className="key cost"/><em>თვითღირებულება</em>{opt(r.cost)}</span>
                    <span><i className="key profit"/><em>მოგება</em>{opt(r.profit)}</span>
                    <span><em>მარჟა</em>{pct(r.marginPercent)}</span>
                    {r.uncosted > 0 && <span><i className="key unknown"/><em>რეცეპტის გარეშე</em>{money(r.uncosted)}</span>}
                    <span><em>გაყიდული</em>{r.quantity} ც.</span>
                </div>}
            </div>;
        })}
    </div>;
}

function Legend({unknown}: {unknown: boolean}) {
    return <div className="saleslegend">
        <span><i className="key cost"/>თვითღირებულება</span>
        <span><i className="key profit"/>მოგება</span>
        {unknown && <span><i className="key unknown"/>რეცეპტის გარეშე</span>}
        <span className="muted">ზოლის სიგრძე = გაყიდვები · % = მარჟა</span>
    </div>;
}

type SortKey = 'name' | 'quantity' | 'revenue' | 'unit' | 'cost' | 'profit' | 'marginPercent';
const unitCost = (r: SalesRow) => r.cost === null || !r.quantity ? null : Math.round(r.cost / r.quantity);

// Four menu-engineering groups as cards, the dishes inside sorted by sales.
function MenuGroups({menu}: {menu: MenuEngineering}) {
    const groups: MenuClass[] = ['star', 'plowhorse', 'puzzle', 'dog'];
    const unknown = menu.rows.filter(r => r.group === 'unknown');
    return <section className="panel pad">
        <div className="receipthead"><h2>კერძების ჯგუფები</h2></div>
        {menu.profitLine === null ? <p className="muted">ჯგუფებისთვის საჭიროა რეცეპტები. დაამატეთ ისინი „მართვა → კალკულაციები“-ში.</p> : <>
            <p className="muted">პოპულარულია კერძი, რომელიც {Math.ceil(menu.popularityLine)} ც. ან მეტი გაიყიდა. მომგებიანია, თუ ერთ პორციაზე მოგება საშუალო {money(Math.round(menu.profitLine))} ან მეტია.</p>
            <div className="menugroups">{groups.map(g => {
                const rows = menu.rows.filter(r => r.group === g), [icon, name, hint] = MENU_CLASS_TEXT[g];
                return <div className={`menugroup ${g}`} key={g}>
                    <h3><span aria-hidden="true">{icon}</span> {name} <small>{rows.length}</small></h3>
                    <p className="muted">{hint}</p>
                    {rows.length ? <ul>{rows.map(r => <li key={r.id}><span>{r.name}</span><small>{r.quantity} ც. · {money(Math.round(r.unitProfit!))}/პორცია</small></li>)}</ul> : <p className="muted">—</p>}
                </div>;
            })}</div>
        </>}
        {!!unknown.length && <p className="muted">რეცეპტის გარეშე: {unknown.map(r => r.name).join(', ')}.</p>}
    </section>;
}

export function SalesAnalyticsView({data, period, exportFiles}: {data: SalesAnalytics; period: string; exportFiles?: ExportFiles}) {
    const [allDishes, setAllDishes] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportNote, setExportNote] = useState('');
    const [sort, setSort] = useState<{key: SortKey; desc: boolean}>({key: 'revenue', desc: true});
    const t = data.total, unknown = t.uncosted > 0;
    if (!data.products.length) return <div className="empty panel">არჩეულ პერიოდში დახურული ანგარიში არ არის.</div>;
    const value = (r: SalesRow): number | string => sort.key === 'name' ? r.name : sort.key === 'unit' ? unitCost(r) ?? -Infinity : r[sort.key] ?? -Infinity;
    const dishes = [...data.products].sort((a, b) => {
        const x = value(a), y = value(b), order = typeof x === 'string' ? x.localeCompare(String(y), 'ka') : x - (y as number);
        return sort.desc ? -order : order;
    });
    const menu = menuEngineering(data.products), group = new Map(menu.rows.map(r => [r.id, r.group]));
    // Desktop: native Save dialog. Browser: a normal download.
    async function exportExcel() {
        setExporting(true); setExportNote('');
        try {
            const bytes = buildXlsx(salesWorkbook(data, menu, period)), name = `ORVIO-sales_${period.match(/\d{4}-\d{2}-\d{2}/g)?.join('_') ?? 'all'}.xlsx`;
            if (exportFiles) { if (await exportFiles.save(name, bytes)) setExportNote('Excel ფაილი შენახულია'); }
            else {
                const url = URL.createObjectURL(new Blob([bytes as BlobPart], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
                const a = Object.assign(document.createElement('a'), {href: url, download: name});
                document.body.append(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        } catch (e) { setExportNote(e instanceof Error ? e.message : String(e)); }
        finally { setExporting(false); }
    }
    const head = (key: SortKey, text: string) => <th aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : undefined}>
        <button type="button" className="sorthead" onClick={() => setSort(s => ({key, desc: s.key === key ? !s.desc : key !== 'name'}))}>{text}{sort.key === key ? (sort.desc ? ' ↓' : ' ↑') : ''}</button></th>;
    return <>
        <div className="exportrow"><button type="button" className="primary" disabled={exporting} onClick={exportExcel}>{exporting ? 'მზადდება…' : 'Excel-ში გადმოწერა'}</button>{exportNote && <span className="muted" role="status">{exportNote}</span>}</div>
        <div className="stats">
            <div><span>გაყიდვები</span><strong>{money(t.revenue)}</strong></div>
            <div><span>თვითღირებულება</span><strong>{opt(t.cost)}</strong></div>
            <div><span>მოგება</span><strong>{opt(t.profit)}</strong></div>
            <div><span>საშუალო მარჟა</span><strong>{pct(t.marginPercent)}</strong></div>
        </div>
        {unknown && <p className="muted">{money(t.uncosted)} გაყიდვები ეკუთვნის კერძებს, რომლებსაც რეცეპტი არ აქვთ. მათი მოგება ვერ დაითვლება, ამიტომ თვითღირებულება, მოგება და მარჟა მხოლოდ რეცეპტიან კერძებზეა. რეცეპტი დაამატეთ „მართვა → კალკულაციები“-ში.</p>}
        <section className="panel pad">
            <div className="receipthead"><h2>განყოფილებები</h2></div>
            <Legend unknown={unknown}/>
            <SalesBars rows={data.departments} label="გაყიდვები, თვითღირებულება და მოგება განყოფილებების მიხედვით"/>
        </section>
        <section className="panel pad">
            <div className="receipthead"><h2>კერძები</h2>{data.products.length > 10 && <button type="button" onClick={() => setAllDishes(v => !v)}>{allDishes ? 'მხოლოდ ტოპ 10' : `ყველა (${data.products.length})`}</button>}</div>
            <Legend unknown={data.products.some(r => r.uncosted > 0)}/>
            <SalesBars rows={allDishes ? data.products : data.products.slice(0, 10)} label="კერძების გაყიდვები, თვითღირებულება და მოგება"/>
        </section>
        <MenuGroups menu={menu}/>
        <section className="panel">
            <table className="salestable">
                <thead><tr>{head('name', 'კერძი')}<th>ჯგუფი</th>{head('quantity', 'გაყიდული')}{head('revenue', 'გაყიდვები')}{head('unit', 'ერთეულის თვითღ.')}{head('cost', 'თვითღირებულება')}{head('profit', 'მოგება')}{head('marginPercent', 'მარჟა')}</tr></thead>
                <tbody>{dishes.map(r => <tr key={r.id}><td>{r.name}</td><td className="groupcell">{MENU_CLASS_TEXT[group.get(r.id) ?? 'unknown'][0]} {MENU_CLASS_TEXT[group.get(r.id) ?? 'unknown'][1]}</td><td>{r.quantity}</td><td>{money(r.revenue)}</td><td>{opt(unitCost(r))}</td><td>{opt(r.cost)}</td><td className={r.profit !== null && r.profit < 0 ? 'loss' : undefined}>{opt(r.profit)}</td><td>{pct(r.marginPercent)}</td></tr>)}</tbody>
            </table>
        </section>
    </>;
}
