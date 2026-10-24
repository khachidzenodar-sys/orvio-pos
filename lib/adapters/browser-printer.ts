import type {ReceiptPrinter} from '@/lib/ports/printer';

// The web version always prints through the browser dialog (.printarea + window.print()).
export function createBrowserPrinter():ReceiptPrinter{
 return {print:async()=>'dialog'};
}
