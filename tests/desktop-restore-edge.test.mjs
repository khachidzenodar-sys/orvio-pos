import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';

function evaluate(path, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', 'crypto', source)(name => {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  }, mod, mod.exports, webcrypto);
  return mod.exports;
}
const domain = evaluate('../lib/pos.ts');
const backup = evaluate('../lib/backup.ts');
const queue = evaluate('../lib/serial-queue.ts');
const escpos = evaluate('../lib/printing/escpos.ts');
const {createDemoStore, DEMO_STORAGE_KEY, DEFAULT_DEMO_PIN} = evaluate('../lib/demo-store.ts', {'./pos': domain, './backup': backup});

function memory() {
  const rows = new Map();
  return {rows, getItem: async key => rows.get(key) ?? null, setItem: async (key, value) => { rows.set(key, String(value)); }};
}

test('two restores keep every pre-restore copy (original data is never lost)', async () => {
  const storage = memory();
  const store = createDemoStore(storage, queue.createSerialQueue());
  const d = await store.read();
  await store.act('openOrder', {tableId: d.state.tables[0].id}, d);
  const original = storage.rows.get(DEMO_STORAGE_KEY);
  const other = createDemoStore(memory(), queue.createSerialQueue());
  await other.read();
  const text = await other.exportBackup();
  await store.restoreBackup(text, DEFAULT_DEMO_PIN);
  await store.restoreBackup(text, DEFAULT_DEMO_PIN);
  const copies = [...storage.rows.entries()].filter(([k]) => k.startsWith('orvio.before-restore.')).map(([, v]) => v);
  assert.ok(copies.includes(original), 'the original document must survive as a pre-restore copy');
});

test('576-dot raster header: xL=72 xH=0, height little-endian, cut at end', () => {
  const height = 300;
  const job = escpos.buildPrintJob({width: 576, height, data: new Uint8Array(72 * height)});
  assert.deepEqual([...job.slice(0, 2)], [0x1b, 0x40]);
  assert.deepEqual([...job.slice(2, 10)], [0x1d, 0x76, 0x30, 0, 72, 0, 255, 0]);
  const second = 10 + 72 * 255;
  assert.deepEqual([...job.slice(second, second + 8)], [0x1d, 0x76, 0x30, 0, 72, 0, 45, 0]);
  assert.deepEqual([...job.slice(-7)], [0x1b, 0x64, 4, 0x1d, 0x56, 0x42, 0]);
  assert.equal(job.length, 2 + 16 + 72 * height + 7);
});
