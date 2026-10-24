import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {applyAction, seedState, PHOTO_ACTION, PHOTO_MESSAGES, isValidProductPhoto} from '../lib/pos.ts';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {PHOTO_MAX_COUNT} from '../lib/product-photo.ts';

type State = ReturnType<typeof seedState>;
const NOW = '2026-10-23T12:00:00.000Z';
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const WEBP = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
const big = (chars: number) => 'data:image/png;base64,' + 'A'.repeat(Math.floor((chars - 22) / 4) * 4);
const act = (s: State, action: string, p: Record<string, unknown> = {}, manager = false) => applyAction(s, action, p, manager, NOW);
const setPhoto = (s: State, productId: string, photo: string | null, manager = true) => act(s, 'setProductPhoto', {productId, photo, pin: '1234'}, manager);
const product = (s: State, id = 'product-1') => s.products.find(p => p.id === id)!;

test('setProductPhoto is the dedicated photo action and requires the manager', () => {
  assert.equal(PHOTO_ACTION, 'setProductPhoto');
  const s = seedState();
  assert.throws(() => setPhoto(s, 'product-1', JPEG, false), /მენეჯერის კოდი აუცილებელია/);
  assert.throws(() => setPhoto(s, 'product-1', null, false), /მენეჯერის კოდი აუცილებელია/);
  assert.equal(product(s).photo, undefined);
});

test('unknown product fails with a Georgian error and leaves the state unchanged', () => {
  const s = seedState();
  const before = structuredClone(s);
  assert.throws(() => setPhoto(s, 'missing', JPEG), /პროდუქტი ვერ მოიძებნა/);
  assert.throws(() => setPhoto(s, undefined as unknown as string, JPEG), /პროდუქტი ვერ მოიძებნა/);
  assert.deepEqual(s, before);
});

test('invalid photo values are rejected with PHOTO_MESSAGES.invalid', () => {
  const s = seedState();
  const before = structuredClone(s);
  const bad: unknown[] = ['https://example.com/a.jpg', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'data:text/html;base64,PGgxPg==', big(60_100), '', undefined, 42, {src: JPEG}, [JPEG], 'data:image/png;base64,AAA'];
  for (const photo of bad) assert.throws(() => act(s, 'setProductPhoto', {productId: 'product-1', photo, pin: '1234'}, true), (e: Error) => e.message === PHOTO_MESSAGES.invalid, String(photo).slice(0, 40));
  assert.deepEqual(s, before);
});

test('set, replace and remove a photo; the audit never stores the data URL', () => {
  let s = seedState();
  s = setPhoto(s, 'product-1', JPEG);
  assert.equal(product(s).photo, JPEG);
  assert.ok(isValidProductPhoto(product(s).photo));
  assert.equal(s.audit.at(-1)!.action, 'setProductPhoto');
  assert.equal(s.audit.at(-1)!.detail, 'ხაჭაპური: ფოტო დაემატა');
  s = setPhoto(s, 'product-1', WEBP);
  assert.equal(product(s).photo, WEBP);
  assert.equal(s.audit.at(-1)!.detail, 'ხაჭაპური: ფოტო შეიცვალა');
  // Other products are untouched.
  assert.ok(s.products.filter(p => p.id !== 'product-1').every(p => !('photo' in p)));
  s = setPhoto(s, 'product-1', null);
  assert.equal('photo' in product(s), false);
  assert.equal(s.audit.at(-1)!.detail, 'ხაჭაპური: ფოტო წაიშალა');
  assert.throws(() => setPhoto(s, 'product-1', null), /პროდუქტს ფოტო არ აქვს/);
  assert.equal(JSON.stringify(s.audit).includes('data:'), false);
  assert.equal(s.audit.length, 3);
});

test('setProductPhoto does not mutate the original state', () => {
  const s = seedState();
  const next = setPhoto(s, 'product-1', JPEG);
  assert.equal(product(s).photo, undefined);
  assert.equal(product(next).photo, JPEG);
});

test('saveProduct keeps the photo when the payload has no photo field', () => {
  let s = setPhoto(seedState(), 'product-1', JPEG);
  s = act(s, 'saveProduct', {id: 'product-1', name: 'იმერული ხაჭაპური', category: 'კერძები', price: 2100, departmentIds: ['kitchen', 'pastry'], active: true});
  const p = product(s);
  assert.equal(p.photo, JPEG);
  assert.equal(p.name, 'იმერული ხაჭაპური');
  assert.equal(p.price, 2100);
  assert.deepEqual(p.departmentIds, ['kitchen', 'pastry']);
  s = act(s, 'saveProduct', {...p, active: false});
  assert.equal(product(s).photo, JPEG);
  assert.equal(product(s).active, false);
});

