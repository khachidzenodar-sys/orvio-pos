import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
import {createTauriFileStorage} from '../lib/adapters/tauri-file-storage.ts';

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
const domain = evaluate('../lib/pos.ts', {'./inventory.ts': evaluate('../lib/inventory.ts')});
const {createSerialQueue} = evaluate('../lib/serial-queue.ts');
const {createDemoStore, DEMO_STORAGE_KEY} = evaluate('../lib/demo-store.ts', {'./pos': domain});

function slowFiles() {
  const rows = new Map();
  const invoke = async (cmd, args) => {
    await new Promise(r => setTimeout(r, 2));
    if (cmd === 'storage_read') return rows.get(args.key) ?? null;
    if (cmd === 'storage_write') { rows.set(args.key, args.value); return null; }
    throw new Error(cmd);
  };
  return {rows, storage: createTauriFileStorage(invoke)};
}

test('two concurrent first reads with the serial queue create one document, not two', async () => {
  const {rows, storage} = slowFiles();
  const store = createDemoStore(storage, createSerialQueue(), 'desktop-error');
  const [a, b] = await Promise.all([store.read(), store.read()]);
  assert.equal(a.userId, b.userId);
  assert.equal(JSON.parse(rows.get(DEMO_STORAGE_KEY)).userId, a.userId);
});

test('stale version after a queued act is rejected as a conflict and nothing is lost', async () => {
  const {rows, storage} = slowFiles();
  const store = createDemoStore(storage, createSerialQueue(), 'desktop-error');
  const s = await store.read();
  const table = s.state.tables[0];
  const first = store.act('openOrder', {tableId: table.id}, s);
  const second = store.act('openOrder', {tableId: table.id}, s);
  const results = await Promise.allSettled([first, second]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.equal(JSON.parse(rows.get(DEMO_STORAGE_KEY)).version, s.version + 1);
});

test('corrupt file is reported, not overwritten', async () => {
  const {rows, storage} = slowFiles();
  rows.set(DEMO_STORAGE_KEY, '{"broken":');
  const store = createDemoStore(storage, createSerialQueue(), 'desktop-error');
  await assert.rejects(store.read(), /დაზიანებულია/);
  assert.equal(rows.get(DEMO_STORAGE_KEY), '{"broken":');
});
