import type {Invoke} from '@/lib/adapters/tauri-invoke';
import type {Bitmap,PrintDocument,PrinterSettings,ReceiptPrinter} from '@/lib/ports/printer';
import type {KeyValueStore} from '@/lib/ports/storage';
import {receiptRows,testPageRows,ticketRows,type Row} from '@/lib/printing/receipt-layout';
import {buildPrintJob} from '@/lib/printing/escpos';

const PRINTER_KEY='orvio.printer.v1';

type Deps={invoke:Invoke;store:KeyValueStore;render:(rows:Row[])=>Promise<Bitmap>};

// Tauri rejects with the Rust Err(String); keep that Georgian text as the Error message.
function asError(error:unknown):Error{
 return error instanceof Error?error:new Error(String(error));
}

// kind:'rows' documents (e.g. the day report) arrive already laid out.
function docRows(doc:PrintDocument):Row[]{
 return doc.kind==='rows'?doc.rows:doc.kind==='receipt'?receiptRows(doc.order,doc.state):ticketRows(doc.ticket,doc.state);
}

// Desktop printer: renders rows to a bitmap and sends ESC/POS raster bytes to the selected Windows printer.
export function createEscPosPrinter({invoke,store,render}:Deps):ReceiptPrinter&PrinterSettings{
 async function selected():Promise<string|null>{
  try{
   const name=JSON.parse(await store.getItem(PRINTER_KEY)||'null')?.name;
   return typeof name==='string'&&name?name:null;
  }catch{
   return null;
  }
 }

 async function send(printer:string,rows:Row[]):Promise<void>{
  try{
   const data=buildPrintJob(await render(rows));
   await invoke<null>('print_raw',{printer,data:Array.from(data)});
  }catch(error){
   throw asError(error);
  }
 }

 return {
  selected,
  async select(name){
   await store.setItem(PRINTER_KEY,JSON.stringify({name:name||null}));
  },
  async list(){
   try{return await invoke<string[]>('list_printers');}
   catch(error){throw asError(error);}
  },
  async print(doc){
   const printer=await selected();
   if(!printer)return 'dialog';
   await send(printer,docRows(doc));
   return 'printed';
  },
  async testPrint(){
   const printer=await selected();
   if(!printer)throw new Error('ჯერ აირჩიეთ პრინტერი');
   await send(printer,testPageRows(new Date()));
  },
 };
}
