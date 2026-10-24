import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('every command the desktop adapters invoke is registered in the Tauri crate', () => {
  const lib = read('src-tauri/src/lib.rs');
  const registered = new Set([...lib.matchAll(/(\w+)::(\w+)\s*[,\]\n]/g)].map(m => m[2]));
  const adapters = ['lib/adapters/tauri-file-storage.ts', 'lib/adapters/tauri-backup-files.ts', 'lib/adapters/escpos-printer.ts'].map(read).join('\n');
  const invoked = new Set([...adapters.matchAll(/invoke<[^>]*>\('(\w+)'/g)].map(m => m[1]));
  assert.deepEqual([...invoked].sort(), ['backup_open', 'backup_save', 'export_save', 'list_printers', 'print_raw', 'storage_read', 'storage_write']);
  for (const name of invoked) assert.ok(registered.has(name), `${name} is not registered`);
  assert.match(lib, /^mod printer;$/m);
});

test('desktop platform uses the ESC/POS printer for printing and settings; the web page keeps the browser printer', () => {
  const platform = read('desktop/platform.ts');
  assert.match(platform, /printer:\s*escpos/);
  assert.match(platform, /printerSettings:\s*escpos/);
  assert.doesNotMatch(platform, /browser-printer/);
  const workspace = read('components/pos-workspace.tsx');
  assert.match(workspace, /platform\?\.printer\?\?createBrowserPrinter\(\)/);
  assert.match(workspace, /platform\?\.printerSettings&&<PrinterSettings/);
});
