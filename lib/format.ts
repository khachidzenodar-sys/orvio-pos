import type {Ticket} from './pos';

// Shared by the on-screen UI and the thermal receipt layout so both print the same text.
export const money=(n:number)=>`${(n/100).toFixed(2)} ₾`;
export const when=(s:string)=>new Date(s).toLocaleString('ka-GE',{timeZone:'Asia/Tbilisi'});
export const grouped=(lines:Ticket['lines'])=>Object.values(lines.reduce<Record<string,Ticket['lines'][number]>>((a,l)=>{const addons=(l.addons||[]).map(x=>[x.id,x.name,x.price]).sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y)));const key=JSON.stringify([l.name,l.note,addons]);if(a[key])a[key].quantity+=l.quantity;else a[key]={...l};return a;},{}));
export const methods:Record<string,string>={cash:'ნაღდი',card:'ბარათი',other:'გადარიცხვა'};
