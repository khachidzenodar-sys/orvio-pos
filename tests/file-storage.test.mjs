import test from 'node:test';
import assert from 'node:assert/strict';
import {createTauriFileStorage} from '../lib/adapters/tauri-file-storage.ts';

// In-memory stand-in for the Rust storage_read/storage_write commands.
function fakeInvoke(rows = new Map()) {
  const calls = [];
  const invoke = async (cmd, args) => {
    calls.push([cmd, args]);
    if (cmd === 'storage_read') return rows.get(args.key) ?? null;
    if (cmd === 'storage_write') { rows.set(args.key, args.value); return null; }
    throw new Error(`unknown command ${cmd}`);
  };
  return {rows, calls, invoke};
}

test('file storage maps getItem/setItem to the Rust commands with key and value', async () => {
  const fake = fakeInvoke();
  const storage = createTauriFileStorage(fake.invoke);
  assert.equal(await storage.getItem('orvio.demo.v1'), null);
  assert.equal(await storage.setItem('orvio.demo.v1', '{"a":"ქართული ₾"}'), undefined);
  assert.equal(await storage.getItem('orvio.demo.v1'), '{"a":"ქართული ₾"}');
  assert.deepEqual(fake.calls, [
    ['storage_read', {key: 'orvio.demo.v1'}],
    ['storage_write', {key: 'orvio.demo.v1', value: '{"a":"ქართული ₾"}'}],
    ['storage_read', {key: 'orvio.demo.v1'}],
  ]);
});

test('file storage propagates command errors unchanged', async () => {
  const storage = createTauriFileStorage(async () => { throw new Error('დისკი სავსეა'); });
  await assert.rejects(storage.getItem('k'), /დისკი სავსეა/);
  await assert.rejects(storage.setItem('k', 'v'), /დისკი სავსეა/);
});
