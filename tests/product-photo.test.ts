import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import * as photo from '../lib/product-photo.ts';

const {isValidProductPhoto, photoBytes, photoKilobytes, photoUsage, photoLimitError, sourceFileError, isHeicFile, fitWithin, isQuotaError, PHOTO_MESSAGES, PHOTO_ENCODE_STEPS} = photo;
// A data URL of exactly `chars` characters (payload kept a multiple of 4).
const dataUrl = (chars: number, type = 'webp') => {
  const head = `data:image/${type};base64,`;
  return head + 'A'.repeat(Math.floor((chars - head.length) / 4) * 4);
};
const products = (n: number, chars = 1000) => Array.from({length: n}, (_, i) => ({id: `p${i}`, photo: dataUrl(chars)}));

test('limits and accept list match the design', () => {
  assert.equal(photo.PHOTO_MAX_SIDE, 400);
  assert.equal(photo.PHOTO_TARGET_CHARS, 54_000);
  assert.equal(photo.PHOTO_MAX_CHARS, 60_000);
  assert.equal(photo.PHOTO_MAX_COUNT, 60);
  assert.equal(photo.PHOTO_MAX_TOTAL_CHARS, 1_800_000);
  assert.equal(photo.PHOTO_SOURCE_MAX_BYTES, 15 * 1024 * 1024);
  assert.equal(photo.PHOTO_ACCEPT, 'image/jpeg,image/png,image/webp,image/heic,image/heif');
  assert.deepEqual(Object.keys(PHOTO_MESSAGES).sort(), ['countLimit', 'heic', 'invalid', 'notImage', 'quota', 'tooHeavy', 'tooLarge', 'totalLimit']);
  assert.ok(Object.values(PHOTO_MESSAGES).every(m => typeof m === 'string' && /[ა-ჰ]/.test(m)));
  assert.equal(PHOTO_MESSAGES.quota, 'ბრაუზერის მეხსიერება გავსებულია — ფოტო ვერ შეინახა. წაშალეთ ზოგიერთი ფოტო.');
});

test('validator accepts only embedded jpeg/png/webp base64 within the size limit', () => {
  for (const type of ['jpeg', 'png', 'webp']) assert.equal(isValidProductPhoto(`data:image/${type};base64,iVBORw0KGgo=`), true, type);
  assert.equal(isValidProductPhoto('data:image/png;base64,AAAA'), true);
  assert.equal(isValidProductPhoto('data:image/png;base64,AA=='), true);
  assert.equal(isValidProductPhoto(dataUrl(60_000)), true);
  const rejected = [
    'https://example.com/a.jpg', 'http://x/y.png', 'javascript:alert(1)', '//cdn/a.png', '/photo.png',
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:image/svg+xml,<svg onload=alert(1)>', 'data:text/html;base64,PGgxPg==',
    'data:image/gif;base64,R0lGODlh', 'data:image/jpg;base64,AAAA', 'data:IMAGE/PNG;base64,AAAA', 'data:image/png,AAAA',
    'data:image/png;base64,', 'data:image/png;base64,AA AA', 'data:image/png;base64,AA-_', 'data:image/png;base64,AAAA\n',
    ' data:image/png;base64,AAAA', 'data:image/png;base64,AAA', 'data:image/png;base64,AAAAA', 'data:image/png;base64,A===',
    'data:image/png;base64,AAAA"onerror="x', '', 'data:image/png;charset=utf-8;base64,AAAA',
  ];
  for (const value of rejected) assert.equal(isValidProductPhoto(value), false, value);
  assert.equal(isValidProductPhoto('data:image/png;base64,' + 'A'.repeat(60_001 - 22)), false);
  assert.equal(isValidProductPhoto(dataUrl(60_004)), false);
  for (const value of [null, undefined, 0, 42, true, {}, [], ['data:image/png;base64,AAAA'], new String('data:image/png;base64,AAAA')]) assert.equal(isValidProductPhoto(value), false);
});

