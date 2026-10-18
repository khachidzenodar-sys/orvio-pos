import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {buildPrintJob, rasterBands} from '../lib/printing/escpos.ts';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {toBitmap} from '../lib/printing/bitmap.ts';

// Tester 1: header fields, band boundaries and pixel → bit mapping end to end.
test('576×510 job: two full bands, xL=72 xH=0, yL/yH little-endian, cut at the end', () => {
  const rgba = new Uint8ClampedArray(576 * 510 * 4).fill(255);
  for (let y = 0; y < 510; y++) { const i = (y * 576 + (y % 576)) * 4; rgba[i] = rgba[i + 1] = rgba[i + 2] = 0; }
  const job = buildPrintJob(toBitmap(rgba, 576, 510));
  assert.equal(job.length, 2 + 2 * (8 + 72 * 255) + 7);
  assert.deepEqual(Array.from(job.subarray(2, 10)), [0x1D, 0x76, 0x30, 0, 72, 0, 255, 0]);
  const second = 2 + 8 + 72 * 255;
  assert.deepEqual(Array.from(job.subarray(second, second + 8)), [0x1D, 0x76, 0x30, 0, 72, 0, 255, 0]);
  // Row 0: pixel x=0 black → first byte 0x80. Row 256 (second band row 1): x=256 → byte 32, bit 0x80.
  assert.equal(job[10], 0x80);
  assert.equal(job[second + 8 + 72 + 32], 0x80);
  assert.deepEqual(Array.from(job.subarray(-7)), [0x1B, 0x64, 0x04, 0x1D, 0x56, 0x42, 0x00]);
});

test('height above 255 in one band is encoded little-endian', () => {
  const bands = rasterBands({width: 8, height: 300, data: new Uint8Array(300)}, 1000);
  assert.deepEqual(Array.from(bands.subarray(0, 8)), [0x1D, 0x76, 0x30, 0, 1, 0, 300 & 0xFF, 1]);
  assert.equal(bands.length, 8 + 300);
});

test('exact multiple of the band size makes no empty trailing band', () => {
  const bands = rasterBands({width: 8, height: 255, data: new Uint8Array(255)});
  assert.equal(bands.length, 8 + 255);
});
