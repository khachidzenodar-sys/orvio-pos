import type {Order,PosState,Ticket} from '@/lib/pos';

export type PrintDocument = {kind:'receipt';order:Order;state:PosState}|{kind:'ticket';ticket:Ticket;state:PosState};

// 'dialog' means no printer is selected: the UI falls back to .printarea + window.print().
// Failures throw an Error with a Georgian message.
export type ReceiptPrinter = {print(doc:PrintDocument):Promise<'printed'|'dialog'>};

export type PrinterSettings = {
 list():Promise<string[]>;
 selected():Promise<string|null>;
 select(name:string|null):Promise<void>;
 testPrint():Promise<void>;
};

// Packed rows of width/8 bytes; the most significant bit is the leftmost pixel; 1 = black.
export type Bitmap = {width:number;height:number;data:Uint8Array};