test('validator rejects an oversized string quickly, before the regex', () => {
  const huge = 'data:image/png;base64,' + 'A'.repeat(20_000_000);
  const started = performance.now();
  assert.equal(isValidProductPhoto(huge), false);
  assert.ok(performance.now() - started < 50);
});

test('photoBytes and photoKilobytes use base64 arithmetic', () => {
  assert.equal(photoBytes('data:image/png;base64,AAAA'), 3);
  assert.equal(photoBytes('data:image/png;base64,AAA='), 2);
  assert.equal(photoBytes('data:image/png;base64,AA=='), 1);
  assert.equal(photoBytes('data:image/jpeg;base64,' + 'A'.repeat(4096)), 3072);
  assert.equal(photoKilobytes('data:image/jpeg;base64,' + 'A'.repeat(4096)), 3);
  assert.equal(photoKilobytes('data:image/jpeg;base64,AAAA'), 1);
  assert.equal(photoKilobytes(dataUrl(54_000)), Math.ceil(photoBytes(dataUrl(54_000)) / 1024));
  assert.ok(photoBytes(dataUrl(60_000)) <= 45_000);
});

test('fitWithin scales down, never enlarges and keeps integer sides', () => {
  assert.deepEqual(fitWithin(4000, 3000), {width: 400, height: 300});
  assert.deepEqual(fitWithin(3000, 4000), {width: 300, height: 400});
  assert.deepEqual(fitWithin(300, 300), {width: 300, height: 300});
  assert.deepEqual(fitWithin(1, 5000), {width: 1, height: 400});
  assert.deepEqual(fitWithin(5000, 1), {width: 400, height: 1});
  assert.deepEqual(fitWithin(4000, 3000, 240), {width: 240, height: 180});
  assert.deepEqual(fitWithin(400, 400), {width: 400, height: 400});
  assert.deepEqual(fitWithin(1333, 1000, 400), {width: 400, height: 300});
  for (const [w, h] of [[0, 0], [NaN, 10], [-5, 20]]) {
    const r = fitWithin(w, h);
    assert.ok(Number.isInteger(r.width) && r.width >= 1 && Number.isInteger(r.height) && r.height >= 1);
  }
});

test('sourceFileError checks the size first, then the type or extension', () => {
  const MB = 1024 * 1024;
  assert.equal(sourceFileError({name: 'a.jpg', type: 'image/jpeg', size: 15 * MB}), null);
  assert.equal(sourceFileError({name: 'a.jpg', type: 'image/jpeg', size: 15 * MB + 1}), PHOTO_MESSAGES.tooLarge);
  assert.equal(sourceFileError({name: 'a.pdf', type: 'application/pdf', size: 16 * MB}), PHOTO_MESSAGES.tooLarge);
  assert.equal(sourceFileError({name: 'menu.pdf', type: 'application/pdf', size: 1000}), PHOTO_MESSAGES.notImage);
  assert.equal(sourceFileError({name: 'notes.txt', type: 'text/plain', size: 10}), PHOTO_MESSAGES.notImage);
  assert.equal(sourceFileError({name: 'logo.svg', type: 'image/svg+xml', size: 10}), PHOTO_MESSAGES.notImage);
  assert.equal(sourceFileError({name: 'anim.gif', type: 'image/gif', size: 10}), PHOTO_MESSAGES.notImage);
  assert.equal(sourceFileError({name: 'noext', type: '', size: 10}), PHOTO_MESSAGES.notImage);
  assert.equal(sourceFileError({name: 'menu.pdf', type: '', size: 10}), PHOTO_MESSAGES.notImage);
  for (const name of ['IMG_1.HEIC', 'a.heif', 'a.jpg', 'a.JPEG', 'a.png', 'a.webp']) assert.equal(sourceFileError({name, type: '', size: 10}), null, name);
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'IMAGE/PNG']) assert.equal(sourceFileError({name: 'x', type, size: 10}), null, type);
  // A renamed PDF passes this pre-check and is rejected later when decoding fails.
  assert.equal(sourceFileError({name: 'fake.jpg', type: 'image/jpeg', size: 10}), null);
});

