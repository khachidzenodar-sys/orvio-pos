import type {Row} from '@/lib/printing/receipt-layout';
import type {DayTotals} from '@/lib/day-report';
import {money,when} from '@/lib/format';
import {differenceText} from '@/lib/day-report';

// Same fields for a live report (no counted cash yet) and a saved day close.
export type DayReportPrint={
 date:string;printedAt:string;totals:DayTotals;
 openingFloat:number;expectedCash:number;
 countedCash?:number;difference?:number;
 sequence?:number;closedAt?:string;closedBy?:string;note?:string;
};

const RULE:Row={rule:true};
const NONE='—';

// Left labels stay at 22 characters or less so the amount fits on the same 80 mm line.
export function dayReportRows(doc:DayReportPrint):Row[]{
 const t=doc.totals;
 const rows:Row[]=[
  {text:'ORVIO',align:'center',size:'large',bold:true},
  {text:'დღის ანგარიში',align:'center',bold:true},
 ];
 if(doc.sequence!==undefined)rows.push({text:doc.sequence>1?`განმეორებითი დახურვა #${doc.sequence}`:`დღის დახურვა #${doc.sequence}`,align:'center',bold:true});
 rows.push({text:'თარიღი',right:doc.date},{text:'დაბეჭდილია',right:when(doc.printedAt)});
 if(doc.closedAt)rows.push({text:'დახურულია',right:when(doc.closedAt)});
 rows.push(
  RULE,
  {text:'დახურული ანგარიშები',right:String(t.closedBills)},
  {text:'მთლიანი გაყიდვები',right:money(t.gross)},
  {text:'ფასდაკლებები',right:money(t.discounts)},
  {text:'გაუქმებები',right:`${t.voidCount} ც. / ${money(t.voidValue)}`},
  {text:'წმინდა გაყიდვები',right:money(t.net),bold:true},
  RULE,
  {text:'ნაღდი',right:money(t.payments.cash)},
  {text:'ბარათი',right:money(t.payments.card)},
  {text:'გადარიცხვა',right:money(t.payments.other)},
  {text:'სულ გადახდები',right:money(t.payments.total)},
  RULE,
  {text:'ღია ანგარიშები',right:`${t.openBills} / ${money(t.openAmount)}`},
  {text:'საშუალო ჩეკი',right:money(t.averageCheck)},
  RULE,
  {text:'დილის თანხა სალაროში',right:money(doc.openingFloat)},
  {text:'მოსალოდნელი ნაღდი',right:money(doc.expectedCash)},
  {text:'დათვლილი',right:doc.countedCash===undefined?NONE:money(doc.countedCash)},
  {text:'სხვაობა',right:doc.difference===undefined?NONE:differenceText(doc.difference),bold:true},
 );
 if(doc.closedBy)rows.push({text:`დახურა: ${doc.closedBy}`});
 if(doc.note)rows.push({text:`შენიშვნა: ${doc.note}`});
 rows.push(RULE,{text:'ORVIO · RESTAURANT POS',align:'center'});
 return rows;
}
