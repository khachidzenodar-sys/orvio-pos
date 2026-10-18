import {applyAction, demoSeedState, INVENTORY_ACTIONS, isValidInventory, normalizeState, type PosState} from './pos';
import type {KeyValueStore} from './ports/storage';

export const DEMO_STORAGE_KEY = 'orvio.demo.v1';
export const DEFAULT_DEMO_PIN = '1234';
export type DemoSnapshot = {userId:string; version:number; configured:true; state:PosState};
export type DemoDocument = DemoSnapshot & {schema:1; pin:string; failures:number; blockedUntil:number};
type Lock = <T>(work:()=>Promise<T>)=>Promise<T>;
const managerActions:string[] = ['discount','voidItem','changePin','saveTable','saveZone','saveDepartment','deleteTable','deleteDepartment',...INVENTORY_ACTIONS];
const storageError = 'დემოს შენახვა ვერ მოხერხდა. დაუშვით ამ საიტისთვის ბრაუზერში მონაცემების შენახვა.';
const corruptError = 'შენახული დემოს მონაცემები დაზიანებულია. ახალი დასაწყისისთვის გამოიყენეთ „დემოს განულება“.';
const conflictError = 'დემო სხვა ფანჯარაში შეიცვალა. განაახლეთ და სცადეთ ხელახლა.';
const isObject = (v:unknown):v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
const strings = (v:unknown):v is string[] => Array.isArray(v) && v.every(x=>typeof x==='string');
const number = (v:unknown) => typeof v==='number' && Number.isSafeInteger(v) && v>=0;
const date = (v:unknown) => typeof v==='string' && Number.isFinite(Date.parse(v));
const records = (v:unknown,check:(r:Record<string,unknown>)=>boolean):boolean => Array.isArray(v) && v.every(r=>isObject(r)&&check(r));
const identity = (r:Record<string,unknown>) => typeof r.id==='string' && typeof r.name==='string';
const optionText = (v:unknown,max=100):v is string => typeof v==='string'&&v.length>0&&v===v.trim()&&v.length<=max;
const quickNotes = (v:unknown) => v===undefined || (Array.isArray(v)&&v.length<=20&&v.every(note=>optionText(note))&&new Set(v).size===v.length);
const addons = (v:unknown) => v===undefined || (Array.isArray(v)&&v.length<=20&&records(v,r=>optionText(r.id,80)&&optionText(r.name)&&number(r.price)&&Number(r.price)>0&&Number(r.price)<=100000000)&&new Set(v.map(a=>a.id)).size===v.length);
const lineOptions = (r:Record<string,unknown>) => {
 if(!addons(r.addons)||(r.basePrice!==undefined&&!number(r.basePrice)))return false;
 const extras = (r.addons as {price:number}[]|undefined)??[];
 if(r.basePrice===undefined)return extras.length===0;
 const composed=Number(r.basePrice)+extras.reduce((sum,addon)=>sum+addon.price,0);
 return Number.isSafeInteger(composed)&&r.price===composed;
};
// Local data may be cleared or corrupted by browser tools. Reject a broken
// document explicitly rather than rendering it or silently replacing history.
function validState(v:unknown):v is PosState {
 if(!isObject(v))return false;
 return records(v.departments,identity) && records(v.zones,identity)
  && records(v.tables,r=>identity(r)&&typeof r.zoneId==='string')
  && records(v.products,r=>identity(r)&&typeof r.category==='string'&&number(r.price)&&strings(r.departmentIds)&&typeof r.active==='boolean'&&quickNotes(r.quickNotes)&&addons(r.addons))
  && records(v.orders,r=>typeof r.id==='string'&&typeof r.tableId==='string'&&['open','closed'].includes(String(r.status))&&date(r.createdAt)&&(r.closedAt===undefined||date(r.closedAt))&&(r.discountAmount===undefined||number(r.discountAmount))&&(r.receiptPrintCount===undefined||number(r.receiptPrintCount))&&typeof r.discountPercent==='number'&&Number.isFinite(r.discountPercent)
   && records(r.lines,l=>identity(l)&&typeof l.productId==='string'&&number(l.price)&&number(l.quantity)&&number(l.voidQuantity)&&number(l.sentQuantity)&&typeof l.note==='string'&&strings(l.departmentIds)&&lineOptions(l))
   && records(r.payments,p=>typeof p.id==='string'&&['cash','card','other'].includes(String(p.method))&&number(p.amount)&&date(p.createdAt)&&records(p.allocations,a=>typeof a.lineId==='string'&&number(a.amount))))
  && records(v.tickets,t=>typeof t.id==='string'&&typeof t.orderId==='string'&&typeof t.tableId==='string'&&typeof t.tableName==='string'&&typeof t.departmentId==='string'&&['order','cancel'].includes(String(t.type))&&date(t.createdAt)&&number(t.printCount)&&records(t.lines,l=>typeof l.lineId==='string'&&typeof l.name==='string'&&number(l.quantity)&&typeof l.note==='string'&&addons(l.addons)))
  && records(v.audit,a=>typeof a.id==='string'&&date(a.at)&&typeof a.action==='string'&&typeof a.detail==='string')
  && (v.inventory===undefined||isValidInventory(v.inventory,(v.products as {id:string}[]).map(p=>p.id)));
}
// Throws corruptError for anything that is not a complete, valid document.
export function parseDemoDocument(raw:string):DemoDocument {
 try{
  const d:unknown=JSON.parse(raw);
  if(!isObject(d)||d.schema!==1||typeof d.userId!=='string'||!d.userId||!number(d.version)||d.configured!==true||typeof d.pin!=='string'||!/^\d{4,12}$/.test(d.pin)||!number(d.failures)||!number(d.blockedUntil)||!validState(d.state))throw new Error();
  const doc=d as DemoDocument;
  // Documents saved before inventory existed migrate to empty stock.
  return {...doc,state:normalizeState(doc.state)};
 }catch{throw new Error(corruptError);}
}
function fresh():DemoDocument {
 return {schema:1,userId:crypto.randomUUID(),version:0,configured:true,state:demoSeedState(),pin:DEFAULT_DEMO_PIN,failures:0,blockedUntil:0};
}
function snapshot(doc:DemoDocument):DemoSnapshot {
 return structuredClone({userId:doc.userId,version:doc.version,configured:true,state:doc.state});
}

