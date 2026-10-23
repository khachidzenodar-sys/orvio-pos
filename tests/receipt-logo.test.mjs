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

const LOGO = 'data:image/png;base64,iVBORw0KGgo=';
const act = (state, payload, manager = true) => domain.applyAction(state, 'setReceiptLogo', payload, manager, NOW);

test('a manager can add, replace and remove the receipt logo', () => {
  let s = domain.seedState();
  assert.throws(() => act(s, {logo: LOGO}, false), /მენეჯერის/);
  s = act(s, {logo: LOGO});
  assert.equal(s.receipt.logo, LOGO);
  assert.ok(!s.audit.at(-1).detail.includes('base64'), 'audit never stores the image');
  s = act(s, {logo: null});
  assert.equal(s.receipt.logo, undefined);
  assert.throws(() => act(s, {logo: null}), /ლოგო/);
});

test('only small embedded jpeg/png/webp images are accepted as a logo', () => {
  const s = domain.seedState();
  for (const bad of ['https://x/logo.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'javascript:alert(1)', 5, '']) assert.throws(() => act(s, {logo: bad}));
});

test('stored documents validate the logo strictly and old documents still load', () => {
  const store = evaluate('../lib/demo-store.ts', {'./pos': domain});
  const doc = state => JSON.stringify({schema: 1, userId: 'u', version: 1, configured: true, state, pin: '1234', failures: 0, blockedUntil: 0});
  const base = domain.seedState();
  assert.doesNotThrow(() => store.parseDemoDocument(doc(base)));
  assert.doesNotThrow(() => store.parseDemoDocument(doc({...base, receipt: {logo: LOGO}})));
  assert.throws(() => store.parseDemoDocument(doc({...base, receipt: {logo: 'https://x/l.png'}})));
  assert.throws(() => store.parseDemoDocument(doc({...base, receipt: {logo: LOGO, extra: 1}})));
});

test('changing the logo needs the manager PIN in both the demo store and the account API', () => {
  for (const file of ['../lib/demo-store.ts', '../app/api/pos/route.ts']) assert.ok(fs.readFileSync(new URL(file, import.meta.url), 'utf8').includes("'setReceiptLogo'"), file);
});
