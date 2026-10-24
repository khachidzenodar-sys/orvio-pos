import type {DemoStore} from '../demo-store';
import type {BackupFiles} from './backup-files';
import type {ExportFiles} from './export-files';
import type {PrinterSettings,ReceiptPrinter} from './printer';

// Everything the POS UI needs from the outside world.
export type Platform = {
 kind:'browser'|'desktop';
 store:DemoStore;
 printer:ReceiptPrinter;
 printerSettings?:PrinterSettings; // desktop only
 backupFiles?:BackupFiles;         // desktop only
 exportFiles?:ExportFiles;         // desktop only; the browser downloads instead
};
