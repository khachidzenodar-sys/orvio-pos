// Backup file format. Pure: the document validator is injected by the caller.
export const BACKUP_FORMAT_VERSION = 1;

export type BackupSummary = {orders:number; products:number};
export type Backup<Doc> = {createdAt:string; document:Doc; summary:BackupSummary; stockItems:number};
type Counted = {state:{orders:unknown[]; products:unknown[]; inventory?:{items:unknown[]}}};

const brokenFile = 'ფაილი დაზიანებულია ან არ არის ORVIO-ს სარეზერვო ასლი';

export function createBackup(document:unknown, now:Date):string {
 return JSON.stringify({app:'orvio-pos',kind:'backup',formatVersion:BACKUP_FORMAT_VERSION,createdAt:now.toISOString(),document},null,2);
}

export function readBackup<Doc extends Counted>(text:string, parseDocument:(raw:string)=>Doc):Backup<Doc> {
 if(!text.trim())throw new Error('ფაილი ცარიელია');
 let envelope:unknown;
 try{envelope=JSON.parse(text);}catch{throw new Error(brokenFile);}
 if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))throw new Error(brokenFile);
 const e=envelope as Record<string,unknown>;
 if(e.app!=='orvio-pos'||e.kind!=='backup')throw new Error('ეს ფაილი ORVIO-ს სარეზერვო ასლი არ არის');
 if(typeof e.formatVersion==='number'&&e.formatVersion>BACKUP_FORMAT_VERSION)throw new Error('ფაილი უფრო ახალი ვერსიითაა შექმნილი');
 if(e.formatVersion!==BACKUP_FORMAT_VERSION||typeof e.createdAt!=='string'||!Number.isFinite(Date.parse(e.createdAt)))throw new Error(brokenFile);
 let document:Doc;
 try{document=parseDocument(JSON.stringify(e.document??null));}catch{throw new Error('სარეზერვო ასლის მონაცემები დაზიანებულია');}
 return {createdAt:e.createdAt,document,summary:{orders:document.state.orders.length,products:document.state.products.length},stockItems:document.state.inventory?.items.length??0};
}

const tbilisi = (now:Date) => Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));

export function backupFileName(now:Date):string {
 const t=tbilisi(now);
 return `orvio-backup-${t.year}-${t.month}-${t.day}.json`;
}

// Used in storage keys, so it must stay within [a-z0-9.-].
export function backupStamp(now:Date):string {
 const t=tbilisi(now);
 return `${t.year}${t.month}${t.day}-${t.hour}${t.minute}${t.second}`;
}
