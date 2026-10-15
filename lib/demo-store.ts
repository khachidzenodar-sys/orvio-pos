import {applyAction, seedState, type PosState} from './pos';

export const DEMO_STORAGE_KEY = 'orvio.demo.v1';
export const DEFAULT_DEMO_PIN = '1234';
export type DemoSnapshot = {userId:string; version:number; configured:true; state:PosState};
type DemoDocument = DemoSnapshot & {schema:1; pin:string; failures:number; blockedUntil:number};
type LocalStorage = Pick<Storage, 'getItem'|'setItem'>;
type Lock = <T>(work:()=>Promise<T>)=>Promise<T>;
const managerActions = ['discount','voidItem','changePin','saveTable','saveZone','saveDepartment','deleteTable','deleteDepartment'];
const storageError = 'დემოს შენახვა ვერ მოხერხდა. დაუშვით ამ საიტისთვის ბრაუზერში მონაცემების შენახვა.';
const corruptError = 'შენახული დემოს მონაცემები დაზიანებულია. ახალი დასაწყისისთვის გამოიყენეთ „დემოს განულება“.';
const conflictError = 'დემო სხვა ფანჯარაში შეიცვალა. განაახლეთ და სცადეთ ხელახლა.';
const isObject = (v:unknown):v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
const strings = (v:unknown):v is string[] => Array.isArray(v) && v.every(x=>typeof x==='string');
const number = (v:unknown) => typeof v==='number' && Number.isSafeInteger(v) && v>=0;
const date = (v:unknown) => typeof v==='string' && Number.isFinite(Date.parse(v));
const records = (v:unknown,check:(r:Record<string,unknown>)=>boolean):boolean => Array.isArray(v) && v.every(r=>isObject(r)&&check(r));
const identity = (r:Record<string,unknown>) => typeof r.id==='string' && typeof r.name==='string';
// Local data may be cleared or corrupted by browser tools. Reject a broken
// document explicitly rather than rendering it or silently replacing history.
function validState(v:unknown):v is PosState {
 if(!isObject(v))return false;
 return records(v.departments,identity) && records(v.zones,identity)
  && records(v.tables,r=>identity(r)&&typeof r.zoneId==='string')
  && records(v.products,r=>identity(r)&&typeof r.category==='string'&&number(r.price)&&strings(r.departmentIds)&&typeof r.active==='boolean')
  && records(v.orders,r=>typeof r.id==='string'&&typeof r.tableId==='string'&&['open','closed'].includes(String(r.status))&&date(r.createdAt)&&(r.closedAt===undefined||date(r.closedAt))&&(r.discountAmount===undefined||number(r.discountAmount))&&(r.receiptPrintCount===undefined||number(r.receiptPrintCount))&&typeof r.discountPercent==='number'&&Number.isFinite(r.discountPercent)
   && records(r.lines,l=>identity(l)&&typeof l.productId==='string'&&number(l.price)&&number(l.quantity)&&number(l.voidQuantity)&&number(l.sentQuantity)&&typeof l.note==='string'&&strings(l.departmentIds))
   && records(r.payments,p=>typeof p.id==='string'&&['cash','card','other'].includes(String(p.method))&&number(p.amount)&&date(p.createdAt)&&records(p.allocations,a=>typeof a.lineId==='string'&&number(a.amount))))
  && records(v.tickets,t=>typeof t.id==='string'&&typeof t.orderId==='string'&&typeof t.tableId==='string'&&typeof t.tableName==='string'&&typeof t.departmentId==='string'&&['order','cancel'].includes(String(t.type))&&date(t.createdAt)&&number(t.printCount)&&records(t.lines,l=>typeof l.lineId==='string'&&typeof l.name==='string'&&number(l.quantity)&&typeof l.note==='string'))
  && records(v.audit,a=>typeof a.id==='string'&&date(a.at)&&typeof a.action==='string'&&typeof a.detail==='string');
}
function fresh():DemoDocument {
 return {schema:1,userId:crypto.randomUUID(),version:0,configured:true,state:seedState(),pin:DEFAULT_DEMO_PIN,failures:0,blockedUntil:0};
}
function snapshot(doc:DemoDocument):DemoSnapshot {
 return structuredClone({userId:doc.userId,version:doc.version,configured:true,state:doc.state});
}

// This PIN is a public demo workflow, not an access-control boundary. Real
// accounts continue to verify their own hashed PIN in the protected API.
export function createDemoStore(storage:LocalStorage, withLock:Lock=work=>work()) {
 const write=(doc:DemoDocument)=>{
  try{storage.setItem(DEMO_STORAGE_KEY,JSON.stringify(doc));}
  catch{throw new Error(storageError);}
 };
 const read=():DemoDocument=>{
  let raw:string|null;
  try{raw=storage.getItem(DEMO_STORAGE_KEY);}catch{throw new Error(storageError);}
  if(raw===null){const doc=fresh();write(doc);return doc;}
  try{
   const d:unknown=JSON.parse(raw);
   if(!isObject(d)||d.schema!==1||typeof d.userId!=='string'||!d.userId||!number(d.version)||d.configured!==true||typeof d.pin!=='string'||!/^\d{4,12}$/.test(d.pin)||!number(d.failures)||!number(d.blockedUntil)||!validState(d.state))throw new Error();
   return d as DemoDocument;
  }catch{throw new Error(corruptError);}
 };
 return {
  read:()=>withLock(async()=>snapshot(read())),
  act:(action:string,payload:Record<string,unknown>,expected:Pick<DemoSnapshot,'userId'|'version'>)=>withLock(async()=>{
   const doc=read();
   if(doc.userId!==expected.userId||doc.version!==expected.version)throw new Error(conflictError);
   let manager=false;
   if(managerActions.includes(action)){
    if(doc.blockedUntil>Date.now())throw new Error('კოდი დროებით დაბლოკილია. სცადეთ 5 წუთში.');
    manager=(action==='changePin'?payload.oldPin:payload.pin)===doc.pin;
    if(!manager){
     doc.failures++;
     if(doc.failures>=5){doc.blockedUntil=Date.now()+300000;doc.failures=0;}
     doc.version++;write(doc);throw new Error('მენეჯერის კოდი არასწორია');
    }
    doc.failures=0;doc.blockedUntil=0;
   }
   if(action==='setupPin')throw new Error('დემოს კოდი უკვე დაყენებულია');
   if(action==='changePin'){
    if(typeof payload.newPin!=='string'||!/^\d{4,12}$/.test(payload.newPin))throw new Error('კოდი უნდა შეიცავდეს 4–12 ციფრს');
    doc.pin=payload.newPin;
   }else doc.state=applyAction(doc.state,action,payload,manager);
   doc.version++;write(doc);return snapshot(doc);
  }),
  reset:()=>withLock(async()=>{const doc=fresh();write(doc);return snapshot(doc);})
 };
}

export function createBrowserDemoStore(){
 let storage:Storage;
 try{storage=window.localStorage;}catch{throw new Error(storageError);}
 const lock:Lock=async work=>navigator.locks?await navigator.locks.request(DEMO_STORAGE_KEY,work):await work();
 return createDemoStore(storage,lock);
}