export type DemoStore = ReturnType<typeof createDemoStore>;

// This PIN is a public demo workflow, not an access-control boundary. Real
// accounts continue to verify their own hashed PIN in the protected API.
export function createDemoStore(storage:KeyValueStore, withLock:Lock=work=>work(), storageMessage=storageError) {
 const save=async(key:string,raw:string)=>{
  try{await storage.setItem(key,raw);}
  catch{throw new Error(storageMessage);}
 };
 const write=(doc:DemoDocument)=>save(DEMO_STORAGE_KEY,JSON.stringify(doc));
 const exists=async(key:string)=>{
  try{return await storage.getItem(key)!==null;}
  catch{throw new Error(storageMessage);}
 };
 const load=async():Promise<{doc:DemoDocument;raw:string}>=>{
  let raw:string|null;
  try{raw=await storage.getItem(DEMO_STORAGE_KEY);}catch{throw new Error(storageMessage);}
  if(raw===null){const doc=fresh();await write(doc);return {doc,raw:JSON.stringify(doc)};}
  return {doc:parseDemoDocument(raw),raw};
 };
 const read=async()=>(await load()).doc;
 // Same PIN rules and lockout for every manager operation.
 const verifyPin=async(doc:DemoDocument,pin:unknown)=>{
  if(doc.blockedUntil>Date.now())throw new Error('კოდი დროებით დაბლოკილია. სცადეთ 5 წუთში.');
  if(pin!==doc.pin){
   doc.failures++;
   if(doc.failures>=5){doc.blockedUntil=Date.now()+300000;doc.failures=0;}
   doc.version++;await write(doc);throw new Error('მენეჯერის კოდი არასწორია');
  }
  doc.failures=0;doc.blockedUntil=0;
 };
 // Loaded lazily so the core store keeps a single runtime dependency (./pos).
 const codec=()=>import('./backup');
 return {
  read:()=>withLock(async()=>snapshot(await read())),
  act:(action:string,payload:Record<string,unknown>,expected:Pick<DemoSnapshot,'userId'|'version'>)=>withLock(async()=>{
   const doc=await read();
   if(doc.userId!==expected.userId||doc.version!==expected.version)throw new Error(conflictError);
   const manager=managerActions.includes(action);
   if(manager)await verifyPin(doc,action==='changePin'?payload.oldPin:payload.pin);
   if(action==='setupPin')throw new Error('დემოს კოდი უკვე დაყენებულია');
   if(action==='changePin'){
    if(typeof payload.newPin!=='string'||!/^\d{4,12}$/.test(payload.newPin))throw new Error('კოდი უნდა შეიცავდეს 4–12 ციფრს');
    doc.pin=payload.newPin;
   }else doc.state=applyAction(doc.state,action,payload,manager);
   doc.version++;await write(doc);return snapshot(doc);
  }),
  reset:()=>withLock(async()=>{const doc=fresh();await write(doc);return snapshot(doc);}),
  exportBackup:()=>withLock(async()=>(await codec()).createBackup(await read(),new Date())),
  inspectBackup:async(text:string)=>{const {createdAt,summary,stockItems}=(await codec()).readBackup(text,parseDemoDocument);return {createdAt,summary,stockItems};},
  // Replaces all local data, so it keeps a copy of the current document first.
  restoreBackup:(text:string,pin:string)=>withLock(async()=>{
   const {readBackup,backupStamp}=await codec();
   const backup=readBackup(text,parseDemoDocument);
   const {doc,raw}=await load();
   await verifyPin(doc,pin);
   // Never overwrite an earlier safety copy, even within the same second.
   const base=`orvio.before-restore.${backupStamp(new Date())}`;
   let key=base;
   for(let n=2;await exists(key);n++)key=`${base}-${n}`;
   await save(key,raw);
   const restored:DemoDocument={...backup.document,failures:0,blockedUntil:0,version:Math.max(doc.version,backup.document.version)+1};
   await write(restored);return snapshot(restored);
  })
 };
}

export function createBrowserDemoStore(){
 let storage:Storage;
 try{storage=window.localStorage;}catch{throw new Error(storageError);}
 const lock:Lock=async work=>navigator.locks?await navigator.locks.request(DEMO_STORAGE_KEY,work):await work();
 return createDemoStore(storage,lock);
}
