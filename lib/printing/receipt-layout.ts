import {orderTotals,type Line,type Order,type PosState,type Ticket} from '@/lib/pos';
import {money,when,grouped,methods} from '@/lib/format';

// Abstract printable lines; the renderer decides pixels. Content mirrors the .printarea in pos-workspace.tsx.
export type Row =
 |{text:string;right?:string;align?:'left'|'center'|'right';size?:'normal'|'large'|'huge';bold?:boolean;lead?:string} // lead: bold prefix on a short left-aligned line
 |{rule:true}
 |{gap:number}
 |{image:string;caption?:string};

const RULE:Row={rule:true};

function cashDetails(line:Line):Row[]{
 const rows:Row[]=[];
 if(line.addons?.length){
  rows.push({text:`საბაზო ფასი: ${money(line.basePrice??line.price-line.addons.reduce((sum,addon)=>sum+addon.price,0))}`});
  for(const addon of line.addons)rows.push({text:`ფასიანი დანამატი: ${addon.name} +${money(addon.price)} / ერთ.`});
 }
 if(line.note)rows.push({text:`შენიშვნა: ${line.note}`});
 return rows;
}

function kitchenDetails(line:Ticket['lines'][number]):Row[]{
 const rows:Row[]=(line.addons||[]).map(addon=>({text:`ფასიანი დანამატი: ${addon.name}`}));
 if(line.note)rows.push({text:`შენიშვნა: ${line.note}`});
 return rows;
}

// Special requests sent with this order, oldest first, without repeats.
export function orderNotes(order:Order,state:PosState):string[]{
 return [...new Set(state.tickets.filter(t=>t.orderId===order.id&&t.note).map(t=>t.note!))];
}

const pad=(n:number)=>String(n).padStart(2,'0');
const tradingDay=(d:Date)=>`${pad(d.getDate())}/${pad(d.getMonth()+1)}/${String(d.getFullYear()).slice(2)}`;
const clock=(d:Date)=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Sequential check number: orders are only ever appended, so the position is stable.
export function checkNumber(order:Order,state:PosState):number{
 return state.orders.findIndex(o=>o.id===order.id)+1;
}

// Header order requested by the owner: logo, table, check number, trading day, time, who entered it.
export function receiptRows(order:Order,state:PosState,printedAt=new Date()):Row[]{
 const totals=orderTotals(order),opened=new Date(order.createdAt);
 const rows:Row[]=[
  ...(state.receipt?.logo?[{image:state.receipt.logo}]:[]),
  {text:`მაგიდა ${state.tables.find(t=>t.id===order.tableId)?.name??''}`,align:'center',size:'large',bold:true},
  {text:`ჩეკი № ${checkNumber(order,state)}${(order.receiptPrintCount||0)>1?' · ასლი':''}`,align:'center',bold:true},
  {text:`სავაჭრო დღე: ${tradingDay(opened)}`},
  {text:`დრო: გახსნა ${clock(opened)} · დაიბეჭდა ${clock(printedAt)}`},
  {text:'შეიყვანა: მოლარე'},
  RULE,
  {text:'არაფისკალური ანგარიში',align:'center'},
  ...orderNotes(order,state).flatMap(note=>[{text:`! ${note}`,bold:true}]),
  ...(orderNotes(order,state).length?[RULE]:[]),
 ];
 for(const line of order.lines.filter(l=>l.quantity>l.voidQuantity)){
  const qty=line.quantity-line.voidQuantity;
  rows.push({text:line.name,bold:true},{lead:`${qty} ×`,text:money(line.price),right:money(line.price*qty)},...cashDetails(line));
 }
 rows.push(RULE);
 const summary:[string,number][]=[['სულ',totals.subtotal],['ფასდაკლება',totals.discount],['ჯამი',totals.total],['გადახდილია',totals.paid],['დარჩენილია',totals.due]];
 for(const [label,value] of summary)rows.push({text:label,right:money(value),bold:label==='ჯამი'});
 for(const payment of order.payments)rows.push({text:`${methods[payment.method]}: ${money(payment.amount)}`});
 rows.push(RULE,{gap:8},{text:'მადლობა სტუმრობისთვის!',align:'center'},{image:'/orvio-mark.svg',caption:'ORVIO · RESTAURANT POS'});
 return rows;
}

export function ticketRows(ticket:Ticket,state:PosState):Row[]{
 const rows:Row[]=[
  {text:state.departments.find(d=>d.id===ticket.departmentId)?.name??'',align:'center',size:'huge',bold:true},
  {text:`მაგიდა ${ticket.tableName}`,align:'center',size:'huge',bold:true},
  {text:`${ticket.type==='cancel'?'გაუქმების ჩეკი':'შეკვეთა'}${ticket.printCount>1?' · ასლი':''}`,align:'center',bold:true},
  {text:when(ticket.createdAt),align:'center'},
  RULE,
  ...(ticket.note?[{text:`! ${ticket.note}`,size:'large' as const,bold:true},RULE]:[]),
 ];
 for(const line of grouped(ticket.lines))rows.push({text:`${line.quantity} × ${line.name}`,size:'large',bold:true},...kitchenDetails(line),{gap:6});
 rows.push(RULE,{text:`#${ticket.id.slice(0,8)}`});
 return rows;
}

export function testPageRows(now:Date):Row[]{
 return [
  {text:'ORVIO — საცდელი ბეჭდვა',align:'center',size:'large',bold:true},
  {text:when(now.toISOString()),align:'center'},
  {text:'ქართული ტექსტი: აბგდევზთ'},
  {text:'₾ 12.50'},
  RULE,
  // Edge markers show whether the full 80 mm print width is used.
  {text:'|< 80 მმ',right:'>|'},
 ];
}