test('saveProduct ignores a photo field, so the PIN cannot be bypassed', () => {
  let s = act(seedState(), 'saveProduct', {id: 'product-2', name: 'ცეზარი', category: 'სალათები', price: 2400, departmentIds: ['kitchen'], active: true, photo: JPEG});
  assert.equal('photo' in product(s, 'product-2'), false);
  s = act(s, 'saveProduct', {name: 'ახალი', category: 'კერძები', price: 500, departmentIds: ['kitchen'], active: true, photo: JPEG});
  assert.equal('photo' in s.products.at(-1)!, false);
  s = setPhoto(s, 'product-2', JPEG);
  s = act(s, 'saveProduct', {...product(s, 'product-2'), photo: WEBP});
  assert.equal(product(s, 'product-2').photo, JPEG);
  s = act(s, 'saveProduct', {...product(s, 'product-2'), photo: null});
  assert.equal(product(s, 'product-2').photo, JPEG);
  s = act(s, 'saveProduct', {...product(s, 'product-2'), photo: 'https://evil.example/x.png'});
  assert.equal(product(s, 'product-2').photo, JPEG);
});

test('the 61st photo hits the count limit; replacing one of 60 is allowed', () => {
  let s = seedState();
  for (let i = s.products.length; i < PHOTO_MAX_COUNT + 1; i++) s = act(s, 'saveProduct', {id: `extra-${i}`, name: `კერძი ${i}`, category: 'კერძები', price: 100 + i, departmentIds: ['kitchen'], active: true});
  assert.equal(s.products.length, 61);
  for (const p of s.products.slice(0, 60)) s = setPhoto(s, p.id, JPEG);
  assert.equal(s.products.filter(p => p.photo).length, 60);
  const before = structuredClone(s);
  assert.throws(() => setPhoto(s, s.products[60].id, JPEG), (e: Error) => e.message === PHOTO_MESSAGES.countLimit);
  assert.deepEqual(s, before);
  s = setPhoto(s, s.products[0].id, WEBP);
  assert.equal(s.products[0].photo, WEBP);
  s = setPhoto(setPhoto(s, s.products[1].id, null), s.products[60].id, JPEG);
  assert.equal(s.products.filter(p => p.photo).length, 60);
});

test('the total size limit is enforced with a Georgian message', () => {
  let s = seedState();
  for (let i = s.products.length; i < 31; i++) s = act(s, 'saveProduct', {id: `extra-${i}`, name: `კერძი ${i}`, category: 'კერძები', price: 100, departmentIds: ['kitchen'], active: true});
  const photo = big(60_000);
  for (const p of s.products.slice(0, 30)) s = setPhoto(s, p.id, photo);
  assert.equal(s.products.reduce((sum, p) => sum + (p.photo?.length ?? 0), 0) <= 1_800_000, true);
  assert.throws(() => setPhoto(s, s.products[30].id, big(2_000)), (e: Error) => e.message === PHOTO_MESSAGES.totalLimit);
  assert.equal(s.products[30].photo, undefined);
  // Replacing a photo with one of the same size still fits.
  s = setPhoto(s, s.products[0].id, photo);
  assert.equal(s.products[0].photo, photo);
});

test('order lines and kitchen tickets never copy the photo', () => {
  let s = setPhoto(seedState(), 'product-1', JPEG);
  s = act(s, 'openOrder', {tableId: 'table-1'});
  const orderId = s.orders[0].id;
  s = act(s, 'addItem', {orderId, productId: 'product-1', quantity: 2});
  s = act(s, 'addItem', {orderId, productId: 'product-5', quantity: 1});
  s = act(s, 'sendOrder', {orderId});
  for (const line of s.orders[0].lines) assert.equal('photo' in line, false);
  assert.ok(s.tickets.length >= 2);
  for (const t of s.tickets) for (const line of t.lines) assert.equal('photo' in line, false);
  assert.equal(JSON.stringify({orders: s.orders, tickets: s.tickets, audit: s.audit}).includes('data:'), false);
  assert.equal(s.orders[0].lines[0].price, 1800);
});
