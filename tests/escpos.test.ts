import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {buildPrintJob, rasterBands, INIT, FEED_AND_CUT} from '../lib/printing/escpos.ts';

const image = (width: number, height: number, fill = 0) => ({width, height, data: new Uint8Array(width / 8 * height).fill(fill)});

test('a 16×3 image becomes init, one GS v 0 band and feed-and-cut with exact bytes', () => {
  const bitmap = {width: 16, height: 3, data: Uint8Array.from([0x80, 0x01, 0xFF, 0x00, 0x0F, 0xF0])};
  assert.deepEqual(Array.from(buildPrintJob(bitmap)), [
    0x1B, 0x40,
    0x1D, 0x76, 0x30, 0x00, 2, 0, 3, 0,
    0x80, 0x01, 0xFF, 0x00, 0x0F, 0xF0,
    0x1B, 0x64, 0x04, 0x1D, 0x56, 0x42, 0x00,
  ]);
  assert.deepEqual(INIT, [0x1B, 0x40]);
  assert.deepEqual(FEED_AND_CUT, [0x1B, 0x64, 0x04, 0x1D, 0x56, 0x42, 0x00]);
});

test('a long receipt is split into bands of at most 255 rows, keeping every data byte in order', () => {
  const bitmap = image(8, 600);
  bitmap.data.forEach((_, i) => { bitmap.data[i] = i % 256; });
  const bytes = rasterBands(bitmap);
  const heights: number[] = [];
  const data: number[] = [];
  for (let at = 0; at < bytes.length;) {
    assert.deepEqual(Array.from(bytes.subarray(at, at + 6)), [0x1D, 0x76, 0x30, 0x00, 1, 0]);
    const rows = bytes[at + 6] + bytes[at + 7] * 256;
    heights.push(rows);
    data.push(...bytes.subarray(at + 8, at + 8 + rows));
    at += 8 + rows;
  }
  assert.deepEqual(heights, [255, 255, 90]);
  assert.deepEqual(data, Array.from(bitmap.data));
});

test('a full 80 mm image uses xL=72 and xH=0', () => {
  const bytes = rasterBands(image(576, 2, 0xFF));
  assert.deepEqual(Array.from(bytes.subarray(0, 8)), [0x1D, 0x76, 0x30, 0x00, 72, 0, 2, 0]);
  assert.equal(bytes.length, 8 + 72 * 2);
});

test('empty and too-wide images are rejected', () => {
  assert.throws(() => buildPrintJob(image(16, 0)));
  assert.throws(() => buildPrintJob({width: 0, height: 0, data: new Uint8Array()}));
  assert.throws(() => buildPrintJob(image(584, 1)));
});
