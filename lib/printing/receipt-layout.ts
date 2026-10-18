import {orderTotals,type Line,type Order,type PosState,type Ticket} from '@/lib/pos';
import {money,when,grouped,methods} from '@/lib/format';

// Abstract printable lines; the renderer decides pixels. Content mirrors the .printarea in pos-workspace.tsx.
export type Row =
 |{text:string;right?:string;align?:'left'|'center'|'right';size?:'normal'|'large'|'huge';bold?:boolean}
 |{rule:true}
 |{gap:number};

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

export function receiptRows(order:Order,state:PosState):Row[]{
 const totals=orderTotals(order);
 const rows:Row[]=[
  {text:'ასკილი',align:'center',size:'large',bold:true},
  {text:`არაფისკალური ანგარიში${(order.receiptPrintCount||0)>1?' · ასლი':''}`,align:'center'},
  {text:`მაგიდა ${state.tables.find(t=>t.id===order.tableId)?.name??''}`,align:'center',bold:true},
  {text:when(order.createdAt)},
  {text:`№ ${order.id.slice(0,8)}`},
  RULE,
 ];
 for(const line of order.lines.filter(l=>l.quantity>l.voidQuantity)){
  const qty=line.quantity-line.voidQuantity;
  rows.push({text:line.name,bold:true},{text:`${qty} × ${money(line.price)}`,right:money(line.price*qty)},...cashDetails(line));
 }
 rows.push(RULE);
 const summary:[string,number][]=[['სულ',totals.subtotal],['ფასდაკლება',totals.discount],['ჯამი',totals.total],['გადახდილია',totals.paid],['დარჩენილია',totals.due]];
 for(const [label,value] of summary)rows.push({text:label,right:money(value),bold:label==='ჯამი'});
 for(const payment of order.payments)rows.push({text:`${methods[payment.method]}: ${money(payment.amount)}`});
 rows.push(RULE,{gap:8},{text:'მადლობა სტუმრობისთვის!',align:'center'},{text:'ORVIO · RESTAURANT POS',align:'center'});
 return rows;
}

export function ticketRows(ticket:Ticket,state:PosState):Row[]{
 const rows:Row[]=[
  {text:state.departments.find(d=>d.id===ticket.departmentId)?.name??'',align:'center',size:'huge',bold:true},
  {text:`მაგიდა ${ticket.tableName}`,align:'center',size:'huge',bold:true},
  {text:`${ticket.type==='cancel'?'გაუქმების ჩეკი':'შეკვეთა'}${ticket.printCount>1?' · ასლი':''}`,align:'center',bold:true},
  {text:when(ticket.createdAt),align:'center'},
  RULE,
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
