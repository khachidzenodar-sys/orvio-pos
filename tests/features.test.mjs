import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {loadDomain} from './helpers/load-domain.mjs';

function evaluate(path, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', source)(name => {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  }, mod, mod.exports);
  return mod.exports;
}

const domain = loadDomain(evaluate);
const NOW = '2026-10-23T12:00:00.000Z';
const run = (state, action, payload = {}, manager = false) => domain.applyAction(state, action, payload, manager, NOW);

test('all feature switches start on, and old documents read as defaults', () => {
  assert.deepEqual(domain.features(domain.seedState()), domain.FEATURE_DEFAULTS);
  assert.ok(Object.values(domain.FEATURE_DEFAULTS).every(Boolean));
});

test('a manager switches a feature off and on; unknown keys are refused', () => {
  let s = domain.seedState();
  assert.throws(() => run(s, 'setFeature', {key: 'sendDelay', on: false}), /მენეჯერის/);
  s = run(s, 'setFeature', {key: 'sendDelay', on: false}, true);
  assert.equal(domain.features(s).sendDelay, false);
  assert.equal(domain.features(s).ticketNote, true);
  s = run(s, 'setFeature', {key: 'sendDelay', on: true}, true);
  assert.equal(domain.features(s).sendDelay, true);
  assert.throws(() => run(s, 'setFeature', {key: 'nope', on: true}, true));
  assert.throws(() => run(s, 'setFeature', {key: 'sendDelay', on: 'yes'}, true));
});

test('turning the waiter-code switch off opens tables without a code even with waiters', () => {
  let s = run(domain.seedState(), 'saveStaff', {name: 'ნინო', code: '1111'}, true);
  assert.throws(() => run(s, 'openOrder', {tableId: 'table-1'}), /მიმტნის კოდი/);
  s = run(s, 'setFeature', {key: 'waiterCode', on: false}, true);
  s = run(s, 'openOrder', {tableId: 'table-1'});
  assert.equal(s.orders[0].waiterName, undefined);
});

test('stored switches are validated and need the PIN everywhere', () => {
  const store = evaluate('../lib/demo-store.ts', {'./pos': domain});
  const doc = state => JSON.stringify({schema: 1, userId: 'u', version: 1, configured: true, state, pin: '1234', failures: 0, blockedUntil: 0});
  const base = domain.seedState();
  assert.doesNotThrow(() => store.parseDemoDocument(doc({...base, features: {sendDelay: false}})));
  assert.throws(() => store.parseDemoDocument(doc({...base, features: {sendDelay: 'no'}})));
  assert.throws(() => store.parseDemoDocument(doc({...base, features: {other: true}})));
  for (const file of ['../lib/demo-store.ts', '../app/api/pos/route.ts']) assert.ok(fs.readFileSync(new URL(file, import.meta.url), 'utf8').includes("'setFeature'"), file);
});