test('isHeicFile recognises HEIC/HEIF by type or extension', () => {
  assert.equal(isHeicFile({name: 'IMG_0001.HEIC', type: ''}), true);
  assert.equal(isHeicFile({name: 'x', type: 'image/heif'}), true);
  assert.equal(isHeicFile({name: 'photo.heic', type: 'image/heic'}), true);
  assert.equal(isHeicFile({name: 'photo.jpg', type: 'image/jpeg'}), false);
  assert.equal(isHeicFile({name: 'heic.png', type: 'image/png'}), false);
});

test('photoUsage counts photos and can exclude the product being replaced', () => {
  const list = [...products(3, 1000), {id: 'none'}, {id: 'empty', photo: ''}];
  assert.deepEqual(photoUsage([]), {count: 0, chars: 0});
  assert.deepEqual(photoUsage(list), {count: 3, chars: 3 * dataUrl(1000).length});
  assert.deepEqual(photoUsage(list, 'p1'), {count: 2, chars: 2 * dataUrl(1000).length});
  assert.deepEqual(photoUsage(list, 'none'), {count: 3, chars: 3 * dataUrl(1000).length});
});

test('photoLimitError allows the 60th photo, rejects the 61st, and ignores a replaced photo', () => {
  const small = dataUrl(1000);
  const list59 = [...products(59), {id: 'new'}];
  assert.equal(photoLimitError(list59, 'new', small), null);
  const list60 = [...products(60), {id: 'new'}];
  assert.equal(photoLimitError(list60, 'new', small), PHOTO_MESSAGES.countLimit);
  // Replacing one of the 60 keeps the count at 60.
  assert.equal(photoLimitError(list60, 'p0', small), null);
  assert.equal(photoLimitError(list60, 'missing', small), PHOTO_MESSAGES.countLimit);
});

test('photoLimitError enforces the total size, counting the replacement only once', () => {
  // 30 × 60 000 = 1 800 000 exactly: allowed.
  const big = dataUrl(60_000);
  const list29 = [...products(29, 60_000), {id: 'new'}];
  assert.equal(photoUsage(list29).chars + big.length <= 1_800_000, true);
  assert.equal(photoLimitError(list29, 'new', big), null);
  const list30 = [...products(30, 60_000), {id: 'new'}];
  assert.equal(photoLimitError(list30, 'new', dataUrl(100)), PHOTO_MESSAGES.totalLimit);
  assert.equal(photoLimitError(list30, 'p0', big), null);
  assert.equal(photoLimitError([...products(29, 60_000), {id: 'p0', photo: dataUrl(100)}], 'p0', big), null);
});

test('isQuotaError recognises browser quota failures only', () => {
  assert.equal(isQuotaError(new DOMException('full', 'QuotaExceededError')), true);
  assert.equal(isQuotaError({name: 'QuotaExceededError'}), true);
  assert.equal(isQuotaError({name: 'NS_ERROR_DOM_QUOTA_REACHED'}), true);
  assert.equal(isQuotaError({code: 22}), true);
  assert.equal(isQuotaError({code: 1014}), true);
  for (const value of [new Error('disk'), new DOMException('x', 'SecurityError'), {name: 'TypeError', code: 0}, 'QuotaExceededError', 22, null, undefined]) assert.equal(isQuotaError(value), false);
});

test('encoder steps go from best quality to smallest output', () => {
  assert.deepEqual(PHOTO_ENCODE_STEPS.map((s: {maxSide: number; quality: number}) => [s.maxSide, s.quality]), [[400, 0.8], [400, 0.7], [400, 0.6], [400, 0.5], [320, 0.6], [240, 0.6]]);
  for (let i = 1; i < PHOTO_ENCODE_STEPS.length; i++) {
    const a = PHOTO_ENCODE_STEPS[i - 1], b = PHOTO_ENCODE_STEPS[i];
    assert.ok(b.maxSide < a.maxSide || (b.maxSide === a.maxSide && b.quality < a.quality), `step ${i} is not smaller`);
    assert.ok(b.maxSide <= photo.PHOTO_MAX_SIDE && b.quality > 0 && b.quality <= 1);
  }
});
