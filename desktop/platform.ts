import {createDemoStore} from '@/lib/demo-store';
import {createSerialQueue} from '@/lib/serial-queue';
import {tauriInvoke} from '@/lib/adapters/tauri-invoke';
import {createTauriFileStorage} from '@/lib/adapters/tauri-file-storage';
import {createTauriBackupFiles, createTauriExportFiles} from '@/lib/adapters/tauri-backup-files';
import {createEscPosPrinter} from '@/lib/adapters/escpos-printer';
import {renderRows} from '@/lib/printing/canvas-renderer';
import type {Platform} from '@/lib/ports/platform';

// Composition root of the Windows app: wires the desktop adapters to the ports.
const files = createTauriFileStorage(tauriInvoke);
// Thermal printer; with no printer selected it falls back to the browser print dialog.
const escpos = createEscPosPrinter({invoke: tauriInvoke, store: files, render: renderRows});

export const desktopPlatform: Platform = {
  kind: 'desktop',
  store: createDemoStore(files, createSerialQueue(), 'მონაცემების შენახვა კომპიუტერზე ვერ მოხერხდა. წინა მონაცემები უცვლელია.'),
  printer: escpos,
  printerSettings: escpos,
  backupFiles: createTauriBackupFiles(tauriInvoke),
  exportFiles: createTauriExportFiles(tauriInvoke),
};
