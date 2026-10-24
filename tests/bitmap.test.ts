import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {toBitmap} from '../lib/printing/bitmap.ts';

type Pixel = [number, number, number, number];
const WHITE: Pixel = [255, 255, 255, 255], BLACK: Pixel = [0, 0, 0, 255], CLEAR: Pixel = [0, 0, 0, 0];
const rgba = (pixels: Pixel[]) => Uint8ClampedArray.from(pixels.flat());

test('pixels pack MSB-first with 1 for black', () => {
  const row: Pixel[] = Array.from({length: 16}, (_, x) => x === 0 || x === 15 ? BLACK : WHITE);
  const bitmap = toBitmap(rgba([...row, ...row.map(p => p === BLACK ? WHITE : BLACK)]), 16, 2);
  assert.equal(bitmap.width, 16);
  assert.equal(bitmap.height, 2);
  assert.deepEqual(Array.from(bitmap.data), [0x80, 0x01, 0x7F, 0xFE]);
});

test('luminance is compared against the threshold', () => {
  const grays: Pixel[] = [100, 150, 159, 160, 170, 200, 250, 0].map(v => [v, v, v, 255]);
  assert.deepEqual(Array.from(toBitmap(rgba(grays), 8, 1).data), [0b11100001]);
  assert.deepEqual(Array.from(toBitmap(rgba(grays), 8, 1, 120).data), [0b10000001]);
});

test('transparent pixels are treated as white paper', () => {
  const pixels: Pixel[] = [CLEAR, CLEAR, BLACK, [0, 0, 0, 64], CLEAR, CLEAR, CLEAR, CLEAR];
  assert.deepEqual(Array.from(toBitmap(rgba(pixels), 8, 1).data), [0b00100000]);
});

test('a width that is not a multiple of 8 throws', () => {
  assert.throws(() => toBitmap(new Uint8ClampedArray(12 * 4), 12, 1), /multiple of 8/);
});
